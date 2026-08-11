---
format: longclaw.ticket/v1
id: 1425105d-515b-406a-a040-4e8a3e975151
key: LC-186
title: User should be able to define priority in Quick Create Mode
status: done
priority: urgent
created_at: 2026-08-09T00:30:22.580Z
updated_at: 2026-08-11T11:30:12.115Z
---

## Activity

<!-- longclaw:event
id: evt_cbc00388
kind: create
occurred_at: 2026-08-09T00:30:22.580Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_29898544
kind: update
occurred_at: 2026-08-09T00:43:16.514Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: none
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a12d5378
kind: update
occurred_at: 2026-08-09T05:28:49.045Z
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
id: evt_829f9ce2
kind: update
occurred_at: 2026-08-09T07:36:29.859Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket

Quick create now asks for priority beside status — the same MenuButton over the same PRIORITY_OPTIONS the panel and full create use, so there is one priority vocabulary rather than two.

`none` is sent rather than omitted: it is a priority a ticket can hold, not a missing answer, and sending it keeps one create request shape. **Open full editor →** carries the priority across with the title and status, so the move between surfaces forgets nothing.

Labels, description and checklist stay in full create — widening by one field is not an invitation to widen further.

`screen-specs.md` and `keyboard-focus-map.md` were updated in place, holding their sections' line counts so the citations pointing into them stay true. verify green (827 frontend tests, every guard clean), a11y:audit Part A green.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_41f64c95
kind: update
occurred_at: 2026-08-11T11:30:12.115Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
