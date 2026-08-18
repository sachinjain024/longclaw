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
 * Since LC-223 it carries the whole reconciled layer, not just accents:
 * D18 resolved E1–E12 prototype-first, so `colors.css` (neutrals, status,
 * priority, labels, avatars, toast) and `typography.css` (the type scale,
 * micro back at 10.5 mono, the title on the display face) are generated
 * too, in the DS's own unprefixed dialect. The retired glyph sets' tokens
 * (`--priority`, `--priority-off`) stay emitted as deprecated aliases so
 * the not-yet-rewritten v1 components keep rendering until LC-196 lands.
 *
 * Output is `claude-design/{themes,colors,typography}.css`, checked in and
 * verified by `design:check` the same way `design-tokens.css` is verified
 * by `tokens:check` — regenerate, diff, fail on drift. The upload itself is
 * a separate step; this only makes the payload reproducible.
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

/* ---- colors.css — the DS dialect of the reconciled non-accent layer ---- */

const N = (name, app) => t.color.neutral[name][app];
const S = (name, app) => t.color.status[name][app];
const F = (name, app) => t.color.feedback[name][app];
const P = (name, app) => t.color.priority[name][app];
const L = (name, app) => t.color.label[name][app];
const A = (name, app) => t.color.avatar[name][app];

function colorsBlock(app) {
  return [
    `  /* neutrals */`,
    `  --bg: ${N("bg", app)};`,
    `  --surface: ${N("surface", app)};`,
    `  --raised: ${N("raised", app)};`,
    `  --ink: ${N("ink", app)};`,
    `  --ink-2: ${N("ink-2", app)};`,
    `  --ink-3: ${N("ink-3", app)};`,
    `  --ink-4: ${N("ink-disabled", app)};`,
    `  --line: ${N("line", app)};`,
    `  --line-soft: ${N("line-soft", app)};`,
    `  --ctrl-border: ${N("line-strong", app)};`,
    `  --check-border: ${N("check-border", app)};`,
    `  /* feedback */`,
    `  --warn: ${F("warn", app)};`,
    `  --warn-bg: ${F("warn-surface", app)};`,
    `  --warn-border: ${F("warn-border", app)};`,
    `  --warn-btn-border: ${F("warn-border-strong", app)};`,
    `  --danger: ${F("danger", app)};`,
    `  --danger-border: ${F("danger-border", app)};`,
    `  /* status — done lives in themes.css as the human accent */`,
    `  --status-backlog: ${S("backlog", app)};`,
    `  --status-todo: ${S("todo", app)};`,
    `  --status-progress: ${S("in-progress", app)};`,
    `  --status-review: ${S("in-review", app)};`,
    `  --status-canceled: ${S("canceled", app)};`,
    `  --status-canceled-x: ${N("surface", app)};`,
    `  /* priority — Urgent · P1–P4 · None (D4); the bar-glyph names are`,
    `     deprecated aliases for the v1 components LC-196 has yet to rewrite */`,
    `  --priority-urgent: ${P("urgent", app)};`,
    `  --priority-urgent-fg: ${t.color.priority.urgent[`mark-${app}`]};`,
    `  --priority-none: ${P("none", app)};`,
    `  --priority: ${P("chip-text", app)};`,
    `  --priority-off: ${P("chip-border", app)};`,
    `  /* label ramp — 8 fixed hues, no green band (D12) */`,
    ...Object.keys(t.color.label)
      .filter((k) => k !== "note")
      .map((k) => `  --label-${k}: ${L(k, app)};`),
    `  /* v1 label aliases */`,
    `  --label-infra: var(--label-blue);`,
    `  --label-watcher: var(--label-orange);`,
    `  --label-design: var(--label-pink);`,
    `  /* avatars — humans are filled circles; the third pair derives from the`,
    `     ramp because the DS's green pair sits in the band D12 keeps for the`,
    `     agent */`,
    `  --avatar-1-bg: ${A("1-bg", app)};`,
    `  --avatar-1-fg: ${A("1-fg", app)};`,
    `  --avatar-2-bg: ${A("2-bg", app)};`,
    `  --avatar-2-fg: ${A("2-fg", app)};`,
    `  --avatar-3-bg: ${mix("var(--label-purple)", "18%", "var(--surface)")};`,
    `  --avatar-3-fg: ${mix("var(--label-purple)", "58%", "var(--ink)")};`,
    `  --avatar-agent-bg: ${N("tile", app)};`,
    `  /* toast is inverted */`,
    `  --toast-bg: ${N("inverse-surface", app)};`,
    `  --toast-fg: ${N("inverse-ink", app)};`,
    `  --toast-kbd: ${mix("var(--toast-fg)", "14%", "transparent")};`,
    `  --toast-muted: ${N("inverse-ink-2", app)};`,
    `  /* text aliases */`,
    `  --text-primary: var(--ink);`,
    `  --text-secondary: var(--ink-2);`,
    `  --text-meta: var(--ink-3);`,
    `  --surface-card: var(--surface);`,
  ].join("\n");
}

const colorsOut = [
  "/* LongClaw color tokens — generated from apps/desktop/src/tokens/design-tokens.json.",
  " * DO NOT EDIT BY HAND. Regenerate with `npm run design:emit` in apps/desktop.",
  " * The AA/CVD-checked values (decisions.md D10, D18): what the app renders",
  " * is what this file says, so what is designed here looks like the app. */",
  ":root {",
  colorsBlock("light"),
  "}",
  '[data-theme="dark"] {',
  colorsBlock("dark"),
  "}",
  "",
];

/* ---- typography.css — the scale in the DS dialect ---- */

const ty = t.type;
const track = (role) => ty[role].tracking ?? "0";
const typographyOut = [
  "/* LongClaw type tokens — generated from apps/desktop/src/tokens/design-tokens.json.",
  " * DO NOT EDIT BY HAND. Regenerate with `npm run design:emit` in apps/desktop.",
  " * Three voices; sizes are fractional — never round them. */",
  ":root {",
  `  --font-display: ${t.font.display};`,
  `  --font-ui: ${t.font.ui};`,
  `  --font-mono: ${t.font.mono};`,
  "  /* scale */",
  "  --size-hero: 46px; /* marketing/specimen only — not in the app scale */",
  "  --size-h2: 27px; /* marketing/specimen only — not in the app scale */",
  `  --size-display: ${ty.display.size}px;`,
  `  --size-title: ${ty.title.size}px; /* the display face since D19 */`,
  `  --size-heading: ${ty.heading.size}px;`,
  `  --size-body: ${ty.body.size}px;`,
  `  --size-ui: ${ty.ui.size}px;`,
  `  --size-small: ${ty.small.size}px;`,
  `  --size-code: ${ty.code.size}px;`,
  `  --size-label: ${ty.label.size}px;`,
  `  --size-micro: ${ty.micro.size}px; /* mono again since D20 (F6) */`,
  `  --track-display: ${track("display")};`,
  `  --track-title: ${track("title")};`,
  `  --track-label: ${track("label")};`,
  `  --lh-body: ${ty.body.lineHeight};`,
  `  --lh-title: ${ty.title.lineHeight};`,
  "}",
  "",
];

const dir = join(here, "claude-design");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "themes.css"), out.join("\n"));
writeFileSync(join(dir, "colors.css"), colorsOut.join("\n"));
writeFileSync(join(dir, "typography.css"), typographyOut.join("\n"));
console.log(
  `emit-design-system: wrote claude-design/{themes,colors,typography}.css (${themes.length} presets × ${APPEARANCES.length} appearances)`,
);
