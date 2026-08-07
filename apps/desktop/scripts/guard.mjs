/**
 * What the guards in this directory share: which files they read, and what a
 * finding looks like when they report one.
 *
 * `color-guard.mjs` owns hues; `token-guard.mjs` owns radii, motion and layers.
 * They disagree about *what* is a defect and about nothing else — same tree,
 * same `src/tokens/` exemption, same exit contract — so the scan and the report
 * live here and each guard is only its rules.
 *
 * `release-audit.mjs` reads a different tree — shipped `.ts`/`.tsx` *and* the
 * Rust source — with no exemption at all, because `src/tokens/` can call
 * `fetch` as easily as anything else can. So it takes `filesUnder` and
 * `report` and leaves `sourceFiles` alone. That is the seam: the walk and the
 * exit contract are shared, the tree each script cares about is not.
 *
 * `stacking-guard.mjs` (LC-96) is the far end of that seam: it reads two named
 * files rather than a tree — `styles.css` and the token JSON — because its
 * question is about the relation between a handful of selectors, not about
 * every file. It takes `report` alone, and the pass line it prints counts
 * surfaces rather than files. `field-guard.mjs` (LC-107/LC-108) is the same
 * shape, and reaches across languages for its second half: a `resize: none` in
 * the stylesheet is only safe while the component still auto-grows the field,
 * so it reads `TicketPanel.tsx` for the other end of the pair.
 * `state-panel-guard.mjs` (LC-91) and `trust-line-guard.mjs` (LC-82) are the
 * same shape again, and share a subject: a rule that is correct read alone and
 * wrong read against its neighbours — a container coming back around a state
 * panel, a descendant selector out-specifying the one class that decides a
 * font. Neither is visible to the vitest suite, which loads no stylesheet.
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

/**
 * `[selector, body]` for every rule in a stylesheet, comments stripped.
 *
 * Two guards now read `styles.css` as rules rather than as lines —
 * `stacking-guard.mjs` for the layer a surface declares, `tile-contrast-guard.mjs`
 * for the ink a background is paired with — and both need the same two things
 * the naive regex gets wrong. Comments go first, because in this stylesheet
 * they sit between the previous `}` and the selector and several are
 * paragraphs: left in, a finding names the rule's rationale instead of the
 * rule. And the selector is collapsed to one line, because it may be a list
 * broken across several.
 *
 * This is a scanner, not a parser: nested rules (`@media`) yield their inner
 * rules, which is what both callers want, and neither has any use for the
 * at-rule's own prelude.
 */
export function cssRules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    ([, selector, body]) => [selector.trim().replace(/\s+/g, " "), body],
  );
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
