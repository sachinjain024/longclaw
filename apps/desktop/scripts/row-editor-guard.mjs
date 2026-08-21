#!/usr/bin/env node
/**
 * The row-editor guard: the checklist row being retyped is a text field, and
 * `.row-edit-field` is the only rule that decides its box.
 *
 * LC-215 gave every checklist row a pencil, and the field it opens stands
 * where the row stood — inside `li.checklist-row`, in both surfaces that draw
 * one. The DS checkbox is styled as `.checklist-row input` (components.md
 * § Checklist), and that selector reads "the box on a checklist row" while
 * matching every input the row holds: the editor's field opened at checkbox
 * size, `appearance: none`, wearing the box's frame, and showed none of the
 * text it existed to change (LC-215's review feedback, 2026-08-12). Nothing
 * was wrong with either rule read alone. The defect only exists between them
 * — `trust-line-guard.mjs`'s subject exactly, on a different pair.
 *
 * That is also the half no test can see. jsdom loads no stylesheet, so the
 * vitest suite proves the field holds the row's text and never which width
 * the cascade lands on. Four checks:
 *
 *   owner    — `.row-edit-field` declares `width: 100%` and `.row-edit-form`
 *              `flex: 1`, the pair that hands the field the row's width. The
 *              cascade check below is about nobody taking that box away;
 *              this is about the box being asked for at all.
 *   cascade  — no rule sets declarations on a selector that both *can match*
 *              a type-less `<input>` standing under a checklist container and
 *              *outranks* `.row-edit-field`. `[type=` and `:checked` are how
 *              this stylesheet says "the box, not the field" — a text input
 *              is never `:checked` — so a selector carrying either cannot
 *              reach the editor and is the scoping the guard accepts. A bare
 *              `input:focus-visible` outranks the owner too and is *not* a
 *              finding: the foundations layer styles every input in the app
 *              on purpose, and the editor is one of the app's text controls —
 *              it should wear the app's focus ring. What it must not wear is
 *              the checkbox's box, and the checkbox is addressed through the
 *              row, which is why a finding here needs a container.
 *   pin      — the editor still stands where this cascade is checked: both
 *              surfaces mount one `RowEditor` in their row, and the field
 *              still carries its class. Moving it fails the run rather than
 *              silently checking a cascade over markup that no longer has it.
 *   chrome   — the row's own two buttons render the 24px `components.md:222`
 *              states. The same defect family caught them from the other
 *              side (LC-224): `.checklist-row .row-edit` asks for
 *              `height: --lc-size-control-sm`, but the buttons wear `.ghost`,
 *              whose `min-height: --lc-size-control` (30px) wins — min-height
 *              always beats height — and every at-rest row stood 38px tall on
 *              a 30px button nothing had asked for. The `small` variant is
 *              the DS's way down, so the pair is what is checked: each button
 *              carries it, and it still resolves to control-sm.
 *
 * Usage: node scripts/row-editor-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cssRules,
  declaredValues,
  outranks,
  report,
  specificityOf,
} from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(resolve(src, "styles.css"), "utf8");
const rules = cssRules(styles);

/**
 * Where the editor stands, and therefore which scopes can catch it. A rule
 * under any other container is aimed at a different input and is that
 * surface's own business.
 */
const CONTAINERS = [".checklist-row", ".checklist"];

/** Surface → how many rows' worth of editor it mounts. */
const MOUNTS = { "TicketPanel.tsx": 1, "CreatePanel.tsx": 1 };

const findings = [];

for (const [file, expected] of Object.entries(MOUNTS)) {
  const text = readFileSync(resolve(src, file), "utf8");
  const mounts = text.match(/<RowEditor\b/g)?.length ?? 0;
  if (mounts !== expected) {
    findings.push(
      `${file} mounts ${mounts} RowEditor(s) and this guard knows ` +
        `${expected} — register the change in MOUNTS or this checks a ` +
        `cascade over markup that no longer stands in it`,
    );
  }
}

const checklistRow = readFileSync(resolve(src, "ChecklistRow.tsx"), "utf8");
if (!checklistRow.includes('className="row-edit-field"')) {
  findings.push(
    "ChecklistRow.tsx no longer names its input `row-edit-field` — the class " +
      "this whole guard is about has moved, so move the guard with it",
  );
}

/** The row's two buttons, named as their class names ChecklistRow.tsx uses. */
const BUTTONS = ["row-edit", "row-remove"];

for (const button of BUTTONS) {
  const className =
    checklistRow.match(
      new RegExp(`className="([^"]*\\b${button}\\b[^"]*)"`),
    )?.[1] ?? "";
  if (className === "") {
    findings.push(
      `ChecklistRow.tsx no longer has a \`${button}\` button — the control ` +
        "this guard sizes has moved, so move the guard with it (LC-224)",
    );
  } else if (!className.split(/\s+/).includes("small")) {
    findings.push(
      `ChecklistRow.tsx's \`${button}\` is a ghost without \`small\` — ` +
        "`.ghost`'s 30px min-height beats the 24px height the row rule asks, " +
        "and every at-rest row stands 38px tall on it (components.md:222, " +
        "LC-224)",
    );
  }
}

if (
  !declaredValues(rules, ".ghost.small", "min-height").includes(
    "var(--lc-size-control-sm)",
  )
) {
  findings.push(
    "`.ghost.small` no longer resolves min-height to `--lc-size-control-sm` " +
      "— the variant the row's buttons rely on to render the 24px " +
      "`components.md:222` states (LC-224)",
  );
}

if (!declaredValues(rules, ".row-edit-field", "width").includes("100%")) {
  findings.push(
    ".row-edit-field no longer asks for `width: 100%` — the field falls back " +
      "to the browser's default box and shows a sliver of the row it stands " +
      "in for (LC-215)",
  );
}
if (!declaredValues(rules, ".row-edit-form", "flex").includes("1")) {
  findings.push(
    ".row-edit-form no longer asks for `flex: 1` — the form shrinks to its " +
      "content and the field's `width: 100%` is 100% of nothing (LC-215)",
  );
}

/** What a rule has to beat to take the editor's box away from it. */
const OWNER = specificityOf(".row-edit-field");

/**
 * Can this compound match the editor's `<input>` itself?
 *
 * A subject naming `.row-edit-field` is a rule *about* the editor rather than
 * one that caught it by accident — `.row-edit-field:focus` outranks the owner
 * on purpose. `[type=` and `:checked` can never hold on a type-less text
 * input. What is left is `input`, alone or behind pseudo-classes the field
 * can be in.
 */
function matchesTheEditor(subject) {
  if (subject.includes(".row-edit-field")) return false;
  if (subject.includes("[type=") || subject.includes(":checked")) return false;
  return /^input(:[\w-]+(\([^)]*\))?)*$/.test(subject);
}

/**
 * Can this selector match the editor's input where one actually stands, *as a
 * checklist rule*? The subject has to be the input itself, and something
 * above it has to be a container the editor is under — `.checklist-row.draft`
 * reaches it exactly as surely as `.checklist-row` does, which is why the
 * compound is tested by its head rather than by equality. A selector with no
 * container is the foundations layer talking to every input at once, which is
 * its job.
 */
function reachesTheEditor(selector) {
  const compounds = selector.split(/[\s>+~]+/).filter(Boolean);
  const subject = compounds.pop();
  if (!subject || !matchesTheEditor(subject)) return false;
  return compounds.some((compound) =>
    CONTAINERS.some(
      (container) =>
        compound === container ||
        compound.startsWith(`${container}.`) ||
        compound.startsWith(`${container}:`),
    ),
  );
}

for (const [selector, body] of rules) {
  if (!body.trim()) continue;
  for (const one of selector.split(",").map((part) => part.trim())) {
    if (reachesTheEditor(one) && outranks(specificityOf(one), OWNER)) {
      findings.push(
        `\`${one}\` styles every input on a checklist row — the editor's ` +
          "field included — and outranks `.row-edit-field`; scope it to " +
          '`input[type="checkbox"]` (LC-215)',
      );
    }
  }
}

report({
  name: "row-editor-guard",
  findings,
  // Everything the run held still, counted as it ran: a mount pin per
  // surface, the field's class, each button's variant and the variant's own
  // declaration, the two owner declarations, and the cascade over each
  // container — `report`'s own warning is that a pass line counting the
  // wrong thing is a small lie in the one sentence a reader actually sees.
  checked:
    Object.keys(MOUNTS).length + 1 + BUTTONS.length + 1 + 2 + CONTAINERS.length,
  noun: "contracts",
  remedy: "row-editor defect(s) — see LC-215 and LC-224",
  clean:
    "the retyped row is a text field, only `.row-edit-field` decides its " +
    "box, and the row's buttons are the 24px the design states",
});
