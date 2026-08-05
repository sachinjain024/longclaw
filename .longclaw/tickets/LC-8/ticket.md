---
format: longclaw.ticket/v1
id: 87b949ff-4b05-4dc1-9c72-24fc55251432
key: LC-8
title: "Priority end-to-end: field, glyph, menu (P), and priority ordering within a column"
status: done
priority: p1
labels:
  - domain
  - v0-backlog
created_at: 2026-08-05T14:22:51Z
updated_at: 2026-08-05T14:22:52Z
---

~~Priority end-to-end: field, glyph, menu (`P`), and priority ordering within a column~~ **Done 2026-07-31** — the glyph set from `components.md` § Priority (`src/PriorityGlyph.tsx`, named for assistive technology, never shape and colour alone), the ADR 0003 comparator on its own seam (`src/ordering.ts`), and `P` on a focused card opening the shared popover (`src/Menu.tsx`) with the write going out through `mutate()`. The panel gained a priority row and its status `<select>` moved onto the same menu, so the primitive V0-09, V0-10 and the ordering control inherit already has two callers. [Plan 14](../../../docs/plans/completed/14-priority-end-to-end.md)

## Must-pass

Passed all three clauses, each confirmed failing first: round-trip through `edit_ticket` with an undo toast (`App.test.tsx`, `TicketPanel.test.tsx`), column order Urgent → P1 → P2 → P3 → P4 → None and stable within a level with keyboard navigation following it (`ordering.test.ts`, `Board.test.tsx`), and `an_agent_written_priority_is_never_rewritten_by_an_unrelated_edit` over a new `valid-agent-written-priority` fixture whose `priority: "p1"` is a legal style the app never emits. **Two things worth a look:** `keyboard-focus-map.md:122` lists only `↑↓` for menus while this ships `j`/`k` as well, and status menu rows carry no glyph because the app has no status dot yet

## Source

`docs/backlog/v0-backlog.md` — **V0-08**, Wave 1, step 11, owner Domain.

## Checklist

- [x] Passed all three clauses, each confirmed failing first: round-trip through edit_ticket with an undo toast (App.test.tsx, TicketPanel.test.tsx), column order Urgent → P1 → P2 → P3 → P4 → None and stable within a level with keyboard navigation following it (ordering.test.ts, Board.test.tsx), and… <!-- longclaw:item=ck_a2365ce7 -->

## Activity

<!-- longclaw:event
id: evt_ae25dfac
kind: create
occurred_at: 2026-08-05T14:22:51Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_576af5b2
kind: update
occurred_at: 2026-08-05T14:22:52Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a2365ce7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-08 is recorded there as passed.
<!-- /longclaw:event -->
