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
/** Parsed once: every check below reads the same stylesheet. */
const sheet = cssRules(styles);

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
  const rules = sheet.filter(([at]) => at === selector);
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

/* Six facts about the cascade that no test in `verify` can see (LC-229).
   Three are the borderless title's: it is spec'd as a field —
   `--lc-type-title`, hover `wash`, focus the field treatment
   (`screen-specs.md:224-225`) — and being borderless is what let it drift off
   that spec without anything looking broken, because a box nobody can see at
   rest is a box nobody checks. All three were wrong for as long as the rule had
   existed. The fourth is the caret the whole field foundation asks for
   (`components.md:66`), which no field in the app had.

   The last two are the *other* title's, the quick create modal's, which the
   first pass left alone as a decision rather than a fix. It is a different
   field on a different spec — `screen-specs.md:256` asks for a borderless 15px
   input, because that modal is one field and two menus and a box around the
   field is a frame around nothing — but borderless earns it the same blind
   spot, and it had drifted off the prototype in the two ways below.

   These read the stylesheet rather than a render because each is a static fact
   about what the cascade resolves to. The geometry they produce is not static,
   and is not claimed here: what a probe measured once is recorded in the
   commit, not asserted every run. */
const TITLE = ".panel-title";
const QUICK_TITLE = ".quick-create-title";

/**
 * Where a selector's rule sits in the file, `-1` when nothing declares it.
 *
 * Comma-split for `declarationsOf`'s reason: a selector merged into a list is
 * the same rule, and an identity test would stop finding it. That matters more
 * here than it looks — the only caller compares two positions, so a selector
 * that quietly stopped being found would compare against `-1` and pass.
 */
const order = (selector) =>
  sheet.findIndex(([at]) =>
    at.split(",").some((one) => one.trim() === selector),
  );

/**
 * A shorthand's space-separated parts, with parenthesised values kept whole:
 * `calc(-1 * var(--x))` is one part and not four.
 *
 * `split(/\s+/)` is the obvious reader and it is wrong for `declaredValues`'
 * reason — it silently mangles exactly the values this file exists to compare,
 * and reports clean over the wreckage.
 */
const parts = (value) => {
  const found = [];
  let depth = 0;
  let current = "";
  for (const character of value.trim()) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0 && /\s/.test(character)) {
      if (current) found.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) found.push(current);
  return found;
};

/**
 * The inline (left and right) value of a `padding` shorthand, or `null` when
 * the two sides are not the same value.
 *
 * One value is all four sides; two and three put the inline one second; four is
 * top/right/bottom/left, where the two sides are separate and a title padded
 * unevenly has no single value for a margin to cancel.
 */
const inlinePadding = (value) => {
  const found = parts(value);
  if (found.length === 1) return found[0];
  if (found.length === 2 || found.length === 3) return found[1];
  if (found.length === 4) return found[1] === found[3] ? found[1] : null;
  return null;
};

/** Whitespace is not meaning in a CSS value, and the spellings below differ in it. */
const flat = (value) => value.replace(/\s+/g, "");

/**
 * Does `margin` undo `padding`? Asked as "is it one of the spellings that
 * negate it", not "does it mention it".
 *
 * The substring test this replaces could not see a sign: it passed
 * `calc(1 * var(--lc-space-2))` — the LC-229 defect doubled rather than
 * cancelled — and `calc(-2 * …)`, and reported both clean. A guard that cannot
 * fail on the defect it was written for is worse than no guard, because the
 * green run is what stops anyone looking.
 */
const cancels = (margin, padding) =>
  [
    `calc(-1*${padding})`,
    `calc(${padding}*-1)`,
    padding.startsWith("-") ? padding.slice(1) : `-${padding}`,
  ].some((spelling) => flat(margin) === flat(spelling));

const CASCADE_CHECKS = [
  /* The `font` shorthand carries size, weight and leading; `--lc-type-title` is
     four values, so the tracking has to be said separately or it is not said. */
  () =>
    declaredValues(sheet, TITLE, "letter-spacing").length
      ? null
      : `${TITLE} declares no letter-spacing — the font shorthand cannot ` +
        `carry it, so --lc-type-title renders at the browser's default ` +
        `tracking instead of --lc-type-title-tracking`,

  /* The title bleeds its inline padding past the panel's content box so the
     hover wash has room, and takes it back as negative margin so the *text*
     lands where the meta grid and the description below it start. (Within the
     1px transparent border, which is not cancelled and is the prototype's
     behaviour too.) Padding without the margin is the defect LC-229 was filed
     on; margin without the padding is the same defect mirrored. Neither half
     means anything alone, so they are asked for as a pair. */
  () => {
    const declared = [
      ...declaredValues(sheet, TITLE, "padding"),
      ...declaredValues(sheet, TITLE, "padding-inline"),
    ];
    const padding = declared.map(inlinePadding).at(-1);
    const margin = declaredValues(sheet, TITLE, "margin-inline").at(-1);
    if (declared.length === 0) {
      return `${TITLE} declares no padding — the hover box has no room`;
    }
    if (padding === null) {
      return (
        `${TITLE} pads its two sides differently (${declared.at(-1)}) — one ` +
        `margin-inline cannot cancel both, so one side of the text is out of ` +
        `line whatever it is set to`
      );
    }
    if (margin === undefined) {
      return (
        `${TITLE} pads its sides by ${padding} and declares no margin-inline ` +
        `to take it back — its text then starts further in than the meta ` +
        `grid and the description under it`
      );
    }
    return cancels(margin, padding)
      ? null
      : `${TITLE} pads its sides by ${padding} but its margin-inline is ` +
          `${margin} — it has to negate the padding (calc(-1 * ${padding})), ` +
          `or the text does not line up with the rest of the panel`;
  },

  /* Focus beats hover here only by sitting below it: both are (0,2,0), so the
     order in the file is the whole contract and it is invisible at the point of
     editing. Moving the block up is a silent revert, so the order is checked
     and not just the declaration. */
  () => {
    const focus = `${TITLE}:focus-visible`;
    if (
      !declaredValues(sheet, focus, "background").includes("var(--lc-surface)")
    ) {
      return (
        `${focus} does not set background: var(--lc-surface) — a focused ` +
        `title keeps whatever :hover painted, so typing into it looks like ` +
        `hovering a row`
      );
    }
    const hover = `${TITLE}:hover`;
    if (order(hover) === -1) {
      return `${hover} has no rule — the focus background has nothing to beat`;
    }
    return order(focus) > order(hover)
      ? null
      : `${focus} is declared above ${hover} — they tie on specificity, so ` +
          `hover wins on source order and the focus background never paints`;
  },

  /* The caret is the third of the focus treatment's three parts
     (`components.md:66`), and the one that was missing everywhere rather than
     on the title alone: every text field in the product blinked the OS default.
     It belongs on the shared rule beside the ring and the border, so that is
     where it is asked for — naming the two selectors that can actually show a
     caret, since `select` cannot. */
  () => {
    const without = ["input:focus-visible", "textarea:focus-visible"].filter(
      (selector) =>
        !declaredValues(sheet, selector, "caret-color").includes(
          "var(--lc-accent-human)",
        ),
    );
    return without.length === 0
      ? null
      : `${without.join(" and ")} do(es) not set caret-color: ` +
          `var(--lc-accent-human) — the field foundation asks for a human-` +
          `accent caret and the OS default is ink`;
  },

  /* The quick create title's weight, and its placeholder's, which are a pair
     for the padding/margin pair's reason: neither states the design alone. The
     prototype draws the field at 500 and the placeholder at 400
     (`prototype.css:700-701`). A placeholder inherits the field's weight, so
     setting the first without the second draws "Ticket title" in the same
     medium a typed title gets — an empty modal wearing a filled one's type. */
  () => {
    const weight = declaredValues(sheet, QUICK_TITLE, "font-weight").at(-1);
    if (weight === undefined) {
      return (
        `${QUICK_TITLE} declares no font-weight — it inherits the body's 400 ` +
        `where the prototype draws the modal's one field at 500 ` +
        `(prototype.css:700)`
      );
    }
    if (weight !== "500") {
      return (
        `${QUICK_TITLE} declares font-weight: ${weight} where the prototype ` +
        `draws it at 500 (prototype.css:700)`
      );
    }
    const placeholder = declaredValues(
      sheet,
      `${QUICK_TITLE}::placeholder`,
      "font-weight",
    ).at(-1);
    return placeholder === "400"
      ? null
      : `${QUICK_TITLE}::placeholder declares font-weight: ` +
          `${placeholder ?? "nothing"} — a placeholder inherits the field's ` +
          `${weight}, so the empty modal draws its prompt in the weight a ` +
          `typed title gets (prototype.css:701)`;
  },

  /* The shared focus rule rings every input in the app, and that rule is right
     for every field that has a box. This one has none — no border and no
     border-radius — so the ring resolves to a hard-cornered 3px rectangle
     traced around a line of text with nothing under it, and the field
     `autoFocus`es, which makes that the first thing the modal draws. The
     prototype cancels it (`prototype.css:702`) and leaves focus to the accent
     caret the shared rule also sets.

     Borderless is checked first, because it is the premise and not a
     decoration: cancelling the ring is only right while there is no box, and
     the boxed field this modal deliberately does not have (`screen-specs.md:256`,
     D-47) is a standing suggestion. A field that grew a border under a
     cancelled ring would be the one field in the app with a visible edge and
     no focus indicator at all — worse than the square this check was written
     to remove, and silent. So the two are asked for together, the way the
     title's padding and margin are.

     `border: none` or `0`, spelled on the shorthand. `border-width: 0` says the
     same thing and is refused: the narrow spelling fails red rather than green,
     which is the safe direction for a premise.

     Specificity settles the ring rather than source order — (0,2,0) against the
     shared rule's (0,1,1) — so unlike the panel title's background there is no
     position to hold still, and only the declaration is asked for. */
  () => {
    const border = declaredValues(sheet, QUICK_TITLE, "border").at(-1);
    if (border !== "none" && border !== "0") {
      return (
        `${QUICK_TITLE} declares border: ${border ?? "nothing"} — the ring ` +
        `this field cancels is cancelled on the premise that it has no box, ` +
        `so a bordered one has a visible edge and no focus indicator at all`
      );
    }
    const focus = `${QUICK_TITLE}:focus-visible`;
    const shadow = declaredValues(sheet, focus, "box-shadow").at(-1);
    return shadow === "none"
      ? null
      : `${focus} does not set box-shadow: none (it sets ` +
          `${shadow ?? "nothing"}) — the shared focus rule rings every input, ` +
          `and a borderless field with no radius takes that ring as a square ` +
          `drawn around text with no box under it`;
  },
];

findings.push(...CASCADE_CHECKS.map((check) => check()).filter(Boolean));

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
    /* Counted rather than written as a literal, for the reason
       `create-surface-guard.mjs` gives: a hand-written total goes stale the
       moment somebody adds one. */
    CASCADE_CHECKS.length,
  noun: "auto-grown fields, cascade contracts and components",
  remedy: "field defect(s) — see cc_screens_diff.md D-3F / D-3G / D-72",
  clean: "each grows to its own text and wears no native chrome",
});
