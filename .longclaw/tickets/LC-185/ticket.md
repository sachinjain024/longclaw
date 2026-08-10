---
format: longclaw.ticket/v1
id: 9a4628a2-6ada-4a36-9348-fad9adf1d0ec
key: LC-185
title: User should be able to rearrange items in checklist
status: in_review
priority: urgent
rank: Zv
created_at: 2026-08-09T00:29:54.076Z
updated_at: 2026-08-10T08:12:57.888Z
---

## Activity

<!-- longclaw:event
id: evt_b571347d
kind: create
occurred_at: 2026-08-09T00:29:54.076Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d7646a59
kind: update
occurred_at: 2026-08-09T07:36:17.145Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2a8068a2
kind: update
occurred_at: 2026-08-09T07:36:31.027Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: Zx
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6f3df280
kind: update
occurred_at: 2026-08-09T07:37:27.793Z
actor:
  type: human
  id: local
changes:
  - field: rank
    from: Zx
    to: Zv
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_25e5dd78
kind: update
occurred_at: 2026-08-10T08:12:57.888Z
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

Reordering ships on both surfaces (drag and ⌥↑/⌥↓), with the move written as `checklist.<id>.moved` naming the row it now follows. `verify` green; `probe:drag` 42/42 including the new checklist case, and its self-test still bites; `a11y:audit` A1–A5 pass.

Two defects were found on the way and fixed here: WebKit skipped the checklist checkboxes entirely, so the rows were pointer-only against `keyboard-focus-map.md:61-62` — `tab-order-guard` now covers checkboxes as well as buttons — and the panel refocused itself on every write, which killed the second press of a reorder.

A held key still loses presses after the first; that is LC-192.
<!-- /longclaw:event -->
