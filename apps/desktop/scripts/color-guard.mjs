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

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../src");
const allowed = resolve(root, "tokens");

const SOURCE = /\.(ts|tsx|css)$/;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTIONAL = /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/g;

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (path === allowed) continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (SOURCE.test(entry)) files.push(path);
  }
};
walk(root);

const findings = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, index) => {
    for (const pattern of [HEX, FUNCTIONAL]) {
      for (const hit of text.matchAll(pattern)) {
        findings.push(
          `${relative(process.cwd(), file)}:${index + 1} — ${hit[0]}… in: ${text.trim()}`,
        );
      }
    }
  });
}

if (findings.length > 0) {
  console.error(
    `color-guard: ${findings.length} hardcoded color(s) outside src/tokens/ — use a --lc-* token:\n` +
      findings.map((finding) => `  ${finding}`).join("\n"),
  );
  process.exit(1);
}

console.log(`color-guard: ${files.length} files clean — every hue is a token`);
