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
  FRESH_CARD_HEIGHT,
  FRESH_CARD_STRIDE,
  cardStrides,
  runningOffsets,
  windowFor,
} from "./boardGeometry";
import type { ExternalMarks } from "./freshness";
import { FRESH_WINDOW_MS } from "./freshness";
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

  it("makes room for the acknowledgement footer on a fresh card", () => {
    const marks: ExternalMarks = {
      "LC-2": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - 1_000,
      },
    };

    expect(cardStrides(rows(3), marks, NOW)).toEqual([
      CARD_STRIDE,
      FRESH_CARD_STRIDE,
      CARD_STRIDE,
    ]);
  });

  it("takes the room back when the acknowledgement has decayed", () => {
    const marks: ExternalMarks = {
      "LC-2": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - FRESH_WINDOW_MS,
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
    expect(FRESH_CARD_STRIDE).toBe(FRESH_CARD_HEIGHT + CARD_GAP);
  });

  // The offsets are only exact while these agree with the stylesheet. A token
  // edit that changed a card's height without this module hearing about it would
  // make every column place its cards a little further wrong the further down
  // scroll. `npm run tokens:check` holds the generated CSS to this same JSON.
  it("agrees with the tokens the board is laid out from", () => {
    expect(tokens.size["board-card"]).toBe(CARD_HEIGHT);
    expect(tokens.size["board-card-fresh"]).toBe(FRESH_CARD_HEIGHT);
  });
});
