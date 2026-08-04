/**
 * What the guards in this directory share: which files they read, and what a
 * finding looks like when they report one.
 *
 * `color-guard.mjs` owns hues; `token-guard.mjs` owns radii and motion. They
 * disagree about *what* is a defect and about nothing else — same tree, same
 * `src/tokens/` exemption, same exit contract — so the scan and the report live
 * here and each guard is only its rules.
 *
 * `release-audit.mjs` reads a different tree — shipped `.ts`/`.tsx` *and* the
 * Rust source — with no exemption at all, because `src/tokens/` can call
 * `fetch` as easily as anything else can. So it takes `filesUnder` and
 * `report` and leaves `sourceFiles` alone. That is the seam: the walk and the
 * exit contract are shared, the tree each script cares about is not.
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

/** Every file under `dir` whose name matches `match`, minus the `skip` paths. */
export function filesUnder(dir, match, skip = []) {
  const excluded = new Set(skip);
  const files = [];
  const walk = (from) => {
    for (const entry of readdirSync(from)) {
      const path = join(from, entry);
      if (excluded.has(path)) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (match.test(entry)) files.push(path);
    }
  };
  walk(dir);
  return files;
}

/** Every production source file a guard should read, `src/tokens/` excluded. */
export function sourceFiles() {
  return filesUnder(root, SOURCE, [allowed]);
}

/** `{ path, text, lines }` for one file, read once. */
export function readSource(file) {
  const text = readFileSync(file, "utf8");
  return { path: relative(process.cwd(), file), text, lines: text.split("\n") };
}

/**
 * The exit contract these scripts share: name every offender and fail, or say
 * how much was checked and pass. A guard that passes silently is one nobody
 * can tell is still running.
 *
 * `noun` is what `checked` counts. It defaults to files because most of these
 * read a tree of them, but `binary-audit.mjs` counts symbols, and a pass line
 * that says "files" about something else is a small lie in the one sentence a
 * reader actually sees.
 */
export function report({ name, findings, checked, remedy, clean, noun }) {
  if (findings.length > 0) {
    console.error(
      `${name}: ${findings.length} ${remedy}\n` +
        findings.map((finding) => `  ${finding}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`${name}: ${checked} ${noun ?? "files"} clean — ${clean}`);
}
