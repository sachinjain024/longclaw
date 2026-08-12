---
format: longclaw.ticket/v1
id: ecc1129b-3efe-4863-8d56-8c0bc170de41
key: LC-215
title: CheckList Item should be editable and deletable
status: in_review
priority: urgent
labels:
  - release
created_at: 2026-08-11T14:57:26.525Z
updated_at: 2026-08-12T06:48:20.523Z
---

Both during Ticket Creation Process and Editing Process


## Checklist

- [ ] Test Checklist <!-- longclaw:item=ck_711a8485 -->
## Activity

<!-- longclaw:event
id: evt_96e60024
kind: create
occurred_at: 2026-08-11T14:57:26.525Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6ef99208
kind: update
occurred_at: 2026-08-11T18:36:19.535Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

Both surfaces. A row now carries a pencil and a cross, revealed with the drag grip: the pencil replaces the row with a field that commits on Enter or blur and abandons on Esc, and the cross removes it with a toast that offers the row back where it sat. Rust gained editChecklistItem, removeChecklistItem and restoreChecklistItem — the last so a removal can be undone, since an append lands at the end and the row was not at the end — and the CLI gained --edit-item/--item-text and --remove-item so an agent can do what the app can. An emptied field leaves the row alone in both surfaces; deleting is the cross's job. Neither gesture is offered on a row the file has minted no id for.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_78b5d394
kind: update
occurred_at: 2026-08-12T06:48:20.523Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_711a8485.added
    to: Test Checklist
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c76c500b
kind: comment
occurred_at: 2026-08-12T06:49:49.355Z
actor:
  type: human
  id: local
-->
### You commented

## Feeback
1. When using pencil icon, the focus input area is too small like 20px types. It doesn’t show the existing content to edit.
<!-- /longclaw:event -->
