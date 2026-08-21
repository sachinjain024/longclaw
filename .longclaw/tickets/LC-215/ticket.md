---
format: longclaw.ticket/v1
id: ecc1129b-3efe-4863-8d56-8c0bc170de41
key: LC-215
title: CheckList Item should be editable and deletable
status: done
priority: urgent
labels:
  - release
created_at: 2026-08-11T14:57:26.525Z
updated_at: 2026-08-21T06:39:39.963Z
---

Both during Ticket Creation Process and Editing Process


## Checklist

- [ ] Test Checklist <!-- longclaw:item=ck_711a8485 -->
- [ ] Item 23 <!-- longclaw:item=ck_30a251c5 -->
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

<!-- longclaw:event
id: evt_f23af9d0
kind: comment
occurred_at: 2026-08-21T05:27:39.148Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The review's catch was the cascade, not the editor: `.checklist-row input` reads "the box on a checklist row" but matched the editor's field too, so the pencil opened a text field dressed as the checkbox — 15px wide, appearance none, showing none of the text it held — and create's draft rows faded it to half on top. The checkbox rules now say `input[type="checkbox"]` in all four places, and the field takes the row again: measured in WebKit against the real stylesheet, 404px of a 420px row, full opacity, in all three row states, with the box on an untouched row still 15px and appearance none. `row-editor-guard.mjs` holds the scoping in `npm run check` — red on the old stylesheet, green on this one — and its specificity counter moved to `guard.mjs` beside `declaredValues`, for LC-177's reason. On branch `fix/lc-215-row-editor-field`, verify green twice.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_eaf8c4fc
kind: update
occurred_at: 2026-08-21T05:37:30.925Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_30a251c5.added
    to: Item 2
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_16167afd
kind: update
occurred_at: 2026-08-21T05:37:34.894Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_30a251c5.text
    from: Item 2
    to: Item 23
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ab8fd552
kind: update
occurred_at: 2026-08-21T06:25:30.020Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_711a8485.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_01785dc0
kind: update
occurred_at: 2026-08-21T06:25:30.521Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_30a251c5.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f765c3b3
kind: update
occurred_at: 2026-08-21T06:25:31.244Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_30a251c5.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6a260172
kind: update
occurred_at: 2026-08-21T06:25:31.963Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_711a8485.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4f6b1587
kind: update
occurred_at: 2026-08-21T06:29:18.860Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_711a8485.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1f9660d1
kind: update
occurred_at: 2026-08-21T06:29:19.582Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_711a8485.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9f2d58cd
kind: update
occurred_at: 2026-08-21T06:39:39.963Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
