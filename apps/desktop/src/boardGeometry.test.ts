/**
 * The arithmetic a windowed column stands on. It is pure on purpose: getting the
 * geometry wrong is how a virtualized list jitters, and jitter is not something
 * a jsdom render test can see.
 */

import { describe, expect, it } from "vitest";
import {
  CARD_GAP,
  CARD_HEIGHT,
  CARD_STRIDE,
  ACKNOWLEDGED_CARD_HEIGHT,
  ACKNOWLEDGED_CARD_STRIDE,
  cardStrides,
  gapAt,
  runningOffsets,
  windowFor,
} from "./boardGeometry";
import type { ExternalMarks } from "./acknowledgement";
import { ACKNOWLEDGEMENT_WINDOW_MS } from "./acknowledgement";
import tokens from "./tokens/design-tokens.json";
import type { TicketRow } from "./types";

const NOW = 1_800_000_000_000;

function rows(count: number): TicketRow[] {
  return Array.from({ length: count }, (_, index) => ({
    state: "indexed",
    key: `LC-${index + 1}`,
    id: `id-${index}`,
    title: `Ticket ${index}`,
    status: "todo",
    priority: "none",
    labels: [],
    createdAt: "2026-07-30T11:00:00Z",
    updatedAt: "2026-07-30T11:00:00Z",
    checkedCount: 0,
    checklistCount: 0,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: `hash-${index}`,
    relativePath: `.longclaw/tickets/LC-${index + 1}/ticket.md`,
  }));
}

describe("a column's card strides", () => {
  it("gives every resting card the same stride", () => {
    expect(cardStrides(rows(3), {}, NOW)).toEqual([
      CARD_STRIDE,
      CARD_STRIDE,
      CARD_STRIDE,
    ]);
  });

  it("makes room for the acknowledgement footer on an acknowledged card", () => {
    const marks: ExternalMarks = {
      "LC-2": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - 1_000,
      },
    };

    expect(cardStrides(rows(3), marks, NOW)).toEqual([
      CARD_STRIDE,
      ACKNOWLEDGED_CARD_STRIDE,
      CARD_STRIDE,
    ]);
  });

  it("takes the room back when the acknowledgement has decayed", () => {
    const marks: ExternalMarks = {
      "LC-2": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - ACKNOWLEDGEMENT_WINDOW_MS,
      },
    };

    expect(cardStrides(rows(3), marks, NOW)).toEqual([
      CARD_STRIDE,
      CARD_STRIDE,
      CARD_STRIDE,
    ]);
  });
});

describe("running offsets over a scroller's slots", () => {
  it("runs one entry longer than the column, so the last entry is its height", () => {
    const offsets = runningOffsets([10, 20, 30]);

    expect(offsets).toEqual([0, 10, 30, 60]);
  });

  it("is a single zero for an empty column", () => {
    expect(runningOffsets([])).toEqual([0]);
  });
});

describe("the window a column renders", () => {
  const offsets = runningOffsets(Array.from({ length: 1_000 }, () => 60));

  it("covers the viewport plus the overscan on both sides", () => {
    // 300px of viewport is five cards; two more each side is the overscan.
    expect(windowFor(offsets, 600, 300, 2)).toEqual({ start: 8, end: 17 });
  });

  it("does not run off either end of the column", () => {
    expect(windowFor(offsets, 0, 300, 2)).toEqual({ start: 0, end: 7 });
    expect(windowFor(offsets, 59_800, 300, 2)).toEqual({
      start: 994,
      end: 1_000,
    });
  });

  it("renders the whole column when it is shorter than the viewport", () => {
    expect(windowFor(runningOffsets([60, 60]), 0, 900, 4)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("renders nothing for an empty column", () => {
    expect(windowFor(runningOffsets([]), 0, 900, 4)).toEqual({
      start: 0,
      end: 0,
    });
  });

  it("keeps the card that straddles the top of the viewport", () => {
    // Scrolled one pixel into card 10; card 10 is still partly on screen.
    expect(windowFor(offsets, 601, 300, 0).start).toBe(10);
    expect(windowFor(offsets, 600, 300, 0).start).toBe(10);
    expect(windowFor(offsets, 599, 300, 0).start).toBe(9);
  });

  it("survives a viewport it has not measured yet", () => {
    // Height 0 would otherwise window down to nothing on the first paint.
    expect(windowFor(offsets, 0, 0, 0).end).toBeGreaterThan(0);
  });
});

describe("the card heights the stylesheet pins", () => {
  it("keeps the stride a card plus the gap below it", () => {
    expect(CARD_STRIDE).toBe(CARD_HEIGHT + CARD_GAP);
    expect(ACKNOWLEDGED_CARD_STRIDE).toBe(ACKNOWLEDGED_CARD_HEIGHT + CARD_GAP);
  });

  // The offsets are only exact while these agree with the stylesheet. A token
  // edit that changed a card's height without this module hearing about it would
  // make every column place its cards a little further wrong the further down
  // scroll. `npm run tokens:check` holds the generated CSS to this same JSON.
  it("agrees with the tokens the board is laid out from", () => {
    expect(tokens.size["board-card"]).toBe(CARD_HEIGHT);
    expect(tokens.size["board-card-acknowledged"]).toBe(
      ACKNOWLEDGED_CARD_HEIGHT,
    );
  });

  // Not a restatement of the number: the point of LC-165 is that the number is
  // a *sum*, and the reserve went stale because one of the terms changed and the
  // total did not — 360px was still paying for the two-row header LC-67 had
  // collapsed. Written as the addition, the same edit fails here rather than
  // shipping columns that end short of the window.
  it("reserves the chrome above and below the region, and nothing else", () => {
    // The header band owns the top edge (LC-223): no main-panel inset above.
    const mainPanelInset = 0 + 24; // `.main-panel` padding-block
    const contentHeader = 62 + 1; // the prototype's band and its hairline
    const boardGridPadding = tokens.space["2"] + tokens.space["5"];
    const reserve = mainPanelInset + contentHeader + boardGridPadding;
    expect(tokens.size["board-stack"]).toBe(`calc(100vh - ${reserve}px)`);
  });

  // The other half of that sum — the rows the stylesheet actually draws, and
  // whether they still add up to the token above — is `card-height-guard.mjs`,
  // not a case here. It cannot be one: this suite loads no stylesheet, and
  // after LC-166 the term most likely to move is the title's line count.
});

describe("the gap a drop falls in", () => {
  const offsets = runningOffsets(Array(5).fill(CARD_STRIDE));

  it("answers with a gap index, not a card index", () => {
    // Five cards have six gaps, and the drop has to be able to name the last.
    expect(gapAt(offsets, 0)).toBe(0);
    expect(gapAt(offsets, 5 * CARD_STRIDE)).toBe(5);
  });

  it("takes the card's midpoint as the line between two gaps", () => {
    expect(gapAt(offsets, CARD_STRIDE + 1)).toBe(1);
    expect(gapAt(offsets, CARD_STRIDE * 1.6)).toBe(2);
  });

  it("answers for a position no card is rendered at", () => {
    // The whole point: a column renders a window, and a drop far below it still
    // has to name a real gap (`Board.tsx` § dragging over a windowed column).
    const tall = runningOffsets(Array(4_000).fill(CARD_STRIDE));

    expect(gapAt(tall, 3_500 * CARD_STRIDE + 4)).toBe(3_500);
  });

  it("clamps a position outside the column", () => {
    expect(gapAt(offsets, -400)).toBe(0);
    expect(gapAt(offsets, 99_999)).toBe(5);
    expect(gapAt(runningOffsets([]), 40)).toBe(0);
  });
});
