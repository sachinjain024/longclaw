#!/usr/bin/env node
/**
 * The tile-ink guard: nothing painted on `--lc-tile` may leave its ink to
 * inheritance, and the ink it does name has to be readable on it.
 *
 * `--lc-tile` is the one background token that is **near-black in both
 * appearances** — `#171923` light, `#060709` dark — because it is the agent's
 * terminal window in miniature (`design-tokens.json`, `components.md:152-157`).
 * Every other surface token flips with the appearance, so a box that takes one
 * and inherits `--lc-ink` reads correctly in both. A box on the tile does not:
 * in light appearance the inherited ink *is* `#171923`, the tile's own value,
 * and the contrast is 1.0 — text painted on itself.
 *
 * That is LC-97 and LC-98 exactly. `.markdown code` and `.markdown-code` took
 * the tile for inline and fenced code, named no `color`, and every ticket
 * description with a backtick in it rendered its code as solid black blocks.
 * Neither declaration is wrong on its own — `background: var(--lc-tile)` is a
 * real token used correctly by the agent avatar, and naming no `color` is what
 * nearly every rule in `styles.css` does. What is wrong is the pair, which is
 * why `color-guard.mjs` and `token-guard.mjs` could not see it: both read one
 * declaration at a time, and both were green while the panel was unreadable.
 *
 * So this reads the pair, and then reads the values:
 *
 *   1. A rule that declares `background: var(--lc-tile)` must declare `color`.
 *      Inheritance is not an answer here — what it inherits is the ink of a
 *      surface the tile is not.
 *   2. That `color` must be a `--lc-*` token this can resolve, and it must
 *      clear WCAG AA body text (4.5:1) against the tile in **both**
 *      appearances and **every** theme. The accents move per theme, so a ratio
 *      checked once is a ratio checked for indigo.
 *
 * Scoped to the tile deliberately. The same pair over every background token
 * would fire on the hundred-odd rules that inherit their ink correctly, since
 * inheriting is the right default anywhere the surface flips with the
 * appearance. The tile is the one token where it never is.
 *
 * **What this does not check.** The `color` in the *same* rule, which is the
 * whole comparison only while no later rule re-colors the same element. Today
 * none does: `.actor-tile.unknown` is the one rule that re-colors an actor
 * tile, and `Timeline.tsx:130` emits `actor-tile agent` or `actor-tile
 * unknown`, never both, so it never lands on a tile background. A rule that
 * overrode the ink on a tile *would* pass here and could still be dark-on-dark
 * — the fix if that ever ships is to resolve the cascade, not to widen the
 * regex.
 *
 * Usage: node scripts/tile-contrast-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const styles = readFileSync(join(src, "styles.css"), "utf8");
const tokens = JSON.parse(
  readFileSync(join(src, "tokens/design-tokens.json"), "utf8"),
);

const APPEARANCES = ["light", "dark"];
/** WCAG AA for body text. Inline code is body text at 12px; nothing here is large. */
const AA = 4.5;

/* ---------- resolving a token to its hues ---------- */

/**
 * `--lc-*` name → `{ [theme]: { light, dark } }`, for the color tokens that
 * carry a literal hue. Derived tokens (`color-mix`) are absent on purpose: a
 * mix resolves against whatever surface it lands on, so a ratio computed for
 * one is a guess. An unresolvable ink is reported rather than skipped.
 */
const THEMES = Object.keys(tokens.themes).filter((name) => name !== "note");
const sameInEveryTheme = (value) =>
  Object.fromEntries(THEMES.map((theme) => [theme, value]));

const palette = new Map();
const add = (name, value) => palette.set(`--lc-${name}`, value);
for (const group of ["neutral", "status", "priority", "feedback", "label"]) {
  for (const [key, value] of Object.entries(tokens.color[group])) {
    if (key === "note" || typeof value?.light !== "string") continue;
    const prefix = {
      status: "status-",
      priority: "priority-",
      label: "label-",
    };
    add(`${prefix[group] ?? ""}${key}`, sameInEveryTheme(value));
  }
}
const ACCENTS = {
  "accent-human": "human",
  "accent-human-text": "human-text",
  "on-accent-human": "on-human",
  "accent-agent": "agent",
  "accent-agent-text": "agent-text",
  "on-accent-agent": "on-agent",
};
for (const [name, role] of Object.entries(ACCENTS)) {
  add(
    name,
    Object.fromEntries(
      THEMES.map((theme) => [theme, tokens.themes[theme][role]]),
    ),
  );
}

/* ---------- contrast ---------- */

const channel = (part) =>
  part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;

/** Relative luminance per WCAG 2.1. Hex only — the tile and its inks are hex. */
function luminance(hex) {
  const value = hex.trim().replace("#", "");
  const [r, g, b] = [0, 2, 4].map((at) =>
    channel(parseInt(value.slice(at, at + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- the rules that paint the tile ---------- */

/* Comments go first: they sit between the previous `}` and the selector, and
   several of them in `styles.css` are paragraphs. Left in, a finding names the
   rule's rationale instead of the rule. */
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const declaration = (body, property) =>
  body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();

const findings = [];
let checked = 0;
for (const [, selector, body] of styles
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .matchAll(RULE)) {
  if (declaration(body, "background") !== "var(--lc-tile)") continue;
  checked += 1;
  const where = selector.trim().replace(/\s+/g, " ");

  const ink = declaration(body, "color");
  if (!ink) {
    findings.push(
      `${where} — paints \`--lc-tile\` and names no \`color\`, so it inherits ` +
        `the ink of a surface the tile is not (1.0:1 in light appearance)`,
    );
    continue;
  }

  const token = ink.match(/^var\((--lc-[a-z0-9-]+)\)$/)?.[1];
  const hues = token && palette.get(token);
  if (!hues) {
    findings.push(
      `${where} — \`color: ${ink}\` is not a token whose hue this can resolve, ` +
        `so its contrast against \`--lc-tile\` cannot be checked`,
    );
    continue;
  }

  /* One finding per distinct hue, not per theme. A neutral ink is the same
     value in all four, and four identical lines about it read as four
     defects. Themes are named only where the token actually moves between
     them, which is where naming them tells the reader something. */
  for (const appearance of APPEARANCES) {
    const byHue = new Map();
    for (const theme of THEMES) {
      const hue = hues[theme][appearance];
      byHue.set(hue, [...(byHue.get(hue) ?? []), theme]);
    }
    for (const [hue, themes] of byHue) {
      const ratio = contrast(tokens.color.neutral.tile[appearance], hue);
      if (ratio >= AA) continue;
      const scope =
        themes.length === THEMES.length
          ? `${appearance} appearance`
          : `${appearance} appearance (${themes.join(", ")})`;
      findings.push(
        `${where} — \`${token}\` on \`--lc-tile\` is ${ratio.toFixed(2)}:1 ` +
          `in ${scope}, under AA's ${AA}:1`,
      );
    }
  }
}

report({
  name: "tile-contrast-guard",
  findings,
  checked,
  /* One tile surface is the normal case here, not the edge one — "1 tile
     surfaces clean" would be the pass line almost every run prints. */
  noun: checked === 1 ? "tile surface" : "tile surfaces",
  remedy: "unreadable tile surface(s) — name a light ink, or use --lc-wash:",
  clean: "every ink on the tile clears AA in both appearances",
});
