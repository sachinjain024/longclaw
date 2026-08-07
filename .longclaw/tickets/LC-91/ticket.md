---
format: longclaw.ticket/v1
id: fe1111e9-ead7-4b76-a023-6faad4428945
key: LC-91
title: Filter states — A bordered rounded container spanning the content width, top-aligned
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.988Z
updated_at: 2026-08-07T05:51:31.164Z
---

**Prototype.** Centered in the board region, no container

**App.** A bordered rounded container spanning the content width, top-aligned

## Source

`docs/cc_screens_diff.md` — **D-31**, § Filter states, severity P2.

## Checklist

- [x] Drop the frame; centre it in the remaining height. NoMatches in App.tsx:1775+. <!-- longclaw:item=ck_a15dde49 -->

## Activity

<!-- longclaw:event
id: evt_b46a10fe
kind: create
occurred_at: 2026-08-05T15:16:00.988Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3d7f87e1
kind: update
occurred_at: 2026-08-07T05:49:24.239Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9840c632
kind: update
occurred_at: 2026-08-07T05:51:31.164Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_a15dde49.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The frame is gone — dashed border, tint and 18px block margin — and the panel now centres in the height the header leaves. Three parts: `.main-panel` becomes a column, the workspace takes a `.workspace-state` modifier for the one state that stands *instead of* the surfaces rather than above them, and `.no-matches` claims what is left and centres in it. Scoped to that state on purpose: the board and the list size themselves and gain nothing from being flex items, and their budgets say so — `perf:board` p95 15/18/25/16ms, `perf:list` p95 16/19/23/16ms. Measured in WebKit at 1440x900, the panel spans y=86 to 844 with its title on the centre line. `.no-matches p` also takes the 400px the prototype gives a state panel's sub-line, which the frame used to do by accident. `.empty-board` and `.unreachable-panel` keep their frames: D-20 and D-59 are the rows that decide those.
<!-- /longclaw:event -->
