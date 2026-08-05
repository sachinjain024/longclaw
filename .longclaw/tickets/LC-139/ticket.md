---
format: longclaw.ticket/v1
id: f6eb3135-23b7-4eff-b413-968568f7edef
key: LC-139
title: Folder missing / unreachable — a missing project folder is never noticed; cached tickets keep rendering as live
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.726Z
updated_at: 2026-08-05T15:16:01.726Z
---

**Prototype.** The watcher signal alone raises the state

**App.** **Nothing happened.** The board kept showing cached tickets, the sidebar dot stayed normal, and the header still read `● watching`, for as long as nothing forced a re-read. The state only appeared after an explicit index rebuild

## Source

`docs/cc_screens_diff.md` — **D-55**, § Folder missing / unreachable, severity P0.

## Checklist

- [ ] states.md:96 forbids exactly this: "Never: … show cached tickets as if they were live." Treat a watcher error / failed read on the project root as the unreachable trigger. <!-- longclaw:item=ck_991669c1 -->

## Activity

<!-- longclaw:event
id: evt_1ce1dc82
kind: create
occurred_at: 2026-08-05T15:16:01.726Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
