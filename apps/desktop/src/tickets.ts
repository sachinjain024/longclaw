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
 * (ADR 0003). `ordering.ts` reads the rank off this list rather than keeping a
 * second copy of it.
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
 * where it is and keeps whatever workflow status it had. Only the list's
 * archived group reads this today — V0-11 adds the mutation and takes archived
 * tickets off the board.
 */
export function isArchived(ticket: TicketRow): boolean {
  return ticket.state === "indexed" && ticket.archivedAt !== undefined;
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

/**
 * One checklist item per typed line, with an optional Markdown task prefix
 * accepted so pasting a list from anywhere works.
 */
export function checklistFromLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim())
    .filter(Boolean);
}
