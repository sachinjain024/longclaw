---
format: longclaw.ticket/v1
id: f7b031f0-a536-41cd-aecb-778ffb5730c2
key: LC-144
title: Folder missing / unreachable — locate folder is the primary indigo button; Remove from app is a danger-outline button with no confirm
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.804Z
updated_at: 2026-08-07T03:15:54.403Z
---

**Prototype.** `Locate folder…` secondary, `Remove from app` ghost → confirm

**App.** `Locate folder` is the **primary** indigo button; `Remove from app` is a danger-outline button with no confirm

## Source

`docs/cc_screens_diff.md` — **D-5B**, § Folder missing / unreachable, severity P2.

## Checklist

- [x] Demote Locate to secondary and put Remove behind the confirm dialog from D-44. <!-- longclaw:item=ck_6081f9f8 -->

## Activity

<!-- longclaw:event
id: evt_05147ce4
kind: create
occurred_at: 2026-08-05T15:16:01.804Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_11713bdd
kind: update
occurred_at: 2026-08-07T03:15:54.403Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_6081f9f8.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
