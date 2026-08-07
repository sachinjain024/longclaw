#!/usr/bin/env node
/**
 * The stacking guard: every surface that has to be on top says which layer it
 * is on, and the layers are in the order the app needs them.
 *
 * `token-guard.mjs` refuses a `z-index` that is not a `--lc-z-*` token. That
 * catches a private number; it cannot catch the two things that actually broke
 * LC-96. The ticket panel is the topmost surface and declared **no** `z-index`
 * at all, while `.list-group-header` declared `z-index: 1` — and a positioned
 * element with any layer outranks one with `auto`, so the list behind the panel
 * punched opaque bands across it: a clipped Labels row, a `Checklist` heading
 * sliced in half, an item hidden outright. Nothing about either declaration is
 * wrong on its own. What is wrong is the pair.
 *
 * So this guard reads the pair. It names the surfaces whose stacking is part of
 * the app's behaviour rather than its paint order, requires each to take a
 * layer, and checks the relations between them:
 *
 *   - the panel over the list's sticky group headers — LC-96 itself. The
 *     raw-file view rode on the panel until LC-134 made it the modal the spec
 *     draws, so it is the scrim's relation that covers it now;
 *   - the modal scrim over the panel, because source order used to settle that
 *     and stopped the moment the panel took a layer of its own;
 *   - the menu popover over the scrim, because quick create carries the status,
 *     priority and label menus and a menu behind its own modal is unusable;
 *   - a toast over the panel, because feedback that arrives hidden is not
 *     feedback;
 *   - the drop indicator over the rows it is dropped between, and under the
 *     sticky header that stays over what scrolls beneath it (LC-154).
 *
 * **Two ways of holding a layer, and why.** LC-154 asked for the layers to be
 * used "everywhere position is set", and swept every positioned rule in the
 * stylesheet to find out what that means rule by rule.
 *
 * `fixed` and `sticky` can be held as a blanket rule, and are, below: a fixed
 * box is out of flow at the root and a sticky one exists in order to overlap
 * what scrolls under it, so each is a claim against surfaces it never names,
 * and a claim like that is either declared or left to source order.
 *
 * `absolute` cannot. It is usually a placement inside one box — a `kbd` chip
 * inside its field, an input hidden under its own label — and the rows settle
 * that it must stay that way: 5,000 of them, placed by geometry that never
 * overlaps, where a stacking context each is paid for a relation they do not
 * have. But two absolute rules *are* claims — both drop indicators, which are
 * rendered before the rows they are dropped between — so they are named in
 * `SURFACES` and required to declare a layer there. Blanket rule where one
 * holds; a named relation where the answer is per surface.
 *
 * The workspace is deliberately absent: it is the floor, and it must stay at
 * `auto`. Giving a layer to an ancestor of the board and list would make it a
 * stacking context, and `Menu.tsx` renders its popover inline rather than
 * through a portal — so a menu opened from a card would be trapped under the
 * panel by the very token meant to order them.
 *
 * **What this does not check.** These are the layers as *declared*, which is
 * the whole comparison only for surfaces that stack at the root. A layer on a
 * positioned box makes it a stacking context, so the panel's own popover is
 * ordered inside the panel — above everything the panel contains, and bounded
 * by the panel's 2 against anything outside it. That is visible only where a
 * menu opened from the panel meets a toast or a scrim, neither of which can
 * overlap it today, and the fix if it ever does is a portal rather than a
 * number. Checked in WebKit when this landed: the panel's status menu paints
 * over every point it covers.
 *
 * Usage: node scripts/stacking-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declarationsOf, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(join(src, "styles.css"), "utf8");
const scale = JSON.parse(
  readFileSync(join(src, "tokens/design-tokens.json"), "utf8"),
).z;

/** The scale, lowest layer first. `note` is prose. */
const LAYERS = Object.keys(scale).filter((name) => name !== "note");

/** Who must sit over whom, and the sentence the failure should read as. */
const SURFACES = {
  ".drop-line": "the board's drop indicator",
  ".list-drop-line": "the list's drop indicator",
  ".list-group-header": "the list's sticky group headers",
  ".ticket-panel": "the ticket panel",
  ".modal-scrim": "a modal",
  ".menu-popover": "a menu",
  ".toast-stack": "a toast",
};
const ORDER = [
  [".list-group-header", ".list-drop-line"],
  [".ticket-panel", ".list-group-header"],
  [".modal-scrim", ".ticket-panel"],
  [".menu-popover", ".modal-scrim"],
  [".toast-stack", ".ticket-panel"],
];

/**
 * The layer each selector takes, as a number.
 *
 * A rule body here is flat — this stylesheet nests nothing but at-rules — so
 * the block a declaration belongs to is the text between the braces around it,
 * and its selector list is the text since the previous brace. `cssRules` in
 * `guard.mjs` does that scan, and handles the comments this file is full of.
 */
function declaredLayers() {
  const found = new Map();
  for (const [selector, body] of cssRules(styles)) {
    const declared = body.match(/z-index:\s*([^;]+);/);
    if (!declared) continue;
    const token = declared[1].trim().match(/^var\(--lc-z-([a-z]+)\)$/)?.[1];
    for (const name of Object.keys(SURFACES)) {
      /* The rule that styles the surface itself, not one nested under it:
         `.ticket-panel` and `.ticket-panel:hover` are the panel, and
         `.ticket-panel .foo` and `.missing-ticket-panel` are not. */
      const isSurface = (part) =>
        part === name ||
        (part.startsWith(name) && !/[-\w\s]/.test(part[name.length]));
      if (
        selector
          .split(",")
          .map((part) => part.trim())
          .some(isSurface)
      ) {
        found.set(name, token ? scale[token] : null);
      }
    }
  }
  return found;
}

const findings = [];

/* The scale itself: ascending, and no two layers the same — a tie is two
   surfaces whose order is back to being source order. */
const values = LAYERS.map((name) => scale[name]);
if (values.some((value, index) => index > 0 && value <= values[index - 1])) {
  findings.push(
    `the --lc-z-* scale does not ascend: ${LAYERS.map((n) => `${n} ${scale[n]}`).join(", ")}`,
  );
}

const layers = declaredLayers();
for (const [selector, prose] of Object.entries(SURFACES)) {
  if (!layers.has(selector)) {
    findings.push(`${selector} (${prose}) declares no z-index`);
  } else if (layers.get(selector) === null) {
    findings.push(`${selector} (${prose}) declares a z-index off the scale`);
  }
}

for (const [over, under] of ORDER) {
  const above = layers.get(over);
  const below = layers.get(under);
  if (typeof above !== "number" || typeof below !== "number") continue;
  if (above <= below) {
    findings.push(
      `${SURFACES[over]} (${over}, layer ${above}) does not paint over ` +
        `${SURFACES[under]} (${under}, layer ${below})`,
    );
  }
}

/* The rule the named surfaces above are instances of: every `fixed` and every
   `sticky` rule takes a layer. A rule may set the position for a whole selector
   list, so each part of the list is a surface that has to answer for one. */
const rules = cssRules(styles);
const outOfFlow = new Set();
for (const [selector, body] of rules) {
  if (!/position:\s*(fixed|sticky)/.test(body)) continue;
  for (const part of selector.split(",")) outOfFlow.add(part.trim());
}
for (const selector of outOfFlow) {
  const declared = declarationsOf(rules, selector).match(
    /z-index:\s*var\(--lc-z-([a-z]+)\)/,
  );
  if (!declared) {
    findings.push(
      `${selector} is fixed or sticky and takes no --lc-z-* layer — it is a ` +
        `claim to be over surfaces it never names`,
    );
  } else if (!(declared[1] in scale)) {
    findings.push(`${selector} takes --lc-z-${declared[1]}, off the scale`);
  }
}

report({
  name: "stacking-guard",
  findings,
  checked: new Set([...Object.keys(SURFACES), ...outOfFlow]).size,
  noun: "surfaces",
  remedy: "stacking defect(s) — see src/tokens/design-tokens.json § z:",
  clean: "each takes a --lc-z-* layer, in the order the app needs",
});
