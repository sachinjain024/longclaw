---
format: longclaw.ticket/v1
id: 227d21ce-daf6-4bcf-9a91-05d30cdc254a
key: LC-22
title: Single-key actions on the focused ticket
status: done
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-11T14:02:50.411Z
---

Single-key actions on the focused ticket

## Why it exists

The speed claim is about the keys a user presses most, not the palette they open occasionally.

## Source

`docs/backlog/v0-backlog.md` — **V0-22**, Wave 2, step 12, owner Frontend.

## Checklist

- [x] Every single-key action in the keyboard map acts on the focused ticket and on nothing else <!-- longclaw:item=ck_bd6e8ae7 -->

## Activity

<!-- longclaw:event
id: evt_894b93f5
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
id: evt_82426cb2
kind: update
occurred_at: 2026-08-05T15:14:39.600Z
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

<!-- longclaw:event
id: evt_5b07c51a
kind: update
occurred_at: 2026-08-11T14:02:50.411Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_bd6e8ae7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Already shipped on 2026-08-01, before this ticket was filed. V0-22 is [plan 24](../../../docs/plans/completed/24-single-key-actions.md), closed as "Single-key actions, modifier safety, panel behavior, tests, and perf budgets are complete", under the Step 12 completion at `docs/plans/active/README.md:36`.

Verified in the tree, including the checklist's "and on nothing else" half, which is the part worth checking:

- `TicketMetaMenu.tsx:32-37` maps the keys the map declares — `S` to status, `P` to priority (`keyboard-focus-map.md:42-43`).
- `Board.tsx:338-350` resolves the card the key was **pressed on** rather than the one the last render believed was focused, and returns unless the target is a card or the grid itself — so a key pressed on a column's `+` belongs to that control and does not act on whatever card was last left behind.
- `keyContext.ts` suspends single-key shortcuts while an input, textarea, select or contenteditable has focus, as one rule shared by the board, the list, the panel and the global `C` — it lives there because it used to be an ad-hoc `closest()` call in one component and the others disagreed with it.

Filed by the 2026-08-05 import off the unstruck `v0-backlog.md:137` row.
<!-- /longclaw:event -->
