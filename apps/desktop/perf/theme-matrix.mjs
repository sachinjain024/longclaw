#!/usr/bin/env node
/**
 * The visual regression matrix (V0-37): the real `App` over the perf harness's
 * stubbed IPC, driven through the core states in every theme preset × both
 * appearances, with rendered-style checks that fail the run — not a timing
 * job, so it holds on a shared CI runner where the interaction budgets cannot
 * (see ci.yml's note on the removed perf job).
 *
 * Two kinds of probe, per state:
 *   - contrast: computed text color against the effective (composited)
 *     background must clear WCAG AA 4.5:1. `scripts/a11y-check.mjs` proves the
 *     tokens can; this proves the components paired them correctly.
 *   - token: the element renders exactly the token named — the
 *     actor-distinction contract. An agent-attributed element carrying the
 *     human accent is a one-line CSS mistake no other check can see.
 * A probe that matches nothing fails: a renamed class must not hollow the
 * matrix silently.
 *
 * Screenshots of every state × axis land in dist-matrix/ as the visual
 * record; the exit code is the gate.
 *
 * Usage: npm run matrix   (vite build --config perf/vite.config.ts first)
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../dist-matrix");
mkdirSync(OUT, { recursive: true });

const THEMES = ["indigo", "clay", "slate", "plum"];
const APPEARANCES = ["light", "dark"];
/** Small board: the matrix checks colors, not scale. */
const TICKETS = 24;
const AA_TEXT = 4.5;
/** The two accents must stay visibly apart once rendered. */
const MIN_ACCENT_DELTA_E = 10;
/** Summed RGB movement a hover/press/focus must produce to count as feedback. */
const MIN_FEEDBACK_DELTA = 6;

/* ---------- color math (node side) ---------- */

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) =>
  0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** CIE76 ΔE over Lab, enough to assert "not the same color". */
const deltaE = (a, b) => {
  const toLab = ([r, g, b2]) => {
    const [x, y, z] = (() => {
      const [lr, lg, lb] = [r, g, b2].map((v) => lin(v / 255));
      return [
        0.4124 * lr + 0.3576 * lg + 0.1805 * lb,
        0.2126 * lr + 0.7152 * lg + 0.0722 * lb,
        0.0193 * lr + 0.1192 * lg + 0.9505 * lb,
      ];
    })();
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [x / 0.95047, y / 1, z / 1.08883].map(f);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/* ---------- probes ---------- */

/**
 * `contrast` probes: text color vs effective background ≥ AA. `token` probes:
 * the property renders exactly the named `--lc-*` value. `distinct` pairs are
 * checked per state after sampling.
 */
/**
 * The interaction probes run on the board, where every control the design
 * system gives a hover or a press is on screen at once: the primary action, a
 * secondary, a card, and the one text field in the header.
 *
 * They name *variants*, not the screens the variants happen to sit on, so a
 * probe should be repointed rather than dropped when a control moves. The
 * secondary below has moved once already (LC-163).
 */
const BOARD_FEEDBACK = [
  {
    selector: ".content-header .primary",
    property: "background-color",
    action: "hover",
  },
  {
    selector: ".content-header .primary",
    property: "background-color",
    action: "press",
  },
  {
    // Resting on `surface` in light and `raised` in dark — the appearance where
    // hovering to `wash` was a move to its own colour.
    //
    // The sidebar's `Create project`, not the header: LC-70 turned the header's
    // `Star` / `Settings` text buttons into one gear icon button, and the only
    // `.secondary` left there is the `DEV_CHROME`-gated Rebuild index button
    // (`App.tsx:1212`, `devChrome.ts:8`), which a production harness build
    // never renders. The probe matched nothing for two weeks and said so only
    // after the `:has-text("Settings")` abort below stopped hiding it (LC-163).
    selector: ".project-actions .secondary",
    property: "background-color",
    action: "hover",
  },
  {
    // The card's hover is a border in light and a fill in dark; the border is
    // the channel present in both. `:not(.acknowledged)` because the first card
    // wears the external-update acknowledgement, whose border deliberately
    // outranks hover — an acknowledged card keeps saying an agent touched it
    // while you point at it, so probing that one would assert the opposite of
    // the design.
    selector: ".ticket-row:not(.acknowledged)",
    property: "border-top-color",
    action: "hover",
  },
  {
    // `components.md:30` — focus is the ring *and* an accent border on the
    // control, and the border is the half a computed style can read.
    selector: ".filter-field",
    property: "border-top-color",
    action: "focus",
  },
  {
    // The `⋮` on a side-panel project row (LC-208). It is a control sitting
    // inside a row that has a hover of its own, so its own hover has to be a
    // visible step *above* the row's — they were both `line-soft`, which made
    // pointing at the control look exactly like pointing at the row, and it
    // was the first thing a person noticed about the menu.
    selector: ".row-menu-button",
    property: "background-color",
    action: "hover",
    // The two fills a project row can be wearing under it: `wash` when hovered
    // and `accent-human-soft` when it is the open project.
    distinctFromTokens: ["--lc-wash", "--lc-accent-human-soft"],
  },
];

const STATES = [
  {
    name: "board",
    contrast: [
      ".ticket-row strong",
      ".ticket-row .ticket-key",
      ".ticket-row.acknowledged-agent .actor",
      ".ticket-row.acknowledged-unknown .actor",
      ".board-column h3",
      ".project-link strong",
      // Was `.eyebrow` — the `LOCAL PROJECT` one, which the one-row header
      // dropped — then `.project-path`, until LC-68 made the path a chip. The
      // path is still the header's quiet text, which is the pairing this probe
      // exists to prove; the chip carries `ink-2` where the bare `<code>` was
      // `ink-3`, so the probe now measures a slightly easier pair, not a
      // different one.
      ".content-header .path-chip",
      ".content-header .primary",
    ],
    token: [
      {
        selector: ".content-header .primary",
        property: "background-color",
        token: "--lc-accent-human",
      },
      {
        // The trace strip is dev-only chrome (devChrome.ts) and this build is
        // a release build, so the agent-accent contract is proven on the
        // designed element instead: the acknowledged card's footer.
        selector: ".ticket-row.acknowledged-agent .actor",
        property: "color",
        token: "--lc-accent-agent-text",
      },
      {
        // And the other half of the same contract: a change nothing claimed
        // wears `warn`, not the agent's green (LC-148).
        selector: ".ticket-row.acknowledged-unknown .actor",
        property: "color",
        token: "--lc-warn",
      },
    ],
    distinct: [
      {
        label: "human accent vs agent accent",
        a: {
          selector: ".content-header .primary",
          property: "background-color",
        },
        b: {
          selector: ".ticket-row.acknowledged-agent .actor",
          property: "color",
        },
      },
      {
        // The row that used to fail: an unattributed change wore the full agent
        // treatment *and* the warn triangle. Two cards side by side, one
        // attributed and one not, must not read as the same event kind — in
        // every theme, since a theme swaps the agent's hue but never `warn`'s.
        label: "agent accent vs unattributed warn",
        a: {
          selector: ".ticket-row.acknowledged-agent .actor",
          property: "color",
        },
        b: {
          selector: ".ticket-row.acknowledged-unknown .actor",
          property: "color",
        },
      },
    ],
  },
  {
    name: "list",
    contrast: [
      ".list-row strong",
      ".list-row-key",
      ".list-group-header",
      ".content-header .path-chip",
    ],
    token: [],
    distinct: [],
  },
  {
    name: "panel",
    contrast: [
      ".panel-title",
      ".entry-heading strong",
      ".timeline-entry.agent .entry-heading strong",
      ".agent-badge",
      ".entry-meta",
      ".checklist label",
      // LC-97 and LC-98: both took `--lc-tile`, the one background token that
      // is near-black in *both* appearances, and left their ink to
      // inheritance — so every backtick in a description painted itself. The
      // matrix was green throughout, because no probe read a code surface.
      // These do, in every preset and both appearances — including code inside
      // a link, which keeps the link's accent rather than the code ink and so
      // is the one pairing naming that ink could have broken.
      ".markdown code",
      ".markdown-code",
      ".markdown a code",
      // The prompt glyph is the agent accent's only appearance on the tile now
      // that the tile is `--lc-tile` rather than a fill (components.md:179), so
      // it has to clear AA against that near-black in every preset.
      ".timeline .actor-tile.agent",
    ],
    token: [
      {
        // Was the tile's `background-color` while the tile was a fill; the
        // accent moved to the glyph, so the probe follows it rather than
        // being dropped.
        selector: ".timeline .actor-tile.agent",
        property: "color",
        token: "--lc-accent-agent",
      },
      {
        selector: ".agent-badge",
        property: "color",
        token: "--lc-accent-agent-text",
      },
      {
        // Contrast alone would pass a link that had quietly become body ink:
        // `code-ink` on `code-surface` is a fine ratio and the wrong colour.
        // This pins the affordance rather than the legibility.
        selector: ".markdown a code",
        property: "color",
        token: "--lc-accent-human-text",
      },
    ],
    distinct: [
      {
        // The human accent used to be read off the composer's `Comment`
        // button. That button is `secondary` now and only exists once there is
        // something to post (LC-107), so it carries neither the accent nor a
        // guaranteed presence in this state. The description's link carries
        // `--lc-accent-human-text` and is already probed for contrast two
        // entries up, so the pair is read off a surface this state is known to
        // render rather than off one that comes and goes.
        label: "agent tile vs human accent",
        a: {
          selector: ".timeline .actor-tile.agent",
          property: "color",
        },
        b: { selector: ".markdown a", property: "color" },
      },
    ],
  },
  {
    // The other half of the panel's timeline (LC-211). A change entry's
    // anatomy — the actor name in its own accent, the badge beside it — is
    // drawn under Activity, and the message anatomy above is drawn under
    // Comments, so neither tab can report on both and the states are two.
    name: "panel-activity",
    contrast: [".change-actor", ".agent-badge", ".entry-meta"],
    token: [
      {
        // The agent's own, not any actor's: `.change-actor` is the name on
        // every change entry and a person's wears ink (`styles.css:3013`).
        // The accent contract is about the one the agent wrote.
        selector: ".timeline-entry.agent .change-actor",
        property: "color",
        token: "--lc-accent-agent-text",
      },
    ],
    distinct: [],
  },
  {
    name: "menu",
    contrast: [".menu-popover .menu-label"],
    token: [],
    distinct: [],
  },
  {
    name: "ordering-menu",
    contrast: [".menu-popover .menu-label"],
    token: [],
    distinct: [],
  },
  {
    name: "palette",
    contrast: [
      ".command-palette input",
      ".palette-label",
      ".command-palette footer",
    ],
    token: [],
    distinct: [],
  },
  {
    name: "quick-create",
    contrast: [".quick-create-modal .eyebrow", ".quick-create-modal .primary"],
    token: [],
    distinct: [],
  },
  {
    // The gear's menu (LC-208), which is the first surface a person meets on
    // the way to settings and takes ink of its own: rows, the quiet right-hand
    // hints, and the captions that say which theme axis is which.
    name: "settings-menu",
    contrast: [".menu-popover .menu-label", ".menu-popover .menu-hint"],
    token: [],
    distinct: [],
  },
  {
    name: "theme-submenu",
    contrast: [".menu-sub .menu-label", ".menu-sub .menu-caption"],
    token: [],
    distinct: [],
  },
  {
    name: "settings",
    contrast: [".theme-option-name", ".settings-panel label"],
    token: [],
    distinct: [],
  },
  {
    name: "error",
    contrast: [".error-banner strong", ".error-banner span"],
    token: [],
    distinct: [],
  },
];

/* ---------- the in-page sampler ---------- */

/** Serialized into the page: samples computed colors and effective background. */
const SAMPLER = `(() => {
  const parse = (value) => {
    let match = value.match(/rgba?\\(([^)]+)\\)/);
    if (match) {
      const parts = match[1].split(",").map((part) => parseFloat(part));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    match = value.match(/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)/);
    if (match) {
      return {
        r: parseFloat(match[1]) * 255,
        g: parseFloat(match[2]) * 255,
        b: parseFloat(match[3]) * 255,
        a: match[4] === undefined ? 1 : parseFloat(match[4]),
      };
    }
    // color-mix() serializes as oklab() in WebKit, and every hover, press,
    // soft and wash token in this system is a color-mix — so without this a
    // probe on any of them reads as unparseable rather than as a colour.
    match = value.match(/oklab\\(([-\\d.]+) ([-\\d.]+) ([-\\d.]+)(?: \\/ ([\\d.]+))?\\)/);
    if (match) {
      const [L, A, B] = [1, 2, 3].map((index) => parseFloat(match[index]));
      const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
      const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
      const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
      const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      ];
      const encode = (channel) => {
        const clamped = Math.min(1, Math.max(0, channel));
        const srgb =
          clamped <= 0.0031308
            ? 12.92 * clamped
            : 1.055 * clamped ** (1 / 2.4) - 0.055;
        return srgb * 255;
      };
      return {
        r: encode(linear[0]),
        g: encode(linear[1]),
        b: encode(linear[2]),
        a: match[4] === undefined ? 1 : parseFloat(match[4]),
      };
    }
    if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    return undefined;
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const effectiveBackground = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0) {
        layers.push(color);
        if (color.a === 1) break;
      }
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) result = over(layers.pop(), result);
    return result;
  };
  window.__matrixSample = (selector, property) => {
    const element = document.querySelector(selector);
    if (!element) return { missing: true };
    const style = getComputedStyle(element);
    // getPropertyValue, not indexed access: CSSStyleDeclaration exposes
    // camelCase keys, so style["border-top-color"] is undefined and every
    // dashed probe would read as unparseable.
    const raw = style.getPropertyValue(property);
    const value = parse(raw);
    if (!value) return { unparsed: raw || "(empty)" };
    const composited = property === "background-color" && value.a < 1
      ? undefined
      : value;
    return {
      value: composited ?? value,
      background: effectiveBackground(
        property === "background-color" ? element.parentElement ?? element : element,
      ),
      disabled: element.matches(":disabled, [aria-disabled='true']"),
    };
  };
  /*
   * A token resolved the way the page would paint it, which __matrixToken
   * cannot do: half this system's surface tokens are color-mix(), and
   * getPropertyValue hands those back unresolved. Painting one on a throwaway
   * element and reading it back is what turns it into channels.
   *
   * No backticks and no interpolation in here: this whole block is a template
   * literal on the Node side, so either would be read at build time.
   */
  window.__matrixColor = (token) => {
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.width = "1px";
    probe.style.height = "1px";
    probe.style.pointerEvents = "none";
    probe.style.backgroundColor = "var(" + token + ")";
    document.body.appendChild(probe);
    const value = parse(getComputedStyle(probe).backgroundColor);
    probe.remove();
    return value ? { value } : { raw: token };
  };
  window.__matrixToken = (token) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const hex = raw.match(/^#([0-9a-fA-F]{6})$/);
    if (!hex) return { raw };
    const value = parseInt(hex[1], 16);
    return { value: { r: value >> 16, g: (value >> 8) & 255, b: value & 255, a: 1 } };
  };
})()`;

/* ---------- drive ---------- */

const preview = await startPreview();

const failures = [];
/** Probes exempted from the AA gate, reported so the exemption is never silent. */
const exempt = [];
const rgb = (c) => [Math.round(c.r), Math.round(c.g), Math.round(c.b)];

const browser = await webkit.launch();
try {
  for (const theme of THEMES) {
    for (const appearance of APPEARANCES) {
      const axis = `${theme}-${appearance}`;
      const page = await browser.newPage({
        viewport: { width: 1_440, height: 900 },
        // The matrix checks colors, not motion, and it flips theme/appearance
        // from script: reduced motion zeroes the --lc-motion-* tokens, so a
        // transition can never be mid-flight when a probe samples it.
        reducedMotion: "reduce",
      });
      await page.goto(`${preview.origin}/?tickets=${TICKETS}`);
      await page.waitForFunction(
        () => document.querySelectorAll(".ticket-row").length > 0,
      );
      // The two attributes `App` actually stamps (`App.tsx:745,782`), in the
      // right order: the preset is `data-lc-theme` and the appearance is
      // `data-theme`, and the accent blocks are published on the **compound**
      // `[data-theme][data-lc-theme]` selector (`appearance.ts:7-12`).
      //
      // This used to write `data-theme = <preset>` and `data-appearance =
      // <light|dark>`. `data-appearance` is not a selector anywhere in the
      // product, and `[data-theme="clay"]` alone matches no accent block, so
      // every axis fell through to `:root` — light indigo. All eight rendered
      // byte-identically and the run reported "8 axes × 12 states clean" for
      // one axis checked eight times. Found while adding the settings menu's
      // states (LC-208), whose whole subject is preset swatches: they were the
      // one thing on screen that could not possibly have looked right.
      await page.evaluate(
        ([theme, appearance]) => {
          document.documentElement.dataset.lcTheme = theme;
          document.documentElement.dataset.theme = appearance;
        },
        [theme, appearance],
      );
      await page.evaluate(SAMPLER);

      // Two cards wearing the external-update acknowledgement, one per
      // vocabulary. The second carries no `attribution` at all, which is the
      // real shape of a change that appended no record — the case the app must
      // *not* dress in agent green (LC-148). Probing only the attributed card
      // would leave the warn treatment's contrast unmeasured in every theme,
      // and it is the pairing this change introduced.
      await page.evaluate(() => {
        // Consecutive envelope sequences, because a repeat is dropped as stale
        // and a skip asks the app to resync (`state.ts:190,198`).
        let envelope = 0;
        const emit = (key, attribution) => {
          const sequence = Number(key.replace("PF-", ""));
          window.__longclawPerf.emit({
            contractVersion: 1,
            sequence: ++envelope,
            projectId: "019c8ca0-0000-7000-8000-0000000000ff",
            emittedAt: "2026-07-31T00:00:00Z",
            event: {
              type: "ticketChanged",
              data: {
                source: "external",
                coalescedEvents: 1,
                detectedInMs: 1,
                ...(attribution ? { attribution } : {}),
                ticket: {
                  state: "indexed",
                  key,
                  id: `matrix-${sequence}`,
                  title: `Searchable storage ticket ${sequence}`,
                  status: "backlog",
                  priority: "none",
                  labels: ["storage"],
                  createdAt: "2026-07-29T00:00:00Z",
                  updatedAt: "2026-07-31T00:00:00Z",
                  checkedCount: 0,
                  checklistCount: 1,
                  commentCount: 0,
                  attachmentCount: 0,
                  contentHash: "hash-matrix",
                  relativePath: `.longclaw/tickets/${key}/ticket.md`,
                },
              },
            },
          });
        };
        const keys = [...document.querySelectorAll(".ticket-row")]
          .slice(0, 2)
          .map((row) => row.getAttribute("data-ticket-key") ?? "");
        emit(keys[0], {
          id: "evt_1",
          kind: "update",
          occurredAt: "2026-07-31T00:00:00Z",
          actor: { type: "agent", name: "Claude Code" },
        });
        emit(keys[1], undefined);
      });
      await page.waitForSelector(".ticket-row.acknowledged-agent", {
        timeout: 5_000,
      });
      await page.waitForSelector(".ticket-row.acknowledged-unknown", {
        timeout: 5_000,
      });

      const check = async (state) => {
        for (const selector of state.contrast) {
          const sample = await page.evaluate(
            ([selector]) => window.__matrixSample(selector, "color"),
            [selector],
          );
          if (sample.missing || sample.unparsed) {
            failures.push(
              `${axis} ${state.name}: probe ${selector} ${sample.missing ? "matched nothing" : `unparsed ${sample.unparsed}`}`,
            );
            continue;
          }
          const ratio = contrast(rgb(sample.value), rgb(sample.background));
          // WCAG 1.4.3 exempts an inactive component, and `--lc-ink-disabled`
          // on `--lc-wash` is the designed unavailable state (components.md:32)
          // — it is below AA on purpose, because that is what "you cannot use
          // this" looks like. The exemption is reported rather than silent: a
          // probe that goes disabled when it should not is a finding too, and a
          // quiet skip would hide it.
          if (sample.disabled) {
            exempt.push(
              `${axis} ${state.name}: ${selector} is disabled — contrast ${ratio.toFixed(2)} not held to AA`,
            );
            continue;
          }
          if (ratio < AA_TEXT) {
            failures.push(
              `${axis} ${state.name}: ${selector} contrast ${ratio.toFixed(2)} < ${AA_TEXT}`,
            );
          }
        }
        for (const probe of state.token) {
          const sample = await page.evaluate(
            ([selector, property]) => window.__matrixSample(selector, property),
            [probe.selector, probe.property],
          );
          const token = await page.evaluate(
            ([token]) => window.__matrixToken(token),
            [probe.token],
          );
          if (sample.missing || sample.unparsed || !token.value) {
            failures.push(
              `${axis} ${state.name}: token probe ${probe.selector} ${sample.missing ? "matched nothing" : "unreadable"}`,
            );
            continue;
          }
          const drift = Math.max(
            ...["r", "g", "b"].map((channel) =>
              Math.abs(sample.value[channel] - token.value[channel]),
            ),
          );
          if (drift > 2) {
            failures.push(
              `${axis} ${state.name}: ${probe.selector} ${probe.property} is not ${probe.token} (off by ${drift.toFixed(0)}/255)`,
            );
          }
        }
        for (const pair of state.distinct) {
          const a = await page.evaluate(
            ([selector, property]) => window.__matrixSample(selector, property),
            [pair.a.selector, pair.a.property],
          );
          const b = await page.evaluate(
            ([selector, property]) => window.__matrixSample(selector, property),
            [pair.b.selector, pair.b.property],
          );
          if (a.missing || b.missing || a.unparsed || b.unparsed) {
            failures.push(
              `${axis} ${state.name}: distinction probe (${pair.label}) matched nothing`,
            );
            continue;
          }
          const delta = deltaE(rgb(a.value), rgb(b.value));
          if (delta < MIN_ACCENT_DELTA_E) {
            failures.push(
              `${axis} ${state.name}: ${pair.label} ΔE ${delta.toFixed(1)} < ${MIN_ACCENT_DELTA_E}`,
            );
          }
        }
        await page.screenshot({
          path: `${OUT}/${state.name}-${axis}.png`,
          animations: "disabled",
        });
      };

      /**
       * The interaction axis (Step 16a review): hover, press and focus are
       * states the design system specifies and nothing was holding.
       *
       * It asserts *difference*, not a token value, and deliberately so. The
       * hover and press fills are `color-mix` derivations, which
       * `getPropertyValue` hands back unresolved, so a token probe cannot read
       * them. Difference is also the property that actually matters and the one
       * that was broken: in dark, `--lc-wash` and `--lc-raised` are the same
       * colour, so a secondary button and a popover row — both resting on
       * `raised` — hovered to their own resting colour and gave no feedback at
       * all. A token probe would have passed that; this fails it.
       */
      const feedback = async (probe) => {
        const sample = () =>
          page.evaluate(
            ([selector, property]) => window.__matrixSample(selector, property),
            [probe.selector, probe.property],
          );
        const label = `${axis} interaction: ${probe.selector} ${probe.property} on ${probe.action}`;

        const rest = await sample();
        if (rest.missing || rest.unparsed) {
          failures.push(`${label} — probe matched nothing at rest`);
          return;
        }

        if (probe.action === "focus") await page.focus(probe.selector);
        else await page.hover(probe.selector);
        if (probe.action === "press") await page.mouse.down();

        // Two frames before sampling. Reduced motion collapses transitions to
        // 0.01ms rather than removing them, so the computed value still needs a
        // tick to leave its start colour — sampling in the same turn reads the
        // resting fill and every probe reports no feedback.
        await page.evaluate(
          () =>
            new Promise((done) =>
              requestAnimationFrame(() => requestAnimationFrame(done)),
            ),
        );

        const acted = await sample();
        if (probe.action === "press") {
          // Release *off* the control. A down-then-up on the same element is a
          // click, and clicking the board's primary opens quick create — whose
          // scrim then swallows every probe after this one.
          await page.mouse.move(0, 0);
          await page.mouse.up();
        } else if (probe.action === "focus") {
          await page.evaluate(() => document.activeElement?.blur());
        } else {
          await page.mouse.move(0, 0);
        }

        if (acted.missing || acted.unparsed) {
          failures.push(`${label} — probe matched nothing after the action`);
          return;
        }
        const moved = ["r", "g", "b"].reduce(
          (total, channel) =>
            total + Math.abs(acted.value[channel] - rest.value[channel]),
          0,
        );
        // Six across three channels is about the smallest step a person can
        // see on an adjacent fill; zero is the bug this exists to catch.
        if (moved < MIN_FEEDBACK_DELTA) {
          failures.push(
            `${label} — no visible feedback (moved ${moved.toFixed(0)}/765)`,
          );
        }

        // A control that sits *inside* something with a hover of its own has a
        // second thing to prove: that its lit fill is not the same colour as
        // the fill its container is wearing underneath it. Moving off its own
        // resting value is not enough — the `⋮` moved from transparent to
        // `line-soft`, which in light is the very same colour as the `wash` its
        // row hovers to, so the control was invisible at the one moment it is
        // meant to be visible.
        //
        // Against the *tokens* rather than against the parent as rendered,
        // because a row can be wearing either of two fills and the harness only
        // ever shows one of them: its board has a single project, so the only
        // row on screen is the selected one (`accent-human-soft`) and a probe
        // that read the live parent would never see the unselected case
        // (`wash`) — which is the case that was broken.
        for (const token of probe.distinctFromTokens ?? []) {
          const other = await page.evaluate(
            ([name]) => window.__matrixColor(name),
            [token],
          );
          if (!other.value) {
            failures.push(`${label} — ${token} is ${other.raw || "unset"}`);
            continue;
          }
          const apart = ["r", "g", "b"].reduce(
            (total, channel) =>
              total + Math.abs(acted.value[channel] - other.value[channel]),
            0,
          );
          if (apart < MIN_FEEDBACK_DELTA) {
            failures.push(
              `${label} — its fill is ${token} (${apart.toFixed(0)}/765 apart), so it vanishes on a row wearing that`,
            );
          }
        }
      };

      const state = (name) => STATES.find((entry) => entry.name === name);

      await check(state("board"));
      for (const probe of BOARD_FEEDBACK) await feedback(probe);

      await page.click('button:has-text("List")');
      await page.waitForSelector(".list-row");
      await check(state("list"));
      await feedback({
        selector: ".list-row",
        property: "background-color",
        action: "hover",
      });
      await page.click('button:has-text("Board")');
      await page.waitForSelector(".ticket-row");

      await page.click(".ticket-row");
      // The panel opens on Comments (LC-211), which is where the message
      // anatomy is: the tile, the name heading, the body and its code.
      await page.waitForSelector(".timeline-entry.agent");
      await check(state("panel"));

      // And the change anatomy is under Activity — a comment is one line
      // there, so the actor name in the agent accent is on a change entry or
      // it is nowhere.
      await page.click('[role="tab"]:has-text("Activity")');
      await page.waitForSelector(".change-actor");
      await check(state("panel-activity"));
      await page.click('[role="tab"]:has-text("Comments")');

      await page.click(".meta-grid .menu-trigger");
      await page.waitForSelector(".menu-popover");
      await check(state("menu"));
      // The popover sits on `raised`, which is the other half of the dark
      // hover collision — its rows have to move too.
      await feedback({
        selector: ".menu-popover .menu-row",
        property: "background-color",
        action: "hover",
      });
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape"); // and the panel

      await page.click(".ordering-control .menu-trigger");
      await page.waitForSelector(".menu-popover");
      await check(state("ordering-menu"));
      await page.keyboard.press("Escape");

      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".command-palette");
      await check(state("palette"));
      await page.keyboard.press("Escape");

      await page.click('button:has-text("New ticket")');
      await page.waitForSelector(".quick-create-modal");
      await check(state("quick-create"));
      await page.keyboard.press("Escape");

      // By class, not by text: the control is a gear icon button whose label is
      // an `aria-label`, so `:has-text()` cannot see it and the run died here
      // for two weeks (LC-70 → LC-163). It opens a menu since LC-208, and the
      // menu is a surface of its own — the rows, the captions and the swatches
      // all take colour, so it is checked before the panel it opens.
      await page.click(".settings-button");
      await page.waitForSelector(".menu-popover");
      await check(state("settings-menu"));

      // Into the theme submenu, which is where both accents are drawn side by
      // side in a popover rather than in a panel (LC-208).
      await page.click('.menu-popover .menu-row:has-text("Theme")');
      await page.waitForSelector(".menu-sub");
      await check(state("theme-submenu"));
      await page.keyboard.press("Escape");

      // `All settings…` is the row that opens the panel; the nav lands on
      // `Theme`, which is the section the picker lives in.
      await page.click('.menu-popover .menu-row:has-text("All settings")');
      await page.waitForSelector(".settings-panel");
      await page.click('.settings-nav-row:has-text("Theme")');
      await page.waitForSelector(".theme-picker");
      await check(state("settings"));

      // Back to General for the rename, and by its row rather than by "the
      // first input in the panel": the section carries a disabled Key field,
      // and only one input in it is meant to be typed into.
      await page.click('.settings-nav-row:has-text("General")');
      await page.fill(".settings-identity input:not([disabled])", "Renamed");
      // It commits on `Enter` — the `Rename` button beside it went with LC-125,
      // because pressing `Done` with a typed name used to discard it silently.
      await page.keyboard.press("Enter");
      // The banner is on the main panel, behind the panel — `Esc` takes the
      // panel down so the error state is rendered as a user would meet it.
      await page.keyboard.press("Escape");
      await page.waitForSelector(".error-banner");
      await check(state("error"));

      await page.close();
      console.log(`${axis}: checked ${STATES.length} states`);
    }
  }
} finally {
  await browser.close();
  await preview.close();
}

if (exempt.length > 0) {
  console.log(
    `\ntheme matrix: ${exempt.length} probe(s) exempt from the AA gate`,
  );
  for (const note of exempt) console.log(`  ${note}`);
}
if (failures.length > 0) {
  console.error(`\ntheme matrix: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `\ntheme matrix: ${THEMES.length * APPEARANCES.length} axes × ${STATES.length} states clean — renders in ${OUT}`,
);
