import { describe, expect, it } from "vitest";
import { sectionMoveOf } from "./projectOrder";

/** `*` marks a starred row: the same row, drawn twice (LC-260j). */
const LOCAL = ["a", "b", "c", "d"];

describe("a row let go inside Local", () => {
  it("lands in the gap it was let go in", () => {
    expect(sectionMoveOf(LOCAL, LOCAL, "a", 2)).toEqual({
      move: { order: ["b", "c", "a", "d"], after: "c", position: 3 },
      inverse: { order: LOCAL, after: null, position: 1 },
    });
  });

  it("names no neighbour at the top, because there is none", () => {
    expect(sectionMoveOf(LOCAL, LOCAL, "d", 0)).toEqual({
      move: { order: ["d", "a", "b", "c"], after: null, position: 1 },
      inverse: { order: LOCAL, after: "c", position: 4 },
    });
  });

  it("is no move at all when the row is let go where it already was", () => {
    expect(sectionMoveOf(LOCAL, LOCAL, "b", 1)).toBeUndefined();
  });

  it("refuses a landing the list does not have", () => {
    expect(sectionMoveOf(LOCAL, LOCAL, "b", -1)).toBeUndefined();
    expect(sectionMoveOf(LOCAL, LOCAL, "b", 4)).toBeUndefined();
    expect(sectionMoveOf(LOCAL, LOCAL, "elsewhere", 1)).toBeUndefined();
  });
});

/**
 * Starred draws some of the same rows, so a drop in it is a statement about
 * *those* rows and the place in Local is what keeps it true.
 */
describe("a row let go inside Starred", () => {
  // a*, b, c*, d — the starred rows are the first and the third.
  const STARRED = ["a", "c"];

  it("lands under the starred row it was dropped under, in Local too", () => {
    expect(sectionMoveOf(LOCAL, STARRED, "a", 1)).toEqual({
      move: { order: ["b", "c", "a", "d"], after: "c", position: 3 },
      inverse: { order: LOCAL, after: null, position: 1 },
    });
  });

  it("lands above the first starred row rather than above the whole list", () => {
    // `c` to the top of Starred is above `a`, and `a` is not Local's first row
    // here: the unstarred rows before it are not rows this drop crossed.
    expect(sectionMoveOf(["z", "a", "b", "c"], STARRED, "c", 0)).toEqual({
      move: { order: ["z", "c", "a", "b"], after: null, position: 2 },
      inverse: { order: ["z", "a", "b", "c"], after: "b", position: 4 },
    });
  });

  /**
   * The gaps touching the row are its own place, and in a section drawing some
   * of the list they are the case to get right: `c` let go under `a` is where
   * `c` already reads, but honouring it as "immediately after `a`" would lift
   * `c` over `b` and renumber both — a write nothing on screen asked for.
   */
  it("is no move when the starred row is let go where it already stood", () => {
    expect(sectionMoveOf(LOCAL, STARRED, "c", 1)).toBeUndefined();
    expect(sectionMoveOf(LOCAL, STARRED, "a", 0)).toBeUndefined();
  });

  it("has nothing to say about a section holding one row", () => {
    expect(sectionMoveOf(LOCAL, ["c"], "c", 0)).toBeUndefined();
  });
});
