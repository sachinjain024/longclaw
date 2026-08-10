#!/usr/bin/env node
/**
 * Emits the Claude Design flavour of the theme layer (LC-192).
 *
 * `build.mjs` generates what the app consumes: `--lc-*` names, every derived
 * variant resolved through `--lc-mix-*`. The Claude Design project
 * "LongClaw DS v3 — system" speaks a different dialect — bare `--accent-human`
 * / `--accent-agent`, plus the v1 aliases (`--human`, `--agent`, `--human-tint`,
 * `--status-done`) that every v1 component in that project already reads. Its
 * components cannot be renamed without rewriting all eleven of them.
 *
 * So: one source, two emitters. Both read `design-tokens.json`; neither is
 * hand-edited. That is the whole point — LC-192 exists because two token files
 * were maintained by hand and stopped agreeing, and a second hand-maintained
 * dialect would reproduce the same failure across the network instead of across
 * a directory.
 *
 * What is deliberately NOT emitted: neutrals, status, priority, feedback and
 * label ramps. Those are where the repo's AA adjustments live (decisions.md
 * D10), and pushing them would overwrite the design system's own values in a
 * direction nobody has yet approved — E1–E12 of the LC-192 conflict list are
 * still open. This emitter carries exactly what D17 settled: the accent layer.
 *
 * Output is `claude-design/themes.css`, checked in and verified by
 * `design:check` the same way `design-tokens.css` is verified by
 * `tokens:check` — regenerate, diff, fail on drift. The upload itself is a
 * separate step; this only makes the payload reproducible.
 *
 * Usage: node src/tokens/emit-design-system.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, "design-tokens.json"), "utf8"));

const themes = Object.keys(t.themes).filter((k) => k !== "note");
const APPEARANCES = ["light", "dark"];
const DEFAULT = themes.find((k) => t.themes[k].default) ?? themes[0];

/** color-mix in the design system's own dialect — its neutrals, not ours. */
const mix = (color, pct, base) =>
  `color-mix(in oklab, ${color} ${pct}, ${base})`;

/**
 * One preset's accent block. `--accent-*` is the v3 contract; the aliases below
 * it are what the v1 components in the project actually read, so both have to
 * be present or half the kit renders in the previous palette.
 */
function block(theme, app) {
  const T = t.themes[theme];
  const m = t.mix[app];
  const human = T.human[app];
  const agent = T.agent[app];
  const lines = [
    `  --accent-human: ${human};`,
    `  --accent-human-text: ${T["human-text"][app]};`,
    `  --accent-human-hover: ${mix("var(--accent-human)", m.hover, "var(--ink)")};`,
    `  --accent-human-active: ${mix("var(--accent-human)", m.active, "var(--ink)")};`,
    `  --accent-human-soft: ${mix("var(--accent-human)", m.soft, "var(--surface)")};`,
    `  --on-accent-human: ${T["on-human"][app]};`,
    `  --accent-agent: ${agent};`,
    `  --accent-agent-text: ${T["agent-text"][app]};`,
    `  --accent-agent-hover: ${mix("var(--accent-agent)", m.hover, "var(--ink)")};`,
    `  --accent-agent-active: ${mix("var(--accent-agent)", m.active, "var(--ink)")};`,
    `  --accent-agent-soft: ${mix("var(--accent-agent)", m.soft, "var(--surface)")};`,
    `  --on-accent-agent: ${T["on-agent"][app]};`,
    `  /* v1 aliases — every component in this project reads these names. */`,
    `  --human: var(--accent-human);`,
    `  --agent: var(--accent-agent);`,
    `  --on-human: var(--on-accent-human);`,
    `  --on-agent: var(--on-accent-agent);`,
    `  --human-tint: var(--accent-human-soft);`,
    `  --agent-tint: var(--accent-agent-soft);`,
    `  --focus-ring: ${mix("var(--accent-human)", m.ring, "transparent")};`,
    `  --agent-ring: ${mix("var(--accent-agent)", m["acknowledged-ring"], "transparent")};`,
    `  --agent-border: ${mix("var(--accent-agent)", m.border, "var(--line)")};`,
    `  --status-done: var(--accent-human);`,
  ];
  return lines.join("\n");
}

const out = [
  "/* LongClaw theme tokens — generated from apps/desktop/src/tokens/design-tokens.json.",
  " * DO NOT EDIT BY HAND. Regenerate with `npm run design:emit` in apps/desktop.",
  " *",
  ` * Presets: ${themes.join(" · ")} (${DEFAULT} is the default).`,
  " * The agent accent is constant across every preset — agent presence must read",
  " * the same in every project (decisions.md D2).",
  " *",
  ' * Contract: data-lc-theme="<preset>" is the theme, data-theme="light|dark" the',
  " * appearance. Both may sit on the same element or on an ancestor.",
  " * Load AFTER tokens/colors.css — these aliases override its hardcoded pair.",
  " */",
  "",
  `/* fallback: ${DEFAULT}, light — so a bare document still renders */`,
  ":root {",
  block(DEFAULT, "light"),
  "}",
  "",
];

for (const app of APPEARANCES) {
  out.push(`[data-theme="${app}"] {`, block(DEFAULT, app), "}", "");
}
for (const theme of themes) {
  for (const app of APPEARANCES) {
    out.push(
      `[data-theme="${app}"][data-lc-theme="${theme}"] {`,
      block(theme, app),
      "}",
      "",
    );
  }
}

const dir = join(here, "claude-design");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "themes.css"), out.join("\n"));
console.log(
  `emit-design-system: wrote claude-design/themes.css (${themes.length} presets × ${APPEARANCES.length} appearances)`,
);
