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
 * Two families are checked, and only two, because they are the two where token
 * coverage is complete and a literal is therefore always a defect:
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
 *
 * Deliberately **not** checked: spacing, type sizes, and one-off widths and
 * heights. `components.md` specifies real component anatomy off the scales —
 * a 190×28 filter field, a 58px key column, a 44px progress meter, 10.5px mono
 * meta, a 9.5px badge — so a guard there would fire on the spec being followed
 * rather than broken. Plan 36's audit table carries those instead.
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

/** A duration or delay that is not a motion token. `0.01ms` is reduced motion. */
const MOTION = {
  label: "motion",
  pattern: /(?:transition|animation)(?:-duration|-delay)?:\s*([^;]+);/g,
  offending: (value) =>
    (value.match(/(?<![\w.])[\d.]+m?s(?![\w])/g) ?? []).filter(
      (part) => part !== "0.01ms",
    ),
};

const files = sourceFiles();
const findings = [];
for (const file of files) {
  const { path, text, lines } = readSource(file);
  for (const rule of [RADIUS, MOTION]) {
    for (const hit of text.matchAll(rule.pattern)) {
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
    "literal value(s) outside src/tokens/ — use a --lc-radius-* or --lc-motion-* token:",
  clean: "every radius and duration is a token",
});
