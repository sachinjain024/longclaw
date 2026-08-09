/**
 * Where the things in one scroller sit, so it can render only the ones on screen.
 *
 * `runningOffsets`, `indexAt` and `windowFor` know nothing about cards: hand them
 * strides and they answer which slots a viewport touches. A board column's slots
 * are its cards; the issue list's are its group headers and its rows
 * (`listGeometry.ts`). Both surfaces window through this one piece of arithmetic
 * deliberately — a second copy would drift, and the drift shows up as jitter
 * rather than as a failing test.
 *
 * The card constants below are the board's own, because only the board has cards.
 *
 * A 5,000-ticket board scrolls at roughly 71 ms a frame in WebKit and at roughly
 * 21 ms when only the visible cards exist — the whole cost is the nodes, not the
 * React work (`perf/README.md`). So the column has to know its own geometry, and
 * that geometry has to be exact: a column that guesses a card's height jitters as
 * it scrolls.
 *
 * It can be exact because the stylesheet pins both card heights. A card is one
 * line of key, *two* of title, one of meta; a card wearing an unreviewed
 * acknowledgement adds the actor footer, which the board spec already requires
 * never to wrap (`screen-specs.md` § Board). There is no third height.
 *
 * The title's two lines are the prototype's (LC-166), and they are pinned rather
 * than counted: the stylesheet clamps the title at two lines and reserves the
 * room for both whether or not the second one is used. That is the whole trade.
 * A card sized to its own title would be the natural way to spend those two
 * lines and it is the one thing this module cannot have — a height that depends
 * on content is a height a column would have to measure, and measuring is what
 * costs 71 ms. So a one-line title pays ~18px of whitespace, and the offsets
 * stay arithmetic.
 */

import { isAcknowledged } from "./acknowledgement";
import type { ExternalMarks } from "./acknowledgement";
import type { TicketRow } from "./types";

/**
 * `--lc-size-board-card`, the height `.ticket-row` is pinned to. Exactly what
 * the card's three rows measure — top 16 + 6, title 2 × 18 + 8, foot 20, plus
 * 10px padding and a 1px border each side — so pinning it moves nothing.
 *
 * That sentence is a claim about a stylesheet this module never reads, so
 * `scripts/card-height-guard.mjs` adds the rows up and fails the build when the
 * total stops being this number. Nothing else can: the tokens agree with these
 * constants whatever they hold, and jsdom lays nothing out.
 */
export const CARD_HEIGHT = 108;
/**
 * `--lc-size-board-card-acknowledged`: the same card with the acknowledgement footer
 * under it. The footer adds its 7px margin, 1px rule, 6px padding and one
 * 14px mono line, pinned so the column can place the cards below it without
 * measuring anything.
 */
export const ACKNOWLEDGED_CARD_HEIGHT = 136;
/** `.ticket-row`'s margin-bottom: the gap between cards in a stack. */
export const CARD_GAP = 8;

/** How far the next card's top sits below this one's. */
export const CARD_STRIDE = CARD_HEIGHT + CARD_GAP;
export const ACKNOWLEDGED_CARD_STRIDE = ACKNOWLEDGED_CARD_HEIGHT + CARD_GAP;

/**
 * The height a column must reserve before it has measured itself. Deliberately a
 * tall viewport rather than zero: a column that windows down to nothing on the
 * first paint would show an empty board for a frame.
 */
export const ASSUMED_VIEWPORT = 720;

export function cardStrides(
  tickets: TicketRow[],
  marks: ExternalMarks,
  now: number,
): number[] {
  return tickets.map((ticket) =>
    isAcknowledged(marks[ticket.key], now)
      ? ACKNOWLEDGED_CARD_STRIDE
      : CARD_STRIDE,
  );
}

/**
 * Running tops, one entry longer than the strides it was given. The last entry is
 * the whole run's height, which is what a scroll container is sized to.
 */
export function runningOffsets(strides: number[]): number[] {
  const offsets = [0];
  for (const stride of strides)
    offsets.push(offsets[offsets.length - 1] + stride);
  return offsets;
}

/** The first slot at or before `position`, by binary search over the offsets. */
export function indexAt(offsets: number[], position: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= position) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * Which gap between slots a position falls in: 0 above the first, `count` below
 * the last, and the slot's own midpoint as the line between its two gaps.
 *
 * This is what makes dragging over a windowed column work at all. A drop cannot
 * be read off the element under the pointer, because most of the column's cards
 * are not in the document — so the drop position is arithmetic over the same
 * offsets the window is cut from, and a gap 3,000 cards below the viewport is as
 * answerable as the one under the pointer.
 */
export function gapAt(offsets: number[], position: number): number {
  const count = offsets.length - 1;
  if (count <= 0) return 0;
  const within = Math.max(0, Math.min(position, offsets[count]));
  const slot = indexAt(offsets, within);
  const middle = (offsets[slot] + offsets[slot + 1]) / 2;
  return within < middle ? slot : slot + 1;
}

/**
 * The half-open range of slots a scroller renders: everything touching the
 * viewport, plus `overscan` slots each side so a scroll does not expose a gap
 * before React has caught up.
 */
export function windowFor(
  offsets: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): { start: number; end: number } {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };

  const height = viewportHeight > 0 ? viewportHeight : ASSUMED_VIEWPORT;
  const top = Math.max(0, Math.min(scrollTop, offsets[count]));
  const first = indexAt(offsets, top);
  let last = first;
  while (last + 1 < count && offsets[last + 1] < top + height) last += 1;

  return {
    start: Math.max(0, first - overscan),
    end: Math.min(count, last + 1 + overscan),
  };
}
