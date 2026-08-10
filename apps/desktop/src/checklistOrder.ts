/**
 * What letting go of a checklist row means, wherever it was let go.
 *
 * The same split the board and the list already run on (`ticketMove.ts`): the
 * surfaces supply the pointer, and the decision lives here. Two surfaces draw a
 * checklist — the ticket panel, whose rows are items on disk, and the create
 * panel, whose rows are strings that have not been written yet — and a drag has
 * to mean the same thing in both or the same gesture would move a row to two
 * different places depending on whether the ticket existed.
 *
 * A landing is stated as an index here and as a *neighbour* on the wire: the
 * edit says "after `ck_0007`", never "at 3". An index is a claim about the whole
 * list, and by the time the write lands the list may have grown an item an agent
 * appended — which moves every index below it and leaves the neighbour exactly
 * where it was (`core/ticket.rs`, `ChecklistMove`).
 */

import type { ChecklistItem, ChecklistMove } from "./types";

/**
 * Where a row ends up, given the gap the pointer chose.
 *
 * A gap is numbered by the row below it: gap 0 is above the first row, gap
 * `length` is below the last. The dragged row is still in the list while it is
 * being dragged, so every gap below it is one place further along than the index
 * the row will actually hold — which is the whole of the arithmetic, and the
 * half of it a drop gets wrong by landing one row short.
 */
export function landingFor(from: number, gap: number): number {
  return gap > from ? gap - 1 : gap;
}

/** The list with the item at `from` taken out and put back at `to`. */
export function reordered<Item>(
  items: readonly Item[],
  from: number,
  to: number,
): Item[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * What a landing writes and what takes it back, or nothing at all when the row
 * was let go where it already was — which is most drags that start and change
 * their mind, and is not a write.
 *
 * The inverse is built here rather than at the call site because it is the same
 * question asked backwards — which row was above this one — and answering it
 * twice is how the two answers come to disagree.
 */
export function moveOf(
  ids: readonly string[],
  from: number,
  to: number,
): { move: ChecklistMove; inverse: ChecklistMove } | undefined {
  if (from === to) return undefined;
  const itemId = ids[from];
  const landed = reordered(ids, from, to);
  return {
    move: { itemId, after: above(landed, to) },
    inverse: { itemId, after: above(ids, from) },
  };
}

/**
 * The items in the order the human left them, for as long as that order is
 * still about this list.
 *
 * A held order describes the items that were on screen when a row was let go.
 * If the file comes back holding different ones — an agent appended a task, a
 * writer removed one — it is a description of a list that no longer exists, and
 * the file's own order is the only true one. Falling back is what keeps a row
 * from vanishing from a list it is still in (`states.md:177`).
 */
export function heldOrder(
  items: readonly ChecklistItem[],
  order: readonly string[] | undefined,
): readonly ChecklistItem[] {
  if (!order || order.length !== items.length) return items;
  const held = order.map((id) => items.find((item) => item.id === id));
  return held.every((item) => item !== undefined)
    ? (held as ChecklistItem[])
    : items;
}

/** The row above this one, or `null` at the top, where there is none to name. */
function above(ids: readonly string[], index: number): string | null {
  return index === 0 ? null : ids[index - 1];
}
