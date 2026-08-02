#!/usr/bin/env node
/**
 * Generates design-tokens.css from design-tokens.json.
 *
 * Output contract (see also $meta.contract in the JSON):
 *   - Static tokens (type, space, size, radius, border, motion) live on :root.
 *   - Appearance tokens live on [data-appearance="light|dark"].
 *   - Theme accents live on [data-appearance][data-theme] compound blocks.
 *   - Every soft/hover/ring/rail accent variant is DERIVED once via
 *     color-mix(in oklab, …), so a theme preset supplies only its accent
 *     values — switching theme or appearance swaps tokens and nothing else.
 *   - :root carries light/indigo fallbacks so a bare document still renders.
 *
 * Usage: node tokens/build.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, "design-tokens.json"), "utf8"));

/* ---------- validation (V0-34) ----------
 * A theme missing a value used to emit the literal string "undefined" into
 * the CSS and ship. A gap is a build failure naming the token instead. */

const missing = [];
const requireAppearances = (path, value) => {
  for (const app of ["light", "dark"]) {
    if (typeof value?.[app] !== "string" || value[app] === "") {
      missing.push(`${path}.${app}`);
    }
  }
};

/* `note` keys are prose; `status.done` derives from the human accent. */
for (const group of ["neutral", "status", "priority", "feedback", "label"]) {
  for (const [k, v] of Object.entries(t.color[group])) {
    if (k === "note" || (group === "status" && k === "done")) continue;
    requireAppearances(`color.${group}.${k}`, v);
  }
}
const ACCENT_ROLES = [
  "human",
  "human-text",
  "on-human",
  "agent",
  "agent-text",
  "on-agent",
];
for (const [theme, preset] of Object.entries(t.themes)) {
  if (theme === "note") continue;
  for (const role of ACCENT_ROLES) {
    requireAppearances(`themes.${theme}.${role}`, preset[role]);
  }
}
for (const app of ["light", "dark"]) {
  for (const group of ["elevation", "mix"]) {
    if (!t[group]?.[app]) missing.push(`${group}.${app}`);
  }
}
if (missing.length > 0) {
  throw new Error(
    `design-tokens.json is missing theme values:\n  ${missing.join("\n  ")}`,
  );
}

const P = "--lc-";
const px = (v) => (typeof v === "number" ? `${v}px` : v);
const line = (name, value) => `  ${P}${name}: ${value};`;

/* ---------- static tokens ---------- */

const staticLines = [];
for (const [k, v] of Object.entries(t.font))
  staticLines.push(line(`font-${k}`, v));
for (const [k, v] of Object.entries(t.type)) {
  staticLines.push(line(`type-${k}-font`, `var(${P}font-${v.font})`));
  staticLines.push(line(`type-${k}-size`, px(v.size)));
  staticLines.push(line(`type-${k}-weight`, v.weight));
  staticLines.push(line(`type-${k}-leading`, v.lineHeight));
  staticLines.push(line(`type-${k}-tracking`, v.tracking));
}
for (const [k, v] of Object.entries(t.space))
  staticLines.push(line(`space-${k}`, px(v)));
for (const [k, v] of Object.entries(t.size))
  staticLines.push(line(`size-${k}`, px(v)));
for (const [k, v] of Object.entries(t.radius))
  staticLines.push(line(`radius-${k}`, px(v)));
for (const [k, v] of Object.entries(t.border))
  staticLines.push(line(`border-${k}`, px(v)));
for (const [k, v] of Object.entries(t.motion)) {
  if (k === "note") continue;
  staticLines.push(line(`motion-${k}`, v));
}

/* ---------- appearance tokens ---------- */

const appearanceLines = (app) => {
  const out = [];
  out.push(`  color-scheme: ${app};`);
  for (const [k, v] of Object.entries(t.color.neutral))
    out.push(line(k, v[app]));
  for (const [k, v] of Object.entries(t.color.status)) {
    if (k === "note" || k === "done")
      continue; /* done derives from the human accent */
    out.push(line(`status-${k}`, v[app]));
  }
  for (const [k, v] of Object.entries(t.color.priority)) {
    if (k === "note") continue;
    out.push(line(`priority-${k}`, v[app]));
    if (v[`mark-${app}`])
      out.push(line(`priority-${k}-mark`, v[`mark-${app}`]));
  }
  for (const [k, v] of Object.entries(t.color.feedback)) {
    if (k === "note") continue;
    out.push(line(k, v[app]));
  }
  for (const [k, v] of Object.entries(t.color.label)) {
    if (k === "note") continue;
    out.push(line(`label-${k}`, v[app]));
  }
  for (const [k, v] of Object.entries(t.elevation[app]))
    out.push(line(`shadow-${k}`, v));
  for (const [k, v] of Object.entries(t.mix[app]))
    out.push(line(`mix-${k}`, v));
  return out;
};

/* ---------- theme accents ---------- */

const themeLines = (theme, app) => {
  const T = t.themes[theme];
  return [
    line("accent-human", T.human[app]),
    line("accent-human-text", T["human-text"][app]),
    line("on-accent-human", T["on-human"][app]),
    line("accent-agent", T.agent[app]),
    line("accent-agent-text", T["agent-text"][app]),
    line("on-accent-agent", T["on-agent"][app]),
  ];
};

/* ---------- derived accent variants (declared once) ---------- */

const derived = [];
for (const actor of ["human", "agent"]) {
  const a = `var(${P}accent-${actor})`;
  derived.push(
    line(
      `accent-${actor}-soft`,
      `color-mix(in oklab, ${a} var(${P}mix-soft), var(${P}surface))`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-wash`,
      `color-mix(in oklab, ${a} var(${P}mix-wash), var(${P}surface))`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-ring`,
      `color-mix(in oklab, ${a} var(${P}mix-ring), transparent)`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-hover`,
      `color-mix(in oklab, ${a} var(${P}mix-hover), var(${P}ink))`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-active`,
      `color-mix(in oklab, ${a} var(${P}mix-active), var(${P}ink))`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-border`,
      `color-mix(in oklab, ${a} var(${P}mix-border), var(${P}line))`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-rail`,
      `color-mix(in oklab, ${a} var(${P}mix-rail), transparent)`,
    ),
  );
  derived.push(
    line(
      `accent-${actor}-avatar-ring`,
      `color-mix(in oklab, ${a} var(${P}mix-avatar-ring), transparent)`,
    ),
  );
}
derived.push(
  line(
    "accent-agent-fresh-ring",
    `color-mix(in oklab, var(${P}accent-agent) var(${P}mix-fresh-ring), transparent)`,
  ),
);
derived.push(
  line(
    "accent-agent-fresh-border",
    `color-mix(in oklab, var(${P}accent-agent) var(${P}mix-border), var(${P}line))`,
  ),
);
derived.push(
  line(
    "accent-agent-pulse",
    `color-mix(in oklab, var(${P}accent-agent) var(${P}mix-pulse), transparent)`,
  ),
);
derived.push(line("status-done", `var(${P}accent-human)`));
derived.push(
  line("focus-ring", `0 0 0 var(${P}border-focus) var(${P}accent-human-ring)`),
);

/* ---------- assemble ---------- */

const themes = Object.keys(t.themes).filter((k) => k !== "note");
const out = [];
out.push(
  `/* LongClaw design tokens v${t.$meta.version} — GENERATED by tokens/build.mjs, do not edit.`,
);
out.push(
  ` * Source: tokens/design-tokens.json · Verified: scripts/a11y-check.mjs`,
);
out.push(
  ` * Contract: set data-appearance="light|dark" AND data-theme="${themes.join("|")}"`,
);
out.push(
  ` * on the same root element (<html>). Components consume only --lc-* tokens;`,
);
out.push(` * no component hardcodes an accent hue. */`);
out.push("");
out.push(":root {");
out.push(...staticLines);
out.push("}");
out.push("");
out.push(
  "/* Fallbacks so a bare document renders as light Indigo (the defaults). */",
);
out.push(":root {");
out.push(...appearanceLines("light"));
out.push(...themeLines("indigo", "light"));
out.push("}");
out.push("");
for (const app of ["light", "dark"]) {
  out.push(`[data-appearance="${app}"] {`);
  out.push(...appearanceLines(app));
  out.push("}");
  out.push("");
}
for (const theme of themes) {
  for (const app of ["light", "dark"]) {
    out.push(`[data-appearance="${app}"][data-theme="${theme}"] {`);
    out.push(...themeLines(theme, app));
    out.push("}");
    out.push("");
  }
}
out.push(
  "/* Derived accent variants — resolve against whichever theme/appearance is active. */",
);
out.push(":root, [data-appearance] {");
out.push(...derived);
out.push("}");
out.push("");
out.push(
  "/* The agent pulse — the designed acknowledgement of an external file edit.",
);
out.push(
  `   Play ${t.motion["pulse-iterations"]} iterations of ${t.motion["pulse-duration"]}; never loop forever. */`,
);
out.push("@keyframes lc-pulse {");
out.push(`  0% { box-shadow: 0 0 0 0 var(${P}accent-agent-pulse); }`);
out.push("  70% { box-shadow: 0 0 0 9px transparent; }");
out.push("  100% { box-shadow: 0 0 0 0 transparent; }");
out.push("}");
out.push("");
/* Every motion token that names a duration is zeroed, derived from the group
   rather than listed here: a hardcoded list silently exempts the next token
   anyone adds, which is exactly what happened to `motion.spinner`. Counts and
   easing curves are not durations and are left alone. */
const zeroed = Object.entries(t.motion)
  .filter(([, value]) => typeof value === "string" && /^[\d.]+m?s$/.test(value))
  .map(([name]) => `${P}motion-${name}: 0ms;`);
out.push("@media (prefers-reduced-motion: reduce) {");
out.push(`  :root { ${zeroed.join(" ")} }`);
out.push("}");
out.push("");

writeFileSync(join(here, "design-tokens.css"), out.join("\n"));
console.log(
  `wrote design-tokens.css (${out.length} lines, ${themes.length} themes × 2 appearances)`,
);
