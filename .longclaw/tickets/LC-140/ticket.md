---
format: longclaw.ticket/v1
id: d329875a-5e7c-4b9c-8bcc-417aa7727d64
key: LC-140
title: Folder missing / unreachable — quick create still opens over the unreachable screen and offers LC-1 as the next key — a collision waiting to happen once the folder returns
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.744Z
updated_at: 2026-08-07T03:15:54.072Z
---

**Prototype.** The unreachable screen is the whole main area; the panel is closed and nothing is creatable

**App.** Quick create still opens over the unreachable screen and offers **`LC-1`** as the next key — a collision waiting to happen once the folder returns

## Source

`docs/cc_screens_diff.md` — **D-57**, § Folder missing / unreachable, severity P1.

## Checklist

- [x] Gate the create surfaces (and the palette's create command) on project.reachable. <!-- longclaw:item=ck_85c8959d -->

## Activity

<!-- longclaw:event
id: evt_c191d91c
kind: create
occurred_at: 2026-08-05T15:16:01.744Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1f6d0a84
kind: update
occurred_at: 2026-08-07T03:15:54.072Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_85c8959d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
