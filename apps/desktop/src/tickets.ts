/**
 * Ticket vocabulary shared by the board, the panel, and creation.
 *
 * The status set is fixed in v0 (ADR 0002), so the order here is the order every
 * surface uses.
 */

import type {
  CreateTicketRequest,
  IndexedTicket,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

export const STATUSES: { id: TicketStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
  { id: "canceled", label: "Canceled" },
];

/**
 * Listed most urgent first, which is also the board's default column order
 * (ADR 0003). `ordering.ts` reads each priority's place off this list rather
 * than keeping a second copy of it.
 */
export const PRIORITIES: { id: TicketPriority; label: string }[] = [
  { id: "urgent", label: "Urgent" },
  { id: "p1", label: "P1" },
  { id: "p2", label: "P2" },
  { id: "p3", label: "P3" },
  { id: "p4", label: "P4" },
  { id: "none", label: "None" },
];

export function priorityLabel(priority: TicketPriority): string {
  return PRIORITIES.find((option) => option.id === priority)?.label ?? priority;
}

export function statusLabel(status: TicketStatus): string {
  return STATUSES.find((option) => option.id === status)?.label ?? status;
}

/**
 * Archived is a date on the ticket, not a status (ADR 0004): the file stays
 * where it is and keeps whatever workflow status it had. `groupByStatus` reads
 * this to leave an archived ticket out of every status group, which is what
 * keeps it off the board; the list reads it to fill its own archived group.
 */
export function isArchived(ticket: TicketRow): boolean {
  return ticket.state === "indexed" && ticket.archivedAt !== undefined;
}

/**
 * `1/3`, and empty for a ticket with no checklist: the fraction surfaces only
 * when there is a checklist to count (`components.md:180`). Shared by the card
 * and the row, which must not be able to disagree about when it appears — the
 * board card also spends a label chip on it whenever it does.
 */
export function checklistFraction(ticket: IndexedTicket): string {
  return ticket.checklistCount > 0
    ? `${ticket.checkedCount}/${ticket.checklistCount}`
    : "";
}

/**
 * The key a create is about to be given, read off the rows already on screen.
 *
 * Rust allocates the real key from the project's own directory names, and that
 * is the one that lasts — this exists only so the card can appear before the
 * write returns, and it is replaced by whatever comes back.
 */
export function provisionalTicketKey(
  projectKey: string,
  tickets: TicketRow[],
): string {
  const highest = tickets.reduce((max, ticket) => {
    const match = /^(.+)-(\d+)$/.exec(ticket.key);
    if (!match || match[1] !== projectKey) return max;
    return Math.max(max, Number(match[2]));
  }, 0);
  return `${projectKey}-${highest + 1}`;
}

/**
 * The ticket key a query is asking for, or nothing when it is asking for
 * something else (LC-171).
 *
 * The palette's root filters command labels, so `LC-60` — the fastest thing
 * anyone knows how to type — used to find nothing at all. This is the rule that
 * tells the root when a query is a key rather than a command, and it answers
 * with the canonical key so the caller has something to compare an index answer
 * against.
 *
 * Two decisions the ticket left open, made here:
 *
 * - **A bare number counts.** `60` is `LC-60`, because the palette runs against
 *   the active project and never another, so its key is the only prefix a
 *   number could mean.
 * - **A foreign prefix does not.** Every ticket of a project carries that
 *   project's key (`core/storage.rs:102`), so `AB-1` cannot be a ticket here;
 *   offering to look for it would promise a search that must come back empty.
 *   The query goes back to filtering commands, which is what it did before.
 *
 * The shape is the file format's own (`core/storage.rs:74`): `<PREFIX>-<n>`,
 * `n` without leading zeros. Case is not part of it — the index lowercases both
 * sides (`core/storage.rs:265-274`) and so does the header filter, so a key
 * typed in the case it is easiest to type is still that key.
 */
export function ticketKeyQuery(
  query: string,
  projectKey: string,
): string | undefined {
  const typed = query.trim();
  if (/^[1-9][0-9]*$/.test(typed)) return `${projectKey}-${typed}`;
  const match = /^(.+)-([1-9][0-9]*)$/.exec(typed);
  if (!match || match[1].toLowerCase() !== projectKey.toLowerCase())
    return undefined;
  return `${projectKey}-${match[2]}`;
}

/** The row an optimistic create shows while its file is being written. */
export function provisionalTicket(
  key: string,
  request: Omit<CreateTicketRequest, "projectId">,
  createdAt: string,
): IndexedTicket {
  return {
    state: "indexed",
    key,
    id: "",
    title: request.title,
    status: request.status ?? "todo",
    priority: request.priority ?? "none",
    labels: request.labels ?? [],
    createdAt,
    updatedAt: createdAt,
    checkedCount: 0,
    checklistCount: request.checklist?.length ?? 0,
    commentCount: 0,
    attachmentCount: 0,
    // No hash: nothing has been written, so nothing may be edited against it.
    contentHash: "",
    relativePath: `.longclaw/tickets/${key}/ticket.md`,
  };
}
