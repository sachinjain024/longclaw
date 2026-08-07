---
format: longclaw.ticket/v1
id: 57cb02e6-9e0d-49a7-bd3a-b2fbeb61d66c
key: LC-60
title: Can’t drag and drop the tickets between lanes
status: in_review
priority: urgent
created_at: 2026-08-05T14:42:42.594Z
updated_at: 2026-08-07T09:07:10.433Z
---

A card could not be dragged out of the column it was in. There were two causes, one in the board and one in the window, and only the first was visible from inside the code.

**The board refused the drop.** [ADR 0003](../../../docs/adr/0003-priority-default-ordering-manual-option.md)'s first consequence is about drag-and-drop *reordering*, and the board had read it as being about *dragging*: in Priority nothing could be picked up at all, and in Manual a drop outside the card's own column was refused. The keyboard had a path across columns (`S`) and the pointer had none.

**And the window ate the drag anyway.** `dragDropEnabled` defaults to true, so wry installs an OS file-drop handler on the WKWebView — `draggingEntered:`, `draggingUpdated:`, `performDragOperation:` — and Tauri's handler answers "handled" to all three without ever forwarding to super. The webview therefore never processes a drag, including one that started inside the page: `dragstart` fires, the card lifts, and then nothing lands. This is why reordering *inside* a column in Manual did not work either, though LC-9 shipped it with thirty-two green claims — jsdom dispatches whatever it is told to, and the WebKit perf harness measures keyboard, scroll and write but never drags. A real drag in Playwright's WebKit, which has no wry between the page and the engine, starts and completes.

## What it now does

- **A drop into another column is a status change** — the same write the `S` menu makes, on project data — and works in both orders. Reordering *within* a column is unchanged: Manual only, so in Priority a card's own column takes no drop and the pointer says so rather than the card sliding back with nothing written.
- **In Manual the drop writes `status` and `rank` as one edit.** A card arriving in a column is given a place in it, or it would land wherever its old rank happened to sort rather than where it was let go. One edit, so one Undo takes the whole gesture back and no intermediate state is ever written. `rankForInsert` is the arriving half of `rankForDrop`, over the same neighbour scan.
- **In Priority the drop writes the status alone.** "`rank` is written only by manual reordering" stands as written, and both must-pass tests that pin it were kept and extended rather than relaxed.
- **The column under the pointer says so** with an accent wash and a hairline; in Manual a drop line also shows where in it the card would land. The Unreadable column takes no drop in either order — it names no status — and neither do the cards in it.
- **Every column that could take the card opens to a card's height while the drag lasts.** An empty column's stack is three pixels of padding at rest, which is not a target a pointer can be asked to hit, and an empty column is exactly where a card is most often headed.
- **The drag scrolls the board sideways at its edges**, the way it already scrolled a column at its top and bottom. Six columns of 264px do not fit the window, and a column off the side of it was otherwise unreachable.
- **`dragDropEnabled: false` on the main window**, held down by `release-audit` — confirmed by flipping it back, which fails the run — and explained in `Board.tsx` where the drag code is. Nothing listens for `tauri://drag-drop`, so it costs nothing today; if file drops are ever wanted (LC-172), they have to be HTML5 drop events in the webview rather than the OS handler.

ADR 0003 carries a "Revised for LC-60" section recording the reinterpretation and its boundary case; `screen-specs.md` § Board records the interaction.

## Verification

`npm run verify` green after merging `main` (709 frontend tests, Rust suite, native watcher, build). Both new frontend behaviours confirmed failing first by mutation, and the audit guard confirmed failing when the window flag is flipped back. Interaction budgets, WebKit, 5,000 tickets, p95 keyboard/scroll/filter/write against ≤50ms: **board Priority 15/18/28/18**, **board Manual 15/18/28/16**, **list Manual 17/19/22/17**.

**In review rather than done:** the window flag cannot be verified by any test in this repo — it needs a person to drag a card in a running build. Moved to done once that is confirmed.

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

<!-- longclaw:event
id: evt_ab00f310
kind: update
occurred_at: 2026-08-07T09:07:10.433Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: done
    to: in_review
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7efb681c
kind: comment
occurred_at: 2026-08-07T10:35:45.547Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The list moves tickets too, on the same terms. `screen-specs.md` § Issue list had withheld the affordance deliberately — *a dense 36px row is not one* — so the same gesture did nothing on one of the two projections of the same store (ADR 0006). What a drop writes now lives in `ticketMove.ts` and both surfaces ask it, so they cannot drift apart on what dropping somewhere means; `listGeometry.dropAt` is the list's half of the pointer arithmetic. Two things the list needed that the board did not: every status renders for as long as a drag lasts, because a status with no group on screen cannot be dropped into and dragging a group's last row away would otherwise remove it as a target for good; and a drop on a pinned sticky header means the top of that header's group rather than whichever row had scrolled beneath it. The archived group neither takes a drop nor gives one — archiving is a date and not a status (ADR 0004) — and that rule sits in `ticketMove.movable` so it holds for any surface that ever draws an archive. `keyboard-focus-map.md` and ADR 0003 record the reversal.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7d1f8e3e
kind: comment
occurred_at: 2026-08-07T11:01:14.581Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The board half is confirmed working in the app. The list half is not, and is now LC-174 — with a WebKit probe (`perf/drag-probe.mjs`) that shows the list accepting the drop in the engine, so the difference is something only the running app has.
<!-- /longclaw:event -->
