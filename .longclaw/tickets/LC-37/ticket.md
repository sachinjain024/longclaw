---
format: longclaw.ticket/v1
id: be88e806-9678-462e-ad30-81a4b3220305
key: LC-37
title: "Visual regression matrix: every preset × light and dark on the core screens"
status: done
priority: p3
labels:
  - design
  - v0-backlog
created_at: 2026-08-05T14:23:14Z
updated_at: 2026-08-05T14:23:15Z
---

~~Visual regression matrix: every preset × light and dark on the core screens~~ **Done 2026-08-01** — `npm run matrix` (`perf/theme-matrix.mjs`) drives the real `App` over the perf harness's stubbed IPC through nine states — board with the external-update acknowledgement, list, panel with the full timeline, status menu, the ordering menu with its footnote, the command palette, quick create, settings, error banner — in all 4 presets × 2 appearances, checking rendered styles: AA 4.5:1 text contrast against the composited background, token-equality on accent-bearing elements, ΔE ≥ 10 between the rendered accents, and a probe that matches nothing fails. The `Theme matrix` CI job runs it and uploads the renders; nothing in it measures time, so the shared-runner problem that removed the perf job (V0-42) does not apply. [Plan 35](../../../docs/plans/completed/35-theme-matrix.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-37**, Wave 3, step 13, owner Design.

## Checklist

- [x] Passed: clean tree green across 8 axes × 9 states; the mutation (agent tile wearing the human accent) fails all eight axes naming the probe and reporting ΔE 0.0. The palette and ordering menu were added on review, so every surface the step names is driven <!-- longclaw:item=ck_e0c5f429 -->

## Activity

<!-- longclaw:event
id: evt_0357513b
kind: create
occurred_at: 2026-08-05T14:23:14Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4b324cfb
kind: update
occurred_at: 2026-08-05T14:23:15Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e0c5f429.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-37 is recorded there as passed.
<!-- /longclaw:event -->
