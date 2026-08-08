#!/usr/bin/env node
/**
 * The non-color token guard (Step 16a).
 *
 * `color-guard.mjs` (V0-34) fails the build on a literal hue. It leaves every
 * other axis Step 16a names — radii, motion — unguarded, and the audit that
 * opened Step 16a found what that costs: 31 literal `border-radius` values in
 * `styles.css`, ten of them `7px`, which is **not a value on the radius scale
 * at all**. The design system had a control radius of 5px and the app had one
 * of 7px, and nothing said so.
 *
 * Three families of literal are checked, and only three, because they are the
 * ones where token coverage is complete and a literal is therefore always a
 * defect:
 *
 *   radius  — the scale is 3·4·5·8·10·14·999 (`--lc-radius-*`). `50%` and `0`
 *             are geometry rather than scale values and are allowed: a circle
 *             is a circle at any size, and `0` is a reset.
 *   motion  — every duration and delay (`--lc-motion-*`). The generated CSS
 *             zeroes each of these under `prefers-reduced-motion` — derived
 *             from the token group, so a new one cannot miss the block — which
 *             makes a literal not merely off-system: it is motion that survives
 *             a user's request for no motion. `0.01ms` in the reduced-motion
 *             block itself is the one exception, and it is what that block is
 *             for.
 *   z-index — every layer (`--lc-z-*`). A stacking order is the one scale where
 *             a value read alone says nothing: `1` is only meaningful against
 *             what the other surfaces claim. LC-96 is what a private number
 *             costs — the list's sticky header held `z-index: 1` while the
 *             ticket panel, the topmost surface, held none, so the list painted
 *             opaque bands across the open panel. What is checked here is a
 *             layer that is off the scale; a surface that declares none is what
 *             the workspace and every unpositioned box are, and holding the
 *             surfaces that *do* need one to having it is `stacking-guard.mjs`,
 *             which reads the relations between them rather than one value.
 *
 * Deliberately **not** checked: spacing, type sizes, and one-off widths and
 * heights. `components.md` specifies real component anatomy off the scales —
 * a 190×28 filter field, a 58px key column, a 44px progress meter, 10.5px mono
 * meta, a 9.5px badge — so a guard there would fire on the spec being followed
 * rather than broken. Plan 36's audit table carries those instead.
 *
 * A fourth check is not about a value at all. `--lc-` is the token namespace,
 * and `src/tokens/` — which `sourceFiles()` already exempts — is the only place
 * entitled to declare into it, so a definition anywhere else is always a defect.
 * That is a documented standard rather than a house preference:
 * `docs/design/foundations/components.md:3` says everything below it *consumes*
 * `--lc-*` tokens from the generated stylesheet, and `guard.mjs` says
 * `src/tokens/` is the one place a literal is allowed anywhere, because it is
 * where the scale is declared. Neither had anything enforcing it.
 * That is the gap the one-off exemption above leaves open: LC-165 first cut a
 * private `--lc-size-board-column-head: 39px` on `.board-column`, which read at
 * its call site exactly like a token while being in no scale, no JSON and no
 * theme. The height was right; the name was the defect, and it is the kind this
 * guard can see. A one-off `39px` in a `max-height` is a value a reader knows to
 * check — the same 39 behind `--lc-` claims to have been through the system.
 *
 * Usage: node scripts/token-guard.mjs   (exits non-zero on any finding)
 */

import { readSource, report, sourceFiles } from "./guard.mjs";

/** A radius value that is neither a token, a circle, nor a reset. */
const RADIUS = {
  label: "border-radius",
  pattern: /border-radius:\s*([^;]+);/g,
  offending: (value) =>
    value
      .split(/[\s/]+/)
      .filter(Boolean)
      .filter(
        (part) => !part.startsWith("var(") && part !== "50%" && part !== "0",
      ),
};

/** A duration or delay that is not a motion token. */
const MOTION = {
  label: "motion",
  pattern: /(?:transition|animation)(?:-duration|-delay)?:\s*([^;]+);/g,
  offending: (value) => value.match(/(?<![\w.])[\d.]+m?s(?![\w])/g) ?? [],
};

/** A layer that is not on the stacking scale. */
const Z_INDEX = {
  label: "z-index",
  pattern: /z-index:\s*([^;]+);/g,
  offending: (value) =>
    /^var\(--lc-z-[a-z]+\)$/.test(value.trim()) ? [] : [value.trim()],
};

/**
 * A token defined outside the one directory allowed to define one.
 *
 * The capture is the property rather than the value, because the value is not
 * what is wrong. Reading it does not need `var(…)` excluded: a reference closes
 * its parenthesis or takes a comma, so only a declaration is followed by a
 * colon.
 */
const TOKEN_DEFINITION = {
  label: "token defined outside src/tokens/",
  pattern: /(--lc-[a-z0-9-]+)\s*:/g,
  offending: (property) => [property],
};

/**
 * The byte ranges of `@media (prefers-reduced-motion: reduce)` blocks.
 *
 * That block is the one place a literal duration is right: `0.01ms` is how the
 * "collapse every transition" idiom is written, and it cannot be a token
 * because it is the value that *replaces* the tokens. Exempting the literal
 * everywhere — which this guard first did — means a production
 * `transition: opacity 0.01ms` sails through, so the exemption is a place
 * rather than a value.
 */
/**
 * The same text with every block comment blanked, character for character.
 *
 * These rules read raw text rather than parsed rules, and this stylesheet's
 * comments quote declarations constantly — saying why a value is what it is is
 * most of what they are for. Unblanked, a comment explaining a rejected
 * `--lc-size-board-column-head: 39px` reads to the scan exactly like the rule
 * itself, and the guard fails the build over its own rationale.
 *
 * Blanked rather than deleted because a finding's line number is counted from
 * the byte offset of its match, so every byte has to stay where it was.
 */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

function reducedMotionRanges(text) {
  const ranges = [];
  const opener = /@media[^{]*prefers-reduced-motion[^{]*\{/g;
  for (const hit of text.matchAll(opener)) {
    let depth = 1;
    let index = hit.index + hit[0].length;
    while (index < text.length && depth > 0) {
      if (text[index] === "{") depth += 1;
      else if (text[index] === "}") depth -= 1;
      index += 1;
    }
    ranges.push([hit.index, index]);
  }
  return ranges;
}

const files = sourceFiles();
const findings = [];
for (const file of files) {
  const { path, text, lines } = readSource(file);
  const scan = withoutComments(text);
  const exemptRanges = reducedMotionRanges(scan);
  for (const rule of [RADIUS, MOTION, Z_INDEX, TOKEN_DEFINITION]) {
    for (const hit of scan.matchAll(rule.pattern)) {
      // Only durations. The block exempts the `0.01ms` idiom, which is a
      // duration and nothing else, so letting it cover the other rules would
      // hand anything written inside it a pass it was never argued for.
      if (
        rule === MOTION &&
        exemptRanges.some(([from, to]) => hit.index >= from && hit.index < to)
      )
        continue;
      const offenders = rule.offending(hit[1]);
      if (offenders.length === 0) continue;
      const line = text.slice(0, hit.index).split("\n").length;
      findings.push(
        `${path}:${line} — ${rule.label} ${offenders.join(" ")} in: ${lines[line - 1].trim()}`,
      );
    }
  }
}

report({
  name: "token-guard",
  findings,
  checked: files.length,
  remedy:
    "off-system value(s) outside src/tokens/ — spend a --lc-radius-*, --lc-motion-* or --lc-z-* token, and declare new ones in src/tokens/:",
  clean:
    "every radius, duration and layer is a token, and no file defines one of its own",
});
