---
format: longclaw.ticket/v1
id: 05c130f3-a896-43df-9105-af60f4301ae6
key: LC-113
title: Quick create — A bordered ~13px input with placeholder Ticket title
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.312Z
updated_at: 2026-08-07T13:47:23.515Z
---

**Prototype.** Title input is borderless, 15px

**App.** A bordered ~13px input with placeholder `Ticket title`

## Source

`docs/cc_screens_diff.md` — **D-47**, § Quick create, severity P2.

## Checklist

- [x] Borderless, 15px; the modal frame is already the field's boundary. <!-- longclaw:item=ck_abfe9f21 -->

## Activity

<!-- longclaw:event
id: evt_12d8fe90
kind: create
occurred_at: 2026-08-05T15:16:01.312Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f6befa6c
kind: update
occurred_at: 2026-08-07T13:47:23.515Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_abfe9f21.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c8c1ed2b
kind: comment
occurred_at: 2026-08-07T14:11:41.142Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Follow-up: the borderless 15px CSS had already landed on main, but this branch now adds quick-create-guard.mjs coverage and closes D-47 in docs/cc_screens_diff.md so the ticket is backed by the gate and the design-diff ledger.
<!-- /longclaw:event -->
