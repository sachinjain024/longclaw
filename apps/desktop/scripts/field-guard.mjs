#!/usr/bin/env node
/**
 * The field guard: no field in this app wears chrome the design system does not
 * draw — no resize handle the human is invited to drag, and no native
 * `<select>`.
 *
 * The panel's title and its comment composer both shipped with the native
 * resize grabber visible in the bottom-right corner (`cc_screens_diff.md`
 * D-3F, D-3G). Nothing in the prototype has one, and on the title — the
 * panel's largest piece of text — the handle was an affordance for a problem
 * the field should never hand over: a title too tall for its box. Both grew a
 * `useAutoGrow` and lost the handle (LC-107, LC-108).
 *
 * D-73 named a third: the create panel's title. It wears the same
 * `.panel-title` rule, so it had lost the handle with the panel's — and it had
 * not grown anything, which is the half of the pair that clips (LC-153).
 *
 * `resize` is the kind of declaration that comes back. It is one word, it is
 * the obvious reflex when a field looks short, and `resize: vertical` reads as
 * a kindness rather than as the reintroduction of a diff — so the pair is
 * asserted here rather than left to a reviewer's memory.
 *
 * The two halves are checked together on purpose: `resize: none` without an
 * auto-grow is a field that clips, which is worse than the grabber. This reads
 * CSS and cannot see the hook, so it names the component that must carry it
 * and fails if the call is gone.
 *
 * The `<select>` is the same subject at the other end of the same document.
 * D-72 found two of them — the sidebar's appearance control and the settings
 * dialog's label colours — and both were OS chrome inside an app that styles
 * everything else it draws. The appearance segment replaced one (LC-127) and
 * the colour swatches the other (LC-130), so what is checked here is the state
 * that leaves: none anywhere (LC-152). A `<select>` is the shortest way to
 * write a menu, which is exactly why it comes back.
 *
 * Usage: node scripts/field-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declaredValues, filesUnder, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(join(src, "styles.css"), "utf8");

/** Selector → what the field is, for a finding that says which one broke. */
const FIELDS = {
  ".panel-title": "the ticket panel's title, and the create panel's",
  ".composer textarea": "the ticket panel's comment composer",
};

/**
 * Component → how many of its fields take a ref from the hook. `.panel-title`
 * is one rule over two components, so the CSS side above cannot tell whether
 * both ends of it grow; this is where that is stated.
 */
const GROWN = {
  "TicketPanel.tsx": 2,
  "CreatePanel.tsx": 1,
};

const findings = [];

for (const [selector, prose] of Object.entries(FIELDS)) {
  const rules = cssRules(styles).filter(([at]) => at === selector);
  if (rules.length === 0) {
    findings.push(`${selector} (${prose}) has no rule at all`);
    continue;
  }
  const declared = rules
    .flatMap(([, body]) => [...body.matchAll(/\bresize\s*:\s*([\w-]+)/g)])
    .map(([, value]) => value);
  if (declared.length === 0) {
    findings.push(
      `${prose} (${selector}) declares no resize — the initial value draws ` +
        `the grabber on a textarea`,
    );
  } else if (declared.some((value) => value !== "none")) {
    findings.push(
      `${prose} (${selector}) declares resize: ${declared.join(", ")}`,
    );
  }
}

/* The borderless title's three numbers (LC-229). It is spec'd as a field —
   `--lc-type-title`, hover `wash`, focus the field treatment
   (`screen-specs.md:224-225`) — and being borderless is what let it drift off
   that spec without anything looking broken: a box nobody can see at rest is a
   box nobody checks, and all three of these were wrong for as long as the rule
   has existed. Each is a static fact about the cascade, which is why they read
   the stylesheet rather than measuring a render. */
const TITLE = ".panel-title";
const rules = cssRules(styles);
const order = (selector) => rules.findIndex(([at]) => at === selector);

/**
 * The inline half of a `padding` shorthand. One value is all four sides and so
 * is its own inline value; two and four both put it second. Three is `a b c`,
 * where `b` is still the inline one.
 */
const inlineOf = (value) => {
  const parts = value.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[1];
};

const TITLE_CHECKS = [
  /* The `font` shorthand carries size, weight and leading; `--lc-type-title` is
     four values, so the tracking has to be said separately or it is not said. */
  () =>
    declaredValues(rules, TITLE, "letter-spacing").length
      ? null
      : `${TITLE} declares no letter-spacing — the font shorthand cannot ` +
        `carry it, so --lc-type-title renders at the browser's default ` +
        `tracking instead of --lc-type-title-tracking`,

  /* The title bleeds its inline padding past the panel's content box so the
     hover wash has room, and gives it straight back as negative margin so the
     *text* stays flush with the meta grid below it. Padding without the margin
     is the defect LC-229 was filed on; margin without the padding is the same
     defect mirrored. Neither half means anything alone, so they are asked for
     as a pair. */
  () => {
    const padding = declaredValues(rules, TITLE, "padding")
      .map(inlineOf)
      .at(-1);
    const margin = declaredValues(rules, TITLE, "margin-inline").at(-1);
    if (padding === undefined) {
      return `${TITLE} declares no padding — the hover box has no room`;
    }
    if (margin === undefined) {
      return (
        `${TITLE} pads its sides by ${padding} and declares no margin-inline ` +
        `to give it back — its text then starts further in than the meta ` +
        `grid and the description under it`
      );
    }
    return margin.includes(padding)
      ? null
      : `${TITLE} pads its sides by ${padding} but its margin-inline is ` +
          `${margin} — the two must cancel, or the text does not line up ` +
          `with the rest of the panel`;
  },

  /* Focus beats hover here only by sitting below it: both are (0,2,0), so the
     order in the file is the whole contract and it is invisible at the point of
     editing. Moving the block up is a silent revert, so the order is checked
     and not just the declaration. */
  () => {
    const focus = `${TITLE}:focus-visible`;
    if (
      !declaredValues(rules, focus, "background").includes("var(--lc-surface)")
    ) {
      return (
        `${focus} does not set background: var(--lc-surface) — a focused ` +
        `title keeps whatever :hover painted, so typing into it looks like ` +
        `hovering a row`
      );
    }
    return order(focus) > order(`${TITLE}:hover`)
      ? null
      : `${focus} is declared above ${TITLE}:hover — they tie on ` +
          `specificity, so hover wins on source order and the focus ` +
          `background never paints`;
  },
];

findings.push(...TITLE_CHECKS.map((check) => check()).filter(Boolean));

/* The half the stylesheet cannot state: a field with no handle has to find its
   own height. Every field takes its ref from the same hook, so counting the
   call sites — the assignments, not the declaration in `autoGrow.ts` — is the
   whole check. */
for (const [file, expected] of Object.entries(GROWN)) {
  const source = readFileSync(join(src, file), "utf8");
  const grown = [...source.matchAll(/=\s*useAutoGrow\(/g)].length;
  if (grown < expected) {
    findings.push(
      `${file} takes ${grown} ref(s) from useAutoGrow where ${expected} field(s) ` +
        `need one — a call per field is what keeps resize: none from clipping`,
    );
  }
}

/* The other native affordance, in the components rather than the stylesheet.
   Comments go first: two files explain in prose which `<select>` they replaced,
   and a guard that reads its own history as a defect is a guard nobody keeps. */
const components = filesUnder(src, /\.tsx$/).filter(
  (file) => !file.endsWith(".test.tsx"),
);
for (const file of components) {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  if (/<select[\s/>]/.test(source)) {
    findings.push(
      `${relative(src, file)} renders a native <select> — the app draws its ` +
        `own menus (Menu.tsx), segments and swatches`,
    );
  }
}

report({
  name: "field-guard",
  findings,
  checked:
    Object.values(GROWN).reduce((total, count) => total + count, 0) +
    components.length +
    /* The title's tracking, its padding/margin pair, and its focus background —
       counted here rather than written as a literal, for the reason
       `create-surface-guard.mjs` gives: a hand-written total goes stale the
       moment somebody adds a fourth. */
    TITLE_CHECKS.length,
  noun: "auto-grown fields, title rules and components",
  remedy: "field defect(s) — see cc_screens_diff.md D-3F / D-3G / D-72",
  clean: "each grows to its own text and wears no native chrome",
});
