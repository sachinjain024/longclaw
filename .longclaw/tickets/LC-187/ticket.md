---
format: longclaw.ticket/v1
id: 68e8e508-b948-49a8-9d3f-b4c565d13473
key: LC-187
title: A Manual drop while a filter is on ranks only the rows that match
status: done
priority: p3
rank: Zw
labels:
  - frontend
created_at: 2026-08-09T00:57:08.052Z
updated_at: 2026-08-11T11:32:17.479Z
---

Found in LC-174's review, and not introduced by it.

Both surfaces are handed `visibleTickets` (`App.tsx`), so a drop is decided over the group **as the surface is drawing it**. With a filter on, that is the matching rows only.

A Manual drop allocates ranks over exactly that subset (`rankForInsert` in `ordering.ts`). The rows it ranks then sort above every row of the same status that still has none — including rows the filter is hiding, which the human never saw and did not move. Clearing the filter shows an order they did not choose.

This predates LC-174: a filtered drop already gave the dragged card a rank that jumped it above hidden unranked rows. LC-174's backfill widens it from one row to the rows above the gap.

## Approach

Three shapes, and picking between them is the ticket:

1. **Decide the drop over the unfiltered group.** The visible gap maps to a position in the full group — the row above the gap, then its index in the whole group. The drop then means what it looks like it means. Costs a second view of the group at drop time.
2. **Refuse a place-drop while a filter is on**, the way a group that would write nothing already refuses one (`takesDrop`). Honest and cheap; takes a gesture away.
3. **Leave it and say so.** It is a small effect on a narrow path.

## How to see it

`node apps/desktop/perf/drag-probe.mjs` has no filtered case; adding one is part of the work. `perf/board-trace.mjs --filter=` shows the filter path the surfaces take.

## Activity

<!-- longclaw:event
id: evt_67aed133
kind: create
occurred_at: 2026-08-09T00:57:08.052Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ff9d487a
kind: update
occurred_at: 2026-08-09T07:37:25.281Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    to: Zw
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dc02511f
kind: update
occurred_at: 2026-08-11T11:23:42.154Z
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

**Shape 1**, on the user's call: the drop is decided over the unfiltered group.

The pointer still arrives in the terms the surface drew it in — a gap among the rows that matched — and `ticketMove.moveForDrop` maps it onto the group behind it before any rank is allocated. A gap is named by the row above it, so that row's seat in the whole group is the answer and the gap is the one after it; at the top of a drawn column there is no row above, so the row below names it instead and the card takes that row's seat. That last case is the one worth stating: a card let go at the top of what the human can see goes above everything they can see, and **not** above the hidden rows over it, which it was never dropped over.

The whole group is bucketed with `groupByStatus` rather than by filtering on the status field, so a degraded row still sits in the status its directory last read as and an archived one is still in no group at all — one statement of those rules, not two. One pass over the project per drop, which is the second view of the group the ticket priced.

Nothing about the *paint* changed: the drop line is still drawn in the gap the pointer is in, over the rows on screen. Only what the gap means changed.

## What changed

- `moveForDrop` takes the unfiltered rows and maps the drawn gap onto the whole group (`ticketMove.ts`); `rankForInsert` and `rankForDrop` are untouched and are now never handed a subset.
- Both surfaces take an `unfiltered` prop and pass it through (`Board.tsx`, `IssueList.tsx`); `App.tsx` hands them the store's rows beside the narrowed ones it already draws.
- `ordering.ts`'s note that `ordered` is "the column as the surface is drawing it" was the statement of this defect; it now says the opposite, and why.
- Two probe cases, `board-place-filtered` and `list-place-filtered`, and a `held` reading in `read()` so a run can tell a column from the window the surface renders of it.

## Runs

- `npm run probe:drag` — 61/61 (was 49/49)
- `npm run probe:drag -- --self-test` — 26/61, inversion holds; both new cases go red with the rest
- `npm run probe:drag --case=board-place-filtered`, with `unfiltered` unwired on purpose — the new check fails alone, `got PF-13 PF-19 PF-1 PF-7 …` against `wanted PF-7 PF-13 PF-19 PF-1 …`, while the drop-line check stays green: the pointer was read right and the write was wrong, which is the diagnosis the case exists to make
- `npm run verify` — exit 0 (881 frontend tests). The native watcher's `filesystem_round_trip_reports_a_folder_that_moved_away_unprompted` failed once and passed on re-run and twice since; nothing here is Rust
- `npm run perf:board` — p95 16/18/28/16ms, within budget
- `npm run perf:list` — p95 17/18/23/17ms, within budget

The two probe cases refuse to report on a column the query did not leave with a hidden row above the gap, or on one the surface is only drawing a window of — a filtered run over a solid column would pass whatever the app did.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7e6d5c50
kind: update
occurred_at: 2026-08-11T11:32:17.479Z
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
