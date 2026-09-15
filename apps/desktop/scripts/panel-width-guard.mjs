#!/usr/bin/env node
/**
 * The ticket panel's width, on both sides of the CSS/TypeScript seam (LC-238s).
 *
 * Three of the width's numbers are written twice, because two languages draw
 * the panel: `panelWidth.ts` does the arithmetic a drag and an arrow press
 * need, and `styles.css` paints the result. Neither can read the other.
 *
 *   the default   `PANEL_WIDTH_DEFAULT` · the `var()` fallback the panel and
 *                 its handle are drawn from before a handle has stamped one
 *   the cap       `PANEL_WIDTH_CAP` · the `vw` share `min()` holds the panel to,
 *                 which is the ceiling that makes a remembered width safe
 *   the floor     `PANEL_RAIL_FLOOR` · the container query LC-227's properties
 *                 rail is behind, which is the only reason the floor is 660
 *
 * A term changed on one side alone is the failure this repo already knows the
 * shape of. Lower the CSS fallback and every panel opens narrow while the
 * module still reports 800 to the control; raise the container query and the
 * floor stops being the floor of anything — the rail folds at a width the
 * handle happily drags to, and `a11y:audit`'s A6 row is the only thing that
 * would notice, in a run nobody is obliged to make before committing.
 *
 * vitest cannot stand in for this: it loads no stylesheet, and a `?raw` import
 * of one comes back empty under the CSS transform.
 *
 * Usage: node scripts/panel-width-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const module = readFileSync(resolve(src, "panelWidth.ts"), "utf8");
const styles = readFileSync(resolve(src, "styles.css"), "utf8");

/** One exported constant of `panelWidth.ts`, as the number it is declared as. */
function constant(name) {
  const declared = new RegExp(
    `export const ${name} = ([0-9_.]+)(?:;|\\s)`,
  ).exec(module);
  return declared ? Number(declared[1].replaceAll("_", "")) : undefined;
}

const findings = [];
const checked = [];

/** What the stylesheet says, beside what the module says. */
function requireAgreement(what, name, drawn, reason) {
  checked.push(what);
  const stated = constant(name);
  if (stated === undefined) {
    findings.push(
      `panelWidth.ts declares no ${name}; ${what} cannot be checked`,
    );
    return;
  }
  const expected = drawn(stated);
  if (styles.includes(expected)) return;
  findings.push(
    `styles.css does not draw ${what} as panelWidth.ts states it — ` +
      `expected \`${expected}\` for ${name} = ${stated} (${reason})`,
  );
}

requireAgreement(
  "the default width and the window's cap",
  "PANEL_WIDTH_DEFAULT",
  (width) => `min(var(--ticket-panel-width, ${width}px), 88vw)`,
  "the panel and its handle are both drawn from this expression",
);

requireAgreement(
  "the cap, as a share of the window",
  "PANEL_WIDTH_CAP",
  (cap) => `, ${cap * 100}vw)`,
  "the drag stops where the paint does, or the handle leaves the edge behind",
);

requireAgreement(
  "the rail's container query, which is the drag floor",
  "PANEL_RAIL_FLOOR",
  (floor) => `@container (min-width: ${floor}px)`,
  "under it the properties fold away, and no gesture may take a reader there",
);

report({
  name: "panel-width-guard",
  findings,
  checked: checked.length,
  noun: "panel width claim",
  remedy:
    "number(s) written twice and no longer agreeing — change both sides, or " +
    "state one of them in terms of the other:",
  clean:
    "the panel's default, cap and rail floor read the same in styles.css and " +
    "panelWidth.ts",
});
