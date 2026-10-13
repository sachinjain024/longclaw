---
format: longclaw.ticket/v1
id: f012aa1f-c5c8-4a07-bb0e-16696fcd1df7
key: LC-276x
title: Permanently delete or trash a removed attachment's bytes
status: in_progress
priority: p1
labels:
  - storage
created_at: 2026-10-13T16:42:42.683Z
updated_at: 2026-10-13T16:47:43.140Z
---

Follow-up to LC-206. Removing an attachment (LC-206, docs/specs/LC-206-attachments.md) only unregisters it: the bytes stay in the ticket's attachments/ directory as a recoverable orphan, which the format's Lifecycle semantics require until an explicit purge is designed.

Design and build that purge: either a ticket-local trash location that removed attachments move into (and can be restored from), or an explicit, confirmed permanent delete of an orphan's bytes — or both. Decide what the activity timeline records, how undo interacts with a purge, and whether the CLI exposes it. Note the website copy rule against advertising hard deletion.

## Activity

<!-- longclaw:event
id: evt_4fcd79ae
kind: create
occurred_at: 2026-10-13T16:42:42.683Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c421bbdc
kind: update
occurred_at: 2026-10-13T16:47:37.722Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9b5086f8
kind: update
occurred_at: 2026-10-13T16:47:43.140Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p3
    to: p1
-->
### You updated this ticket
<!-- /longclaw:event -->
