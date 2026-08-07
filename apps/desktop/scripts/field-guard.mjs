#!/usr/bin/env node
/**
 * The field guard: a textarea the app sizes for the human draws no handle
 * inviting them to size it themselves.
 *
 * The panel's title and its comment composer both shipped with the native
 * resize grabber visible in the bottom-right corner (`cc_screens_diff.md`
 * D-3F, D-3G). Nothing in the prototype has one, and on the title — the
 * panel's largest piece of text — the handle was an affordance for a problem
 * the field should never hand over: a title too tall for its box. Both grew a
 * `useAutoGrow` and lost the handle (LC-107, LC-108).
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
 * Usage: node scripts/field-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(join(src, "styles.css"), "utf8");
const panel = readFileSync(join(src, "TicketPanel.tsx"), "utf8");

/** Selector → what the field is, for a finding that says which one broke. */
const FIELDS = {
  ".panel-title": "the ticket panel's title",
  ".composer textarea": "the ticket panel's comment composer",
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

/* The half the stylesheet cannot state: a field with no handle has to find its
   own height. Both fields take their ref from the same hook, so counting the
   call sites — the assignments, not the declaration above them — is the whole
   check. */
const grown = [...panel.matchAll(/=\s*useAutoGrow\(/g)].length;
if (grown < Object.keys(FIELDS).length) {
  findings.push(
    `TicketPanel.tsx takes ${grown} ref(s) from useAutoGrow, one short of a ` +
      `field — a call per field is what keeps resize: none from clipping`,
  );
}

report({
  name: "field-guard",
  findings,
  checked: Object.keys(FIELDS).length,
  noun: "auto-grown fields",
  remedy: "field defect(s) — see cc_screens_diff.md D-3F / D-3G",
  clean: "each grows to its own text and draws no native resize handle",
});
