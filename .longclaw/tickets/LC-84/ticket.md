---
format: longclaw.ticket/v1
id: 0dbd81de-9699-4a8d-9b81-dfbf9d9820f2
key: LC-84
title: Board — focus ring exists but is faint at card scale — the focused card is hard to find after S/P closes a menu
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.875Z
updated_at: 2026-08-07T01:55:07.109Z
---

**Prototype.** Focused card: human-accent inset border + ring

**App.** Focus ring exists but is faint at card scale — the focused card is hard to find after `S`/`P` closes a menu

## Source

`docs/cc_screens_diff.md` — **D-22**, § Board, severity P2.

## Checklist

- [x] Verify against components.md § Board card focus; the ring should read at a glance, it is the only thing roving focus can point at. <!-- longclaw:item=ck_fd8ad052 -->

## Activity

<!-- longclaw:event
id: evt_c69af666
kind: create
occurred_at: 2026-08-05T15:16:00.875Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_470374f1
kind: update
occurred_at: 2026-08-07T01:55:07.109Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_fd8ad052.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9eac3bf8
kind: comment
occurred_at: 2026-08-07T01:55:19.536Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Landed on `fix/lc-83-85-board-column-add-focus-priority`, together with the other two board rows (D-21/D-22/D-23).

- **LC-83** — `ColumnAdd` in `Board.tsx`, revealed on column hover or its own focus, named for its column. It raises the status; `App` opens quick create with it, and `QuickCreate` now takes an `initialStatus`. The synthetic Unreadable column has none — it names no status to preseed.
- **LC-84** — the ring was clipped, not faint: it is drawn outside the card and `.board-stack` scrolls, so the column's 3px/4px of padding was all the room it had. The card wears its focus inside itself now, as `.list-row` already does.
- **LC-85** — the `None` dash keeps its geometry and gains the chip frame `P1`…`P4` wear, so the five levels share one slot.

`npm run verify`, `npm run a11y:audit` and `npm run matrix` all pass.
<!-- /longclaw:event -->
