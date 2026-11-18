---
format: longclaw.ticket/v1
id: 0b1db676-5271-42b9-b398-c03938ec1e97
key: LC-288m
title: Adding a new label while creating a ticket dismisses the draft
status: todo
priority: p2
labels:
  - frontend
type: bug
created_at: 2026-11-18T14:06:39.428Z
updated_at: 2026-11-18T14:06:39.428Z
---

Reported in GitHub issue #92 (https://github.com/sachinjain024/longclaw/issues/92) against 0.3.1 on macOS 27.0.1: while composing a new ticket, creating a new label from the label picker — typing a name under _+ add_ and pressing Enter or choosing _Add label_ — makes the in-progress ticket disappear from the creation surface. Expected: the label is created and selected, and create stays open with the title and description intact. Whether the draft is discarded, saved or recoverable is not yet confirmed, and the reporter has not independently reproduced it.

Likely places to start: `LabelMenu.tsx` (the picker's add row) and how create handles the Enter / commit that follows — the Enter may be reaching create's own submit or dismiss path, or the label write may re-render the surface away.

To decide: reproduce in the app, then make adding a label from create keep the draft open with the new label selected, for both Enter and _Add label_.

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
