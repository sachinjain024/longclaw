import { describe, expect, it } from "vitest";
import { seatsFor, type StatusGroup } from "./grouping";
import { byRank, orderColumn } from "./ordering";
import { moveForDrop, takesDrop, type TicketDrop } from "./ticketMove";
import type { IndexedTicket, TicketRow, TicketStatus } from "./types";

function row(
  key: string,
  rank?: string,
  status: TicketStatus = "todo",
): TicketRow {
  return {
    state: "indexed",
    key,
    id: key.toLowerCase(),
    title: key,
    status,
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

/**
 * The column as it reads once the drop has been written and the query cleared:
 * the ranks the move allocates, applied to the whole group, sorted the way
 * Manual sorts it. What the human is left looking at is the assertion here — a
 * rank string is an implementation detail of it.
 */
function afterDrop(whole: TicketRow[], drop: TicketDrop): string[] {
  const ranks = new Map<string, string>(
    (drop.move.backfill ?? []).map((one) => [one.key, one.rank]),
  );
  if (drop.move.rank) ranks.set(drop.ticket.key, drop.move.rank);
  const written = whole.map((one) =>
    one.state === "indexed" && ranks.has(one.key)
      ? { ...one, rank: ranks.get(one.key) }
      : one,
  );
  return orderColumn(written, byRank).map((one) => one.key);
}

describe("a drop while a filter is on (LC-187)", () => {
  // Nothing here carries a rank, which is every column until somebody drags in
  // it (ADR 0003), and is what makes the hidden rows moveable by accident: an
  // unranked row sorts below every ranked one whether or not it was dropped on.
  const whole = [
    row("LC-1"),
    row("LC-2"),
    row("LC-3"),
    row("LC-4"),
    row("LC-5"),
  ];
  /** The query matched the first, the third and the fifth. */
  const drawn: StatusGroup[] = [
    {
      id: "todo",
      title: "Todo",
      status: "todo",
      tickets: [whole[0], whole[2], whole[4]],
    },
    { id: "done", title: "Done", status: "done", tickets: [] },
  ];
  const seats = seatsFor(drawn);
  /** Let go in the gap between the two matches below it: LC-3 and LC-5. */
  const spot = { group: 0, gap: 2 };

  it("puts the card in the gap the human let go in, and not above the rows they could not see", () => {
    const drop = moveForDrop(drawn, seats.get("LC-1"), spot, "manual", whole)!;

    expect(afterDrop(whole, drop)).toEqual([
      "LC-2",
      "LC-3",
      "LC-1",
      "LC-4",
      "LC-5",
    ]);
  });

  it("gives a hidden row above the gap the position that keeps it where it was", () => {
    const drop = moveForDrop(drawn, seats.get("LC-1"), spot, "manual", whole)!;

    // LC-2 matched nothing and was never on screen. It is written anyway: it
    // sits above the gap, and a row with no rank sorts below every row with
    // one, so leaving it alone is what moved it (`ordering.ts`, LC-174).
    expect(drop.move.backfill!.map((one) => one.key)).toEqual(["LC-2", "LC-3"]);
  });

  it("goes above what the query left, not above the rows over it, at the top of a group", () => {
    const column = [row("LC-6"), row("LC-7"), row("LC-8"), row("LC-9")];
    // LC-6 and LC-8 are hidden; the human sees LC-7 above LC-9 and drops LC-9
    // over the top of the group — which is the top of what they can see.
    const filtered: StatusGroup[] = [
      {
        id: "todo",
        title: "Todo",
        status: "todo",
        tickets: [column[1], column[3]],
      },
    ];
    const drop = moveForDrop(
      filtered,
      seatsFor(filtered).get("LC-9"),
      { group: 0, gap: 0 },
      "manual",
      column,
    )!;

    expect(afterDrop(column, drop)).toEqual(["LC-6", "LC-9", "LC-7", "LC-8"]);
  });

  it("decides an arriving ticket's place over the whole group too", () => {
    // Statuses are honest here, because the group behind the drawn one is
    // bucketed from these rows rather than taken on the surface's word.
    const project = [
      row("LC-1"),
      row("LC-2", undefined, "done"),
      row("LC-3", undefined, "done"),
      row("LC-4", undefined, "done"),
    ];
    const filtered: StatusGroup[] = [
      { id: "todo", title: "Todo", status: "todo", tickets: [project[0]] },
      {
        id: "done",
        title: "Done",
        status: "done",
        // LC-3 matched nothing, so Done draws two rows and holds three.
        tickets: [project[1], project[3]],
      },
    ];
    const drop = moveForDrop(
      filtered,
      seatsFor(filtered).get("LC-1"),
      { group: 1, gap: 2 },
      "manual",
      project,
    )!;

    expect(drop.move.status).toBe("done");
    // Done, once the card has arrived in it: the group it came from has no say
    // in the order, only in which rows were on screen to be dropped between.
    expect(afterDrop([...project.slice(1), project[0]], drop)).toEqual([
      "LC-2",
      "LC-3",
      "LC-4",
      "LC-1",
    ]);
  });

  it("takes the drawn group for the whole one when it is not told otherwise", () => {
    // Which is what every caller but the two surfaces means, and what both of
    // them meant until this ticket: the same drop, decided over the matches
    // alone, ranks LC-3 and LC-1 and nothing else — so both sort above LC-2,
    // a row nobody dragged and nobody could see.
    const drop = moveForDrop(drawn, seats.get("LC-1"), spot, "manual")!;

    expect(afterDrop(whole, drop)).toEqual([
      "LC-3",
      "LC-1",
      "LC-2",
      "LC-4",
      "LC-5",
    ]);
  });
});
