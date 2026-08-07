/**
 * Stands in for `@tauri-apps/api/core` so the real `App` renders in a browser.
 *
 * Only the commands the board path uses answer; anything else throws, so a
 * measurement can never quietly pass through a command this harness invented.
 *
 * `?rw=1` adds the write commands, and nothing else changes: the accessibility
 * audit (plan 41) has to complete the ticket lifecycle — create, edit, archive,
 * undo, retry — and every one of those is a write. It is a query flag rather
 * than a second stub file so the strict default above stays the default: a perf
 * or matrix run never asks for it, so a measurement still cannot pass through a
 * command that was invented for the audit. `?fail=edit` makes the first edit
 * fail, which is the only way to reach the Retry the gate asks about, and
 * `?fail=parse` degrades every read, which is the only way to reach the raw
 * file view.
 */

import { bridge, markLoaded } from "../bridge";
import { PROJECT, detail, snapshot, ticket } from "../fixture";
import type {
  CreateTicketRequest,
  EditTicketRequest,
  IndexedTicket,
  TicketDetail,
  VisibleUiProbe,
  WriteResult,
} from "../../src/types";

const params = new URLSearchParams(window.location.search);

/**
 * `?tickets=N` shrinks the board, so a number can be shown to scale with it.
 * `?tickets=0` is the empty project (LC-86), which is a designed state and not
 * a degenerate size — the guide card is only reachable here.
 */
const requested = params.get("tickets");
const size = requested === null ? Number.NaN : Number(requested);
const board = snapshot(
  requested !== "" && Number.isFinite(size) && size >= 0 ? size : undefined,
);

/** `?rw=1`: serve the write commands as well as the read ones. */
const WRITABLE = params.get("rw") === "1";
/** `?fail=edit`: the next `edit_ticket` fails once, recoverably. */
let failNextEdit = params.get("fail") === "edit";
/**
 * `?fail=parse`: every `read_ticket` comes back degraded, so the raw file view
 * can be driven.
 *
 * A read rather than a fixture row: a degraded ticket in `board.tickets` would
 * land in every screenshot the theme matrix and the board shots take, and in
 * the counts the perf budgets are measured against. What the keyboard contract
 * needs is only the panel's side of it.
 */
const FAIL_PARSE = params.get("fail") === "parse";

export class Channel<T> {
  onmessage: (message: T) => void = () => {};
}

/**
 * The mutable half of the fixture. `board.tickets` is the array the snapshot
 * handed the store, and the writes below edit these rows in place so a re-read
 * — the panel opening, a search — sees what the last write did.
 */
const rows = new Map(
  board.tickets.map((row) => [row.key, row as IndexedTicket]),
);
let generation = board.generation;
let created = 0;

function write(row: IndexedTicket): WriteResult {
  generation += 1;
  row.contentHash = `hash-${generation}`;
  row.updatedAt = new Date(Date.UTC(2026, 7, 4, generation)).toISOString();
  return { ticket: { ...row }, generation, changes: [] };
}

function createTicket(request: CreateTicketRequest): WriteResult {
  created += 1;
  const row: IndexedTicket = {
    ...(ticket(board.tickets.length + created) as IndexedTicket),
    key: `PF-NEW${created}`,
    id: `perf-new-${created}`,
    title: request.title,
    status: request.status ?? "todo",
    priority: request.priority ?? "none",
    labels: request.labels ?? [],
    checklistCount: request.checklist?.length ?? 0,
    checkedCount: 0,
  };
  row.relativePath = `.longclaw/tickets/${row.key}/ticket.md`;
  rows.set(row.key, row);
  return write(row);
}

function editTicket(request: EditTicketRequest): WriteResult {
  const row = rows.get(request.ticketKey);
  if (!row) {
    throw Object.assign(new Error(`no ticket ${request.ticketKey}`), {
      code: "ticket_not_found",
      recoverable: false,
    });
  }
  const { edit } = request;
  if (edit.title !== undefined) row.title = edit.title;
  if (edit.status !== undefined) row.status = edit.status;
  if (edit.priority !== undefined) row.priority = edit.priority;
  if (edit.labels !== undefined) row.labels = edit.labels;
  if (edit.archived !== undefined) {
    row.archivedAt = edit.archived
      ? new Date(Date.UTC(2026, 7, 4)).toISOString()
      : undefined;
  }
  if (edit.addChecklistItems?.length) {
    row.checklistCount += edit.addChecklistItems.length;
  }
  return write(row);
}

/** The panel's view of a row, so an edit made on the board is visible in it. */
function ticketDetail(key: string): TicketDetail {
  const base = detail(key);
  if (FAIL_PARSE) {
    return {
      ...base,
      ticket: undefined,
      raw: [
        "---",
        "format: longclaw.ticket/v1",
        `key: ${key}`,
        "status: not_a_real_status",
        "---",
        "",
        "The body survives.",
      ].join("\n"),
      diagnostic: {
        code: "parse_failed",
        message:
          "status must be one of backlog, todo, …; found not_a_real_status",
        line: 4,
      },
    };
  }
  const row = rows.get(key);
  if (!row || !base.ticket) return base;
  return {
    ...base,
    contentHash: row.contentHash,
    ticket: {
      ...base.ticket,
      title: row.title,
      status: row.status,
      priority: row.priority,
      labels: row.labels,
      archivedAt: row.archivedAt,
    },
  };
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  // The real command supplies the native user's home for display-only tilde
  // abbreviation. This fixture project lives under /tmp, so the concrete stub
  // value does not alter what the performance surfaces render.
  if (command === "home_dir") return "/Users/longclaw" as T;
  if (command === "list_projects") return [PROJECT] as T;
  // A harness that carried preferences between runs would carry a view mode or
  // a filter into a measurement that did not ask for one, so this device
  // remembers nothing: every run starts on the launch defaults, and what the
  // app writes goes nowhere.
  if (command === "read_preferences") return {} as T;
  if (command === "write_preferences") return undefined as T;
  if (command === "open_project" || command === "rebuild_index") {
    return { ...board, tickets: [...rows.values()], generation } as T;
  }
  // The theme matrix (V0-37) opens the panel and raises the error banner.
  if (command === "read_ticket")
    return ticketDetail(args?.ticketKey as string) as T;
  if (command === "update_project_name") {
    throw Object.assign(
      new Error("Project file is read-only in this harness"),
      { code: "permission_denied", recoverable: true },
    );
  }
  if (command === "report_visible_ui") {
    bridge.probes.push({
      at: performance.now(),
      probe: args?.probe as VisibleUiProbe,
    });
    markLoaded();
    return undefined as T;
  }

  if (WRITABLE) {
    if (command === "create_ticket") {
      return createTicket(args?.request as CreateTicketRequest) as T;
    }
    if (command === "edit_ticket") {
      if (failNextEdit) {
        failNextEdit = false;
        // The shape `failure.ts` reads: a cause it knows, and a path, so the
        // danger toast carries a recovery sentence and a Retry rather than a
        // bare code.
        throw Object.assign(new Error("Permission denied writing ticket.md"), {
          code: "permission_denied",
          recoverable: true,
          context: {
            cause: "readOnly",
            path: `.longclaw/tickets/${(args?.request as EditTicketRequest).ticketKey}/ticket.md`,
          },
        });
      }
      return editTicket(args?.request as EditTicketRequest) as T;
    }
    if (command === "search_tickets") {
      const query = String(args?.query ?? "").toLowerCase();
      const tickets = [...rows.values()]
        .filter(
          (row) =>
            row.key.toLowerCase().includes(query) ||
            row.title.toLowerCase().includes(query),
        )
        .slice(0, 100);
      return { tickets, elapsedMs: 0 } as T;
    }
  }

  throw new Error(`the performance harness does not serve ${command}`);
}
