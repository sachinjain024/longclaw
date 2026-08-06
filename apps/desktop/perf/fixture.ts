/**
 * The 5,000-ticket board the risk register asks for, generated in the shape
 * `src-tauri/tests/performance.rs` writes to disk.
 *
 * The Rust harness proves the storage path at this size; this one proves the
 * render path, so the two sit side by side on the same fixture.
 */

import type {
  ProjectReference,
  ProjectSnapshot,
  TicketDetail,
  TicketRow,
  TicketStatus,
} from "../src/types";

/** Matches `TICKETS` in `src-tauri/tests/performance.rs`. */
export const TICKETS = 5_000;

export const PROJECT: ProjectReference = {
  id: "019c8ca0-0000-7000-8000-0000000000ff",
  name: "Performance Fixture",
  rootPath: "/tmp/longclaw-performance-fixture",
  key: "PF",
  theme: "indigo",
  starred: false,
  reachable: true,
  labels: {},
};

/**
 * Spread across every status so each column is long, rather than piling every
 * ticket into one column and leaving the other five empty.
 */
const COLUMNS: TicketStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
];

export function ticket(sequence: number): TicketRow {
  return {
    state: "indexed",
    key: `PF-${sequence}`,
    id: `perf-${sequence}`,
    title: `Searchable storage ticket ${sequence}`,
    status: COLUMNS[sequence % COLUMNS.length],
    priority: "none",
    labels: ["storage"],
    createdAt: "2026-07-29T00:00:00Z",
    updatedAt: "2026-07-29T00:00:00Z",
    checkedCount: 0,
    checklistCount: 1,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: `hash-${sequence}`,
    relativePath: `.longclaw/tickets/PF-${sequence}/ticket.md`,
  };
}

/**
 * The detail behind the ticket panel, for the theme matrix (V0-37): its
 * activity holds every timeline voice the attribution treatment distinguishes
 * — a human comment, an agent comment, agent field changes, and an
 * unattributed external change — so one open panel renders every actor state
 * the matrix has to check.
 */
export function detail(key: string): TicketDetail {
  const human = { type: "human" as const, id: "sachin", name: "Sachin" };
  const agent = { type: "agent" as const, name: "Claude Code" };
  return {
    key,
    relativePath: `.longclaw/tickets/${key}/ticket.md`,
    contentHash: "hash-detail",
    byteLength: 1_024,
    readOnly: false,
    raw: "",
    rawTruncated: false,
    missingAttachments: [],
    orphanAttachments: [],
    ticket: {
      id: `perf-detail-${key}`,
      key,
      title: `Searchable storage ticket ${key}`,
      status: "in_progress",
      priority: "p2",
      labels: ["storage"],
      createdAt: "2026-07-29T00:00:00Z",
      updatedAt: "2026-07-31T10:00:00Z",
      // Inline `code` and a fenced block are here so the matrix's panel probes
      // have something to measure: LC-97 and LC-98 shipped black-on-black code
      // past a green matrix, because the one description it rendered had no
      // backtick in it.
      description:
        "Prove the debounce holds under a rename storm — `unlink` then `add` " +
        "on `watcher/coalesce.rs`.\n\n```\ncoalesce(unlink, add) -> rename\n```",
      checklist: [
        { id: "ck_1", text: "Reproduce the storm", checked: true },
        { id: "ck_2", text: "Pin it in a test", checked: false },
      ],
      attachments: [],
      activity: [
        {
          id: "evt_1",
          kind: "create",
          occurredAt: "2026-07-29T00:00:00Z",
          actor: human,
          changes: [],
          body: "",
        },
        {
          id: "evt_2",
          kind: "comment",
          occurredAt: "2026-07-29T09:00:00Z",
          actor: human,
          changes: [],
          body: "Plan:\n\n1. reproduce\n2. pin it down",
        },
        {
          id: "evt_3",
          kind: "update",
          occurredAt: "2026-07-30T09:00:00Z",
          actor: agent,
          changes: [
            { field: "status", from: "todo", to: "in_progress" },
            { field: "checklist.ck_1.checked", from: "false", to: "true" },
          ],
          body: "",
        },
        {
          id: "evt_4",
          kind: "comment",
          occurredAt: "2026-07-30T09:01:00Z",
          actor: agent,
          changes: [],
          body: "Reproduced; the storm is the editor's rename pattern.",
        },
        {
          id: "evt_5",
          kind: "external_change",
          occurredAt: "2026-07-31T10:00:00Z",
          actor: { type: "unknown" },
          changes: [{ field: "description" }],
          body: "",
        },
      ],
      historyIncomplete: false,
      unknownKeys: [],
      recordDiagnostics: [],
    },
  };
}

export function snapshot(count = TICKETS, sequence = 0): ProjectSnapshot {
  const tickets: TicketRow[] = [];
  for (let index = 1; index <= count; index += 1) tickets.push(ticket(index));
  return {
    project: PROJECT,
    tickets,
    generation: 1,
    rebuiltInMs: 0,
    sequence,
  };
}
