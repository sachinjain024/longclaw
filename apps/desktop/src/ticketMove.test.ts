import { describe, expect, it } from "vitest";
import { seatsFor, type StatusGroup } from "./grouping";
import { moveForDrop, takesDrop } from "./ticketMove";
import type { TicketRow } from "./types";

function row(key: string, rank?: string): TicketRow {
  return {
    state: "indexed",
    key,
    id: key.toLowerCase(),
    title: key,
    status: "todo",
    priority: "none",
    labels: [],
    rank,
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

/** Todo holds the moving card; In Progress holds two ranked ones. */
const groups: StatusGroup[] = [
  {
    id: "todo",
    title: "Todo",
    status: "todo",
    tickets: [row("LC-1", "a0"), row("LC-2", "a1")],
  },
  {
    id: "in_progress",
    title: "In Progress",
    status: "in_progress",
    tickets: [row("LC-3", "a5"), row("LC-4", "a6")],
  },
  { id: "unreadable", title: "Unreadable", tickets: [] },
];

const seats = seatsFor(groups);
const from = seats.get("LC-1")!;

describe("which group would take the drop", () => {
  it("takes a card from another group, in either order", () => {
    expect(takesDrop(groups, from, 1, "priority")).toBe(true);
    expect(takesDrop(groups, from, 1, "manual")).toBe(true);
  });

  it("takes it back into its own group only in Manual", () => {
    expect(takesDrop(groups, from, 0, "priority")).toBe(false);
    expect(takesDrop(groups, from, 0, "manual")).toBe(true);
  });

  it("never takes it into a group no status names", () => {
    expect(takesDrop(groups, from, 2, "manual")).toBe(false);
    expect(takesDrop(groups, from, 2, "priority")).toBe(false);
  });

  it("takes nothing while nothing is being dragged", () => {
    expect(takesDrop(groups, undefined, 1, "manual")).toBe(false);
  });
});

describe("what letting go writes", () => {
  it("writes the status of the group it landed in", () => {
    expect(moveForDrop(groups, from, 1, 0, "priority")).toStrictEqual({
      status: "in_progress",
    });
  });

  it("writes the status and the place in it, in Manual", () => {
    const move = moveForDrop(groups, from, 1, 1, "manual");

    expect(move?.status).toBe("in_progress");
    expect(move!.rank! > "a5" && move!.rank! < "a6").toBe(true);
  });

  it("writes only a rank back inside its own group", () => {
    const move = moveForDrop(groups, from, 0, 2, "manual");

    expect(move?.status).toBeUndefined();
    expect(move!.rank! > "a1").toBe(true);
  });

  it("writes nothing for a drop that would not move the card", () => {
    expect(moveForDrop(groups, from, 0, 0, "manual")).toBeUndefined();
    expect(moveForDrop(groups, from, 0, 1, "manual")).toBeUndefined();
    // And nothing at all inside its own group in Priority, where a place is
    // not a thing this board can write (ADR 0003).
    expect(moveForDrop(groups, from, 0, 2, "priority")).toBeUndefined();
  });

  it("writes nothing into a group no status names", () => {
    expect(moveForDrop(groups, from, 2, 0, "manual")).toBeUndefined();
  });

  it("writes nothing for a file it cannot read", () => {
    const degraded: StatusGroup[] = [
      {
        id: "todo",
        title: "Todo",
        status: "todo",
        tickets: [
          {
            state: "degraded",
            key: "LC-99",
            contentHash: "hash-99",
            relativePath: ".longclaw/tickets/LC-99/ticket.md",
            byteLength: 12,
            readOnly: false,
            diagnostic: { code: "parse_failed", message: "no frontmatter" },
          },
        ],
      },
      { id: "done", title: "Done", status: "done", tickets: [] },
    ];
    const seat = seatsFor(degraded).get("LC-99")!;

    expect(moveForDrop(degraded, seat, 1, 0, "priority")).toBeUndefined();
    expect(takesDrop(degraded, seat, 1, "priority")).toBe(false);
  });
});
