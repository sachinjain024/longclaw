/**
 * How the tickets inside one board column are ordered.
 *
 * ADR 0003 gives the board two orders: priority by default, and a Manual order
 * over the per-ticket `rank`. Only the first exists today. The comparator is here
 * rather than inside `layOutColumns` so that adding the second one is adding a
 * function beside this one, not unpicking a sort from the layout.
 */

import { PRIORITIES } from "./tickets";
import type { TicketRow } from "./types";

/** Compares two tickets for their place in a column. */
export type TicketOrdering = (left: TicketRow, right: TicketRow) => number;

const RANK = new Map(PRIORITIES.map((option, index) => [option.id, index]));

/**
 * A file that would not parse has no priority anyone could read, so it sorts as
 * if it had none rather than being given one it never claimed.
 */
function rankOf(ticket: TicketRow): number {
  const priority = ticket.state === "indexed" ? ticket.priority : "none";
  return RANK.get(priority) ?? RANK.size;
}

/** Urgent → P1 → P2 → P3 → P4 → None (ADR 0003). */
export const byPriority: TicketOrdering = (left, right) =>
  rankOf(left) - rankOf(right);

/**
 * Orders one column, leaving the array it was given alone.
 *
 * `Array.prototype.sort` has been stable since ES2019, which is what makes the
 * order within one priority level the order the tickets arrived in — the store's
 * key sort (`screen-specs.md:112`).
 */
export function orderColumn(
  tickets: TicketRow[],
  compare: TicketOrdering = byPriority,
): TicketRow[] {
  return [...tickets].sort(compare);
}
