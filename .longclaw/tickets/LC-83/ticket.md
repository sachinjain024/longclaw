---
format: longclaw.ticket/v1
id: d74f45cb-68f8-4177-afc2-c913a67ff180
key: LC-83
title: Board — column header reveals a + on hover — No + anywhere (Board.tsx:447-453 renders dot + name + count only)
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.860Z
updated_at: 2026-08-05T15:16:00.860Z
---

**Prototype.** Column header reveals a `+` on hover

**App.** No `+` anywhere (`Board.tsx:447-453` renders dot + name + count only)

## Source

`docs/cc_screens_diff.md` — **D-21**, § Board, severity P2.

## Checklist

- [ ] Add a hover/focus-revealed icon button to the column <h3>; on activate, setCreateSurface("quick") with status preseeded. The quick-create modal already accepts a status. <!-- longclaw:item=ck_7a8828e4 -->

## Activity

<!-- longclaw:event
id: evt_18560d39
kind: create
occurred_at: 2026-08-05T15:16:00.860Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
