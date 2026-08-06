#!/usr/bin/env node
/**
 * The tile-ink guard: nothing painted on `--lc-tile` may leave its ink to
 * inheritance, and the ink it does name has to be readable on it.
 *
 * `--lc-tile` is the one background token that is **near-black in both
 * appearances** — `#171923` light, `#060709` dark — because it is the agent's
 * terminal window in miniature (`design-tokens.json`, `components.md:152-157`).
 * Every other surface token flips with the appearance, so a box that takes one
 * and inherits `--lc-ink` reads correctly in both. A box on the tile does not:
 * in light appearance the inherited ink *is* `#171923`, the tile's own value,
 * and the contrast is 1.0 — text painted on itself.
 *
 * That is LC-97 and LC-98 exactly. `.markdown code` and `.markdown-code` took
 * the tile for inline and fenced code, named no `color`, and every ticket
 * description with a backtick in it rendered its code as solid black blocks.
 * Neither declaration is wrong on its own — `background: var(--lc-tile)` is a
 * real token used correctly by the agent avatar, and naming no `color` is what
 * nearly every rule in `styles.css` does. What is wrong is the pair, which is
 * why `color-guard.mjs` and `token-guard.mjs` could not see it: both read one
 * declaration at a time, and both were green while the panel was unreadable.
 *
 * So this reads the pair, and then reads the values:
 *
 *   1. A rule that declares `background: var(--lc-tile)` must declare `color`.
 *      Inheritance is not an answer here — what it inherits is the ink of a
 *      surface the tile is not.
 *   2. That `color` must be a `--lc-*` token this can resolve, and it must
 *      clear WCAG AA body text (4.5:1) against the tile in **both**
 *      appearances and **every** theme. The accents move per theme, so a ratio
 *      checked once is a ratio checked for indigo.
 *   3. Every mention of `--lc-tile` in the stylesheet must belong to a rule
 *      this read. One rule matches today, so without that count a single edit
 *      to how the background is written would leave the guard checking nothing
 *      and still exiting 0.
 *
 * The rendered counterpart is the theme matrix's `panel` state, which measures
 * the same pair in WebKit after the cascade has run and catches what a reader
 * of the source cannot. This is the cheap check that runs in `tokens:check` on
 * every commit; that is the true one that needs a browser.
 *
 * Scoped to the tile deliberately. The same pair over every background token
 * would fire on the hundred-odd rules that inherit their ink correctly, since
 * inheriting is the right default anywhere the surface flips with the
 * appearance. The tile is the one token where it never is.
 *
 * **What this does not check.** The `color` in the *same* rule, which is the
 * whole comparison only while no later rule re-colors the same element. Today
 * none does: `.actor-tile.unknown` is the one rule that re-colors an actor
 * tile, and `Timeline.tsx:130` emits `actor-tile agent` or `actor-tile
 * unknown`, never both, so it never lands on a tile background. A rule that
 * overrode the ink on a tile *would* pass here and could still be dark-on-dark
 * — the fix if that ever ships is to resolve the cascade, not to widen the
 * regex.
 *
 * Usage: node scripts/tile-contrast-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(join(src, "styles.css"), "utf8");
const tokens = JSON.parse(
  readFileSync(join(src, "tokens/design-tokens.json"), "utf8"),
);

const APPEARANCES = ["light", "dark"];
/** WCAG AA for body text. Inline code is body text at 12px; nothing here is large. */
const AA = 4.5;

/* ---------- resolving a token to its hues ---------- */

/**
 * `--lc-*` name → `{ [theme]: { light, dark } }`, for the color tokens that
 * carry a literal hue. Derived tokens (`color-mix`) are absent on purpose: a
 * mix resolves against whatever surface it lands on, so a ratio computed for
 * one is a guess. An unresolvable ink is reported rather than skipped.
 */
const THEMES = Object.keys(tokens.themes).filter((name) => name !== "note");
const sameInEveryTheme = (value) =>
  Object.fromEntries(THEMES.map((theme) => [theme, value]));

const PREFIX = { status: "status-", priority: "priority-", label: "label-" };

const palette = new Map();
const add = (name, value) => palette.set(`--lc-${name}`, value);
for (const group of ["neutral", "status", "priority", "feedback", "label"]) {
  for (const [key, value] of Object.entries(tokens.color[group])) {
    if (key === "note") continue;
    /* `status.done` is the string `"accent.human"` rather than a hue —
       `build.mjs` skips it here and derives it from the theme accent. Admitting
       it would parse `"ac"` as hex and report the ratio as `NaN`. */
    if (group === "status" && key === "done") continue;
    if (typeof value.light !== "string") continue;
    add(`${PREFIX[group] ?? ""}${key}`, sameInEveryTheme(value));
    /* A priority may carry its own mark ink (`build.mjs`'s `mark-<app>`). It is
       a real token a rule can name, so leaving it out would report a correct
       ink as one this cannot resolve. */
    if (value["mark-light"] && value["mark-dark"]) {
      add(
        `${PREFIX[group]}${key}-mark`,
        sameInEveryTheme({
          light: value["mark-light"],
          dark: value["mark-dark"],
        }),
      );
    }
  }
}
const ACCENTS = {
  "accent-human": "human",
  "accent-human-text": "human-text",
  "on-accent-human": "on-human",
  "accent-agent": "agent",
  "accent-agent-text": "agent-text",
  "on-accent-agent": "on-agent",
};
for (const [name, role] of Object.entries(ACCENTS)) {
  add(
    name,
    Object.fromEntries(
      THEMES.map((theme) => [theme, tokens.themes[theme][role]]),
    ),
  );
}

/* ---------- contrast ---------- */

const channel = (part) =>
  part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;

/**
 * Relative luminance per WCAG 2.1, for a 6-digit hex.
 *
 * Every hue in the token file is `#rrggbb` today and nothing enforces that, so
 * anything else returns `undefined` rather than the `NaN` that would otherwise
 * flow into a ratio and print as a finding nobody can act on. The caller turns
 * that into a finding that says so.
 */
function luminance(hex) {
  const value = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return undefined;
  const [r, g, b] = [0, 2, 4].map((at) =>
    channel(parseInt(value.slice(at, at + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The ratio, or `undefined` if either side is not a hue this can read. */
function contrast(a, b) {
  const both = [luminance(a), luminance(b)];
  if (both.some((value) => value === undefined)) return undefined;
  const [hi, lo] = both.sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- the rules that paint the tile ---------- */

const declaration = (body, property) =>
  body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();

const rules = cssRules(styles);

const findings = [];
let checked = 0;
for (const [where, body] of rules) {
  if (declaration(body, "background") !== "var(--lc-tile)") continue;
  checked += 1;

  const ink = declaration(body, "color");
  if (!ink) {
    findings.push(
      `${where} — paints \`--lc-tile\` and names no \`color\`, so it inherits ` +
        `the ink of a surface the tile is not (1.0:1 in light appearance)`,
    );
    continue;
  }

  const token = ink.match(/^var\((--lc-[a-z0-9-]+)\)$/)?.[1];
  const hues = token && palette.get(token);
  if (!hues) {
    findings.push(
      `${where} — \`color: ${ink}\` is not a token whose hue this can resolve, ` +
        `so its contrast against \`--lc-tile\` cannot be checked`,
    );
    continue;
  }

  /* One finding per distinct hue, not per theme. A neutral ink is the same
     value in all four, and four identical lines about it read as four
     defects. Themes are named only where the token actually moves between
     them, which is where naming them tells the reader something. */
  for (const appearance of APPEARANCES) {
    const byHue = new Map();
    for (const theme of THEMES) {
      const hue = hues[theme][appearance];
      byHue.set(hue, [...(byHue.get(hue) ?? []), theme]);
    }
    for (const [hue, themes] of byHue) {
      const ratio = contrast(tokens.color.neutral.tile[appearance], hue);
      const scope =
        themes.length === THEMES.length
          ? `${appearance} appearance`
          : `${appearance} appearance (${themes.join(", ")})`;
      if (ratio === undefined) {
        findings.push(
          `${where} — \`${token}\` is \`${hue}\`, which is not a 6-digit hex, ` +
            `so its contrast against \`--lc-tile\` in ${scope} cannot be read`,
        );
      } else if (ratio < AA) {
        findings.push(
          `${where} — \`${token}\` on \`--lc-tile\` is ${ratio.toFixed(2)}:1 ` +
            `in ${scope}, under AA's ${AA}:1`,
        );
      }
    }
  }
}

/* The floor, and the reason this guard cannot go quiet.
 *
 * Everything above keys off the exact string `background: var(--lc-tile)`.
 * `background-color: var(--lc-tile)`, a shorthand with a position, or a
 * `var(--lc-tile, #000)` fallback all slip straight through the filter — and
 * because exactly one rule matches today, one such edit would leave nothing to
 * check while the script still exited 0. `guard.mjs` is explicit that this is
 * the failure mode these scripts exist to avoid: "A guard that passes silently
 * is one nobody can tell is still running."
 *
 * So the tile is counted twice, by two different methods, and the counts have
 * to agree: every mention of the token in the stylesheet must belong to a rule
 * this actually read. A mention it cannot account for is a finding naming the
 * rule, not a silence. */
const mentions = rules.filter(([, body]) => body.includes("var(--lc-tile)"));
if (mentions.length !== checked) {
  for (const [where, body] of mentions) {
    if (declaration(body, "background") === "var(--lc-tile)") continue;
    findings.push(
      `${where} — names \`--lc-tile\` in a form this guard does not read ` +
        `(it understands \`background: var(--lc-tile)\` alone), so its ink ` +
        `would go unchecked`,
    );
  }
}

report({
  name: "tile-contrast-guard",
  findings,
  checked,
  /* One tile surface is the normal case here, not the edge one — "1 tile
     surfaces clean" would be the pass line almost every run prints. */
  noun: checked === 1 ? "tile surface" : "tile surfaces",
  remedy:
    "unreadable tile surface(s) — name a light ink, or take --lc-code-surface:",
  clean: "every ink on the tile clears AA in both appearances",
});
