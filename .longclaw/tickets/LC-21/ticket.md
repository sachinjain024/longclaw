---
format: longclaw.ticket/v1
id: 265e3e56-e839-4f4b-926e-8d6dc1619668
key: LC-21
title: Palette sub-modes for status, priority, ordering, theme, project, and search
status: done
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-11T14:02:50.391Z
---

Palette sub-modes for status, priority, ordering, theme, project, and search

## Why it exists

A flat command list cannot express "change status to…" without a second surface, and `Esc` stepping back rather than out is the behaviour the spec defines.

## Source

`docs/backlog/v0-backlog.md` — **V0-21**, Wave 2, step 12, owner Frontend.

## Checklist

- [x] Sub-modes show the crumb, Esc steps back to root, and a command with no target is disabled with an inline explanation rather than failing <!-- longclaw:item=ck_828ac2cb -->

## Activity

<!-- longclaw:event
id: evt_e1acfb83
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e6c916b9
kind: update
occurred_at: 2026-08-05T15:14:39.580Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_35ee4cd1
kind: update
occurred_at: 2026-08-11T14:02:50.391Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_828ac2cb.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Already shipped on 2026-08-01, before this ticket was filed. V0-21 is [plan 26](../../../docs/plans/completed/26-palette-sub-modes.md), closed as "All six modes, target selection, previews, notes, reasons, navigation, and tests are complete", under the Step 12 completion recorded at `docs/plans/active/README.md:36`.

Verified in the tree: all six sub-modes this ticket names are in `CommandPalette.tsx` — project (:246), status (:252), priority (:265), search (:276), theme (:300) and ordering (:317). The disabled-with-a-reason behaviour the checklist asks for is the same mechanism the Phase 2 terminal row uses (:330-337): a `disabled` flag carrying a `reason` rather than a command that fails when run. `keyboard-focus-map.md:112` pins the Esc contract — sub-mode steps back to root, root closes.

Filed by the 2026-08-05 import off the unstruck `v0-backlog.md:136` row.
<!-- /longclaw:event -->
