---
format: longclaw.ticket/v1
id: 9e7137bd-af9e-481b-bce2-d401e2dee8cf
key: LC-70
title: App shell — two text buttons Star / Settings, stacked vertically at the right edge
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.658Z
updated_at: 2026-08-06T07:30:32.498Z
---

**Prototype.** Settings is a **ghost gear icon button** next to the project name

**App.** Two text buttons `Star` / `Settings`, stacked vertically at the right edge

## Source

`docs/cc_screens_diff.md` — **D-08**, § App shell, severity P2.

## Checklist

- [x] Gear icon button for settings; keep star as the sidebar row affordance (it already exists there) and drop the header Star button. <!-- longclaw:item=ck_ca752c57 -->

## Activity

<!-- longclaw:event
id: evt_9722dfa3
kind: create
occurred_at: 2026-08-05T15:16:00.658Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fdd7af1c
kind: update
occurred_at: 2026-08-06T07:20:42.126Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Codex updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c45b6a97
kind: update
occurred_at: 2026-08-06T07:30:32.498Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_ca752c57.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket
<!-- /longclaw:event -->
