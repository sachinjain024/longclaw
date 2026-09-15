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
 * Two more claims are here for the same reason and are not numbers.
 *
 * **The handle draws a grip at rest, at every width.** It shipped for review
 * drawing nothing until hover — the edge is a line in the design, and a line
 * that is already a control seemed not to need announcing — and came back as
 * "I don't see the handle". The second cut kept the grip but painted it
 * `transparent` wherever the window left no travel, which is the same defect
 * under 778px. Every test of this control asks what it *does*, in jsdom, where
 * a `background: transparent` is as good as any other; so the one property
 * that decides whether a human can find it at all is checked where it is
 * written, in both states.
 *
 * **And the line `panelWidth.ts` cites for the container query is the line the
 * container query is on.** The floor is the one number here whose other half
 * is not in this stylesheet's panel section but 500 lines further down, so the
 * comment points at it — and a citation into a file that grows above the line
 * it names goes stale the way this repo's design-doc citations do. It went
 * stale inside this ticket.
 *
 * Usage: node scripts/panel-width-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, declaredValues, report } from "./guard.mjs";

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

/**
 * The grip's own rule: `.panel-resize::after` is painted at rest, in a token.
 * `transparent` is exactly the value the first cut had, so it is named as the
 * failure rather than left to a generic "not a token".
 */
const rules = cssRules(styles);
checked.push("the grip drawn at rest");
const grip = declaredValues(rules, ".panel-resize::after", "background");
if (grip.length === 0) {
  findings.push(
    ".panel-resize::after declares no background — the handle draws no grip " +
      "at rest, and a control nobody can see is one nobody reaches for",
  );
} else if (grip.includes("transparent") || grip.includes("none")) {
  findings.push(
    `.panel-resize::after is ${grip.join(", ")} at rest — that is the ` +
      "hover-only handle LC-238s shipped for review and had to change",
  );
} else if (!grip.some((value) => value.includes("var(--lc-"))) {
  findings.push(
    `.panel-resize::after draws ${grip.join(", ")}, which is not a token — ` +
      "the grip straddles the panel's hairline and belongs to the line scale",
  );
}

/**
 * And the same rule with no travel to offer: dimmed, never dropped. The grip
 * vanishing below a 778px window is the hover-only handle again, told by window
 * width — and it is the state no jsdom test and no 1440px audit run visits.
 */
const INERT = '.panel-resize[aria-disabled="true"]::after';
checked.push("the grip still drawn where there is nowhere to drag");
const dimmed = declaredValues(rules, INERT, "background");
if (dimmed.some((value) => value === "transparent" || value === "none")) {
  findings.push(
    `${INERT} is ${dimmed.join(", ")} — a handle with nowhere to drag into ` +
      "keeps its grip and dims it, or it is hidden at every window under 778px",
  );
} else if (dimmed.length > 0 && !dimmed.some((v) => v.includes("var(--lc-"))) {
  findings.push(
    `${INERT} draws ${dimmed.join(", ")}, which is not a token — ` +
      "unavailable is `--lc-ink-disabled` everywhere else in this stylesheet",
  );
}

/**
 * The floor's citation, as a citation: the line named in `panelWidth.ts` has to
 * be the line the container query is on.
 */
checked.push("the rail's container query is where panelWidth.ts says it is");
const cited = /`styles\.css:(\d+)`/.exec(module);
const floor = constant("PANEL_RAIL_FLOOR");
if (!cited) {
  findings.push(
    "panelWidth.ts cites no line of styles.css for the rail's container " +
      "query; the floor's other half is 500 lines from the panel's own rules",
  );
} else {
  const line = styles.split("\n")[Number(cited[1]) - 1] ?? "";
  const query = `@container (min-width: ${floor}px)`;
  if (!line.includes(query)) {
    const moved = styles.split("\n").findIndex((one) => one.includes(query));
    findings.push(
      `panelWidth.ts cites styles.css:${cited[1]} for \`${query}\`, which is ` +
        (moved === -1
          ? "nowhere in the stylesheet"
          : `at styles.css:${moved + 1}`),
    );
  }
}

report({
  name: "panel-width-guard",
  findings,
  checked: checked.length,
  noun: "panel width claim",
  remedy:
    "claim(s) that no longer hold — change both sides of a number, state one " +
    "in terms of the other, give the grip a colour again, or re-point the " +
    "line the floor cites:",
  clean:
    "the panel's default, cap and rail floor read the same in styles.css and " +
    "panelWidth.ts, the handle draws a grip at every width, and the floor's " +
    "citation lands on the container query",
});
