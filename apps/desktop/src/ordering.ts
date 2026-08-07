/**
 * How the tickets inside one board column are ordered.
 *
 * ADR 0003 gives the board two orders: priority by default, and a Manual order
 * over the per-ticket `rank`. Both live here rather than inside `layOutColumns`,
 * so a surface picks an order instead of owning one — the list reads the same
 * preference for the rows inside a group (`screen-specs.md:146`).
 *
 * Which of the two is in force is a device-local view preference and never
 * project data, so nothing in this file writes anything and switching mode moves
 * cards without touching a file.
 */

import { rankBetween } from "./rank";
import { PRIORITIES } from "./tickets";
import type { TicketRow } from "./types";

/** Compares two tickets for their place in a column. */
export type TicketOrdering = (left: TicketRow, right: TicketRow) => number;

/** The two orders the board offers (ADR 0003). A view preference, not a field. */
export type OrderingMode = "priority" | "manual";

/** The rows of the ordering menu, in the order the control lists them. */
export const ORDERINGS: { id: OrderingMode; label: string }[] = [
  { id: "priority", label: "Priority" },
  { id: "manual", label: "Manual" },
];

/** Whether an untrusted preference names one of the ordering modes we offer. */
export function isOrderingMode(value: unknown): value is OrderingMode {
  return ORDERINGS.some((option) => option.id === value);
}

/**
 * Where each priority sits in the order `PRIORITIES` lists them in. Not a
 * `rank`: that word is taken, and it means the manual-order string on the
 * ticket (ADR 0003, `docs/file_format.md`) — which this file also sorts by, ten
 * lines down.
 */
const PRIORITY_ORDER = new Map(
  PRIORITIES.map((option, index) => [option.id, index]),
);

/**
 * A file that would not parse has no priority anyone could read, so it sorts as
 * if it had none rather than being given one it never claimed.
 */
function priorityIndex(ticket: TicketRow): number {
  const priority = ticket.state === "indexed" ? ticket.priority : "none";
  return PRIORITY_ORDER.get(priority) ?? PRIORITY_ORDER.size;
}

/** Urgent → P1 → P2 → P3 → P4 → None (ADR 0003). */
export const byPriority: TicketOrdering = (left, right) =>
  priorityIndex(left) - priorityIndex(right);

/** The rank on a row, if it has one. A file that would not parse has none. */
function manualRank(ticket: TicketRow): string | undefined {
  return ticket.state === "indexed" ? ticket.rank : undefined;
}

/**
 * The Manual order: by `rank`, and then by priority for everything with no rank.
 *
 * The mixed case is the one worth stating, because it is the ordinary one. A
 * project switching to Manual has no ranks at all, and ADR 0003 forbids
 * allocating any until something is actually dragged — so Manual has to mean
 * something for a column where none, some, or all of the cards carry a rank.
 *
 * A rank is a position a human chose; no rank is a position nobody chose. So
 * the chosen ones come first, in rank order, and the rest follow in the order
 * they already had. Two consequences are deliberate: switching mode on a board
 * nobody has dragged changes nothing on screen, and the first card dragged in a
 * column lands at the boundary between the ordered cards and the unordered ones
 * rather than exactly under the pointer — see `onDrop` in `Board.tsx`.
 *
 * Comparison is plain `<` over the whole string, including a rank this build did
 * not write (`rank.ts`): it cannot be split, but it is still a position, and
 * ignoring it would move a card nobody touched. Equal ranks return 0 and are
 * left to the stable sort, exactly as equal priorities are.
 */
export const byRank: TicketOrdering = (left, right) => {
  const leftRank = manualRank(left);
  const rightRank = manualRank(right);
  if (leftRank === undefined && rightRank === undefined)
    return byPriority(left, right);
  if (leftRank === undefined) return 1;
  if (rightRank === undefined) return -1;
  return leftRank < rightRank ? -1 : leftRank > rightRank ? 1 : 0;
};

export function comparatorFor(mode: OrderingMode): TicketOrdering {
  return mode === "manual" ? byRank : byPriority;
}

/**
 * The rank for a card dropped at `index` of a column that does not already hold
 * it — a card arriving from another column, and, once the card being moved is
 * taken out of the way, a reorder inside one column too.
 *
 * The neighbours are the nearest ranked card on each side, not the immediate
 * ones: a card with no rank is not a position, so it cannot bound one.
 *
 * There is always an answer, unlike a reorder: an arriving card has to be given
 * a place, and a column holding no ranks at all gives it the first one — which
 * is the boundary between the ranked cards and the unranked ones, the same
 * place the first drag inside a column lands.
 */
export function rankForInsert(ordered: TicketRow[], index: number): string {
  const at = Math.max(0, Math.min(index, ordered.length));

  let before: string | undefined;
  for (let scan = at - 1; scan >= 0 && before === undefined; scan -= 1) {
    before = manualRank(ordered[scan]);
  }
  let after: string | undefined;
  for (let scan = at; scan < ordered.length && after === undefined; scan += 1) {
    after = manualRank(ordered[scan]);
  }

  return rankBetween(before, after);
}

/**
 * The rank for a card dropped at `index` in the column it is already in.
 *
 * `undefined` means the drop would not move the card and so should write
 * nothing — `TicketDocument::apply` refuses an edit that changes nothing.
 */
export function rankForDrop(
  ordered: TicketRow[],
  movingKey: string,
  index: number,
): string | undefined {
  const from = ordered.findIndex((ticket) => ticket.key === movingKey);
  if (from === -1) return;
  // The two gaps either side of the card are where it already is.
  if (index === from || index === from + 1) return;

  const others = ordered.filter((ticket) => ticket.key !== movingKey);
  const next = rankForInsert(others, index > from ? index - 1 : index);
  // A drop that cannot be expressed as a rank on this card alone — into the
  // middle of a run of cards that have none — writes nothing rather than
  // writing a rank the column would not move for.
  return next === manualRank(ordered[from]) ? undefined : next;
}

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
