/**
 * What the two token guards share: which files they read, and what a finding
 * looks like when they report one.
 *
 * `color-guard.mjs` owns hues; `token-guard.mjs` owns radii and motion. They
 * disagree about *what* is a defect and about nothing else — same tree, same
 * `src/tokens/` exemption, same exit contract — so the scan and the report live
 * here and each guard is only its rules.
 *
 * `src/tokens/` is the one place a literal is allowed anywhere: it is where the
 * scale is declared.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../src");
const allowed = resolve(root, "tokens");

const SOURCE = /\.(ts|tsx|css)$/;

/** Every production source file a guard should read, `src/tokens/` excluded. */
export function sourceFiles() {
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
  return files;
}

/** `{ path, text, lines }` for one file, read once. */
export function readSource(file) {
  const text = readFileSync(file, "utf8");
  return { path: relative(process.cwd(), file), text, lines: text.split("\n") };
}

/**
 * The exit contract both guards share: name every offender and fail, or say
 * how much was checked and pass. A guard that passes silently is one nobody
 * can tell is still running.
 */
export function report({ name, findings, checked, remedy, clean }) {
  if (findings.length > 0) {
    console.error(
      `${name}: ${findings.length} ${remedy}\n` +
        findings.map((finding) => `  ${finding}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`${name}: ${checked} files clean — ${clean}`);
}
