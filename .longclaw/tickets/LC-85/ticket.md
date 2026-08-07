---
format: longclaw.ticket/v1
id: 2e4ac0d2-cd33-41f2-ad9d-0e53482dd71b
key: LC-85
title: Board — priority None renders as a stray hyphen in a chip slot with no chip
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.889Z
updated_at: 2026-08-07T01:55:07.128Z
---

**Prototype.** Priority `None` renders as a dash glyph in the ID row

**App.** Same, but the dash sits in the chip slot with no chip — reads as a stray hyphen (see LC-108)

## Source

`docs/cc_screens_diff.md` — **D-23**, § Board, severity P3.

## Checklist

- [x] Either render the — inside the same 22×16 chip frame as P1…P4, or omit it. <!-- longclaw:item=ck_83b18b6c -->

## Activity

<!-- longclaw:event
id: evt_97352533
kind: create
occurred_at: 2026-08-05T15:16:00.889Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_018f1ec0
kind: update
occurred_at: 2026-08-07T01:55:07.128Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_83b18b6c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8078e44b
kind: comment
occurred_at: 2026-08-07T01:55:19.567Z
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
