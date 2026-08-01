import { describe, expect, it } from "vitest";
import { filterTickets, isFiltering } from "./filtering";
import type { TicketRow } from "./types";

function row(key: string, title: string, labels: string[] = []): TicketRow {
  return {
    state: "indexed",
    key,
    id: key.toLowerCase(),
    title,
    status: "todo",
    priority: "none",
    labels,
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

const keys = (rows: TicketRow[]) => rows.map((ticket) => ticket.key);

describe("the header filter's match rule", () => {
  const tickets = [
    row("LC-1", "Atomic replace race", ["storage"]),
    row("LC-2", "Watcher recovery", ["platform", "wake"]),
    row("LC-3", "Rebuild the index"),
  ];

  it("matches the key", () => {
    expect(keys(filterTickets(tickets, "LC-2"))).toEqual(["LC-2"]);
  });

  it("matches the title, case-insensitively and mid-word", () => {
    expect(keys(filterTickets(tickets, "COVER"))).toEqual(["LC-2"]);
  });

  it("matches a label slug", () => {
    expect(keys(filterTickets(tickets, "storage"))).toEqual(["LC-1"]);
  });

  it("collapses whitespace on both sides of the comparison", () => {
    const spaced = [row("LC-9", "one   two")];
    expect(keys(filterTickets(spaced, "  one two "))).toEqual(["LC-9"]);
  });

  it("returns the array it was given for an empty query", () => {
    expect(filterTickets(tickets, "   ")).toBe(tickets);
  });

  it("keeps nothing when a query matches nothing readable", () => {
    expect(filterTickets(tickets, "zzz")).toEqual([]);
  });

  // The rule the plan argues: a file this build cannot parse has no text to
  // compare, so the app must not claim the query failed to match it.
  it("never filters out an unreadable file, whatever the query", () => {
    const withBroken = [...tickets, degraded("LC-4")];
    expect(keys(filterTickets(withBroken, "zzz"))).toEqual(["LC-4"]);
    expect(keys(filterTickets(withBroken, "storage"))).toEqual([
      "LC-1",
      "LC-4",
    ]);
  });

  it("knows when there is a query to clear", () => {
    expect(isFiltering("")).toBe(false);
    expect(isFiltering("  ")).toBe(false);
    expect(isFiltering("a")).toBe(true);
  });
});
