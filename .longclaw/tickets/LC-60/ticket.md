---
format: longclaw.ticket/v1
id: 57cb02e6-9e0d-49a7-bd3a-b2fbeb61d66c
key: LC-60
title: Can’t drag and drop the tickets between lanes
status: done
priority: urgent
created_at: 2026-08-05T14:42:42.594Z
updated_at: 2026-08-07T08:11:27.403Z
---

A card could not be dragged out of the column it was in. In Priority nothing on the board could be picked up at all; in Manual a drop outside the card's own column was refused. The keyboard had a path across columns (`S`) and the pointer had none — on the one surface whose whole shape is columns.

The cause was a reading of [ADR 0003](../../../docs/adr/0003-priority-default-ordering-manual-option.md): its first consequence is about drag-and-drop **reordering**, and the board had taken it to be about **dragging**.

## What it now does

- **A drop into another column is a status change** — the same write the `S` menu makes, on project data — and works in both orders. Reordering *within* a column is unchanged: Manual only, so in Priority a card's own column takes no drop and the pointer says so rather than the card sliding back with nothing written.
- **In Manual the drop writes `status` and `rank` as one edit.** A card arriving in a column is given a place in it, or it would land wherever its old rank happened to sort rather than where it was let go. One edit, so one Undo takes the whole gesture back and no intermediate state is ever written. `rankForInsert` is the arriving half of `rankForDrop`, over the same neighbour scan.
- **In Priority the drop writes the status alone.** "`rank` is written only by manual reordering" stands as written, and both must-pass tests that pin it were kept and extended rather than relaxed.
- **The column under the pointer says so** with an accent wash and a hairline; in Manual a drop line also shows where in it the card would land. The Unreadable column takes no drop in either order — it names no status — and neither do the cards in it.
- **Every column that could take the card opens to a card's height while the drag lasts.** An empty column's stack is three pixels of padding at rest, which is not a target a pointer can be asked to hit, and an empty column is exactly where a card is most often headed.
- **The drag scrolls the board sideways at its edges**, the way it already scrolled a column at its top and bottom. Six columns of 264px do not fit the window, and a column off the side of it was otherwise unreachable — which would have left the pointer without a path to the very statuses this ticket is about.

ADR 0003 carries a "Revised for LC-60" section recording the reinterpretation and its boundary case; `screen-specs.md` § Board records the interaction.

## Verification

`npm run verify` green (693 frontend tests, Rust suite, native watcher, build). Both new behaviours confirmed failing first by mutation. Interaction budgets, WebKit, 5,000 tickets, p95 keyboard/scroll/filter/write against ≤50ms: **board Priority 15/18/28/18**, **board Manual 15/18/28/16**, **list Manual 17/19/22/17** — every p95 within budget and every median within 4ms of the 600-ticket floor.

## Activity

<!-- longclaw:event
id: evt_9f2a834a
kind: create
occurred_at: 2026-08-05T14:42:42.594Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_36d5b30d
kind: update
occurred_at: 2026-08-05T15:14:39.717Z
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
id: evt_f3bbc1f3
kind: update
occurred_at: 2026-08-07T01:47:14.109Z
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
id: evt_9b3b8dab
kind: update
occurred_at: 2026-08-07T06:32:03.865Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: backlog
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f748154e
kind: update
occurred_at: 2026-08-07T08:11:27.403Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
