#!/usr/bin/env node
/**
 * The hardcoded-color guard (V0-34).
 *
 * Components consume `--lc-*` tokens and nothing else — that is the token
 * contract (`tokens/design-tokens.css` header), and it is what makes switching
 * theme or appearance a token swap. This scans the production source for the
 * ways a literal hue actually arrives in a diff — hex values and functional
 * color notations — and fails the build naming each offender.
 *
 * `src/tokens/` is the one place hues are allowed: it is where they are
 * declared. Named CSS colors (`red`, `royalblue`) are deliberately out of
 * scope; a regex over the 148 names drowns in false positives (`white-space`,
 * a variable called `red`), and the functional forms are how colors get
 * written here in practice.
 *
 * Usage: node scripts/color-guard.mjs   (exits non-zero on any finding)
 */

import { readSource, report, sourceFiles } from "./guard.mjs";

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTIONAL = /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/g;

const files = sourceFiles();
const findings = [];
for (const file of files) {
  const { path, lines } = readSource(file);
  lines.forEach((text, index) => {
    for (const pattern of [HEX, FUNCTIONAL]) {
      for (const hit of text.matchAll(pattern)) {
        findings.push(`${path}:${index + 1} — ${hit[0]}… in: ${text.trim()}`);
      }
    }
  });
}

report({
  name: "color-guard",
  findings,
  checked: files.length,
  remedy: "hardcoded color(s) outside src/tokens/ — use a --lc-* token:",
  clean: "every hue is a token",
});
