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
