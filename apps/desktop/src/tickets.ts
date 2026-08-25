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
 * Where a ticket's file actually is, for the clipboard (LC-222).
 *
 * A row carries `relativePath` — `.longclaw/tickets/LC-1/ticket.md`, which is
 * the same string in every project there has ever been — so a Copy file path
 * row that copied it would put something on the clipboard that names no file.
 * The project's folder is what makes it one.
 *
 * String work rather than a path library: the frontend has no `node:path`, and
 * the one case that is not concatenation is a `relativePath` that is already
 * absolute, which nothing writes and which is left alone rather than corrupted.
 */
export function ticketPath(rootPath: string, relativePath: string): string {
  if (relativePath.startsWith("/")) return relativePath;
  return `${rootPath.replace(/\/+$/, "")}/${relativePath}`;
}

/**
 * `1/3`, and empty for a ticket with no checklist: the fraction surfaces only
 * when there is a checklist to count (`components.md:190`). Shared by the card
 * and the row, which must not be able to disagree about when it appears — the
 * board card also spends a label chip on it whenever it does.
 */
export function checklistFraction(ticket: IndexedTicket): string {
  return ticket.checklistCount > 0
    ? `${ticket.checkedCount}/${ticket.checklistCount}`
    : "";
}

/**
 * A ticket key taken apart: its project prefix, the number it spends, and the
 * trailing character it carries if it carries one.
 *
 * `<PREFIX>-<n>` or `<PREFIX>-<n><s>`, `n` without leading zeros and `s` a single
 * lowercase letter (`core/storage.rs:92`, `file_format.md:223`). Both forms,
 * because `LC-1` … `LC-233` were minted before `s` existed and keep the keys they
 * were minted with (LC-232).
 *
 * The one place this file reads a key apart. LC-232 found two copies of the old
 * shape here — an optimistic key computed from a maximum of zero, and a palette
 * that could not find a suffixed ticket — because the rule was written twice as a
 * regex rather than once as a function.
 *
 * The prefix carries no `-`, because a project key is letters and digits
 * (`core/project.rs`, `file_format.md:223`) — which is what keeps `LC-42-1` from
 * being read as ticket 1 of a project called `LC-42`.
 *
 * Case is taken as typed and normalized by the caller. This says how a key comes
 * apart, not whose it is or whether it was written the way the directory is: the
 * palette accepts `lc-60` on purpose (LC-171), and the directory grammar that
 * refuses it is Rust's (`core/storage.rs:92`).
 */
export function splitTicketKey(
  key: string,
): { prefix: string; number: number; suffix: string } | undefined {
  const match = /^([A-Za-z][A-Za-z0-9]*)-([1-9][0-9]*)([A-Za-z]?)$/.exec(key);
  if (!match) return undefined;
  return { prefix: match[1], number: Number(match[2]), suffix: match[3] };
}

/**
 * The key a create is about to be given, read off the rows already on screen.
 *
 * Rust allocates the real key from the project's own directory names, and that
 * is the one that lasts — this exists only so the card can appear before the
 * write returns, and it is replaced by whatever comes back.
 *
 * The number is all this can guess. The real key's trailing character is drawn
 * when the directory is claimed (LC-232), so the placeholder wears none rather
 * than inventing one that the write would then contradict.
 */
export function provisionalTicketKey(
  projectKey: string,
  tickets: TicketRow[],
): string {
  const highest = tickets.reduce((max, ticket) => {
    const parts = splitTicketKey(ticket.key);
    if (!parts || parts.prefix !== projectKey) return max;
    return Math.max(max, parts.number);
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
 * with the canonical key, which is what a row can then be matched against.
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
 * The shape is the file format's own (`core/storage.rs:92`): `<PREFIX>-<n>` or
 * `<PREFIX>-<n><s>`, `n` without leading zeros and `s` a single lowercase
 * letter. Case is not part of it — the index lowercases both sides
 * (`core/storage.rs:328-337`) and so does the header filter, so a key typed in
 * the case it is easiest to type is still that key.
 *
 * A typed trailing character is kept, and its absence is not one: `LC-234` names
 * `LC-234x`, because the number is what a person reads off a commit message or
 * hears out loud and the character is the part they will not have (LC-232).
 * [`ticketKeyNames`] is the other half of that — this normalizes what was typed,
 * and that decides which row it names.
 */
export function ticketKeyQuery(
  query: string,
  projectKey: string,
): string | undefined {
  const typed = query.trim();
  if (/^[1-9][0-9]*$/.test(typed)) return `${projectKey}-${typed}`;
  const parts = splitTicketKey(typed);
  if (!parts || parts.prefix.toLowerCase() !== projectKey.toLowerCase())
    return undefined;
  return `${projectKey}-${parts.number}${parts.suffix.toLowerCase()}`;
}

/**
 * Whether a query that resolved to `queried` names the ticket keyed `key`.
 *
 * Exact when the query carried a trailing character, and otherwise the number
 * alone: `LC-234` names `LC-234x`, and `LC-6` still does not name `LC-60` —
 * which is the distinction the palette's exact match was written for (LC-171).
 *
 * A number that two tickets carry names the first of them, which is the state
 * `npm run ticket-keys:check` fails on: a key claimed twice is ambiguous by
 * definition, and the palette is not where that gets resolved.
 */
export function ticketKeyNames(queried: string, key: string): boolean {
  if (queried === key) return true;
  const parts = splitTicketKey(queried);
  const target = splitTicketKey(key);
  if (!parts || !target || parts.suffix !== "") return false;
  return parts.prefix === target.prefix && parts.number === target.number;
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
