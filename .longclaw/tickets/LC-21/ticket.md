---
format: longclaw.ticket/v1
id: 265e3e56-e839-4f4b-926e-8d6dc1619668
key: LC-21
title: Palette sub-modes for status, priority, ordering, theme, project, and search
status: backlog
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-05T15:14:39.580Z
---

Palette sub-modes for status, priority, ordering, theme, project, and search

## Why it exists

A flat command list cannot express "change status to…" without a second surface, and `Esc` stepping back rather than out is the behaviour the spec defines.

## Source

`docs/backlog/v0-backlog.md` — **V0-21**, Wave 2, step 12, owner Frontend.

## Checklist

- [ ] Sub-modes show the crumb, Esc steps back to root, and a command with no target is disabled with an inline explanation rather than failing <!-- longclaw:item=ck_828ac2cb -->

## Activity

<!-- longclaw:event
id: evt_e1acfb83
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e6c916b9
kind: update
occurred_at: 2026-08-05T15:14:39.580Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
