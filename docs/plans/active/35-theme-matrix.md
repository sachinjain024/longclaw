---
title: "The visual regression matrix: every preset × appearance on the core screens"
product: LongClaw
status: active
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

_To be written on completion._
