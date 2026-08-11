/**
 * How the tickets inside one board column are ordered.
 *
 * ADR 0003 gives the board two orders: priority by default, and a Manual order
 * over the per-ticket `rank`. Both live here rather than inside `layOutColumns`,
 * so a surface picks an order instead of owning one — the list reads the same
 * preference for the rows inside a group (`screen-specs.md:180`).
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
 * Whether a rank could be written to this row at all. A file this build cannot
 * read has no frontmatter to put one in — the same reason it cannot be dragged
 * (`ticketMove.movable`), reaching it here because a degraded row still sits in
 * the column its directory last read as (`grouping.ticketStatus`) and so can
 * stand above a gap somebody else drops into.
 */
function takesRank(ticket: TicketRow): boolean {
  return ticket.state === "indexed";
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

/** A card that is given a rank by a drop, and the rank it is given. */
export interface RankAssignment {
  key: string;
  rank: string;
}

/**
 * What one drop allocates: the rank for the card being moved, and a rank for
 * every card above it that had none.
 *
 * `backfill` is empty for most drops and is never long — it is the cards
 * *above* the gap only, in the order they already had, and a column keeps its
 * ranks once it has them. It exists because a fractional index can only sit
 * between keys that exist, and until LC-174 a drop among cards with no rank
 * silently landed at the boundary instead (see `rankForInsert`).
 */
export interface RankPlan {
  rank: string;
  backfill: RankAssignment[];
}

/**
 * The ranks for a card dropped at `index` of a column that does not already
 * hold it — a card arriving from another column, and, once the card being moved
 * is taken out of the way, a reorder inside one column too.
 *
 * The neighbours are the nearest ranked card on each side, not the immediate
 * ones: a card with no rank is not a position, so it cannot bound one — which
 * is the whole difficulty, because until something is dragged *no* card in a
 * column has one (ADR 0003).
 *
 * So a drop into a run of unranked cards gives those **above the gap** a
 * position, in the order they already had, and takes the one after them. The
 * cards below the gap are left alone: unranked cards sort below every ranked
 * one and keep their order among themselves, so they are already where the drop
 * says they should be, and a rank on one of them would be a file written for a
 * card nobody moved. Dropping above everything writes nothing but the card's own
 * rank; dropping at the bottom of a fresh column is the expensive end, and it is
 * paid once per column.
 *
 * ADR 0003 originally had this land at the ranked/unranked boundary rather than
 * under the pointer, on the grounds that the alternative wrote files nobody
 * dragged. LC-174 is what that cost: on a column nobody has dragged in, which is
 * every column, a card let go three rows down did not move at all.
 *
 * A row above a gap that cannot be given a position keeps the unranked tail
 * rather than being written to: a file this build cannot read has no frontmatter
 * to hold one. That is the ranked-before-unranked rule of `byRank` showing
 * through, and it is not new here.
 *
 * `ordered` is the whole column and never the drawn one. A filtered surface
 * hands its subset to `ticketMove`, which maps the gap onto the group behind it
 * before this is asked anything (LC-187): allocating over the subset ranked the
 * matching rows above every hidden row that had none, which is this same rule
 * showing through where nobody could see it.
 */
export function rankForInsert(ordered: TicketRow[], index: number): RankPlan {
  const at = Math.max(0, Math.min(index, ordered.length));

  // The nearest ranked card below the gap, which bounds everything allocated
  // here. Absent means the gap runs to the bottom of the column.
  let after: string | undefined;
  for (let scan = at; scan < ordered.length && after === undefined; scan += 1) {
    after = manualRank(ordered[scan]);
  }

  // Down the cards above the gap, carrying the lower bound: a ranked one moves
  // it, an unranked one is given the next position and becomes it. A file this
  // build cannot read is passed over rather than named in a write that could
  // not happen — it keeps the unranked tail, which is where a column that has
  // been dragged in puts everything with no position (`byRank`).
  const backfill: RankAssignment[] = [];
  let before: string | undefined;
  for (let scan = 0; scan < at; scan += 1) {
    const rank = manualRank(ordered[scan]);
    if (rank !== undefined) {
      before = rank;
      continue;
    }
    if (!takesRank(ordered[scan])) continue;
    before = rankBetween(before, after);
    backfill.push({ key: ordered[scan].key, rank: before });
  }

  return { rank: rankBetween(before, after), backfill };
}

/**
 * The ranks for a card dropped at `index` in the column it is already in.
 *
 * `undefined` means the drop would not move the card and so should write
 * nothing — `TicketDocument::apply` refuses an edit that changes nothing.
 */
export function rankForDrop(
  ordered: TicketRow[],
  movingKey: string,
  index: number,
): RankPlan | undefined {
  const from = ordered.findIndex((ticket) => ticket.key === movingKey);
  if (from === -1) return;
  // The two gaps either side of the card are where it already is.
  if (index === from || index === from + 1) return;

  const others = ordered.filter((ticket) => ticket.key !== movingKey);
  const plan = rankForInsert(others, index > from ? index - 1 : index);
  // A drop that moves nothing writes nothing. Only a plan that gives the card
  // the rank it already has can be one: a backfill is by definition a card
  // changing position relative to the one being dragged.
  if (plan.backfill.length === 0 && plan.rank === manualRank(ordered[from])) {
    return;
  }
  return plan;
}

/**
 * Orders one column, leaving the array it was given alone.
 *
 * `Array.prototype.sort` has been stable since ES2019, which is what makes the
 * order within one priority level the order the tickets arrived in — the store's
 * key sort (`screen-specs.md:132`).
 */
export function orderColumn(
  tickets: TicketRow[],
  compare: TicketOrdering = byPriority,
): TicketRow[] {
  return [...tickets].sort(compare);
}
