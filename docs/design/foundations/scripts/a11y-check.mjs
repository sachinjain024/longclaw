#!/usr/bin/env node
/**
 * LongClaw design-token accessibility checker.
 *
 * Reads tokens/design-tokens.json and verifies:
 *   1. WCAG 2.1 AA text contrast (≥ 4.5:1) for every text-bearing pair,
 *      across all theme presets × both appearances.
 *   2. WCAG 2.1 AA non-text contrast (≥ 3:1) for status/priority glyphs,
 *      focus indication, and accent fills.
 *   3. Human/agent accent distinction under normal vision and simulated
 *      protanopia, deuteranopia and tritanopia (Machado 2009, severity 1.0),
 *      reported as CIE76 ΔE with lightness deltas.
 *
 * Soft/tint derivations replicate the CSS color-mix(in oklab, …) math so the
 * checked values are the values that ship.
 *
 * Usage:  node scripts/a11y-check.mjs [--write]
 *   --write   regenerate ../accessibility.md from the results
 * Exits non-zero if any hard requirement fails.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/* LC-192: the one token file. This used to read a fork under ../tokens/ that
   stopped tracking the shipped tokens at LC-183, so every AA number below was
   proved against values the app did not use. An explicit path may be passed to
   check a candidate set before landing it. */
const tokensPath =
  process.argv.find((a) => a.endsWith(".json")) ??
  join(here, "../../../../apps/desktop/src/tokens/design-tokens.json");
const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));

/* ---------- color math ---------- */

const hex2rgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const rgb2hex = (rgb) =>
  "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const luminance = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* oklab, for replicating CSS color-mix(in oklab, …) */
const srgb2oklab = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const oklab2srgb = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgb2hex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(unlin)
  );
};
/** color-mix(in oklab, a p%, b) */
const mixOklab = (a, b, p) => {
  const A = srgb2oklab(a), B = srgb2oklab(b);
  return oklab2srgb(A.map((v, i) => v * p + B[i] * (1 - p)));
};

/* CVD simulation — Machado, Oliveira & Fernandes (2009), severity 1.0, linear RGB */
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const simulate = (hex, kind) => {
  const rgb = hex2rgb(hex).map(lin);
  const m = CVD[kind];
  return rgb2hex(m.map((row) => row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]).map(unlin));
};

/* CIE Lab (D65) + ΔE76 */
const srgb2lab = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(lin);
  const [x, y, z] = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const deltaE = (a, b) => {
  const A = srgb2lab(a), B = srgb2lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

/* ---------- token access ---------- */

const APPEARANCES = ["light", "dark"];
const THEMES = Object.keys(tokens.themes).filter((k) => k !== "note");
const N = (name, app) => tokens.color.neutral[name][app];
const pct = (app, key) => parseFloat(tokens.mix[app][key]) / 100;

/* ---------- checks ---------- */

const results = { text: [], nonText: [], cvd: [] };
let failures = 0;

const check = (bucket, scope, fg, bg, label, min) => {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failures++;
  results[bucket].push({ scope, label, fg, bg, ratio, min, pass });
};

for (const app of APPEARANCES) {
  const S = (name) => tokens.color.status[name]?.[app];
  const scope = `system · ${app}`;
  const surfaces = app === "light"
    ? [["bg", N("bg", app)], ["surface", N("surface", app)], ["wash", N("wash", app)]]
    : [["bg", N("bg", app)], ["surface", N("surface", app)], ["raised", N("raised", app)], ["wash", N("wash", app)]];

  for (const [sName, sVal] of surfaces) {
    check("text", scope, N("ink", app), sVal, `ink on ${sName}`, 4.5);
    check("text", scope, N("ink-2", app), sVal, `ink-2 on ${sName}`, 4.5);
    check("text", scope, N("ink-3", app), sVal, `ink-3 on ${sName}`, 4.5);
  }
  check("text", scope, N("inverse-ink", app), N("inverse-surface", app), "toast text on toast", 4.5);
  check("text", scope, N("inverse-ink-2", app), N("inverse-surface", app), "toast secondary on toast", 4.5);

  const F = (name) => tokens.color.feedback[name][app];
  check("text", scope, F("warn"), N("surface", app), "warn text on surface", 4.5);
  check("text", scope, F("warn"), F("warn-surface"), "warn text on warn banner", 4.5);
  check("text", scope, F("warn-ink"), F("warn-surface"), "warn secondary on warn banner", 4.5);
  check("text", scope, F("danger"), N("surface", app), "danger text on surface", 4.5);
  check("text", scope, F("danger"), F("danger-surface"), "danger text on danger surface", 4.5);
  if (app === "dark") check("text", scope, F("danger"), N("raised", app), "danger text on raised", 4.5);

  /* status + priority glyphs: non-text UI, ≥ 3:1 vs canvas and card.
     P1–P4 chip labels are real (mono) text, so they take the 4.5:1 text gate. */
  for (const [sName, sVal] of [["bg", N("bg", app)], ["surface", N("surface", app)]]) {
    for (const st of ["backlog", "todo", "in-progress", "in-review", "canceled"]) {
      check("nonText", scope, S(st), sVal, `status ${st} on ${sName}`, 3);
    }
    check("nonText", scope, tokens.color.priority.urgent[app], sVal, `priority urgent on ${sName}`, 3);
    check("text", scope, tokens.color.priority["chip-text"][app], sVal, `priority P1–P4 chip text on ${sName}`, 4.5);
  }
  check(
    "nonText", scope,
    tokens.color.priority.urgent[`mark-${app}`],
    tokens.color.priority.urgent[app],
    "urgent mark on urgent fill", 3
  );
}

/* per-theme accent checks */
for (const theme of THEMES) {
  const T = tokens.themes[theme];
  for (const app of APPEARANCES) {
    const scope = `${theme} · ${app}`;
    const surface = N("surface", app);
    const bgc = N("bg", app);
    const human = T.human[app], agent = T.agent[app];
    const humanText = T["human-text"][app], agentText = T["agent-text"][app];
    const humanSoft = mixOklab(human, surface, pct(app, "soft"));
    const agentSoft = mixOklab(agent, surface, pct(app, "soft"));
    const agentWash = mixOklab(agent, surface, pct(app, "wash"));

    check("text", scope, T["on-human"][app], human, "button label on human accent", 4.5);
    check("text", scope, humanText, surface, "human accent text on surface", 4.5);
    check("text", scope, humanText, humanSoft, "human accent text on soft chip", 4.5);
    check("text", scope, agentText, surface, "agent accent text on surface", 4.5);
    check("text", scope, agentText, agentSoft, "agent accent text on soft chip", 4.5);
    check("text", scope, agentText, agentWash, "agent accent text on checklist wash", 4.5);

    check("nonText", scope, human, surface, "human accent fill (done dot, selection) on surface", 3);
    check("nonText", scope, human, bgc, "human accent fill on bg", 3);
    check("nonText", scope, agent, surface, "agent accent fill (checkbox, dot) on surface", 3);
    check("nonText", scope, T["on-agent"][app], agent, "agent check mark on fill", 3);
    check("nonText", scope, agent, N("tile", app), "agent ❯ prompt on avatar tile", 3);
    check("nonText", scope, human, surface, "focus border (1px accent) on surface", 3);

    /* CVD distinction: the brand-critical pair */
    for (const kind of ["normal", "protanopia", "deuteranopia", "tritanopia"]) {
      const h = kind === "normal" ? human : simulate(human, kind);
      const a = kind === "normal" ? agent : simulate(agent, kind);
      const dE = deltaE(h, a);
      const dL = Math.abs(srgb2lab(h)[0] - srgb2lab(a)[0]);
      /* ΔE ≥ 20: clearly distinct. 12–20: acceptable only because shape/typography
         redundancy always accompanies the hue (circle vs tile, sans vs mono). */
      const pass = dE >= 20 || (dE >= 12 && dL >= 10);
      if (!pass) failures++;
      results.cvd.push({ scope, kind, human: h, agent: a, dE, dL, pass });
    }
  }
}

/* ---------- report ---------- */

const fmt = (n) => n.toFixed(2);
const failWord = (p) => (p ? "pass" : "**FAIL**");

for (const row of [...results.text, ...results.nonText]) {
  if (!row.pass)
    console.error(`FAIL  [${row.scope}] ${row.label}: ${row.fg} on ${row.bg} = ${fmt(row.ratio)} (needs ${row.min})`);
}
for (const row of results.cvd) {
  if (!row.pass)
    console.error(`FAIL  [${row.scope}] ${row.kind}: human/agent ΔE ${fmt(row.dE)} ΔL ${fmt(row.dL)}`);
}

console.log(
  `\n${results.text.length + results.nonText.length} contrast pairs, ${results.cvd.length} CVD pairs — ${
    failures === 0 ? "all pass" : failures + " failure(s)"
  }`
);

if (process.argv.includes("--write")) {
  const lines = [];
  lines.push("# Accessibility & contrast results");
  lines.push("");
  lines.push("> Generated by `scripts/a11y-check.mjs --write`. Do not edit by hand — rerun after any token change.");
  lines.push("");
  lines.push("## Method");
  lines.push("");
  lines.push("- **Text contrast** — WCAG 2.1 AA for normal text (≥ 4.5:1). LongClaw's UI type runs 10.5–17 px, all below the AA large-text threshold, so 4.5:1 is applied everywhere text appears.");
  lines.push("- **Non-text contrast** — WCAG 2.1 AA for UI components and graphical objects (≥ 3:1): status and priority glyphs, accent fills, check marks, focus indication.");
  lines.push("- **Soft/tint surfaces** are computed with the same `color-mix(in oklab, …)` math the shipped CSS uses, so tested values are shipped values.");
  lines.push("- **Color-vision deficiency** — accents simulated with Machado, Oliveira & Fernandes (2009) matrices at severity 1.0 (protanopia, deuteranopia, tritanopia), compared as CIE76 ΔE and lightness delta ΔL.");
  lines.push("- **Pass rule for the human/agent pair** — ΔE ≥ 20, or ΔE ≥ 12 with ΔL ≥ 10. The relaxed tier is acceptable because hue is never the only channel: humans are circles set in the UI sans; agents are square terminal tiles set in mono with the ❯ prompt glyph and an `agent` badge. See components.md § Agent presence.");
  lines.push("");
  lines.push("## Text contrast (AA ≥ 4.5:1)");
  lines.push("");
  lines.push("| Scope | Pair | Colors | Ratio | Result |");
  lines.push("|---|---|---|---:|---|");
  for (const r of results.text)
    lines.push(`| ${r.scope} | ${r.label} | \`${r.fg}\` on \`${r.bg}\` | ${fmt(r.ratio)} | ${failWord(r.pass)} |`);
  lines.push("");
  lines.push("## Non-text contrast (AA ≥ 3:1)");
  lines.push("");
  lines.push("| Scope | Pair | Colors | Ratio | Result |");
  lines.push("|---|---|---|---:|---|");
  for (const r of results.nonText)
    lines.push(`| ${r.scope} | ${r.label} | \`${r.fg}\` on \`${r.bg}\` | ${fmt(r.ratio)} | ${failWord(r.pass)} |`);
  lines.push("");
  lines.push("## Human/agent distinction under color-vision deficiency");
  lines.push("");
  lines.push("| Theme · appearance | Vision | Human → | Agent → | ΔE | ΔL | Result |");
  lines.push("|---|---|---|---|---:|---:|---|");
  for (const r of results.cvd)
    lines.push(`| ${r.scope} | ${r.kind} | \`${r.human}\` | \`${r.agent}\` | ${fmt(r.dE)} | ${fmt(r.dL)} | ${failWord(r.pass)} |`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Values adjusted from the approved visual reference to clear these gates are listed in `decisions.md` § Accessibility adjustments.");
  lines.push("- Label dots are reinforcement only (the chip text is the identifier) and are not held to 3:1; `ink-disabled` is used exclusively for disabled states, which WCAG exempts.");
  lines.push("- Backlog and Todo share a stroke color by design; the dash pattern is the distinction, which survives every CVD type.");
  lines.push("");
  writeFileSync(join(here, "../accessibility.md"), lines.join("\n"));
  console.log("wrote accessibility.md");
}

process.exit(failures === 0 ? 0 : 1);
