---
format: longclaw.ticket/v1
id: 8d3670c7-0cf7-4a7d-8629-55197eafea93
key: LC-28
title: Deleted or renamed ticket while it is open
status: done
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:05Z
updated_at: 2026-08-05T14:23:06Z
---

~~Deleted or renamed ticket while it is open~~ **Done 2026-08-02** — `ticketRemoved` now reaches the open `TicketPanel`; the panel stops showing stale content as current, preserves unsaved draft text in memory, and offers retry or close. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-28**, Wave 3, step 14, owner Frontend.

## Checklist

- [x] Passed: TicketPanel.test.tsx preserves an unsaved draft after removal and retries when the file reappears; App.test.tsx proves the event stream notifies the open panel <!-- longclaw:item=ck_6aafe6c6 -->

## Activity

<!-- longclaw:event
id: evt_d7886fe8
kind: create
occurred_at: 2026-08-05T14:23:05Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c87dd304
kind: update
occurred_at: 2026-08-05T14:23:06Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6aafe6c6.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-28 is recorded there as passed.
<!-- /longclaw:event -->
