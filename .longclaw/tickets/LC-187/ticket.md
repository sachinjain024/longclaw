---
format: longclaw.ticket/v1
id: 68e8e508-b948-49a8-9d3f-b4c565d13473
key: LC-187
title: A Manual drop while a filter is on ranks only the rows that match
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-09T00:57:08.052Z
updated_at: 2026-08-09T00:57:08.052Z
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
