# Tickets order by priority by default, with a per-board Manual option

Within a board column, tickets are ordered by priority by default (Urgent → P1 → P2 → P3 → P4 → None). A board-level control lets the user switch the ordering type between **Priority** and **Manual**. Manual ordering uses the per-ticket `rank` field from the file format; the selected ordering type is a view preference held in device-local app state, not project data.

## Consequences

- Drag-and-drop reordering is available only while the selected sort option is **Manual**. It is disabled while sorting by Priority. (Reordering — a card's place *within* a column. Dragging a card to *another* column is a status change and is available in both orders; see the revision below, which is where this bullet was read too widely.)
- `rank` is written only by manual reordering; a project that never leaves Priority mode never writes rank data, and priority ordering needs nothing on disk beyond the existing `priority` field.
- New tickets need no rank allocation on create in Priority mode; Manual mode assigns rank on first reorder.
- LongClaw owns rank allocation in v0. Agents preserve existing rank strings and do not invent them, so the allocation algorithm remains an app implementation detail rather than part of the agent-facing file contract.

## Revised for LC-60: dragging a card to another column

**Status:** accepted on 2026-08-07, during LC-60. LC-60 says *lane*; the specs and the code say *column*, and this keeps to that.

The first consequence above is about **reordering**, and it was read as being about **dragging**. So a card could not be dragged out of its column in either order: in Priority nothing on the board could be picked up at all, and in Manual a drop outside the card's own column was refused. The keyboard had a path across columns (`S`) and the pointer had none, on the one surface whose whole shape is columns.

Dragging a card into another column is a **status change** — the same write the `S` menu makes, on project data — and is available in both orders. Reordering *within* a column is unchanged: Manual only.

- A drop into another column writes `status`. In Priority it writes nothing else: the position the card takes in the column it arrives in is the priority order, which is not a thing the human chose by dropping there.
- In Manual the same drop writes `status` and `rank` as one edit, because a card arriving in a column is given a place in it — otherwise it would land wherever its old rank happened to sort, which is not where it was let go. One edit, so one Undo takes the whole gesture back and no intermediate state is ever written.
- "`rank` is written only by manual reordering" therefore stands as written: only a drag while the board is in Manual allocates one, whichever column the card lands in.
- A card in a column the app cannot name — the synthetic column for files that will not parse — takes no drop, and neither do the cards in it: there is no frontmatter to write either half of a move into.
- **The boundary case is inherited, and is now the common one.** A card arriving in a column where nothing has a rank takes the first rank and lands above the unranked cards rather than under the pointer — the same "ordered cards first, unordered after" boundary a first drag inside a column lands at, and for the same reason: the alternative is ranking the whole column on its first drop, which writes files nobody dragged. Within one column this was a corner; arriving from another one it is ordinary, because a column nobody has dragged in has no ranks at all.
- The board is wider than the window, so a drag scrolls it sideways at its edges the way it already scrolled a column at its top and bottom. A column that cannot be reached is a status that cannot be set by pointer, which is the gap this revision exists to close.
