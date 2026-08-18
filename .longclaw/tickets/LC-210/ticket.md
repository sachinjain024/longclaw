---
format: longclaw.ticket/v1
id: 3452595f-fdba-43d3-b29b-13531462208a
key: LC-210
title: Generate LongClaw Icons & Brand Icon Set
status: canceled
priority: urgent
labels:
  - frontend
  - design
  - release
created_at: 2026-08-11T14:50:45.521Z
updated_at: 2026-08-18T09:51:08Z
---

## Activity

<!-- longclaw:event
id: evt_b3624aad
kind: create
occurred_at: 2026-08-11T14:50:45.521Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3ae6f051
kind: update
occurred_at: 2026-08-18T09:51:08Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: canceled
-->
### Claude Code updated this ticket

Closed as a duplicate of LC-62 "Implement the LongClaw logo", where this work is tracked and now largely done: the icon and brand set were generated from the Aug 13 2026 concept round, live under `assets/brand/` (concepts, plus the selected white-on-#B45F06 set with the full Tauri `icons/` and `in-app/` PNGs), the set is installed at `apps/desktop/src-tauri/icons/` with `bundle.icon` pointing at it, and the in-app `OwlMark` and canonical `owl-mark.svg` are redrawn to the same mark. See LC-62's checklist and 2026-08-18 activity for the details.
<!-- /longclaw:event -->
