#!/usr/bin/env node
/**
 * Both create surfaces — the quick-create modal and the full create panel —
 * have four prototype-diff rows whose contract lives in CSS rather than
 * component state:
 *
 *   D-47 — the title input is borderless, 15px.
 *   D-48 — the context line is a flex row, so the theme dot centres against the
 *          letters beside it rather than riding their baseline.
 *   D-49 — the status trigger is bare in quick create, while keeping the shared
 *          menu trigger semantics and chevron from `MenuButton`.
 *   D-4A — full create's provisional key wears the ID chip and none of its
 *          behaviour: no pointer, because there is nothing to copy yet.
 *
 * jsdom does not reliably expose the stylesheet cascade for these declarations,
 * so the stable check is the same shape as the other CSS guards: read
 * `styles.css`, find the exact rules, and fail when the declarations drift. The
 * tests beside them pin what the components render; only the cascade is here.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declarationsOf, declaredValues, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(resolve(src, "styles.css"), "utf8");
const rules = cssRules(styles);

const findings = [];

/**
 * What the pass line counts, both derived from the assertions below rather than
 * written down beside them: every declaration this file holds, and every
 * prototype-diff row those declarations belong to.
 *
 * The row is a separate argument rather than the first word of `reason` because
 * a sentence is not a key. A hand-written `2` is what LC-177 was filed against,
 * and the `4` that replaced it went stale the same way; a number and a list
 * that count themselves cannot.
 */
let checked = 0;
const rows = new Set();

function requireDeclaration(row, selector, property, expected, reason) {
  checked += 1;
  rows.add(row);

  const values = declaredValues(rules, selector, property);
  if (values.includes(expected)) return;

  // Two ways to miss, and the reader needs them apart: a rule that says
  // something else, and a selector the stylesheet no longer has at all.
  findings.push(
    declarationsOf(rules, selector).length === 0
      ? `${selector} has no rule; expected ${row} ${reason}`
      : `${selector} declares ${property}: ${values.join(", ") || "<missing>"}; ` +
          `expected ${expected} (${row} ${reason})`,
  );
}

requireDeclaration(
  "D-47",
  ".quick-create-title",
  "border",
  "none",
  "title input uses the modal frame as its boundary",
);
requireDeclaration(
  "D-47",
  ".quick-create-title",
  "padding",
  "0",
  "title input has no field chrome",
);
requireDeclaration(
  "D-47",
  ".quick-create-title",
  "background",
  "none",
  "title input has no field chrome",
);
requireDeclaration(
  "D-47",
  ".quick-create-title",
  "font-size",
  "15px",
  "title input matches the prototype size",
);
requireDeclaration(
  "D-48",
  ".quick-create-context",
  "display",
  "flex",
  "the theme dot centres against the name rather than sitting on its baseline",
);
requireDeclaration(
  "D-48",
  ".quick-create-context",
  "align-items",
  "center",
  "the theme dot centres against the name rather than sitting on its baseline",
);
requireDeclaration(
  "D-49",
  ".quick-create-meta .menu-trigger",
  "border",
  "0",
  "quick-create status trigger is bare",
);
requireDeclaration(
  "D-49",
  ".quick-create-meta .menu-trigger",
  "padding",
  "0",
  "quick-create status trigger is bare",
);
requireDeclaration(
  "D-49",
  ".quick-create-meta .menu-trigger",
  "background",
  "none",
  "quick-create status trigger is bare",
);
requireDeclaration(
  "D-4A",
  ".id-chip.provisional",
  "cursor",
  "default",
  "the provisional key has nothing to copy, so the pointer must not offer it",
);

report({
  name: "create-surface-guard",
  findings,
  checked,
  noun: "declarations",
  remedy: "create-surface CSS contract(s) drifted",
  clean: `${[...rows].join(", ")} CSS contracts hold`,
});
