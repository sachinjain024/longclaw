---
format: longclaw.ticket/v1
id: bebaef85-66c9-416b-8929-5eac25510060
key: LC-86
title: Empty project — the whole board is replaced by one full-width dashed panel; no columns render at all
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.905Z
updated_at: 2026-08-05T15:16:00.905Z
---

**Prototype.** Board scaffold stays; guided card sits **inside the Todo column**

**App.** The whole board is replaced by one full-width dashed panel; no columns render at all

## Source

`docs/cc_screens_diff.md` — **D-20**, § Empty project, severity P1.

## Checklist

- [ ] This is the state the spec is most explicit about — the app never hides the workspace. Keep <Board/> mounted when tickets.length === 0 and render the guide card as the Todo column's only child. Keep EmptyBoard's copy, move it into a 264px card. <!-- longclaw:item=ck_5a1a0bde -->

## Activity

<!-- longclaw:event
id: evt_60764e76
kind: create
occurred_at: 2026-08-05T15:16:00.905Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
