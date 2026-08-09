# Tickets order by priority by default, with a per-board Manual option

Within a board column, tickets are ordered by priority by default (Urgent → P1 → P2 → P3 → P4 → None). A board-level control lets the user switch the ordering type between **Priority** and **Manual**. Manual ordering uses the per-ticket `rank` field from the file format; the selected ordering type is a view preference held in device-local app state, not project data.

## Consequences

- Drag-and-drop reordering is available only while the selected sort option is **Manual**. It is disabled while sorting by Priority. (Reordering — a card's place _within_ a column. Dragging a card to _another_ column is a status change and is available in both orders; see the revision below, which is where this bullet was read too widely.)
- `rank` is written only by manual reordering; a project that never leaves Priority mode never writes rank data, and priority ordering needs nothing on disk beyond the existing `priority` field.
- New tickets need no rank allocation on create in Priority mode; Manual mode assigns rank on first reorder.
- LongClaw owns rank allocation in v0. Agents preserve existing rank strings and do not invent them, so the allocation algorithm remains an app implementation detail rather than part of the agent-facing file contract.

## Revised for LC-60: dragging a card to another column

**Status:** accepted on 2026-08-07, during LC-60. LC-60 says _lane_; the specs and the code say _column_, and this keeps to that.

The first consequence above is about **reordering**, and it was read as being about **dragging**. So a card could not be dragged out of its column in either order: in Priority nothing on the board could be picked up at all, and in Manual a drop outside the card's own column was refused. The keyboard had a path across columns (`S`) and the pointer had none, on the one surface whose whole shape is columns.

Dragging a card into another column is a **status change** — the same write the `S` menu makes, on project data — and is available in both orders. Reordering _within_ a column is unchanged: Manual only.

- A drop into another column writes `status`. In Priority it writes nothing else: the position the card takes in the column it arrives in is the priority order, which is not a thing the human chose by dropping there.
- In Manual the same drop writes `status` and `rank` as one edit, because a card arriving in a column is given a place in it — otherwise it would land wherever its old rank happened to sort, which is not where it was let go. One edit, so one Undo takes the whole gesture back and no intermediate state is ever written.
- "`rank` is written only by manual reordering" therefore stands as written: only a drag while the board is in Manual allocates one, whichever column the card lands in.
- A card in a column the app cannot name — the synthetic column for files that will not parse — takes no drop, and neither do the cards in it: there is no frontmatter to write either half of a move into.
- **The boundary case is inherited, and is now the common one.** A card arriving in a column where nothing has a rank takes the first rank and lands above the unranked cards rather than under the pointer — the same "ordered cards first, unordered after" boundary a first drag inside a column lands at, and for the same reason: the alternative is ranking the whole column on its first drop, which writes files nobody dragged. Within one column this was a corner; arriving from another one it is ordinary, because a column nobody has dragged in has no ranks at all.
- The board is wider than the window, so a drag scrolls it sideways at its edges the way it already scrolled a column at its top and bottom. A column that cannot be reached is a status that cannot be set by pointer, which is the gap this revision exists to close.
- **The list moves tickets on the same terms.** Its status groups are the board's columns on one axis, and `screen-specs.md` § Issue list had given it no drag affordance at all — so the same gesture did nothing on one of the two projections of the same store (ADR 0006). What a drop writes is decided in one place for both surfaces (`ticketMove.ts`), so they cannot drift apart on what dropping somewhere means. The list's archived group takes no drop and gives none: archiving is a date and not a status (ADR 0004), and a row dragged out of it would land where the board still would not show it.

## Revised for LC-174: a drop lands where it was let go

**Status:** accepted on 2026-08-09, during LC-174.

The revision above accepted a boundary case and named it inherited: _"A card
arriving in a column where nothing has a rank takes the first rank and lands
above the unranked cards rather than under the pointer … the alternative is
ranking the whole column on its first drop, which writes files nobody dragged."_

That boundary is not a corner. A column nobody has dragged in has **no ranks at
all**, which is every column until somebody drags in it — so on a fresh project
the boundary is the only case there is. What it cost was reported as LC-174, and
it does not read as a boundary from the outside: a card let go three rows down
its own column either does not move at all or jumps to the top of it, on both
surfaces, while the drop line was drawn in the right gap the whole time. "Drag
and drop does nothing" is what that looks like.

There is no single-file write that fixes it. A fractional index can only sit
between keys that exist (`rank.ts`), so a position inside a run of cards with no
rank cannot be expressed by a rank on the dragged card alone.

**So a drop gives the cards above it a place too, and nobody else.** The cards
_above_ the gap that have no rank are ranked, in the order they already had, and
the dragged card takes the position after them (`rankForInsert` in
`ordering.ts`). The cards _below_ the gap are left alone: an unranked card sorts
below every ranked one and keeps its order among the others, so it is already
where the drop says it should be, and a rank on it would be the file nobody
dragged that the earlier revision was right to refuse.

Two rows above a gap are passed over rather than given a place, and both keep
the unranked tail. A file this build cannot read has no frontmatter to hold a
rank — it sits in the column its directory last read as
(`grouping.ticketStatus`), so one can stand above a gap, and naming it in the
plan would be naming a write that cannot happen. And `rankForInsert` is handed
the column **as the surface is drawing it**, so under an active filter a drop
can only express a position among the rows that match. Neither is introduced
here — both are the ranked-before-unranked rule of `byRank` showing through, and
a drop already moved such a row by one — but the backfill moves it further.
LC-187 is the open item for the filter one.

- **It is still one gesture.** The backfill and the dragged card go out as one
  mutation, the backfill first, and one Undo takes the whole of it back
  (`moveCard`/`editMutation` in `App.tsx`). A failure part-way through puts back
  what it has already written rather than leaving a column half-ordered — best
  effort, and the toast still names the failure.
- **The cost is paid once per column, and it is bounded by where the drop is.**
  Dropping at the top of a fresh column writes one file, as it always did;
  dropping at the bottom writes the column. Every later drop in that column
  writes one file, because the column now has ranks.
- **"`rank` is written only by manual reordering" still stands.** Nothing here
  allocates a rank outside a Manual drag: switching mode still writes nothing
  (`must-pass: switching the order rewrites no file`), and a drop in Priority
  writes no rank whichever column it lands in (`must-pass: Priority mode writes
no rank however the board is dragged`, which asserts the whole edit and not
  just its status). The two Priority "place" cases in `perf/drag-probe.mjs` say
  the narrower thing the pointer can be asked: that such a drop is refused
  outright.
- **The proof is a run, not a memory.** `npm run probe:drag` drives all four of
  LC-174's checklist rows with real mouse input in WebKit, with the write
  commands served, and reads the order back — because the surfaces' jsdom tests
  cannot tell a drop the page accepted from a drop that landed.
