---
format: longclaw.ticket/v1
id: 4f1fe43f-02da-42d0-bcd7-ddd11930190b
key: LC-206
title: Add Support for adding attachments
status: in_progress
priority: p1
labels:
  - ready-for-agent
due: 2026-10-16
created_at: 2026-08-11T14:38:36.097Z
updated_at: 2026-10-13T16:47:27.625Z
---

Users should be able to add attachments in description and comments: paste, drop or pick a file in the description editor, the comment composer and the create panel; see images and videos inline and other files as chips; list, open, remove and re-attach them from an Attachments section in the panel. Agents get the same operation as `longclaw ticket attach`.

**Spec:** [`docs/specs/LC-206-attachments.md`](../../../docs/specs/LC-206-attachments.md) covers the problem, user stories, implementation and testing decisions, and the two test seams: the core attach operation, shared by the app and the CLI, and the frontend render-and-insert path. It supersedes the "no attachment UI" half of ADR 0005.

Removal only unregisters; the bytes stay as a recoverable orphan. Permanent delete or trash is LC-276x.

## Activity

<!-- longclaw:event
id: evt_9f1043c2
kind: create
occurred_at: 2026-08-11T14:38:36.097Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4fa6c27
kind: update
occurred_at: 2026-09-09T02:20:08.073Z
actor:
  type: human
  id: local
changes:
  - field: labels
    from: release
    to: ""
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_59b0ad98
kind: update
occurred_at: 2026-10-13T16:31:56.965Z
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
id: evt_598d1e47
kind: update
occurred_at: 2026-10-13T16:42:49.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: ""
    to: ready-for-agent
  - field: description
-->
### Claude Code updated this ticket

Wrote the spec to docs/specs/LC-206-attachments.md and linked it from the description. Filed LC-276x for permanently deleting or trashing removed attachments. Labelled ready-for-agent.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8ecdde88
kind: update
occurred_at: 2026-10-13T16:47:17.454Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p2
    to: p1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_02b43692
kind: update
occurred_at: 2026-10-13T16:47:27.625Z
actor:
  type: human
  id: local
changes:
  - field: due
    to: 2026-10-16
-->
### You updated this ticket
<!-- /longclaw:event -->
