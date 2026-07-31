import { describe, expect, it } from "vitest";
import { byPriority, orderColumn } from "./ordering";
import type { TicketPriority, TicketRow } from "./types";

function row(key: string, priority: TicketPriority): TicketRow {
  return {
    state: "indexed",
    key,
    id: key.toLowerCase(),
    title: key,
    status: "todo",
    priority,
    labels: [],
    createdAt: "2026-07-30T11:00:00Z",
    updatedAt: "2026-07-30T11:00:00Z",
    checkedCount: 0,
    checklistCount: 0,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: `hash-${key}`,
    relativePath: `.longclaw/tickets/${key}/ticket.md`,
  };
}

function degraded(key: string): TicketRow {
  return {
    state: "degraded",
    key,
    contentHash: `hash-${key}`,
    relativePath: `.longclaw/tickets/${key}/ticket.md`,
    byteLength: 12,
    readOnly: false,
    diagnostic: { code: "parse_failed", message: "no frontmatter" },
  };
}

const keys = (tickets: TicketRow[]) => tickets.map((ticket) => ticket.key);

describe("priority ordering", () => {
  it("puts a column in the ADR 0003 order", () => {
    const shuffled = [
      row("LC-1", "p3"),
      row("LC-2", "none"),
      row("LC-3", "urgent"),
      row("LC-4", "p4"),
      row("LC-5", "p1"),
      row("LC-6", "p2"),
    ];

    expect(keys(orderColumn(shuffled, byPriority))).toEqual([
      "LC-3",
      "LC-5",
      "LC-6",
      "LC-1",
      "LC-4",
      "LC-2",
    ]);
  });

  it("keeps equal priorities in the order they arrived", () => {
    // "Stable within a level" (screen-specs.md:112). The incoming order is the
    // store's global key sort, so this is what a human sees inside a level.
    const level = [
      row("LC-10", "p2"),
      row("LC-11", "p2"),
      row("LC-12", "urgent"),
      row("LC-13", "p2"),
      row("LC-14", "p2"),
    ];

    expect(keys(orderColumn(level, byPriority))).toEqual([
      "LC-12",
      "LC-10",
      "LC-11",
      "LC-13",
      "LC-14",
    ]);
  });

  it("leaves the tickets it was handed alone", () => {
    const given = [row("LC-1", "none"), row("LC-2", "urgent")];

    orderColumn(given, byPriority);

    expect(keys(given)).toEqual(["LC-1", "LC-2"]);
  });

  it("sorts a row that would not parse as if it had no priority", () => {
    // A degraded file has no readable priority, and inventing one for it would
    // be a claim about bytes nobody could read.
    const mixed = [degraded("LC-98"), row("LC-1", "none"), row("LC-2", "p1")];

    expect(keys(orderColumn(mixed, byPriority))).toEqual([
      "LC-2",
      "LC-98",
      "LC-1",
    ]);
  });
});
