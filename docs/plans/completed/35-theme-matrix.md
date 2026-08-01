---
title: "The visual regression matrix: every preset × appearance on the core screens"
product: LongClaw
status: completed
backlog_id: V0-37
order: 35
owner_area: Design
release_blocking: false
written: 2026-08-01
applies_to: "step-13-themes-appearance @ bc53761"
depends_on: "33 — the guard makes a literal color a build failure; this makes a wrong *token* a failure"
---

# The visual regression matrix: every preset × appearance on the core screens

> "Four presets across two appearances over board, list, panel, menus, dialogs,
> errors, timeline, and external-update states is more than a human re-checks
> reliably." — `docs/backlog/v0-backlog.md:163`

## Must-pass

> The matrix runs in CI and fails on a contrast or actor-distinction regression.

## What this checks that nothing else does

- `scripts/a11y-check.mjs` proves the **tokens** clear WCAG AA and the
  human/agent accents stay distinct under CVD — for every preset × appearance,
  at the JSON level. It cannot see a component that reads the *wrong* token.
- Plan 33's color guard proves no component carries a literal hue. It cannot
  see a component pairing `--lc-ink-3` text with a background it fails on.
- This matrix renders the real `App` (the perf harness already mounts the
  shipping code over stubbed IPC) in all four presets × both appearances,
  drives the core states, and asserts **rendered** element pairs: text
  contrast from computed styles, and the actor-distinction contract — an
  agent-attributed element renders with the agent accent tokens, a
  human-attributed one with the human tokens, and the two rendered colors are
  the distinct pair the token check validated.

It is deliberately **not** an interaction-budget job: nothing here measures
time, so the shared-runner problem that removed the perf job (V0-42, run
30675271000) does not apply.

## What to change

1. `perf/stubs/core.ts` learns two more commands: `read_ticket` (serving a
   detail whose activity holds a human comment, an agent comment, agent field
   changes, and an unattributed `external_change` — the timeline states) and a
   rejecting `update_project_name` (a typed `permission_denied`, to raise the
   real error banner).
2. `perf/theme-matrix.mjs` (new): vite preview + WebKit, and per axis drives:
   board with an external-update acknowledgement, the issue list, the ticket
   panel with the timeline, the status menu, quick create (dialog), project
   settings (the theme picker), and the error banner. Each state carries a
   probe list — selector, property, expectation (AA contrast against the
   effective background, or equality with a named token) — and a probe that
   matches nothing fails, so a renamed class cannot silently hollow the check.
   Screenshots of every state × axis land in `dist-matrix/` as the visual
   record; the exit code is the gate.
3. `npm run matrix` script; a `Theme matrix` CI job (WebKit install + build +
   run), uploading `dist-matrix/` as an artifact.

## Must-pass checks

- An unmodified tree passes across all 8 axes.
- Mutation: pointing an agent-attributed probe element at the human accent
  token (or breaking a text/background pairing) fails the run naming the
  probe, theme, and appearance.

## Outcome

Done 2026-08-01. `perf/theme-matrix.mjs` drives the real `App` (perf harness,
stubbed IPC) through seven states — board with the external-update
acknowledgement, list, panel with the full timeline, status menu, quick
create, settings with the theme picker, and the error banner — in all four
presets × both appearances, and checks rendered styles: WCAG AA 4.5:1 text
contrast against the composited effective background, token-equality probes
for accent-bearing elements, and ΔE ≥ 10 between the rendered human and agent
accents. A probe that matches nothing fails, which caught two wrong selectors
on the first run. `npm run matrix`; the `Theme matrix` CI job installs
WebKit, runs it, and uploads `dist-matrix/` as the visual record. The stubs
gained `read_ticket` (a detail whose activity holds a human comment, an agent
comment, agent field changes, and an unattributed external change) and a
rejecting `update_project_name` for the error state.

The mutation check: pointing `.actor-tile.agent` at the human accent failed
all eight axes twice over — the token probe named the element and the drift,
and the distinction pair reported ΔE 0.0. Clean tree: 8 axes × 7 states, no
failures.

**Two things worth knowing.** The mutation run leaves its build behind:
`dist-perf/` and `dist-matrix/` are whatever the last `npm run matrix` built,
so a screenshot examined after a mutation run shows the mutation — rebuild
before reading artifacts (an hour was nearly lost to a "pink agent tile"
that was this plan's own injected defect). And the palette is the one core
surface the matrix does not drive — its rendering is pinned by
`CommandPalette.test.tsx` and its rows are the same tokens the settings
picker probes, but a future pass could add it as an eighth state.
