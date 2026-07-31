/**
 * Bucketing tickets by status, which is the one thing the board and the list
 * genuinely share.
 *
 * The board draws a column per group and the list draws a sticky header over a
 * card of rows, but "which tickets are in Todo, and in what order" is one
 * question with one answer, and two copies of it would be two chances to
 * disagree. The surfaces differ in exactly one thing worth a flag: the board
 * keeps every status whether or not it holds anything (ADR 0002 fixes the set,
 * so the scaffold is the point), and the list renders only the statuses that
 * have tickets (`screen-specs.md:135-136`).
 *
 * Ordering happens here, once, because the seats every surface's arrows read
 * have to agree with what it drew (`screen-specs.md:115`).
 *
 * An archived ticket is in none of these groups. Archived is a date and not a
 * status (ADR 0004), so a ticket carrying one has no status bucket to sit in:
 * that is what keeps it off the board (`screen-specs.md:116`) without either
 * surface owning a rule of its own. The list still sees every archived ticket —
 * it asks `isArchived` directly and appends its own group.
 */

import { byPriority, orderColumn, type TicketOrdering } from "./ordering";
import { isArchived, STATUSES } from "./tickets";
import type { TicketRow, TicketStatus } from "./types";

/**
 * A file that will not parse has no status, so it is grouped as what it is.
 * `archived` is not produced here — archived is a date and not a status (ADR
 * 0004) — but the list appends a group under that id, and naming it here is what
 * keeps the two surfaces reading one set of group ids.
 */
export type GroupId = TicketStatus | "unreadable" | "archived";

export interface StatusGroup {
  id: GroupId;
  title: string;
  /** Absent for the synthetic unreadable group, which no status names. */
  status?: TicketStatus;
  tickets: TicketRow[];
}

/** Where a ticket sits in the visual order, which is what the arrows follow. */
export interface Seat {
  group: number;
  index: number;
}

export function ticketStatus(ticket: TicketRow): GroupId {
  return ticket.state === "indexed" ? ticket.status : "unreadable";
}

/** One pass over the tickets rather than one filter per status. */
export function groupByStatus(
  tickets: TicketRow[],
  options?: {
    compare?: TicketOrdering;
    /** True keeps a status with nothing in it: the board's fixed scaffold. */
    keepEmpty?: boolean;
  },
): StatusGroup[] {
  const compare = options?.compare ?? byPriority;
  const byStatus = new Map<string, TicketRow[]>(
    STATUSES.map((status) => [status.id, []]),
  );
  const unreadable: TicketRow[] = [];
  for (const ticket of tickets) {
    if (isArchived(ticket)) continue;
    const status = ticketStatus(ticket);
    if (status === "unreadable") unreadable.push(ticket);
    else byStatus.get(status)?.push(ticket);
  }

  const groups: StatusGroup[] = [];
  for (const status of STATUSES) {
    const held = byStatus.get(status.id) ?? [];
    if (held.length === 0 && !options?.keepEmpty) continue;
    groups.push({
      id: status.id,
      title: status.label,
      status: status.id,
      tickets: orderColumn(held, compare),
    });
  }
  // A file this build cannot read still belongs to the project, so it keeps a
  // place on both surfaces rather than disappearing from the one that lists
  // everything. Unordered: there is no priority in it to order by.
  if (unreadable.length > 0) {
    groups.push({ id: "unreadable", title: "Unreadable", tickets: unreadable });
  }
  return groups;
}

/** Every ticket's seat, so a key press can be answered without a search. */
export function seatsFor(groups: StatusGroup[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();
  groups.forEach((group, groupIndex) =>
    group.tickets.forEach((ticket, index) =>
      seats.set(ticket.key, { group: groupIndex, index }),
    ),
  );
  return seats;
}
