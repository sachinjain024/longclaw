---
format: longclaw.ticket/v1
id: f5dfc44d-3982-4855-b745-33a209d04e85
key: LC-9
title: Board ordering control with Manual mode, rank allocation, and drag-and-drop
status: done
priority: p1
labels:
  - domain
  - v0-backlog
created_at: 2026-08-05T14:22:52Z
updated_at: 2026-08-05T14:22:53Z
---

~~Board ordering control with Manual mode, rank allocation, and drag-and-drop~~ **Done 2026-08-01** — `byRank` beside `byPriority` on V0-08's seam (`src/ordering.ts`), the ordering control on V0-08's shared popover with the `footnote` that was put there for it, and the preference in `localStorage` per project beside `appearance` — never in `longclaw.yaml`, never on a ticket. **Rank allocation is fractional indexing** in its own module (`src/rank.ts`): base 62 in ASCII order so plain `<` is the order, with the integer-part header that keeps head and tail drops four characters wide however often they happen. It is why `file_format.md:66`'s example is `a0V` — that is what this allocates in the first gap it is asked about. A rank outside the alphabet (a LexoRank string, a trailing `0`) is preserved and ordered by but never used as a bound, because the app owes a value it did not write the same courtesy the format contract asks of agents. **The mixed case:** ranked cards first in rank order, unranked after in the priority order they already had — so switching a board nobody has dragged into Manual moves nothing, and the first drag lands at the boundary between ordered and unordered cards. **Dragging over a virtualized column** is native HTML5 events and no library: the drop is `gapAt(offsets, position)` in `boardGeometry.ts` rather than the element under the pointer, so a gap 3,000 cards below the viewport is as answerable as the one under it, and hanging near an edge auto-scrolls. `dragstart` and `dragend` are handled where they bubble to, not on the card, so the per-card memoization is untouched. [Plan 20](../../../docs/plans/completed/20-board-ordering-and-drag.md)

## Must-pass

Passed all four clauses, each confirmed failing first. **Drag only in Manual:** `card.draggable` flips with the mode, and a full drag in Priority calls no write (`Board.test.tsx`, `App.test.tsx`) — re-confirmed by mutation, since the claim is vacuous against a board with no drag: removing the mode guard from `onDragStart` fails it. **`rank` written only by manual reordering:** the App round trip asserts the edit is `{ rank }` and nothing else, with an Undo against the hash the first write returned, and an Undo of a first-ever rank sending `rank: null` rather than inventing one. **Priority writes no rank** and **the ordering choice never rewrites files:** switching Manual→Priority→Manual calls no `edit_ticket`, no `update_project_theme`, no `update_project_name`. Thirty-two frontend claims confirmed red first across `rank.test.ts`, `ordering.test.ts`, `boardGeometry.test.ts`, `Board.test.tsx`, `IssueList.test.tsx` and `App.test.tsx`. **Perf** (`perf:board`/`perf:list`, WebKit, 5,000 tickets, p95 keyboard/scroll/write against ≤50 ms): board 16/17/16 in Priority and 16/18/16 in Manual; list 16/18/15 and 15/18/15. The harness gained `--order=manual`, because Manual is the heavier comparator. **Keyboard:** reordering is **pointer-only in v0, by specification** — `keyboard-focus-map.md:158-161` lists "no drag-and-drop keyboard equivalent" under *Not bound in v0 (deliberate)* and names `S` as the keyboard path that exists. No shortcut was invented. The *mode* is better off than the map assumed: it is a focusable trigger in the content header, so Tab reaches it without the Wave 2 palette. If reordering by keyboard is ever reconsidered it belongs with V0-23, which should read plan 20 first — it would contradict the map, not fill a hole in it. **Two things worth a look:** a drop into the middle of a run of *unranked* cards lands at the boundary rather than under the pointer, and dragging a ranked card below an unranked one writes nothing, because neither can be expressed as a rank on one card — the alternative was ranking the whole column on its first drop, which writes files nobody dragged; and `TicketEdit.rank`'s doc comment claimed on both sides of the wire that leaving Manual sends `null`, which this row's must-pass forbids, now corrected. **Amended 2026-08-01:** the *negative* half of "`rank` is written only by manual reordering" had no test. `CreatedState` in the V0-16 contract test compares the two creation paths' ranks, but both are `None`, so it would have agreed just as happily if both had started writing one. `nothing_but_a_manual_reordering_ever_writes_a_rank` is the side that does not pass by accident: neither create surface and none of the nine other mutations a `TicketEdit` can carry may put a `rank:` in the bytes, record a `rank` change in the history, or leave one on the re-read ticket — with a manual reorder as the control, so the claims cannot hold by nothing being able to write a rank at all. Confirmed red twice, against a create writer that emits `rank: a0V` and against a priority edit that allocates one

## Source

`docs/backlog/v0-backlog.md` — **V0-09**, Wave 1, step 11, owner Domain.

## Checklist

- [x] Passed all four clauses, each confirmed failing first. Drag only in Manual: card.draggable flips with the mode, and a full drag in Priority calls no write (Board.test.tsx, App.test.tsx) — re-confirmed by mutation, since the claim is vacuous against a board with no drag: removing the mode guard… <!-- longclaw:item=ck_6915b16e -->

## Activity

<!-- longclaw:event
id: evt_403199dd
kind: create
occurred_at: 2026-08-05T14:22:52Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_49720822
kind: update
occurred_at: 2026-08-05T14:22:53Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6915b16e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-09 is recorded there as passed.
<!-- /longclaw:event -->
