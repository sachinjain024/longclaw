import { describe, expect, it } from "vitest";
import { seatsFor, type StatusGroup } from "./grouping";
import { moveForDrop, takesDrop } from "./ticketMove";
import type { IndexedTicket, TicketRow } from "./types";

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
  it("writes the status of the group it landed in, for the ticket it moved", () => {
    const drop = moveForDrop(groups, from, { group: 1, gap: 0 }, "priority");

    expect(drop?.ticket.key).toBe("LC-1");
    expect(drop?.move).toStrictEqual({ status: "in_progress" });
  });

  it("writes the status and the place in it, in Manual", () => {
    const drop = moveForDrop(groups, from, { group: 1, gap: 1 }, "manual");

    expect(drop?.move.status).toBe("in_progress");
    expect(drop!.move.rank! > "a5" && drop!.move.rank! < "a6").toBe(true);
  });

  it("writes only a rank back inside its own group", () => {
    const drop = moveForDrop(groups, from, { group: 0, gap: 2 }, "manual");

    expect(drop?.move.status).toBeUndefined();
    expect(drop!.move.rank! > "a1").toBe(true);
    // Both groups here are fully ranked, so the drop is one ticket's business.
    expect(drop!.move.backfill).toBeUndefined();
  });

  it("carries the places it had to give the tickets above it (LC-174)", () => {
    // A group nobody has dragged in, which is every group until somebody does.
    // The drop is a position, so the rows above it are given positions too —
    // one gesture, and one Undo, however many rows that is.
    const fresh: StatusGroup[] = [
      {
        id: "todo",
        title: "Todo",
        status: "todo",
        tickets: [row("LC-1"), row("LC-2"), row("LC-3"), row("LC-4")],
      },
      { id: "done", title: "Done", status: "done", tickets: [] },
    ];
    const seat = seatsFor(fresh).get("LC-1")!;
    const drop = moveForDrop(fresh, seat, { group: 0, gap: 3 }, "manual");

    expect(drop!.move.backfill!.map((one) => one.key)).toEqual([
      "LC-2",
      "LC-3",
    ]);
    // Above them, and below nothing: LC-4 is under the drop and keeps none.
    expect(drop!.move.rank! > drop!.move.backfill![1].rank).toBe(true);
  });

  it("carries them for a ticket arriving from another group too", () => {
    const fresh: StatusGroup[] = [
      { id: "todo", title: "Todo", status: "todo", tickets: [row("LC-1")] },
      {
        id: "done",
        title: "Done",
        status: "done",
        tickets: [row("LC-5"), row("LC-6")],
      },
    ];
    const seat = seatsFor(fresh).get("LC-1")!;
    const drop = moveForDrop(fresh, seat, { group: 1, gap: 2 }, "manual");

    expect(drop!.move.status).toBe("done");
    expect(drop!.move.backfill!.map((one) => one.key)).toEqual([
      "LC-5",
      "LC-6",
    ]);
  });

  it("gives a ticket arriving in Priority no rank and nobody else one", () => {
    // The order inside the group it arrives in is the priority order, which is
    // not a thing the human chose by dropping there — so there is no position
    // to express and nothing above it to express one against.
    const fresh: StatusGroup[] = [
      { id: "todo", title: "Todo", status: "todo", tickets: [row("LC-1")] },
      {
        id: "done",
        title: "Done",
        status: "done",
        tickets: [row("LC-5"), row("LC-6")],
      },
    ];
    const seat = seatsFor(fresh).get("LC-1")!;

    expect(
      moveForDrop(fresh, seat, { group: 1, gap: 2 }, "priority")?.move,
    ).toStrictEqual({ status: "done" });
  });

  it("writes nothing for a drop that would not move the card", () => {
    expect(
      moveForDrop(groups, from, { group: 0, gap: 0 }, "manual"),
    ).toBeUndefined();
    expect(
      moveForDrop(groups, from, { group: 0, gap: 1 }, "manual"),
    ).toBeUndefined();
    // And nothing at all inside its own group in Priority, where a place is
    // not a thing this board can write (ADR 0003).
    expect(
      moveForDrop(groups, from, { group: 0, gap: 2 }, "priority"),
    ).toBeUndefined();
  });

  it("writes nothing into a group no status names", () => {
    expect(
      moveForDrop(groups, from, { group: 2, gap: 0 }, "manual"),
    ).toBeUndefined();
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

    expect(
      moveForDrop(degraded, seat, { group: 1, gap: 0 }, "priority"),
    ).toBeUndefined();
    expect(takesDrop(degraded, seat, 1, "priority")).toBe(false);
  });

  it("writes nothing for an archived ticket, whichever surface asks", () => {
    // Archiving is a date and not a status (ADR 0004), so a move would put an
    // archived ticket in a group the board would still not draw it in. The
    // rule is here rather than in the list, which is the only surface drawing
    // an archive today — the next one gets it for nothing.
    const archived: StatusGroup[] = [
      {
        id: "todo",
        title: "Todo",
        status: "todo",
        tickets: [
          {
            ...(row("LC-8") as IndexedTicket),
            archivedAt: "2026-07-30T09:00:00Z",
          },
        ],
      },
      { id: "done", title: "Done", status: "done", tickets: [] },
    ];
    const seat = seatsFor(archived).get("LC-8")!;

    expect(takesDrop(archived, seat, 1, "priority")).toBe(false);
    expect(
      moveForDrop(archived, seat, { group: 1, gap: 0 }, "priority"),
    ).toBeUndefined();
  });
});
