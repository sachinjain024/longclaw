---
format: longclaw.ticket/v1
id: 7295a4cc-9d65-4203-9578-5f0f4c2c9ffa
key: LC-36
title: Instant per-project theme selection at creation, in settings, and from the palette
status: done
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:13Z
updated_at: 2026-08-05T14:23:14Z
---

~~Instant per-project theme selection at creation, in settings, and from the palette~~ **Done 2026-08-01** — the specified picker (`screen-specs.md:92-98`: 44×28 pair swatches, micro name, human-accent selection ring) is `src/ThemePicker.tsx`, native radios in a fieldset, used at creation and in settings; the palette already had swatch rows. The 150ms crossfade is one transient `theme-transition` class on `<html>` under which color-bearing properties transition and nothing else does; both the theme and appearance stamps apply it on a *change* and never on launch. `changeTheme` is optimistic — the reference flips before the write, reverts and says so on failure — and no longer re-loads the project, because a theme change is a fact about `longclaw.yaml`, not tickets. [Plan 32](../../../docs/plans/completed/32-instant-theme-selection.md)

## Must-pass

Passed: four claims in `App.test.tsx` § V0-36 (three confirmed red against the old `changeTheme`) — instant apply writing only `update_project_theme`, crossfade on change and never on first stamp, revert + error on refusal, and exactly four fixed presets with no custom-color affordance. Persistence to `longclaw.yaml` was already correct and unchanged

## Source

`docs/backlog/v0-backlog.md` — **V0-36**, Wave 3, step 13, owner Frontend.

## Checklist

- [x] Passed: four claims in App.test.tsx § V0-36 (three confirmed red against the old changeTheme) — instant apply writing only update_project_theme, crossfade on change and never on first stamp, revert + error on refusal, and exactly four fixed presets with no custom-color affordance. Persistence to… <!-- longclaw:item=ck_42d25ab6 -->

## Activity

<!-- longclaw:event
id: evt_7bb45fb6
kind: create
occurred_at: 2026-08-05T14:23:13Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ca5e8985
kind: update
occurred_at: 2026-08-05T14:23:14Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_42d25ab6.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-36 is recorded there as passed.
<!-- /longclaw:event -->
