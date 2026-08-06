---
format: longclaw.ticket/v1
id: 2dc4d8c1-1c81-4988-8245-e08f59d4240b
key: LC-99
title: Ticket panel — the Edit description affordance is absolutely positioned over the body text and overlaps it (…pairs that the collides with Edit description)
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.105Z
updated_at: 2026-08-06T16:02:33.500Z
---

**Prototype.** Description hover reveals a pencil + `Edit` at the right of the section header

**App.** The `Edit description` affordance is absolutely positioned **over the body text** and overlaps it (`…pairs that the` collides with `Edit description`)

## Source

`docs/cc_screens_diff.md` — **D-04**, § Ticket panel, severity P1.

## Checklist

- [x] Move the affordance into the Description section header row (it has room), or give it an opaque background and reserve the gutter. <!-- longclaw:item=ck_a356317d -->

## Activity

<!-- longclaw:event
id: evt_36920951
kind: create
occurred_at: 2026-08-05T15:16:01.105Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_83baf241
kind: update
occurred_at: 2026-08-06T16:02:33.500Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_a356317d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Moved the affordance into the Description section header, where the prototype puts it: a pencil and `Edit` opposite the heading, revealed by hovering the section or holding focus. The body is markdown again, with no button over it and no hover wash promising a click it never had. The empty state keeps its own `Add a description` button, so each state has exactly one way into the editor.

Held by two tests in `TicketPanel.test.tsx`; `verify`, `a11y:audit` (A1-A5, panel Tab order 9 stops in reading order) and `matrix` (8 axes x 9 states) all green.
<!-- /longclaw:event -->
