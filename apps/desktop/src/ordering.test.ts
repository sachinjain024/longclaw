import { describe, expect, it } from "vitest";
import {
  byPriority,
  byRank,
  comparatorFor,
  orderColumn,
  rankForDrop,
} from "./ordering";
import type { TicketPriority, TicketRow } from "./types";

function row(key: string, priority: TicketPriority, rank?: string): TicketRow {
  return {
    state: "indexed",
    key,
    id: key.toLowerCase(),
    title: key,
    status: "todo",
    priority,
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

describe("manual ordering (ADR 0003)", () => {
  it("puts ranked tickets in rank order, ignoring priority", () => {
    const column = [
      row("LC-1", "urgent", "a2"),
      row("LC-2", "p4", "a0"),
      row("LC-3", "p2", "a1"),
    ];

    expect(keys(orderColumn(column, byRank))).toEqual(["LC-2", "LC-3", "LC-1"]);
  });

  it("leaves a column that has never been reordered exactly as Priority had it", () => {
    // Switching mode is a view preference and writes nothing (ADR 0003), so a
    // project that has never dragged anything must not see its board move.
    const column = [
      row("LC-1", "p3"),
      row("LC-2", "none"),
      row("LC-3", "urgent"),
      degraded("LC-98"),
      row("LC-4", "p1"),
    ];

    expect(keys(orderColumn(column, byRank))).toEqual(
      keys(orderColumn(column, byPriority)),
    );
  });

  it("sits a ranked ticket above every ticket with no rank", () => {
    // The mixed case. A rank is a position someone chose; no rank is a position
    // nobody chose, so the chosen ones come first and the rest keep the
    // priority order they already had.
    const column = [
      row("LC-1", "urgent"),
      row("LC-2", "p4", "a1"),
      row("LC-3", "p1"),
      row("LC-4", "none", "a0"),
    ];

    expect(keys(orderColumn(column, byRank))).toEqual([
      "LC-4",
      "LC-2",
      "LC-1",
      "LC-3",
    ]);
  });

  it("orders by a rank it did not write rather than ignoring it", () => {
    // A LexoRank string an agent left behind is not something this build can
    // split, but it is still a position, and dropping it would move a card
    // nobody touched.
    const column = [row("LC-1", "p1", "a0"), row("LC-2", "p1", "0|hzzzzz:")];

    expect(keys(orderColumn(column, byRank))).toEqual(["LC-2", "LC-1"]);
  });

  it("keeps two tickets sharing a rank in the order they arrived", () => {
    const column = [
      row("LC-7", "p4", "a0"),
      row("LC-8", "urgent", "a0"),
      row("LC-9", "p1", "a0"),
    ];

    expect(keys(orderColumn(column, byRank))).toEqual(["LC-7", "LC-8", "LC-9"]);
  });

  it("names the comparator each mode uses", () => {
    expect(comparatorFor("priority")).toBe(byPriority);
    expect(comparatorFor("manual")).toBe(byRank);
  });
});

describe("the rank a drop allocates", () => {
  /** A column already in Manual order, which is what a drop is computed over. */
  const column = [
    row("LC-1", "p1", "a0"),
    row("LC-2", "p1", "a1"),
    row("LC-3", "p1", "a2"),
  ];

  it("writes nothing for a drop that does not move the card", () => {
    expect(rankForDrop(column, "LC-2", 1)).toBeUndefined();
    expect(rankForDrop(column, "LC-2", 2)).toBeUndefined();
  });

  it("lands between the neighbours the drop is between", () => {
    const next = rankForDrop(column, "LC-3", 1);

    expect(next).toBeDefined();
    expect(next! > "a0" && next! < "a1").toBe(true);
  });

  it("takes the head and the tail of the column", () => {
    expect(rankForDrop(column, "LC-3", 0)! < "a0").toBe(true);
    expect(rankForDrop(column, "LC-1", 3)! > "a2").toBe(true);
  });

  it("gives the first drag in an unranked column the first rank", () => {
    const unranked = [row("LC-1", "p1"), row("LC-2", "p2"), row("LC-3", "p3")];

    expect(rankForDrop(unranked, "LC-3", 1)).toBe("a0");
    // And letting go of it where it already sits still writes nothing, even
    // though it has no rank yet to compare the allocated one against.
    expect(rankForDrop(unranked, "LC-3", 3)).toBeUndefined();
  });

  it("skips past a neighbour with no rank to find one that has it", () => {
    // An unranked card is not a position, so it cannot bound one.
    const mixed = [
      row("LC-1", "p1", "a0"),
      row("LC-2", "p1", "a1"),
      row("LC-3", "p1"),
      row("LC-4", "p2"),
    ];
    const next = rankForDrop(mixed, "LC-4", 1);

    expect(next! > "a0" && next! < "a1").toBe(true);
  });

  it("writes nothing when no rank on this card alone could express the drop", () => {
    // Dragging the only ranked card below cards that have no rank. There is a
    // position the human asked for and no single-file write that reaches it, so
    // the honest answer is to write nothing rather than to write a rank the
    // column would not move for.
    const mixed = [
      row("LC-1", "p1", "a0"),
      row("LC-2", "p1"),
      row("LC-3", "p2"),
    ];

    expect(rankForDrop(mixed, "LC-1", 3)).toBeUndefined();
  });
});
