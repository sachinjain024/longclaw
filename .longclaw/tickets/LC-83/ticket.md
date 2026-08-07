---
format: longclaw.ticket/v1
id: d74f45cb-68f8-4177-afc2-c913a67ff180
key: LC-83
title: Board — column header reveals a + on hover — No + anywhere (Board.tsx:447-453 renders dot + name + count only)
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.860Z
updated_at: 2026-08-07T01:55:07.088Z
---

**Prototype.** Column header reveals a `+` on hover

**App.** No `+` anywhere (`Board.tsx:447-453` renders dot + name + count only)

## Source

`docs/cc_screens_diff.md` — **D-21**, § Board, severity P2.

## Checklist

- [x] Add a hover/focus-revealed icon button to the column <h3>; on activate, setCreateSurface("quick") with status preseeded. The quick-create modal already accepts a status. <!-- longclaw:item=ck_7a8828e4 -->

## Activity

<!-- longclaw:event
id: evt_18560d39
kind: create
occurred_at: 2026-08-05T15:16:00.860Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fc1c9ed1
kind: update
occurred_at: 2026-08-07T01:55:07.088Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_7a8828e4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d881fe31
kind: comment
occurred_at: 2026-08-07T01:55:19.501Z
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
