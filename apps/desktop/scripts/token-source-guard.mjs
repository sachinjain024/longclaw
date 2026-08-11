#!/usr/bin/env node
/**
 * The one-token-file guard (LC-192).
 *
 * `tokens:check` already proves the generated CSS matches the JSON it came
 * from. It cannot see the failure this guard exists for, because that failure
 * is not drift between a source and its output — it is a *second source*.
 *
 * What LC-192 found: `docs/design/foundations/tokens/design-tokens.json` was
 * labelled "Token source of truth" in its own README, while
 * `apps/desktop/src/tokens/design-tokens.json` was what shipped. The two
 * stopped tracking each other at LC-183 and nothing said so for three months.
 * The docs copy fell nineteen tokens behind — every `--lc-z-*` layer, the board
 * card heights, `motion.spinner`, `raised-hover`, the `code-*` aliases.
 *
 * The cost was not the stale numbers. It was that
 * `docs/design/foundations/scripts/a11y-check.mjs` read the *stale* file, so
 * the accessibility guarantee — 226 checks, the thing the design system points
 * at when someone asks whether a hue is safe — was being proved against values
 * the app did not use. A green suite said nothing about what shipped.
 *
 * Three things are checked, and they are the three ways a second source gets
 * created:
 *
 *   1. `design-tokens.json` exists in exactly one place. A copy is how it
 *      started last time — someone needed the tokens somewhere else and copied
 *      rather than linked.
 *   2. `design-tokens.css` likewise. It is generated, so a checked-in second
 *      copy is a snapshot that will silently age.
 *   3. Every stylesheet link under `docs/design/` that names a token file
 *      resolves to the one real file. The prototype and both proof pages are
 *      design surfaces; a prototype built on tokens the app does not ship is a
 *      prototype of a product that does not exist, which is the specific thing
 *      LC-192 was filed to stop.
 *
 * Nothing is exempt. `archive/` used to be — it held the superseded foundations,
 * token files and all — but the directory is gone, so every tracked file is now
 * held to the one-source rule.
 *
 * Usage: node scripts/token-source-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: dirname(fileURLToPath(import.meta.url)),
  encoding: "utf8",
}).trim();
const CANON_JSON = "apps/desktop/src/tokens/design-tokens.json";
const CANON_CSS = "apps/desktop/src/tokens/design-tokens.css";

const tracked = execFileSync("git", ["ls-files"], {
  cwd: repo,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const findings = [];

/* 1 + 2 — exactly one of each, in the one place that may declare tokens. */
for (const [name, canon] of [
  ["design-tokens.json", CANON_JSON],
  ["design-tokens.css", CANON_CSS],
]) {
  const found = tracked.filter((p) => p.endsWith(`/${name}`) || p === name);
  for (const p of found) {
    if (p !== canon) {
      findings.push(
        `${p}\n    a second ${name}. The one source is ${canon} — link to it, do not copy it.`,
      );
    }
  }
  if (!found.includes(canon)) {
    findings.push(
      `${canon}\n    missing — this is the one file every surface reads.`,
    );
  }
}

/* 3 — every token stylesheet link under docs/design/ points at the real file. */
const LINK = /<link\b[^>]*href="([^"]*design-tokens\.css)"/g;
for (const p of tracked.filter(
  (f) => f.startsWith("docs/design/") && f.endsWith(".html"),
)) {
  const html = readFileSync(join(repo, p), "utf8");
  for (const [, href] of html.matchAll(LINK)) {
    const resolved = relative(repo, resolve(dirname(join(repo, p)), href));
    if (resolved !== CANON_CSS) {
      findings.push(
        `${p}\n    links "${href}" → ${resolved}\n    design surfaces read the shipped tokens or they are prototypes of nothing. Expected ${CANON_CSS}.`,
      );
    }
  }
}

if (findings.length) {
  console.error(`token-source-guard: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error(`  ${f}\n`);
  process.exit(1);
}
console.log(
  `token-source-guard: one token source, ${tracked.length} tracked files clean`,
);
