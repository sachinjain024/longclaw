---
format: longclaw.ticket/v1
id: e53e5d06-f728-4bbc-b261-ff9108845543
key: LC-242h
title: User should be able to select / tick items in the checklist while creating the ticket too
status: done
priority: none
created_at: 2026-08-30T01:25:44.237Z
updated_at: 2026-08-31T10:07:30.254Z
---

Useful when user is creating a ticket for the past work or already in half-state of implementation

## Activity

<!-- longclaw:event
id: evt_877f73bd
kind: create
occurred_at: 2026-08-30T01:25:44.237Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7d0acea0
kind: update
occurred_at: 2026-08-31T10:07:30.254Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
-->
### Claude Code updated this ticket

Shipped on `lc-242h-create-checklist-tick`.

`NewChecklistItem { text, checked }` replaces the bare string in `NewTicket.checklist` on the wire and in Rust, so a create can file a row already ticked. `render_new_ticket_as` writes `- [x]` in the same two markers a later toggle writes — nothing downstream can tell a row created ticked from one ticked afterwards, and the contract test now proves it down both paths rather than asserting it. The create panel's box is live, drawn as checked, and a real Tab stop; the tick survives a reword and a reorder. No activity entry is written for a row that arrived ticked: it was never toggled (ADR 0001).

The CLI's `--checklist` still files every row open. A flag that let an agent file a ticked row is a decision of its own and has not been asked for.

Verified with the full gate: `npm run verify` green end to end, `test:rust` 247 passed, `test:watcher` 2 passed on the native adapter, frontend 1089/1089, clippy clean under `-D warnings`. `a11y:audit` passes A1-A5. `probe:drag` 55/56 — the one failure is the board-place-filtered row, which reproduces unchanged on `main`. `probe:checklist` 60/60 with all 8 sizes driven.
<!-- /longclaw:event -->
