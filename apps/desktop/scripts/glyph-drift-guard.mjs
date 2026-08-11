#!/usr/bin/env node
/**
 * The glyph-drift guard: where a component redraws a master from
 * `assets/glyphs.svg` instead of referencing it, the two still draw the same
 * mark.
 *
 * The sheet's header licenses the copy — "components must consume the
 * `<symbol>`s (or copy the geometry) with tokens" — and copying is what every
 * glyph component here does, because an external `<use href="…#id">` renders
 * nothing in WebKit, which is the only engine this product ships in. So the
 * duplication is deliberate and permanent. What it leaves behind is a pair of
 * files that must agree and no reason they will: correcting a curve on the
 * sheet is a docs change, correcting it in the component is an app change, and
 * neither review sees the other. Both drifts this guard found on its first run
 * had been in the tree for months — `StatusDot` drawing r=4.4/4.6 where the
 * sheet and `components.md` § Status both say r=5, and dropping the filled
 * dot's stroke, which is the one thing that section says keeps a filled dot the
 * same visual weight as a ring.
 *
 * What is compared, and what deliberately is not:
 *
 *   geometry     — the ordered shape list: tag, `d`/`points`/box/circle
 *                  attributes, dash pattern, and the effective stroke width.
 *                  Numbers are normalised first, so `.9` and `0.9` are the same
 *                  number rather than a finding; a guard that fails the build
 *                  over how a number is spelled gets switched off.
 *   stroke width — resolved the way it renders, through the wrapper and the
 *                  stylesheet, not read off the element. The sheet puts 1.6 on
 *                  every path; `FormattingIcon` puts it once on the `<svg>`;
 *                  the specimen puts it in `.fglyph`. Three spellings of one
 *                  number, and only the resolved value can be compared.
 *   fill         — as `none` or `painted`, never by value. A mark the sheet
 *                  leaves open and a copy fills is drift; `currentColor` where
 *                  the sheet names `--lc-warn` is the contract working.
 *   colour       — not at all, for the same reason. The sheet pins tokens so it
 *                  renders standalone; a component inherits the ink of the
 *                  control it sits in.
 *
 * **Groups.** One component often draws a whole family: `StatusDot` is a single
 * `<circle>` that has to be all seven `status-*` masters. For those, `varies`
 * names the attributes the family is allowed to differ on, and the guard checks
 * three things rather than one — that the masters agree on everything *not*
 * declared varying, that they really do differ on everything that is (a dead
 * exemption is how a check quietly stops checking), and that the set of values
 * the component's ternaries can produce is exactly the set the masters hold.
 * That last one is what catches a dash pattern retuned in the component and
 * nowhere else.
 *
 * **What is not registered, and why.** `priority-p1`…`p4` are not copyable: the
 * sheet draws them with `<text>` and says so in its own comment — "in
 * components, render as a styled `<span>` so the chip uses the app's loaded
 * mono face" — and `PriorityGlyph` does. `priority-none` is the same dash as
 * its master (9 × 1.6, rx 0.8) re-framed into the chip P1–P4 wear, on its own
 * 9×2 viewBox rather than the 14×14 grid, so there is no grid to compare it on
 * (D-23). `checkbox-*` and `agent-tile` have no SVG copy in the app at all.
 *
 * The registry is this guard's one hand-maintained fact, so it is pinned to the
 * sheet: every `format-*`, `status-*` and `priority-*` symbol must be either
 * registered or listed in `NOT_COPIED` with its reason, and a new one arriving
 * fails the run rather than silently going unchecked.
 *
 * Usage: node scripts/glyph-drift-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declaredValues, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (path) => readFileSync(resolve(repo, path), "utf8");

const SHEET = "docs/design/foundations/assets/glyphs.svg";
const ICON = "apps/desktop/src/FormattingIcon.tsx";
const SPECIMEN = "docs/design/foundations/proof/components-library.html";
const STATUS = "apps/desktop/src/StatusDot.tsx";
const PRIORITY = "apps/desktop/src/PriorityGlyph.tsx";

/**
 * Which masters are redrawn where. The reader name says how to find the copy in
 * its file, because a JSX fragment, an inline `<svg>` in a proof page and a
 * whole component are three shapes of the same question.
 */
const COPIES = [
  {
    symbols: ["format-bold"],
    copies: [
      ["marks", ICON, "bold"],
      ["specimen", SPECIMEN, "Bold"],
    ],
  },
  {
    symbols: ["format-italic"],
    copies: [
      ["marks", ICON, "italic"],
      ["specimen", SPECIMEN, "Italic"],
    ],
  },
  {
    symbols: ["format-code"],
    copies: [
      ["marks", ICON, "code"],
      ["specimen", SPECIMEN, "Code"],
    ],
  },
  {
    symbols: ["format-list"],
    copies: [
      ["marks", ICON, "list"],
      ["specimen", SPECIMEN, "List"],
    ],
  },
  {
    symbols: ["format-task"],
    copies: [
      ["marks", ICON, "task"],
      ["specimen", SPECIMEN, "Task"],
    ],
  },
  {
    symbols: ["format-link"],
    copies: [
      ["marks", ICON, "link"],
      ["specimen", SPECIMEN, "Link"],
    ],
  },
  {
    symbols: ["folder"],
    copies: [["component", "apps/desktop/src/FolderGlyph.tsx"]],
  },
  {
    symbols: ["warn"],
    copies: [["component", "apps/desktop/src/WarnGlyph.tsx"]],
  },
  {
    // One circle, seven statuses. The fill is the state and the dash is
    // Backlog's alone; everything else is the Todo ring the set derives from
    // (`components.md` § Status).
    symbols: [
      "status-backlog",
      "status-todo",
      "status-in-progress",
      "status-in-review",
      "status-done",
      "status-canceled",
      "status-custom",
    ],
    copies: [["component", STATUS]],
    varies: ["fill", "stroke-dasharray"],
  },
  { symbols: ["priority-urgent"], copies: [["component", PRIORITY, "mark"]] },
];

/** Masters with no SVG copy in the app, and the reason there is none. */
const NOT_COPIED = {
  "priority-p1":
    "the sheet draws `<text>`; components render a styled `<span>`",
  "priority-p2":
    "the sheet draws `<text>`; components render a styled `<span>`",
  "priority-p3":
    "the sheet draws `<text>`; components render a styled `<span>`",
  "priority-p4":
    "the sheet draws `<text>`; components render a styled `<span>`",
  "priority-none":
    "the same dash, re-framed into the P1–P4 chip on a 9×2 viewBox (D-23)",
};

/** Every master this guard must have an answer for. */
const PINNED = /^(format|status|priority)-/;

const SHAPES = /<(path|rect|circle|polyline|ellipse|line)\b([^>]*?)\/?>/g;

/** Everything that decides what a shape looks like. */
const COMPARED = [
  "d",
  "points",
  "x",
  "y",
  "width",
  "height",
  "rx",
  "ry",
  "cx",
  "cy",
  "r",
  "x1",
  "y1",
  "x2",
  "y2",
  "stroke-width",
  "stroke-dasharray",
  "fill",
];

/** The three of those that an element takes from its `<svg>` or a stylesheet. */
const INHERITS = new Set(["stroke-width", "stroke-dasharray", "fill"]);

/**
 * `1.60` and `1.6` are one number, `.9` and `0.9` are one number, and `M3.5 2`,
 * `M3.5,2` and `M 3.5 2` are one path. Everything this guard compares goes
 * through here first, so a finding always means the mark changed.
 *
 * Path data is tokenised rather than pattern-substituted, because SVG lets
 * numbers run together — `.9.9` is two numbers, `1-1.4` is two numbers — and a
 * substitution that rewrites them in place can join two distinct paths into the
 * same string. Splitting first means every number is compared as a number.
 */
function normalise(value) {
  return (
    value
      .replace(/([A-Za-z])/g, " $1 ")
      .replace(/,/g, " ")
      // A `-` right after a digit starts the next number rather than subtracting.
      .replace(/(?<=[\d.])-/g, " -")
      // `.9.9` — the second `.` starts a new number.
      .replace(/(\.\d+)(?=\.)/g, "$1 ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) =>
        /^-?(\d+\.?\d*|\.\d+)$/.test(token) ? String(Number(token)) : token,
      )
      .join(" ")
  );
}

/**
 * The raw attribute text, or `null`. Reads SVG's `stroke-width` and JSX's
 * `strokeWidth`, and returns a `{…}` expression whole for `branchesOf`.
 *
 * The name may not be preceded by a word character *or a hyphen*: `\b` alone
 * matches the `width` inside `stroke-width`, which reports a stroke as a
 * geometry attribute and makes every copy look drifted.
 */
function attr(attrs, name) {
  const jsx = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  for (const key of new Set([name, jsx])) {
    const found = attrs.match(
      new RegExp(`(?<![\\w-])${key}\\s*=\\s*(?:"([^"]*)"|\\{([^}]*)\\})`),
    );
    if (found) return (found[1] ?? found[2]).trim();
  }
  return null;
}

/**
 * Every value one attribute can take. A literal is one; a ternary is its two
 * branches, which is how a component draws a family from one element.
 *
 * A scanner, not a JS parser: a nested ternary is reported rather than guessed
 * at, because silently reading one branch of it would check half a glyph.
 */
function branchesOf(expression, where, findings) {
  const question = expression.indexOf("?");
  if (question === -1) return [expression];
  const rest = expression.slice(question + 1);
  const colon = rest.lastIndexOf(":");
  const branches =
    colon === -1 ? [rest] : [rest.slice(0, colon), rest.slice(colon + 1)];
  if (branches.some((branch) => branch.includes("?"))) {
    findings.push(
      `${where} sets an attribute from a nested ternary, which this guard ` +
        "cannot read — give it one value per branch",
    );
    return [];
  }
  return branches;
}

/** `"none"` and `none` are one value; `undefined` is the attribute being absent. */
function valueOf(raw) {
  const bare = raw.trim().replace(/^["'`]|["'`]$/g, "");
  return bare === "undefined" ? null : bare;
}

/** Painted or not, never which paint. */
const asFill = (value) => (value && value !== "none" ? "painted" : "none");

/**
 * One shape as `{ tag, attrs }`, where every compared attribute maps to the set
 * of values it can take. `inherited` carries what the enclosing `<svg>` or
 * stylesheet already set, which the element may override — the resolution the
 * browser does, done here so three spellings of 1.6 compare equal.
 */
function shapeOf(tag, attrs, inherit, where, findings) {
  const values = {};
  for (const name of COMPARED) {
    const raw = attr(attrs, name) ?? inherit(name, attrs);
    const branches =
      raw === null ? [null] : branchesOf(raw, where, findings).map(valueOf);
    values[name] = new Set(
      branches.map((value) => {
        if (name === "fill") return asFill(value);
        return value === null ? "unset" : normalise(value);
      }),
    );
  }
  return { tag, attrs: values };
}

/** Every shape in a fragment, in document order. */
function shapesIn(markup, inherit, where, findings) {
  return [...markup.matchAll(SHAPES)].map(([, tag, attrs]) =>
    shapeOf(tag, attrs, inherit, where, findings),
  );
}

/** The sheet paints every element itself; nothing is inherited. */
const PER_ELEMENT = () => null;

/** The first class a `className` names, through a template literal if need be. */
function firstClass(markup) {
  const value = attr(markup, "className") ?? attr(markup, "class") ?? "";
  return (
    value
      .replace(/[`${}]/g, " ")
      .trim()
      .split(/\s+/)[0] || null
  );
}

/** `name: value` from the first of these selectors that declares it. */
function fromRules(rules, selectors, name) {
  for (const selector of selectors) {
    const [declared] = declaredValues(rules, selector, name);
    if (declared !== undefined) return declared;
  }
  return null;
}

/**
 * What a shape inherits: the wrapper `<svg>`'s own attributes, then the
 * stylesheet, most specific selector first.
 *
 * The stylesheet half is not optional. `PriorityGlyph` sets no `fill` on any
 * element — `.priority-glyph` and `.priority-glyph .mark` paint it, because the
 * two colours are tokens that follow the theme. Read off the markup alone the
 * mark looks unpainted, which is a finding against a glyph that renders
 * correctly.
 */
function inheritFrom(head, rules) {
  const wrapper = firstClass(head);
  return (name, attrs) => {
    // Presentation inherits; geometry does not. An `<svg width="14">` sets how
    // big the drawing renders, and gives the `<path>` inside it no width at all.
    if (!INHERITS.has(name)) return null;
    const own = attr(head, name);
    if (own !== null) return own;
    const child = firstClass(attrs);
    return fromRules(
      rules,
      [
        child && wrapper && `.${wrapper} .${child}`,
        child && `.${child}`,
        wrapper && `.${wrapper}`,
      ].filter(Boolean),
      name,
    );
  };
}

const findings = [];
const sheet = read(SHEET);

/** `id → { viewBox, shapes }` for every master on the sheet. */
const masters = new Map(
  [...sheet.matchAll(/<symbol id="([\w-]+)"([^>]*)>([\s\S]*?)<\/symbol>/g)].map(
    ([, id, head, body]) => [
      id,
      {
        viewBox: normalise(attr(head, "viewBox") ?? ""),
        shapes: shapesIn(body, PER_ELEMENT, `${SHEET} #${id}`, findings),
      },
    ],
  ),
);

/** The app stylesheet, which is where several components' fills actually live. */
const appRules = cssRules(read("apps/desktop/src/styles.css"));

/** The `<svg>` a copy hangs its shared presentation attributes on. */
function wrapperOf(markup, rules = []) {
  const head = markup.match(/<svg\b([^>]*)>/)?.[1] ?? "";
  return {
    viewBox: normalise(attr(head, "viewBox") ?? ""),
    inherit: inheritFrom(head, rules),
  };
}

/**
 * One `<svg>` in a component. `marker` picks it out when the file draws more
 * than one — `PriorityGlyph` also holds the `priority-none` dash — by naming a
 * string only that block contains.
 */
function readComponent(path, marker) {
  const blocks = read(path).match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g) ?? [];
  const block = marker ? blocks.find((one) => one.includes(marker)) : blocks[0];
  if (!block) return null;
  const { viewBox, inherit } = wrapperOf(block, appRules);
  return { viewBox, shapes: shapesIn(block, inherit, path, findings) };
}

/**
 * One entry of `FormattingIcon`'s `MARKS` table. The wrapper is the single
 * `<svg>` further down the file, which is where the shared 1.6 lives.
 */
function readMarks(path, action) {
  const source = read(path);
  const { viewBox, inherit } = wrapperOf(source, appRules);
  const table = source.match(/const MARKS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!table) {
    findings.push(`${path} has no MARKS table — this guard cannot read it`);
    return null;
  }
  // Sliced between key positions rather than matched lazily: an entry runs to
  // the next key, and a lazy match with an end-of-line alternative stops at the
  // first newline — which reads a two-path mark as an empty one.
  const keys = [...table[1].matchAll(/^ {2}(\w+):/gm)];
  const at = keys.findIndex(([, key]) => key === action);
  if (at === -1) return null;
  const entry = table[1].slice(
    keys[at].index,
    at + 1 < keys.length ? keys[at + 1].index : undefined,
  );
  return {
    viewBox,
    shapes: shapesIn(entry, inherit, `${path} (${action})`, findings),
  };
}

/** One toolbar button in the specimen page, found by its `title`. */
function readSpecimen(path, title) {
  const source = read(path);
  const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const button = source.match(
    new RegExp(`<button[^>]*title="${title}"[^>]*>([\\s\\S]*?)</button>`),
  );
  if (!button) return null;
  // The specimen page carries its own stylesheet, which is where `.fglyph`
  // puts the stroke the sheet puts on every path.
  const { viewBox, inherit } = wrapperOf(button[1], cssRules(style));
  return {
    viewBox,
    shapes: shapesIn(button[1], inherit, `${path} (${title})`, findings),
  };
}

const READERS = {
  marks: readMarks,
  specimen: readSpecimen,
  component: readComponent,
};

const registered = new Set(COPIES.flatMap(({ symbols }) => symbols));
for (const id of masters.keys()) {
  if (PINNED.test(id) && !registered.has(id) && !(id in NOT_COPIED)) {
    findings.push(
      `\`${id}\` is on the sheet and this guard has no answer for it — register ` +
        "its copies in COPIES, or say in NOT_COPIED why it has none",
    );
  }
}
for (const id of Object.keys(NOT_COPIED)) {
  if (!masters.has(id)) {
    findings.push(
      `\`${id}\` is excused in NOT_COPIED and is not on the sheet — drop the entry`,
    );
  }
}

const same = (a, b) =>
  a.size === b.size && [...a].every((value) => b.has(value));
const show = (set) => [...set].sort().join(" | ");

let checked = 0;

for (const { symbols, copies, varies = [] } of COPIES) {
  const group = symbols.map((id) => [id, masters.get(id)]);
  const missing = group.filter(([, master]) => !master).map(([id]) => id);
  if (missing.length > 0) {
    findings.push(
      `${missing.map((id) => `\`${id}\``).join(", ")} registered here and not on the sheet (${SHEET})`,
    );
    continue;
  }

  // The first master stands for the group's drawing; the rest are checked
  // against it below, attribute by attribute.
  const [first] = group.map(([, master]) => master);
  const label =
    symbols.length === 1
      ? `\`${symbols[0]}\``
      : `\`${symbols[0]}\` and its ${symbols.length - 1} sibling(s)`;

  // The family has to be a family: same shapes, differing only where declared.
  for (const [id, master] of group.slice(1)) {
    if (
      master.shapes.length !== first.shapes.length ||
      master.viewBox !== first.viewBox
    ) {
      findings.push(
        `\`${id}\` is grouped with \`${symbols[0]}\` and is not the same drawing — split the group`,
      );
    }
  }
  const values = (index, name) =>
    new Set(
      group.flatMap(([, master]) => [
        ...(master.shapes[index]?.attrs[name] ?? []),
      ]),
    );

  first.shapes.forEach((shape, index) => {
    for (const name of COMPARED) {
      const across = values(index, name);
      if (varies.includes(name)) {
        if (across.size < 2 && symbols.length > 1) {
          findings.push(
            `${label} declare \`${name}\` as varying and every one of them draws ` +
              `\`${show(across)}\` — drop it from \`varies\`, or it exempts a value nothing changes`,
          );
        }
      } else if (across.size > 1) {
        findings.push(
          `${label} disagree on \`${name}\` (${show(across)}) — either the sheet is ` +
            "wrong or `varies` should name it",
        );
      }
    }
  });

  for (const [kind, path, key] of copies) {
    const copy = READERS[kind](path, key);
    const where = `${path}${key ? ` (${key})` : ""}`;
    if (!copy) {
      findings.push(
        `${label} has no copy at ${where} — the registry and the file disagree`,
      );
      continue;
    }
    checked += 1;
    if (copy.viewBox !== first.viewBox) {
      findings.push(
        `${label} is drawn on \`${copy.viewBox}\` at ${where} and \`${first.viewBox}\` on ` +
          "the sheet — same grid, or the marks are different sizes",
      );
    }
    if (copy.shapes.length !== first.shapes.length) {
      findings.push(
        `${label} has ${first.shapes.length} shape(s) on the sheet and ${copy.shapes.length} at ${where}`,
      );
      continue;
    }
    first.shapes.forEach((shape, index) => {
      if (copy.shapes[index].tag !== shape.tag) {
        findings.push(
          `${label} shape ${index + 1} is a \`${shape.tag}\` on the sheet and a ` +
            `\`${copy.shapes[index].tag}\` at ${where}`,
        );
        return;
      }
      for (const name of COMPARED) {
        const across = values(index, name);
        const mine = copy.shapes[index].attrs[name];
        if (!same(across, mine)) {
          findings.push(
            `${label} shape ${index + 1} has drifted at ${where}\n` +
              `      ${name} — sheet: ${show(across)}\n` +
              `      ${" ".repeat(name.length)}   copy: ${show(mine)}`,
          );
        }
      }
    });
  }
}

report({
  name: "glyph-drift-guard",
  findings,
  checked,
  noun: "copies",
  remedy: `glyph(s) drifted from their masters in ${SHEET}`,
  clean: "every redrawn glyph still draws its master's geometry",
});
