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
 * file view. `?slow=N` holds a write open, which is the only way to see the
 * screen the app shows while one is in flight.
 */

import { bridge, markLoaded } from "../bridge";
import { PROJECT, detail, snapshot, ticket } from "../fixture";
import type {
  ChecklistItem,
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
/**
 * `?slow=N`: a ticket write stays unsettled for N milliseconds before it lands.
 *
 * `create_ticket` and `edit_ticket` only — the two the mutation store reports
 * on. Nothing else here writes: `write_preferences` returns without a receipt
 * and `update_project_name` is refused by this harness on purpose.
 *
 * The disk-state indicator is on screen only while a write is in flight
 * (`WriteFeedback.tsx`), and this stub settles a write in a microtask, so
 * without this the harness can never look at the header the way LC-149's
 * reporter did. It delays the *answer*, not the request: everything the app
 * does optimistically still happens at once, which is the point — the state
 * being held is "written, not yet confirmed", not "the app is stalled".
 */
let slowWriteMs = Number(params.get("slow") ?? 0);
const settling = () =>
  slowWriteMs > 0
    ? new Promise<void>((wake) => setTimeout(wake, slowWriteMs))
    : Promise.resolve();
// The same delay, turned on for one step of a run rather than for all of it
// (`bridge.ts`). `checklist-probe` needs a single write held open while it types
// through it, and paying `?slow` for every write of the run instead would be
// minutes of waiting to reach the one that matters.
if (WRITABLE) bridge.holdWrites = (ms: number) => void (slowWriteMs = ms);

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
  // `null` clears it, which is what an undone first drag sends (`types.ts`).
  // Without this a Manual drag settles back to the rank it started with, and a
  // harness watching where a card landed would be watching the optimistic
  // update decay rather than the write — which is the one thing `drag-probe`
  // exists to tell apart.
  if (edit.rank !== undefined) row.rank = edit.rank ?? undefined;
  if (edit.archived !== undefined) {
    row.archivedAt = edit.archived
      ? new Date(Date.UTC(2026, 7, 4)).toISOString()
      : undefined;
  }
  if (edit.addChecklistItems?.length) {
    row.checklistCount += edit.addChecklistItems.length;
    // The item lands in the list the next read serves, not only in the card's
    // count. A stub that moved the number and left the list alone would let a
    // probe type into the add-field and never see the row it made — and the
    // panel's re-render around that new row is exactly what LC-193 is about.
    const key = request.ticketKey;
    const items = [...(checklists.get(key) ?? baseChecklist(key))];
    for (const text of edit.addChecklistItems) {
      appended += 1;
      items.push({ id: `ck_add${appended}`, text, checked: false });
    }
    checklists.set(key, items);
  }
  // The order the write settled on, kept so the next read serves it. Without
  // this a probe watching where a checklist row landed would be watching the
  // panel's optimistic order decay back to the fixture's — the same trap the
  // rank above is kept for, and the one `drag-probe` exists to tell apart.
  if (edit.moveChecklistItem) {
    const { itemId, after } = edit.moveChecklistItem;
    const key = request.ticketKey;
    const items = [...(checklists.get(key) ?? baseChecklist(key))];
    const from = items.findIndex((item) => item.id === itemId);
    const anchor =
      after === null ? -1 : items.findIndex((item) => item.id === after);
    if (from >= 0 && (after === null || anchor >= 0)) {
      const [moved] = items.splice(from, 1);
      items.splice(anchor > from ? anchor : anchor + 1, 0, moved);
      checklists.set(key, items);
    }
  }
  return write(row);
}

/** Checklists a write has reordered or appended to, by ticket key. */
const checklists = new Map<string, ChecklistItem[]>();
/** Ids for appended items, unique across the run the way LongClaw's are. */
let appended = 0;

const baseChecklist = (key: string): ChecklistItem[] =>
  detail(key).ticket?.checklist ?? [];

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
      checklist: checklists.get(key) ?? base.ticket.checklist,
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
      await settling();
      return createTicket(args?.request as CreateTicketRequest) as T;
    }
    if (command === "edit_ticket") {
      await settling();
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
