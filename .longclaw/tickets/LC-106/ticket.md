---
format: longclaw.ticket/v1
id: 914bbe54-5ac5-46cf-84b8-5a4ceba8c486
key: LC-106
title: Ticket panel — A full-width bordered input, Add a checklist item
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.208Z
updated_at: 2026-08-07T01:19:55.068Z
---

**Prototype.** Add-row: ghost checkbox + borderless input, Enter appends and keeps focus

**App.** A full-width **bordered** input, `Add a checklist item`

## Source

`docs/cc_screens_diff.md` — **D-3E**, § Ticket panel, severity P2.

## Checklist

- [x] Restyle to the ghost-checkbox + borderless pattern so it reads as the next row rather than a form field. <!-- longclaw:item=ck_1a71e59a -->

## Activity

<!-- longclaw:event
id: evt_66ad3660
kind: create
occurred_at: 2026-08-05T15:16:01.208Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c9324056
kind: update
occurred_at: 2026-08-07T01:19:55.068Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_1a71e59a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Restyled the add-row to the ghost-checkbox + borderless pattern (D-3E). The box is a real disabled checkbox rather than a drawn one, so it is exactly the shape, size and baseline of the boxes above it in every appearance; it is aria-hidden and off the tab order, and the field beside it is borderless until focus, on the rows' own gap and padding so the two boxes share a column. Enter already appended without blurring — that is now held by a test rather than by luck. The box was extracted as GhostBox and the create surface's add-row took it too: .checklist-add is shared, the prototype gives that row one as well (prototype.js:895-897), and a borderless field there would otherwise have sat a checkbox's width out of line.
<!-- /longclaw:event -->
