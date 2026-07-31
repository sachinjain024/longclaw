/**
 * Where the cards in one board lane sit, so a lane can render only the ones on
 * screen.
 *
 * A 5,000-ticket board scrolls at roughly 71 ms a frame in WebKit and at roughly
 * 21 ms when only the visible cards exist — the whole cost is the nodes, not the
 * React work (`perf/README.md`). So the lane has to know its own geometry, and
 * that geometry has to be exact: a lane that guesses a card's height jitters as
 * it scrolls.
 *
 * It can be exact because the stylesheet pins both card heights. A card is one
 * line of key, one of title, one of meta; a card wearing an unreviewed
 * acknowledgement adds the actor footer, which the board spec already requires
 * never to wrap (`screen-specs.md` § Board). There is no third height.
 */

import { isFresh } from "./freshness";
import type { ExternalMarks } from "./freshness";
import type { TicketRow } from "./types";

/**
 * `--lc-size-board-card`, the height `.ticket-row` is pinned to. Exactly what
 * the card's three lines measure, so pinning it moves nothing.
 */
export const CARD_HEIGHT = 55;
/**
 * `--lc-size-board-card-fresh`: the same card with the acknowledgement footer
 * under it. Not a round number because it is not a chosen one — it is what the
 * footer's 10.5px line already measured, pinned so the lane can place the cards
 * below it without measuring anything.
 */
export const FRESH_CARD_HEIGHT = 79.33;
/** `.ticket-row`'s margin-bottom: the gap between cards in a stack. */
export const CARD_GAP = 8;

/** How far the next card's top sits below this one's. */
export const CARD_STRIDE = CARD_HEIGHT + CARD_GAP;
export const FRESH_CARD_STRIDE = FRESH_CARD_HEIGHT + CARD_GAP;

/**
 * The height a lane must reserve before it has measured itself. Deliberately a
 * tall viewport rather than zero: a lane that windows down to nothing on the
 * first paint would show an empty board for a frame.
 */
export const ASSUMED_VIEWPORT = 720;

export function cardStrides(
  tickets: TicketRow[],
  marks: ExternalMarks,
  now: number,
): number[] {
  return tickets.map((ticket) =>
    isFresh(marks[ticket.key], now) ? FRESH_CARD_STRIDE : CARD_STRIDE,
  );
}

/**
 * Running tops, one entry longer than the lane. The last entry is the lane's
 * full height, which is what the scroll container is sized to.
 */
export function laneOffsets(strides: number[]): number[] {
  const offsets = [0];
  for (const stride of strides)
    offsets.push(offsets[offsets.length - 1] + stride);
  return offsets;
}

/** The first index at or before `position`, by binary search over the offsets. */
function indexAt(offsets: number[], position: number): number {
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
 * The half-open range of cards a lane renders: everything touching the viewport,
 * plus `overscan` cards each side so a scroll does not expose a gap before React
 * has caught up.
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
