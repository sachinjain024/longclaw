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
import { cssRules, filesUnder, report } from "./guard.mjs";

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
    components.length,
  noun: "auto-grown fields and components",
  remedy: "field defect(s) — see cc_screens_diff.md D-3F / D-3G / D-72",
  clean: "each grows to its own text and wears no native chrome",
});
