---
format: longclaw.ticket/v1
id: 8f5ced92-b221-45c3-8074-39b991b4d078
key: LC-67
title: App shell — three stacked blocks totalling ~230px before the first card; board/list start at y≈275 instead of y≈100
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.603Z
updated_at: 2026-08-05T15:16:00.603Z
---

**Prototype.** One 56px header row; project name and controls on the same line

**App.** Three stacked blocks totalling ~230px before the first card; board/list start at y≈275 instead of y≈100

## Source

`docs/cc_screens_diff.md` — **D-05**, § App shell, severity P1.

## Checklist

- [ ] Collapse project-toolbar and board-heading into a single flex row in App.tsx:1106-1256. Drop the LOCAL PROJECT eyebrow and the <h2>Board/List</h2> heading — the view segment already says which view is active. Move Star and Settings inline, right of the project name. <!-- longclaw:item=ck_d0fc5e5a -->

## Activity

<!-- longclaw:event
id: evt_9b05c778
kind: create
occurred_at: 2026-08-05T15:16:00.603Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
