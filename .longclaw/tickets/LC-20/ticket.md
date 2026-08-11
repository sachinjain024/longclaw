---
format: longclaw.ticket/v1
id: a787caed-df2e-430f-b746-54e2e592a92b
key: LC-20
title: ⌘K palette shell and the approved root command set, with the Phase 2 terminal command present and disabled
status: done
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-11T14:02:50.369Z
---

`⌘K` palette shell and the approved root command set, with the Phase 2 terminal command present and disabled

## Why it exists

The palette is the product's primary navigation claim and the cheapest path to every command once the commands exist.

## Source

`docs/backlog/v0-backlog.md` — **V0-20**, Wave 2, step 12, owner Frontend.

## Checklist

- [x] Every root command in the screen spec runs against the correct project and focused ticket; the terminal row is visible, disabled, and tagged PHASE 2 <!-- longclaw:item=ck_1bc70ed6 -->

## Activity

<!-- longclaw:event
id: evt_9de69147
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
id: evt_1b0c574c
kind: update
occurred_at: 2026-08-05T15:14:39.554Z
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
id: evt_9204b284
kind: update
occurred_at: 2026-08-11T14:02:50.369Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_1bc70ed6.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Already shipped — on 2026-08-01, four days before this ticket was filed.

V0-20 is [plan 25](../../../docs/plans/completed/25-command-palette-shell.md), closed as "Root commands, styling, accessibility, focus behavior, and tests are complete", and `docs/plans/active/README.md:36` states outright that Step 12 — Wave 2, keyboard-first — is complete, V0-20 through V0-25 being plans 24-29.

Verified in the tree rather than taken from the plan. `CommandPalette.tsx` carries the root set — create ticket, go to project, change status, set priority, search tickets, star/unstar, toggle appearance, change theme, archive/unarchive, change ordering, switch view — and the checklist's specific clause holds at `CommandPalette.tsx:330-337`, where the terminal row is present with `disabled: true`, `hint: "PHASE 2"` and a reason of "Terminals arrive in Phase 2".

This ticket exists because the 2026-08-05 import read the unstruck row at `docs/backlog/v0-backlog.md:135` rather than the plans table. That row is the stale one — the same import artefact that produced LC-21 through LC-25.
<!-- /longclaw:event -->
