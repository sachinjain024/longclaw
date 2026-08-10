import { describe, expect, it } from "vitest";
import {
  dropEdge,
  gapUnder,
  heldOrder,
  landingFor,
  moveOf,
  reordered,
} from "./checklistOrder";
import type { ChecklistMove } from "./types";

const IDS = ["ck_a", "ck_b", "ck_c"];

describe("where a dragged row lands", () => {
  it("reads a gap below the row it came from as one place up", () => {
    // [a b c], a dragged over c's lower half: gap 3, and a lands last.
    expect(landingFor(0, 3)).toBe(2);
  });

  it("reads a gap above the row it came from as that gap", () => {
    expect(landingFor(2, 0)).toBe(0);
    expect(landingFor(2, 1)).toBe(1);
  });

  it("reads the two gaps touching the row as no move at all", () => {
    expect(landingFor(1, 1)).toBe(1);
    expect(landingFor(1, 2)).toBe(1);
  });
});

describe("which gap the pointer is in", () => {
  /** A row 20px tall at the top of the page, and the pointer over it. */
  function overRow(clientY: number, index: number) {
    const row = {
      getBoundingClientRect: () => ({ top: 0, height: 20 }) as DOMRect,
    };
    const target = { closest: () => row } as unknown as EventTarget;
    return gapUnder({ target, clientY }, () => index);
  }

  it("reads the upper half as the gap above the row", () => {
    expect(overRow(5, 2)).toBe(2);
  });

  it("reads the lower half as the gap below it", () => {
    expect(overRow(15, 2)).toBe(3);
  });

  it("is nowhere when the pointer is not over a row at all", () => {
    expect(gapUnder({ target: null, clientY: 5 }, () => -1)).toBeUndefined();
  });
});

describe("which edge carries the insertion line", () => {
  it("puts it above the row the gap is numbered by", () => {
    expect(dropEdge(0, 3, 0)).toBe("drop-above");
    expect(dropEdge(1, 3, 1)).toBe("drop-above");
  });

  it("gives the last row the list's bottom edge, having no row below it", () => {
    expect(dropEdge(2, 3, 3)).toBe("drop-below");
    expect(dropEdge(1, 3, 3)).toBeUndefined();
  });

  it("draws nothing while nothing is being dragged", () => {
    expect(dropEdge(0, 3, undefined)).toBeUndefined();
  });
});

describe("the list a landing produces", () => {
  it("takes the item out and puts it back", () => {
    expect(reordered(IDS, 0, 2)).toEqual(["ck_b", "ck_c", "ck_a"]);
    expect(reordered(IDS, 2, 0)).toEqual(["ck_c", "ck_a", "ck_b"]);
    expect(reordered(IDS, 1, 0)).toEqual(["ck_b", "ck_a", "ck_c"]);
  });

  it("leaves a list alone when the item does not move", () => {
    expect(reordered(IDS, 1, 1)).toEqual(IDS);
  });
});

describe("what a landing writes", () => {
  it("names the item the moved one now follows", () => {
    expect(moveOf(IDS, 0, 2)?.move).toEqual({
      itemId: "ck_a",
      after: "ck_c",
    });
  });

  it("names the top as no item at all, because none is above it", () => {
    expect(moveOf(IDS, 2, 0)?.move).toEqual({ itemId: "ck_c", after: null });
  });

  it("moves up by one place onto the row above the row above", () => {
    // b between a and c, moved up: it now follows nothing.
    expect(moveOf(IDS, 1, 0)?.move).toEqual({ itemId: "ck_b", after: null });
    // c moved up one place follows a, not b — b is where it came from.
    expect(moveOf(IDS, 2, 1)?.move).toEqual({ itemId: "ck_c", after: "ck_a" });
  });

  it("takes itself back to the row it was under", () => {
    expect(moveOf(IDS, 2, 0)?.inverse).toEqual({
      itemId: "ck_c",
      after: "ck_b",
    });
    expect(moveOf(IDS, 0, 2)?.inverse).toEqual({ itemId: "ck_a", after: null });
  });

  it("is nothing when the item lands where it already was", () => {
    expect(moveOf(IDS, 1, 1)).toBeUndefined();
  });

  it.each([
    [0, 2],
    [2, 0],
    [1, 2],
    [2, 1],
  ])("undoes itself: %i to %i and back", (from, to) => {
    const move = moveOf(IDS, from, to);
    expect(move).toBeDefined();
    const moved = applied(IDS, move!.move);
    expect(moved).toEqual(reordered(IDS, from, to));
    expect(applied(moved, move!.inverse)).toEqual(IDS);
  });
});

describe("the order held while the write is out", () => {
  const items = [
    { id: "ck_a", text: "a", checked: false },
    { id: "ck_b", text: "b", checked: false },
  ];

  it("shows the human's order over the file's", () => {
    expect(heldOrder(items, ["ck_b", "ck_a"]).map((item) => item.id)).toEqual([
      "ck_b",
      "ck_a",
    ]);
  });

  it("holds nothing when there is nothing held", () => {
    expect(heldOrder(items, undefined)).toBe(items);
  });

  it("gives way to a file that no longer holds the same items", () => {
    // An agent appended one, or removed one, while the move was in flight: the
    // held order is about a list that is gone.
    expect(heldOrder(items, ["ck_b", "ck_a", "ck_c"])).toBe(items);
    expect(heldOrder(items, ["ck_b", "ck_gone"])).toBe(items);
  });
});

/**
 * A move as Rust reads it, so the anchors this module picks are asserted in the
 * terms the file will settle them in rather than in the indices they came from
 * (`core/ticket.rs`, `landing`).
 */
function applied(ids: string[], move: ChecklistMove): string[] {
  const from = ids.indexOf(move.itemId);
  const anchor = move.after === null ? -1 : ids.indexOf(move.after);
  return reordered(ids, from, anchor > from ? anchor : anchor + 1);
}
