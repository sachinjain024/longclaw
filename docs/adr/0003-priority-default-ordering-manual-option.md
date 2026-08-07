# Tickets order by priority by default, with a per-board Manual option

Within a board column, tickets are ordered by priority by default (Urgent → P1 → P2 → P3 → P4 → None). A board-level control lets the user switch the ordering type between **Priority** and **Manual**. Manual ordering uses the per-ticket `rank` field from the file format; the selected ordering type is a view preference held in device-local app state, not project data.

## Consequences

- Drag-and-drop reordering is available only while the selected sort option is **Manual**. It is disabled while sorting by Priority.
- `rank` is written only by manual reordering; a project that never leaves Priority mode never writes rank data, and priority ordering needs nothing on disk beyond the existing `priority` field.
- New tickets need no rank allocation on create in Priority mode; Manual mode assigns rank on first reorder.
- LongClaw owns rank allocation in v0. Agents preserve existing rank strings and do not invent them, so the allocation algorithm remains an app implementation detail rather than part of the agent-facing file contract.

## Revised for LC-60: dragging a card to another lane

**Status:** accepted on 2026-08-07, during LC-60.

The first consequence above is about **reordering**, and it was read as being about **dragging**. So a card could not be dragged out of its column in either order: in Priority nothing on the board could be picked up at all, and in Manual a drop outside the card's own column was refused. The keyboard had a path across columns (`S`) and the pointer had none, on the one surface whose whole shape is lanes.

Dragging a card into another lane is a **status change** — the same write the `S` menu makes, on project data — and is available in both orders. Reordering *within* a lane is unchanged: Manual only.

- A drop into another lane writes `status`. In Priority it writes nothing else: the position the card takes in the lane it arrives in is the priority order, which is not a thing the human chose by dropping there.
- In Manual the same drop writes `status` and `rank` as one edit, because a card arriving in a lane is given a place in it — otherwise it would land wherever its old rank happened to sort, which is not where it was let go. One edit, so one Undo takes the whole gesture back and no intermediate state is ever written.
- "`rank` is written only by manual reordering" therefore stands as written: only a drag while the board is in Manual allocates one, whichever lane the card lands in.
- A card in a lane the app cannot name — the synthetic column for files that will not parse — takes no drop, and neither do the cards in it: there is no frontmatter to write either half of a move into.
