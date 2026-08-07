#!/usr/bin/env node
/**
 * Quick create has two prototype-diff rows whose contract lives in CSS rather
 * than component state:
 *
 *   D-47 — the title input is borderless, 15px.
 *   D-49 — the status trigger is bare in quick create, while keeping the shared
 *          menu trigger semantics and chevron from `MenuButton`.
 *
 * jsdom does not reliably expose the stylesheet cascade for these declarations,
 * so the stable check is the same shape as the other CSS guards: read
 * `styles.css`, find the exact rules, and fail when the declarations drift.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declarationsOf, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(resolve(src, "styles.css"), "utf8");
const rules = cssRules(styles);

const findings = [];

function requireDeclaration(selector, property, expected, reason) {
  const declarations = declarationsOf(rules, selector);
  if (declarations.length === 0) {
    findings.push(`${selector} has no rule; expected ${reason}`);
    return;
  }

  const values = [
    ...declarations.matchAll(new RegExp(`${property}\\s*:\\s*([^;]+)`, "g")),
  ].map(([, value]) => value.trim());
  if (!values.includes(expected)) {
    findings.push(
      `${selector} declares ${property}: ${values.join(", ") || "<missing>"}; ` +
        `expected ${expected} (${reason})`,
    );
  }
}

requireDeclaration(
  ".quick-create-title",
  "border",
  "none",
  "D-47 title input uses the modal frame as its boundary",
);
requireDeclaration(
  ".quick-create-title",
  "padding",
  "0",
  "D-47 title input has no field chrome",
);
requireDeclaration(
  ".quick-create-title",
  "background",
  "none",
  "D-47 title input has no field chrome",
);
requireDeclaration(
  ".quick-create-title",
  "font-size",
  "15px",
  "D-47 title input matches the prototype size",
);
requireDeclaration(
  ".quick-create-meta .menu-trigger",
  "border",
  "0",
  "D-49 quick-create status trigger is bare",
);
requireDeclaration(
  ".quick-create-meta .menu-trigger",
  "padding",
  "0",
  "D-49 quick-create status trigger is bare",
);
requireDeclaration(
  ".quick-create-meta .menu-trigger",
  "background",
  "none",
  "D-49 quick-create status trigger is bare",
);

report({
  name: "quick-create-guard",
  findings,
  checked: 2,
  noun: "contracts",
  remedy: "quick-create CSS contract(s) drifted",
  clean: "D-47 and D-49 CSS contracts hold",
});
