---
format: longclaw.ticket/v1
id: 0b1db676-5271-42b9-b398-c03938ec1e97
key: LC-288m
title: Adding a new label while creating a ticket dismisses the draft
status: in_progress
priority: p2
labels:
  - frontend
type: bug
created_at: 2026-11-18T14:06:39.428Z
updated_at: 2026-11-18T15:36:44.850Z
---

Reported in GitHub issue #92 (https://github.com/sachinjain024/longclaw/issues/92) against 0.3.1 on macOS 27.0.1: while composing a new ticket, creating a new label from the label picker — typing a name under _+ add_ and pressing Enter or choosing _Add label_ — makes the in-progress ticket disappear from the creation surface. Expected: the label is created and selected, and create stays open with the title and description intact. Whether the draft is discarded, saved or recoverable is not yet confirmed, and the reporter has not independently reproduced it.

Likely places to start: `LabelMenu.tsx` (the picker's add row) and how create handles the Enter / commit that follows — the Enter may be reaching create's own submit or dismiss path, or the label write may re-render the surface away.

To decide: reproduce in the app, then make adding a label from create keep the draft open with the new label selected, for both Enter and _Add label_.


## Checklist

- [x] Reproduce: adding a label from quick create submits the modal's own form and creates the ticket <!-- longclaw:item=ck_f6d22361 -->
- [x] Fix: the define row's submit stops at its own form, with a test for Enter and Add label <!-- longclaw:item=ck_7d93e29e -->
- [ ] After the PR is merged, edit the comment on GitHub issue #92 so its link points at .longclaw/tickets/LC-288m/ticket.md on main rather than the lc-288m branch <!-- longclaw:item=ck_9cb05ca6 -->
## Activity

<!-- longclaw:event
id: evt_959b6093
kind: create
occurred_at: 2026-11-18T14:06:39.428Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d066f3db
kind: update
occurred_at: 2026-11-18T15:36:36.719Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_f6d22361.added
    to: "Reproduce: adding a label from quick create submits the modal's own form and creates the ticket"
  - field: checklist.ck_7d93e29e.added
    to: "Fix: the define row's submit stops at its own form, with a test for Enter and Add label"
  - field: checklist.ck_9cb05ca6.added
    to: "After the PR is merged, edit the comment on GitHub issue #92 so its link points at .longclaw/tickets/LC-288m/ticket.md on main rather than the lc-288m branch"
-->
### Claude Code updated this ticket

Reproduced in `QuickCreate.test.tsx`: Enter or **Add label** in the define row called `onCreate`. The define row is a `<form>` rendered inside quick create's `<form>` (the menu is not portalled), and its submit bubbled up unstopped, so the draft was *created* without the new label and the modal closed. Fixed in `LabelMenu.tsx` by stopping the submit at the row. Full create was not affected: its labels row is not inside a form.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_733c0c63
kind: update
occurred_at: 2026-11-18T15:36:44.829Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f6d22361.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4bb528c1
kind: update
occurred_at: 2026-11-18T15:36:44.850Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7d93e29e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
