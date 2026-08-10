/**
 * The list's composition, held to the stylesheet. Getting this wrong is how a
 * virtualized list jitters, and jitter is not something a jsdom render test can
 * see — the same reason `boardGeometry.test.ts` exists.
 */

import { describe, expect, it } from "vitest";
import { runningOffsets, windowFor } from "./boardGeometry";
import {
  GROUP_BODY_BORDER,
  GROUP_GAP,
  GROUP_HEADER_HEIGHT,
  ROW_HEIGHT,
  dropAt,
  groupBodyHeight,
  listGeometry,
  rowTop,
} from "./listGeometry";
import tokens from "./tokens/design-tokens.json";

const group = (rows: number) => ({ tickets: new Array(rows).fill(0) });

describe("the slots a list scroller stacks", () => {
  it("puts a header slot in front of each group's rows", () => {
    const { slots } = listGeometry([group(2), group(1)]);

    expect(slots).toEqual([
      { group: 0, row: -1 },
      { group: 0, row: 0 },
      { group: 0, row: 1 },
      { group: 1, row: -1 },
      { group: 1, row: 0 },
    ]);
  });

  it("gives a collapsed group its header and nothing else", () => {
    // The only group that is ever empty is Archived while it is shut
    // (`screen-specs.md:205-209`); every other group is drawn because it has
    // tickets in it.
    const { slots, offsets } = listGeometry([group(1), group(0)]);

    expect(slots).toEqual([
      { group: 0, row: -1 },
      { group: 0, row: 0 },
      { group: 1, row: -1 },
    ]);
    expect(offsets[offsets.length - 1]).toBe(
      GROUP_HEADER_HEIGHT +
        2 * GROUP_BODY_BORDER +
        ROW_HEIGHT +
        GROUP_GAP +
        GROUP_HEADER_HEIGHT +
        GROUP_GAP,
    );
  });
});

describe("where the list puts things", () => {
  it("offsets a row at exactly the top of that row", () => {
    const { offsets } = listGeometry([group(3)]);

    // Header, then the body's top hairline, then one row per stride.
    const bodyTop = GROUP_HEADER_HEIGHT + GROUP_BODY_BORDER;
    expect(offsets.slice(0, 4)).toEqual([
      0,
      bodyTop,
      bodyTop + ROW_HEIGHT,
      bodyTop + 2 * ROW_HEIGHT,
    ]);
  });

  it("reserves the same height the stylesheet gives a group", () => {
    // A group is its header, its body, and the air below it, and the body's two
    // hairlines are inside the height because everything is border-box.
    const { offsets } = listGeometry([group(4), group(2)]);
    const heightOf = (rows: number) =>
      GROUP_HEADER_HEIGHT + groupBodyHeight(rows) + GROUP_GAP;

    expect(offsets[offsets.length - 1]).toBe(heightOf(4) + heightOf(2));
    expect(groupBodyHeight(4)).toBe(4 * ROW_HEIGHT + 2 * GROUP_BODY_BORDER);
  });

  it("stacks rows inside their own group body", () => {
    expect(rowTop(0)).toBe(0);
    expect(rowTop(3)).toBe(3 * ROW_HEIGHT);
  });
});

describe("the window the list renders", () => {
  it("windows across groups through the board's own arithmetic", () => {
    const { slots, offsets } = listGeometry([group(100), group(100)]);
    const range = windowFor(offsets, 0, 300, 0);
    const drawn = slots.slice(range.start, range.end);

    // A 300px viewport over a 32px header and 36px rows: the header and the
    // rows it leaves room for, and nothing from the group below.
    expect(drawn[0]).toEqual({ group: 0, row: -1 });
    expect(drawn.every((slot) => slot.group === 0)).toBe(true);
    expect(drawn.length).toBeLessThan(12);
  });

  it("builds its offsets with the same function the board does", () => {
    // Not a second copy of the arithmetic: strides in, running tops out.
    expect(listGeometry([group(1)]).offsets).toEqual(
      runningOffsets([
        GROUP_HEADER_HEIGHT + GROUP_BODY_BORDER,
        ROW_HEIGHT + GROUP_BODY_BORDER + GROUP_GAP,
      ]),
    );
  });
});

describe("where a drop over the list would land (LC-60)", () => {
  // Two groups of two rows. Group 0: header 0-33, rows at 33 and 69, and the
  // gap after it ends at 118. Group 1 starts there.
  const geometry = listGeometry([group(2), group(2)]);

  it("puts a drop over a group's header at the top of that group", () => {
    // A header is the group's own top edge, not the tail of the one above it.
    expect(dropAt(geometry, 4)).toEqual({ group: 0, gap: 0 });
    expect(dropAt(geometry, 118 + 4)).toEqual({ group: 1, gap: 0 });
  });

  it("splits a row at its middle, like the board splits a card", () => {
    // The first row runs 33-69, so its middle is 51.
    expect(dropAt(geometry, 40)).toEqual({ group: 0, gap: 0 });
    expect(dropAt(geometry, 60)).toEqual({ group: 0, gap: 1 });
    expect(dropAt(geometry, 75)).toEqual({ group: 0, gap: 1 });
    expect(dropAt(geometry, 100)).toEqual({ group: 0, gap: 2 });
  });

  it("counts the air below a group as the end of it", () => {
    // The last row's stride carries the body's hairline and the 12px gap, so
    // the air between two groups belongs to the one above — which is where the
    // pointer looks like it is.
    expect(dropAt(geometry, 112)).toEqual({ group: 0, gap: 2 });
  });

  it("clamps a position off either end of the scroller", () => {
    expect(dropAt(geometry, -40)).toEqual({ group: 0, gap: 0 });
    expect(dropAt(geometry, 9_000)).toEqual({ group: 1, gap: 2 });
  });

  it("puts a drop on a collapsed group's header in that group", () => {
    // Archived, shut: a header slot and no rows at all (`screen-specs.md`).
    // Header 0-33, its one row 33-82, then the shut group's header from 82.
    const collapsed = listGeometry([group(1), group(0)]);

    expect(dropAt(collapsed, 100)).toEqual({ group: 1, gap: 0 });
    // And a hair above that is still the row above it, not the shut group.
    expect(dropAt(collapsed, 80)).toEqual({ group: 0, gap: 1 });
  });

  it("answers nothing for a list with no groups at all", () => {
    expect(dropAt(listGeometry([]), 10)).toBeUndefined();
  });
});

describe("the heights the stylesheet pins", () => {
  // Stated as numbers rather than as the constants, deliberately: every other
  // assertion here is written in terms of those constants and would follow a
  // wrong one anywhere it went. These are the numbers the CSS lays out —
  // a 32px header, the body's hairline, 36px rows, 12px of air — and if this
  // fails, either the stylesheet or this module has moved without the other.
  it("places two rows exactly where the stylesheet does", () => {
    expect(listGeometry([group(2)]).offsets).toEqual([0, 33, 69, 118]);
    expect(groupBodyHeight(2)).toBe(74);
  });

  // The offsets are only exact while these agree with the stylesheet, and a
  // token edit that moved a row without this module hearing about it would make
  // the list place its rows a little further wrong the further down you scroll.
  it("agrees with the tokens the list is laid out from", () => {
    expect(tokens.size.row).toBe(ROW_HEIGHT);
    expect(tokens.space["7"]).toBe(GROUP_HEADER_HEIGHT);
  });
});
