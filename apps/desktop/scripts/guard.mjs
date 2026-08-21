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
 * `state-panel-guard.mjs` (LC-91), `trust-line-guard.mjs` (LC-82) and
 * `row-editor-guard.mjs` (LC-215) are the same shape again, and share a
 * subject: a rule that is correct read alone and wrong read against its
 * neighbours — a container coming back around a state panel, a descendant
 * selector out-specifying the one class that decides a font, or the one that
 * decides a text field's box. None is visible to the vitest suite, which
 * loads no stylesheet.
 *
 * `glyph-drift-guard.mjs` (LC-111) takes `report` alone and reads further out
 * than any of them: `docs/design/foundations/`, which is not app source at all.
 * That is the point of it. Its subject is a component and the design master it
 * was copied from, and the two live on opposite sides of the repo, so the only
 * place the pair can be compared is a script that reads both trees.
 *
 * `create-surface-guard.mjs` (LC-113/LC-115, then LC-114/LC-116) is back in the
 * stylesheet: it pins four prototype-diff rows whose implementation is
 * declarations on existing controls rather than a component branch. Vitest can
 * assert the trigger still behaves like a menu, but the chrome that made the
 * rows fail is CSS. It was `quick-create-guard.mjs` while the modal was its
 * whole subject; the full create panel brought it two more rows and the name
 * stopped being true.
 *
 * `card-height-guard.mjs` (LC-166) is the shape stretched furthest: it reads
 * `styles.css` and the token JSON not to compare two rules but to *add the
 * rules up*, because the board places 5,000 cards from a height it never
 * measures. Its subject is the one thing none of the others is — a number that
 * is correct only as long as a sum of numbers somewhere else has not moved.
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

/**
 * Every declaration one selector makes, across all the rules that set it,
 * joined into one body a pattern can be run over.
 *
 * Exact-match on the selector, not substring: `.no-matches` must not collect
 * what `.no-matches strong` declares, and `.trust-line` must not collect what
 * `.welcome-panel .trust-line` does — the second of each pair is a different
 * subject, and in `trust-line-guard.mjs` it is the *defect* being looked for.
 */
export function declarationsOf(rules, selector) {
  return rules
    .filter(([at]) => at.split(",").some((one) => one.trim() === selector))
    .map(([, body]) => body)
    .join(";");
}

/**
 * Every value one selector declares for `property`, in source order.
 *
 * The name may not be preceded by a word character *or a hyphen*: `\b` alone
 * matches the `padding` inside `scroll-padding` and the `border` inside
 * `-webkit-border-before`, so a guard asserting the shorthand would be
 * satisfied by a longhand and report clean over a declaration that had drifted.
 *
 * `glyph-drift-guard.mjs` (LC-111) learned that boundary in its own reader and
 * `create-surface-guard.mjs` (LC-113) was written without it (LC-177). Both
 * want the same sentence out of `declarationsOf` — find `property: value` —
 * so the boundary lives here once rather than in each caller, which is where
 * one of the two would go on missing it.
 *
 * A scanner, not a parser: a value runs to the next `;`, which is what both
 * callers' declarations look like.
 */
export function declaredValues(rules, selector, property) {
  const pattern = new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]+)`, "g");
  return [...declarationsOf(rules, selector).matchAll(pattern)].map(
    ([, value]) => value.trim(),
  );
}

/**
 * `[ids, classes, types]`, counted the way the cascade counts them —
 * pseudo-classes with classes, so `.welcome-panel p:first-child` is not
 * mistaken for a weaker rule than it is.
 *
 * Two guards now ask which of a pair of rules the cascade lets win —
 * `trust-line-guard.mjs` over the trust line's font, `row-editor-guard.mjs`
 * over the checklist editor's box — and the counter lives here for
 * `declaredValues`' reason: each copy had already grown a caveat the other
 * lacked, which is how one of them misses the next boundary fix (LC-177).
 * Both caveats, then: pseudo-*elements* are overcounted as classes rather
 * than types, and attribute selectors are miscounted outright. Neither
 * matters to either caller — no selector ending in a pseudo-element reaches
 * their comparisons, and a selector carrying `[type=` is refused as unable
 * to match the editor before its specificity is ever asked for — but a new
 * caller must check it can say the same.
 */
export function specificityOf(selector) {
  const score = [0, 0, 0];
  for (const simple of selector.match(/[#.:]?[\w-]+(\([^)]*\))?/g) ?? []) {
    if (simple.startsWith("#")) score[0] += 1;
    else if (simple.startsWith(".") || simple.startsWith(":")) score[1] += 1;
    else score[2] += 1;
  }
  return score;
}

/**
 * Does `challenger` beat `owner` on specificity alone? Equal specificity is
 * the owner's own rules — which may legitimately have the last word among
 * themselves, in source order — so it answers no.
 */
export function outranks(challenger, owner) {
  for (let rank = 0; rank < owner.length; rank += 1) {
    if (challenger[rank] !== owner[rank]) return challenger[rank] > owner[rank];
  }
  return false;
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
