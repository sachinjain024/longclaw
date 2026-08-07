---
format: longclaw.ticket/v1
id: 2eb05937-6737-4951-aa57-5e76addffa29
key: LC-137
title: "Unparseable ticket file — footer: note + Open in editor + Retry parse — Neither action"
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.693Z
updated_at: 2026-08-07T05:07:43.972Z
---

**Prototype.** Footer: note + **Open in editor** + **Retry parse**

**App.** Neither action

## Source

`docs/cc_screens_diff.md` — **D-54**, § Unparseable ticket file, severity P2.

## Checklist

- [x] Retry parse matters most (states.md:120-122) — without it the only recovery is to wait for the watcher. <!-- longclaw:item=ck_4022ddc7 -->

## Activity

<!-- longclaw:event
id: evt_67b2e471
kind: create
occurred_at: 2026-08-05T15:16:01.693Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_04a9b318
kind: update
occurred_at: 2026-08-07T05:07:43.972Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_4022ddc7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
