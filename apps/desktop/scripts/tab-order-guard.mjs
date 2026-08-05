#!/usr/bin/env node
/**
 * The tab-stop guard: every `<button>` this app renders carries an explicit
 * `tabIndex`.
 *
 * **Why this is not redundant with the HTML default.** A `<button>` is in the
 * tab order in every browser except the one LongClaw actually ships on. WebKit
 * follows the macOS *Keyboard navigation* setting (`AppleKeyboardUIMode`), which
 * is off by default, and with it off Tab visits text fields, selects and links
 * and nothing else — buttons are skipped. The board already knew this: plan 07
 * gave the cards roving focus because "WebKit never put `<button>` cards in the
 * Tab order". Nothing else in the app was ever adjusted for it, so on a default
 * Mac the ticket panel's controls, the toast's Retry and the conflict banner's
 * two choices were pointer-only — against `keyboard-focus-map.md`'s § Ticket
 * panel Tab order and its rule 1, "every pointer action has a keyboard path".
 * The Step 17 accessibility audit found it; `perf/a11y-audit.mjs` is where it
 * stays found.
 *
 * `tabIndex={0}` puts the control back in the order regardless of the OS
 * setting. `tabIndex={-1}` is equally explicit and equally fine — a roving group
 * (`Menu.tsx`, the board's cards, the editor's tabstrip) has exactly one stop and
 * says so. What this refuses is the *absent* attribute, because that is the one
 * that reads as "the default is fine" and is not.
 *
 * Usage: node scripts/tab-order-guard.mjs   (exits non-zero on any finding)
 */

import { readSource, sourceFiles, report } from "./guard.mjs";

/** A JSX button opening tag: `<button` followed by whitespace or `>`. */
const OPENING = /<button(\s|>|$)/;

/**
 * The attributes of the JSX element starting at `line`, as one string.
 *
 * A JSX opening tag runs over as many lines as it likes and its attribute values
 * contain `>` freely (`onClick={() => …}`), so the tag cannot be matched with a
 * single regex. Scanning forward for the first line that closes the tag at depth
 * zero is enough here and is honest about what it is: these are hand-written
 * components, not arbitrary input.
 */
function openingTag(lines, start) {
  let depth = 0;
  const collected = [];
  for (
    let index = start;
    index < lines.length && index < start + 40;
    index += 1
  ) {
    // A comment between attributes is prose, and prose contains `>` and braces
    // that are not the tag's. `Menu.tsx` has exactly that, and reading it as
    // markup ended the tag three attributes early.
    const line = lines[index].replace(/\/\/.*$/, "");
    collected.push(line);
    for (const character of line) {
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      else if (character === ">" && depth === 0) return collected.join(" ");
    }
  }
  return collected.join(" ");
}

const files = sourceFiles().filter((file) => !/\.test\.tsx?$/.test(file));
const findings = [];
for (const file of files) {
  const { path, lines } = readSource(file);
  lines.forEach((text, index) => {
    // A `<button>` inside a comment is prose about the DOM, not DOM.
    if (/^\s*(\/\/|\*|\/\*)/.test(text)) return;
    if (!OPENING.test(text)) return;
    if (/tabIndex=/.test(openingTag(lines, index))) return;
    findings.push(`${path}:${index + 1} — <button> with no tabIndex`);
  });
}

report({
  name: "tab-order-guard",
  findings,
  checked: files.length,
  remedy:
    "button(s) with no explicit tabIndex — WebKit skips those on a default Mac, " +
    "so add tabIndex={0}, or tabIndex={-1} if a roving group owns the stop:",
  clean: "every button states its place in the tab order",
});
