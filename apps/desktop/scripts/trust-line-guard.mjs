#!/usr/bin/env node
/**
 * The trust-line guard: the claim the product rests on renders in mono, and
 * `.trust-line` is the only rule that decides its face.
 *
 * `no account · no cloud · your files, on your disk` is set in mono by the
 * spec (`screen-specs.md:93-94`) and by `.trust-line`, which has always asked
 * for a mono token. It rendered in the UI face on the welcome screen anyway
 * (`cc_screens_diff.md` D-16, LC-82), and the reason is the whole point of this
 * script: the subtitle above it was styled as `.welcome-copy p`, which matched
 * the trust line too and beat `.trust-line` on specificity. Nothing was wrong
 * with either rule read alone. The defect only exists between them.
 *
 * That is also the half no test can see. jsdom loads no stylesheet, so the
 * vitest suite can assert that every paragraph in the column carries a class —
 * it does — but never which font the cascade actually lands on.
 *
 * Two checks, and only two:
 *
 *   family   — `.trust-line` resolves to `--lc-font-mono`, through whichever
 *              type role it takes. Resolved rather than pattern-matched,
 *              because the defect this replaces was a token that *looked*
 *              right; `--lc-type-kbd-font` and `--lc-type-code-font` are both
 *              mono and `--lc-type-micro-font` is not, and only the token file
 *              knows that.
 *   cascade  — no rule anywhere sets a font on a selector that can match
 *              `<p class="trust-line">`: a bare `p`, or a `p` scoped to one of
 *              the containers the line lives in. Every such selector outranks
 *              a single class.
 *
 * The container list is this guard's one hand-maintained fact, so it is pinned
 * to the markup: `App.tsx` must hold exactly as many trust lines as there are
 * containers here, and moving one without registering it fails the run rather
 * than silently narrowing what is checked.
 *
 * Usage: node scripts/trust-line-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cssRules, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(resolve(src, "styles.css"), "utf8");
const tokens = readFileSync(resolve(src, "tokens/design-tokens.css"), "utf8");
const app = readFileSync(resolve(src, "App.tsx"), "utf8");
const rules = cssRules(styles);

/** Where a trust line stands, and therefore what may be scoped over it. */
const CONTAINERS = [".side-panel-footer", ".welcome-panel"];

const findings = [];

const lines = app.match(/className="trust-line"/g)?.length ?? 0;
if (lines !== CONTAINERS.length) {
  findings.push(
    `App.tsx renders ${lines} trust line(s) and this guard knows ` +
      `${CONTAINERS.length} container(s) — register the new one in CONTAINERS ` +
      `or this checks the cascade over a screen that no longer has one`,
  );
}

/** `--lc-*: value` for every custom property the token file declares. */
const declared = new Map(
  [...tokens.matchAll(/(--lc-[\w-]+)\s*:\s*([^;]+);/g)].map(
    ([, name, value]) => [name, value.trim()],
  ),
);

/** Follow `var(--a)` → `var(--b)` → a real font stack. */
function resolveToken(value) {
  let seen = 0;
  let current = value;
  while (current?.startsWith("var(") && seen++ < 10) {
    current = declared.get(current.slice(4, current.indexOf(")")).trim());
  }
  return current ?? "";
}

/**
 * The family a `font:` shorthand or `font-family:` names. The shorthand ends
 * with the family, which in this stylesheet is always a single token.
 */
function familyToken(body) {
  const family = body.match(/\bfont-family\s*:\s*([^;]+);/);
  if (family) return family[1].trim();
  const shorthand = body.match(/\bfont\s*:\s*([^;]+);/);
  return shorthand?.[1].trim().split(/\s+/).pop() ?? null;
}

const trustLine = rules
  .filter(([selector]) =>
    selector.split(",").some((one) => one.trim() === ".trust-line"),
  )
  .map(([, body]) => body)
  .join(";");

const family = familyToken(trustLine);
if (family === null) {
  findings.push(
    ".trust-line names no font family — the line falls back to the UI face " +
      "the spec puts it deliberately outside of",
  );
} else if (!/mono/i.test(resolveToken(family))) {
  findings.push(
    `.trust-line resolves ${family} to \`${resolveToken(family)}\`, which is ` +
      "not the mono stack (`screen-specs.md:93-94`)",
  );
}

/** Does this selector match a `<p>` by tag, over a trust line's container? */
function reachesTheTrustLine(selector) {
  const compounds = selector.split(/[\s>+~]+/).filter(Boolean);
  if (compounds.pop() !== "p") return false;
  return (
    compounds.length === 0 ||
    compounds.some((compound) => CONTAINERS.includes(compound))
  );
}

for (const [selector, body] of rules) {
  if (familyToken(body) === null) continue;
  for (const one of selector.split(",").map((part) => part.trim())) {
    if (reachesTheTrustLine(one)) {
      findings.push(
        `\`${one}\` sets a font on a selector that also matches the trust ` +
          "line and outranks `.trust-line` — give the paragraph it is meant " +
          "for a class of its own (cc_screens_diff.md D-16)",
      );
    }
  }
}

report({
  name: "trust-line-guard",
  findings,
  checked: CONTAINERS.length + 1,
  noun: "cascades",
  remedy: "trust-line defect(s) — see cc_screens_diff.md D-16",
  clean: "the trust line is mono, and only `.trust-line` decides its face",
});
