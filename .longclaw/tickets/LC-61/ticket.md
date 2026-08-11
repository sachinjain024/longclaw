---
format: longclaw.ticket/v1
id: 2fb86400-a5be-4131-a366-be1aab3a637a
key: LC-61
title: There should be an option like Checkbox to Create another Ticket while creating more tickets
status: done
priority: none
created_at: 2026-08-05T14:44:30.610Z
updated_at: 2026-08-11T14:11:52.814Z
---

## Activity

<!-- longclaw:event
id: evt_d8395a1a
kind: create
occurred_at: 2026-08-05T14:44:30.610Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8c9d279f
kind: update
occurred_at: 2026-08-05T15:14:39.736Z
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
id: evt_dba1f1d6
kind: update
occurred_at: 2026-08-11T14:11:52.814Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
-->
### Claude Code updated this ticket

Delivered by LC-201, which is a superset of this: quick create gained the **Create more** checkbox this ticket asks for, and with it a description field and the project's label menu.

The checkbox is off on every open and is never persisted — it is a mode for the run in front of you, not a preference. With it ticked, Create writes the ticket optimistically as it always has and then the modal stays up: title and description clear, status, priority and labels are kept, the context line advances to the next free key, and focus returns to the title rather than following the card. That last part is the one that had to be got right — the write returns while the next title is being typed, so a create that moved focus to the new card would read as dropped keystrokes.

Spec and outcome: `docs/plans/completed/LC-201-Bulk-Create-In-Quick-Create-Mode.md`. Prototype: `docs/ux/prototypes/LC-201-Bulk-Create-In-Quick-Create-Mode.html`. Closing as done rather than canceled, because the thing it asked for exists.
<!-- /longclaw:event -->
