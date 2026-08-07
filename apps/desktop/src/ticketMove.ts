/**
 * What letting go of a ticket writes, wherever it was let go.
 *
 * Both surfaces ask the same question. The board asks it of six columns, the
 * list of its status groups — but a group is a status either way, and the two
 * answers have to agree or the same gesture would mean different things on two
 * projections of the same store (ADR 0006). So the decision lives here and the
 * surfaces only supply the pointer.
 *
 * The rule, from ADR 0003 as revised for LC-60:
 *
 * - **Into another group** it is a status change, the same write the `S` menu
 *   makes. Both orders have it, because a status is project data and the order
 *   is a view preference.
 * - **Inside its own group** it is a rank, which is Manual's alone. In Priority
 *   a ticket's own group takes no drop at all, so the pointer can say so.
 * - **In Manual, arriving is both**: a ticket coming into a group is given a
 *   place in it, or it would land wherever its old rank happened to sort rather
 *   than where it was let go.
 *
 * A group no status names — the synthetic unreadable one, the list's archived
 * one — takes nothing: there is no field a drop there could write. Neither does
 * a file this build cannot read, which has no frontmatter to write into.
 */

import type { Seat, StatusGroup } from "./grouping";
import { rankForDrop, rankForInsert, type OrderingMode } from "./ordering";
import type { IndexedTicket, TicketStatus } from "./types";

/**
 * What a drop asks for: the group it landed in when that is not the one it came
 * from, the place it took there when the board is in Manual, or both. Never
 * neither — a drop that would write nothing is refused rather than raised.
 */
export interface TicketMove {
  status?: TicketStatus;
  rank?: string;
}

/** The ticket a seat holds, when it is one this build can write to. */
function movable(
  groups: StatusGroup[],
  from: Seat | undefined,
): IndexedTicket | undefined {
  if (!from) return undefined;
  const ticket = groups[from.group]?.tickets[from.index];
  return ticket?.state === "indexed" ? ticket : undefined;
}

/**
 * Whether letting go over this group would write anything — which is also the
 * question `dragover` answers, so a group that would write nothing refuses the
 * drop and the pointer says so rather than the ticket sliding back in silence.
 */
export function takesDrop(
  groups: StatusGroup[],
  from: Seat | undefined,
  group: number,
  ordering: OrderingMode,
): boolean {
  if (!movable(groups, from) || !from) return false;
  if (groups[group]?.status === undefined) return false;
  return from.group !== group || ordering === "manual";
}

/**
 * The move a drop at `gap` of `group` asks for, or `undefined` when it asks for
 * nothing — `TicketDocument::apply` refuses an edit that changes nothing, so a
 * drop that would write nothing is never raised as one that would.
 */
export function moveForDrop(
  groups: StatusGroup[],
  from: Seat | undefined,
  group: number,
  gap: number,
  ordering: OrderingMode,
): TicketMove | undefined {
  const moving = movable(groups, from);
  if (!moving || !from || !takesDrop(groups, from, group, ordering)) return;
  const landing = groups[group];

  if (from.group === group) {
    // Back in its own group: a place in it, and only in Manual (ADR 0003).
    const rank = rankForDrop(landing.tickets, moving.key, gap);
    return rank === undefined ? undefined : { rank };
  }

  return {
    status: landing.status,
    // Priority allocates no rank, here as anywhere: the order inside the group
    // it arrives in is not something the human chose by dropping there.
    ...(ordering === "manual"
      ? { rank: rankForInsert(landing.tickets, gap) }
      : {}),
  };
}
