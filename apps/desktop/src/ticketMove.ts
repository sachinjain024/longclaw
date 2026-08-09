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
import {
  rankForDrop,
  rankForInsert,
  type OrderingMode,
  type RankAssignment,
  type RankPlan,
} from "./ordering";
import { isArchived } from "./tickets";
import type { IndexedTicket, TicketStatus } from "./types";

/**
 * What a drop asks for: the group it landed in when that is not the one it came
 * from, the place it took there when the board is in Manual, or both. Never
 * neither, which the shape says rather than the prose: a move with no status
 * has a rank, and one with no rank has a status.
 *
 * `backfill` is the rest of the gesture rather than a second gesture: the
 * tickets above the drop that had no rank and so had to be given one for the
 * place to exist at all (`ordering.ts`, LC-174). Usually absent, never present
 * without a `rank`, and one Undo takes the whole of it back — a drop is one
 * thing the human did.
 */
export type TicketMove = (
  { status: TicketStatus; rank?: string } | { status?: undefined; rank: string }
) & { backfill?: RankAssignment[] };

/**
 * Where a pointer is over a surface, in the terms a drop is decided in: which
 * group, and which gap between that group's tickets. Two bare numbers either
 * side of a call transpose silently; this cannot.
 */
export interface DropSpot {
  group: number;
  gap: number;
}

/** What a drop writes, and the ticket it writes to. */
export interface TicketDrop {
  ticket: IndexedTicket;
  move: TicketMove;
}

/**
 * The ticket a seat holds, when it is one a drag may pick up at all.
 *
 * A file this build cannot read has no frontmatter to write a move into. An
 * archived ticket is off the board entirely (ADR 0004), so moving one would
 * write a status the human cannot see the result of — the rule lives here
 * rather than in the surface that draws the archive, so it holds for any
 * surface that ever draws one.
 */
export function movable(
  groups: StatusGroup[],
  from: Seat | undefined,
): IndexedTicket | undefined {
  if (!from) return undefined;
  const ticket = groups[from.group]?.tickets[from.index];
  if (ticket?.state !== "indexed" || isArchived(ticket)) return undefined;
  return ticket;
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
 * The ticket a drop at `spot` moves and what it writes, or `undefined` when it
 * writes nothing — `TicketDocument::apply` refuses an edit that changes
 * nothing, so a drop that would write nothing is never raised as one that
 * would. The ticket comes back with the move so a caller has no second chance
 * to disagree about which one it was.
 */
export function moveForDrop(
  groups: StatusGroup[],
  from: Seat | undefined,
  spot: DropSpot,
  ordering: OrderingMode,
): TicketDrop | undefined {
  const ticket = movable(groups, from);
  if (!ticket || !from || !takesDrop(groups, from, spot.group, ordering))
    return;
  const landing = groups[spot.group];

  if (from.group === spot.group) {
    // Back in its own group: a place in it, and only in Manual (ADR 0003).
    const plan = rankForDrop(landing.tickets, ticket.key, spot.gap);
    return plan === undefined ? undefined : { ticket, move: asMove(plan) };
  }
  // `takesDrop` has already refused a group no status names.
  const status = landing.status as TicketStatus;

  return {
    ticket,
    move: {
      status,
      // Priority allocates no rank, here as anywhere: the order inside the
      // group it arrives in is not something the human chose by dropping there.
      ...(ordering === "manual"
        ? asMove(rankForInsert(landing.tickets, spot.gap))
        : {}),
    },
  };
}

/**
 * A plan as the half of a move that carries it. An empty backfill is left out
 * rather than sent as `[]`, so the ordinary drop — into a group that already
 * has ranks — is the same object it has always been.
 */
function asMove(plan: RankPlan): {
  rank: string;
  backfill?: RankAssignment[];
} {
  return {
    rank: plan.rank,
    ...(plan.backfill.length > 0 ? { backfill: plan.backfill } : {}),
  };
}
