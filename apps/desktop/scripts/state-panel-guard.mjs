#!/usr/bin/env node
/**
 * The state-panel guard: the no-match state is centred in the region and wears
 * no container of its own.
 *
 * It shipped as a bordered, tinted card spanning the content width and sitting
 * at the top of the workspace — a frame drawn around the answer to "why is
 * there nothing here?", where the prototype centres a state panel in the board
 * region with nothing around it (`prototype.css § state-panel`,
 * `cc_screens_diff.md` D-31). It got there honestly: `.no-matches` shared one
 * rule with `.unreachable-panel`, which does keep its frame, so the next person
 * to touch that rule has a plausible reason to put the selector back on it
 * (LC-91). The empty-project state shared it too until D-20/LC-86, and now has
 * no panel at all — it is a card inside the Todo column.
 *
 * A frame is also the half no test can see. The panel's markup is identical
 * either way — jsdom loads no stylesheet, and the vitest suite can assert the
 * class the centring hangs off but never the declarations behind it. So the
 * absence is asserted here, with the chain it depends on: `.no-matches` claims
 * the height `.workspace-state` claims from `.main-panel`, and a column that
 * stops being a column anywhere along that chain leaves the panel at the top
 * of the screen with every rule below it still reading as correct.
 *
 * Usage: node scripts/state-panel-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declarationsOf, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(here, "../src/styles.css"), "utf8");
const rules = cssRules(styles);

/** Every declaration a selector makes, across all the rules that set it. */
const declarations = (selector) => declarationsOf(rules, selector);

const findings = [];

/**
 * What a container is made of — any one of these is a frame coming back.
 *
 * Each pattern takes the longhands as well as the shorthand. The margin one
 * did not, so `margin-top: 18px` — the exact declaration the frame this guard
 * exists to keep out carried — would have walked straight past it.
 */
const FRAME = [
  [
    "border",
    /\bborder(-(top|right|bottom|left|block|inline))?\s*:\s*(?!0|none)/,
  ],
  ["background", /\bbackground(-color|-image)?\s*:\s*(?!none|transparent)/],
  [
    "margin",
    /\bmargin(-(top|right|bottom|left)|-(block|inline)(-(start|end))?)?\s*:\s*(?!0)/,
  ],
];

const panel = declarations(".no-matches");
if (panel === "") {
  findings.push(".no-matches has no rule at all — the state panel is unstyled");
} else {
  for (const [what, pattern] of FRAME) {
    if (pattern.test(panel)) {
      findings.push(
        `.no-matches declares a ${what} — the no-match state carries no ` +
          `container of its own (cc_screens_diff.md D-31)`,
      );
    }
  }
}

/* The column the centring hangs from, top to bottom. Each link states the one
   declaration that makes the next one possible. */
const CHAIN = [
  [".main-panel", "flex-direction", /\bflex-direction\s*:\s*column\b/],
  [".workspace-state", "flex", /\bflex\s*:\s*1\b/],
  [".no-matches", "flex", /\bflex\s*:\s*1\b/],
  [".no-matches", "justify-content", /\bjustify-content\s*:\s*center\b/],
];

for (const [selector, property, pattern] of CHAIN) {
  if (!pattern.test(declarations(selector))) {
    findings.push(
      `${selector} no longer declares the ${property} the centred state ` +
        `panel is measured from — it would render at the top of the region`,
    );
  }
}

report({
  name: "state-panel-guard",
  findings,
  checked: CHAIN.length + FRAME.length,
  noun: "declarations",
  remedy: "state-panel defect(s) — see cc_screens_diff.md D-31",
  clean: "the no-match panel is centred in the region and wears no frame",
});
