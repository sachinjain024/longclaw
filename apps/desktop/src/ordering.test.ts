import { describe, expect, it } from "vitest";
import {
  byPriority,
  byRank,
  comparatorFor,
  orderColumn,
  rankForDrop,
  rankForInsert,
  type RankPlan,
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

/**
 * Applies a plan to a column and returns the order it produces, which is the
 * only thing a plan is for: a list of rank strings is not an assertion anybody
 * can read, and "the card is where it was let go" is.
 */
function afterPlan(
  column: TicketRow[],
  plan: RankPlan,
  movingKey: string,
): string[] {
  const given = new Map(plan.backfill.map((one) => [one.key, one.rank]));
  given.set(movingKey, plan.rank);
  const written = column.map((ticket) =>
    given.has(ticket.key) ? { ...ticket, rank: given.get(ticket.key) } : ticket,
  ) as TicketRow[];
  return keys(orderColumn(written, byRank));
}

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
    const plan = rankForDrop(column, "LC-3", 1);

    expect(plan).toBeDefined();
    expect(plan!.rank > "a0" && plan!.rank < "a1").toBe(true);
    // Both neighbours are positions already, so nobody else is written.
    expect(plan!.backfill).toEqual([]);
  });

  it("takes the head and the tail of the column", () => {
    expect(rankForDrop(column, "LC-3", 0)!.rank < "a0").toBe(true);
    expect(rankForDrop(column, "LC-1", 3)!.rank > "a2").toBe(true);
  });

  it("gives the cards above the drop a place, so the card lands at one (LC-174)", () => {
    // The ordinary case, not a corner: a column nobody has dragged in has no
    // ranks at all, so there is nothing for the drop to sit between. The cards
    // above the gap are given positions in the order they already have, and the
    // dragged card takes the one after them.
    const unranked = [row("LC-1", "p1"), row("LC-2", "p2"), row("LC-3", "p3")];
    const plan = rankForDrop(unranked, "LC-3", 1)!;

    expect(plan.backfill.map((one) => one.key)).toEqual(["LC-1"]);
    expect(plan.rank > plan.backfill[0].rank).toBe(true);
    expect(afterPlan(unranked, plan, "LC-3")).toEqual(["LC-1", "LC-3", "LC-2"]);
  });

  it("leaves the cards below the drop unranked", () => {
    // Half the point of ranking the cards above the gap rather than the whole
    // column: everything below it is already in the right order relative to the
    // drop, and a rank on it would be a file written for a card nobody moved.
    const unranked = [
      row("LC-1", "p1"),
      row("LC-2", "p2"),
      row("LC-3", "p3"),
      row("LC-4", "p4"),
    ];
    const plan = rankForDrop(unranked, "LC-1", 3)!;

    // LC-4 is below the gap and keeps no rank at all.
    expect(plan.backfill.map((one) => one.key)).toEqual(["LC-2", "LC-3"]);
    expect(afterPlan(unranked, plan, "LC-1")).toEqual([
      "LC-2",
      "LC-3",
      "LC-1",
      "LC-4",
    ]);
  });

  it("still writes nothing for a drop into the gap the card is already in", () => {
    const unranked = [row("LC-1", "p1"), row("LC-2", "p2"), row("LC-3", "p3")];

    expect(rankForDrop(unranked, "LC-3", 3)).toBeUndefined();
    expect(rankForDrop(unranked, "LC-3", 2)).toBeUndefined();
  });

  it("skips past a neighbour with no rank to find one that has it", () => {
    // An unranked card is not a position, so it cannot bound one.
    const mixed = [
      row("LC-1", "p1", "a0"),
      row("LC-2", "p1", "a1"),
      row("LC-3", "p1"),
      row("LC-4", "p2"),
    ];
    const plan = rankForDrop(mixed, "LC-4", 1)!;

    expect(plan.rank > "a0" && plan.rank < "a1").toBe(true);
    expect(plan.backfill).toEqual([]);
  });

  it("carries the only ranked card past cards that have none", () => {
    // Dragging the one ranked card to the bottom. The position exists, so it is
    // reached — before LC-174 this wrote nothing and the card stayed put, which
    // is what "dragging does nothing" looked like from the outside.
    const mixed = [
      row("LC-1", "p1", "a0"),
      row("LC-2", "p1"),
      row("LC-3", "p2"),
    ];
    const plan = rankForDrop(mixed, "LC-1", 3)!;

    expect(afterPlan(mixed, plan, "LC-1")).toEqual(["LC-2", "LC-3", "LC-1"]);
  });
});

describe("the rank a card arriving from another column takes", () => {
  /** The column being dropped into. The moving card is not one of these. */
  const column = [
    row("LC-1", "p1", "a0"),
    row("LC-2", "p1", "a1"),
    row("LC-3", "p1", "a2"),
  ];

  it("lands between the neighbours the drop is between", () => {
    const plan = rankForInsert(column, 1);

    expect(plan.rank > "a0" && plan.rank < "a1").toBe(true);
    expect(plan.backfill).toEqual([]);
  });

  it("takes the head and the tail of the column", () => {
    expect(rankForInsert(column, 0).rank < "a0").toBe(true);
    expect(rankForInsert(column, 3).rank > "a2").toBe(true);
  });

  it("gives the first card in an empty column the first rank", () => {
    expect(rankForInsert([], 0)).toEqual({ rank: "a0", backfill: [] });
  });

  it("skips past a neighbour with no rank to find one that has it", () => {
    // An unranked card is not a position, so it cannot bound one — the same
    // rule a reorder inside one column follows.
    const mixed = [
      row("LC-1", "p1", "a0"),
      row("LC-2", "p1", "a1"),
      row("LC-3", "p1"),
      row("LC-4", "p2"),
    ];

    expect(rankForInsert(mixed, 3).rank > "a1").toBe(true);
  });

  it("gives the cards above the gap a place when none of them has one", () => {
    // The arriving card's version of the same rule: a drop among cards with no
    // rank is a position, and the cards above it are what express it.
    const unranked = [row("LC-1", "p1"), row("LC-2", "p2")];
    const plan = rankForInsert(unranked, 1);

    expect(plan.backfill.map((one) => one.key)).toEqual(["LC-1"]);
    expect(plan.rank > plan.backfill[0].rank).toBe(true);
  });

  it("ranks every unranked card above the gap, in the order they already had", () => {
    const unranked = [
      row("LC-1", "p1"),
      row("LC-2", "p2"),
      row("LC-3", "p3"),
      row("LC-4", "p4"),
    ];
    const plan = rankForInsert(unranked, 3);

    expect(plan.backfill.map((one) => one.key)).toEqual([
      "LC-1",
      "LC-2",
      "LC-3",
    ]);
    const ranks = plan.backfill.map((one) => one.rank);
    expect([...ranks].sort()).toEqual(ranks);
    expect(plan.rank > ranks[2]).toBe(true);
  });

  it("writes nobody else when the drop is above every card", () => {
    const unranked = [row("LC-1", "p1"), row("LC-2", "p2")];

    expect(rankForInsert(unranked, 0).backfill).toEqual([]);
  });

  it("clamps a gap that is off the end of the column", () => {
    expect(rankForInsert(column, 99).rank > "a2").toBe(true);
    expect(rankForInsert(column, -1).rank < "a0").toBe(true);
  });
});
