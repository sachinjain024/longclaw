---
format: longclaw.ticket/v1
id: 92783222-5f6b-4997-9cb9-024e573cc144
key: LC-221
title: Undo for adding a checklist item
status: todo
priority: none
labels:
  - frontend
created_at: 2026-08-12T07:15:03.825Z
updated_at: 2026-08-12T07:15:03.825Z
---

LC-220 gave ⌘Z a working path everywhere it is offered, and left one checklist mutation without an offer at all: adding a row.

Both halves of the inverse are missing rather than merely unwritten.

- The receipt does not carry the ids. `WriteResult.ticket` is an `IndexedTicket`, which counts the checklist (`checklistCount`, `checkedCount`) and does not list it, so the surface that just added rows cannot name them. `save()` re-reads the file afterwards, but `mutate()` has built the toast and its Undo by then.
- `TicketEdit.removeChecklistItem` takes one id, and an add is a batch: `queuedItems` exists precisely so items typed during a write are not dropped (LC-193), so one gesture can put several rows in one edit.

So this wants a decision on the Rust side first — whether the receipt names what an `addChecklistItems` minted, or whether removal takes a list — and the frontend change is small once it does.

Every other checklist mutation offers undo: reword and remove (LC-215), move (LC-185), check (`states.md:62-63`).

## Activity

<!-- longclaw:event
id: evt_ef70e8e8
kind: create
occurred_at: 2026-08-12T07:15:03.825Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
