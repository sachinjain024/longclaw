/**
 * The mechanics both dragging surfaces share: picking a ticket up, and keeping
 * a scroller moving while the drag hangs at its edge.
 *
 * What a drop *means* is `ticketMove.ts`; this is the part that touches the DOM
 * and the browser's own drag API. Both live outside the surfaces because the
 * board and the list would otherwise each carry a copy — and the copies would
 * disagree about the traps rather than about the design, which is worse: the
 * empty-data-transfer rule below is a WebKit fact, and one surface remembering
 * it is not the same as both.
 *
 * **Neither of these works at all unless the window has `dragDropEnabled:
 * false`** — see `Board.tsx`, which states why, and `release-audit`, which
 * holds the flag down.
 */

import { useRef } from "react";
import type { DragEvent, RefObject } from "react";
import type { Seat } from "./grouping";
import type { StatusGroup } from "./grouping";
import { movable } from "./ticketMove";

/**
 * How close to an edge a drag has to hang before the scroller under it moves,
 * and how far it travels each frame.
 */
export const AUTO_SCROLL_EDGE = 44;
export const AUTO_SCROLL_STEP = 14;

/**
 * The ticket a `dragstart` picked up, or `undefined` when it picked up nothing
 * this build may move.
 *
 * `dragstart` bubbles, so each surface handles it once at its scroller rather
 * than handing every row a callback of its own — which is what keeps the rows
 * memoized on their own ticket and two booleans.
 */
export function pickUp(
  event: DragEvent<HTMLElement>,
  options: {
    /** The class the surface's rows wear: `.ticket-row`, `.list-row`. */
    selector: string;
    groups: StatusGroup[];
    seats: Map<string, Seat>;
  },
): string | undefined {
  const on = (event.target as HTMLElement).closest?.(options.selector);
  const key = (on as HTMLElement | null)?.dataset.ticketKey;
  if (key === undefined) return undefined;
  if (!movable(options.groups, options.seats.get(key))) return undefined;
  // WebKit will not start a drag with an empty data transfer.
  event.dataTransfer?.setData("text/plain", key);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  return key;
}

/** -1 near the low edge of a box, 1 near the high one, 0 anywhere between. */
export function towardsEdge(
  position: number,
  low: number,
  high: number,
): number {
  if (position > high - AUTO_SCROLL_EDGE) return 1;
  if (position < low + AUTO_SCROLL_EDGE) return -1;
  return 0;
}

/**
 * Returns `driftBy(direction)`: -1, 1, or 0 to stop. The caller reads the
 * direction off the pointer, because only it knows which box the pointer is
 * being measured against.
 *
 * Stepping once when the drift starts rather than waiting for the first frame
 * is what makes the edge feel like it responded.
 */
export function useEdgeDrift(
  target: RefObject<HTMLElement | null>,
  axis: "scrollTop" | "scrollLeft",
  onScrolled?: (position: number) => void,
): (next: number) => void {
  const drift = useRef(0);
  const frame = useRef(0);

  function step() {
    frame.current = 0;
    const element = target.current;
    if (!element || drift.current === 0) return;
    element[axis] += drift.current * AUTO_SCROLL_STEP;
    onScrolled?.(element[axis]);
    frame.current = requestAnimationFrame(step);
  }

  return function driftBy(next: number) {
    drift.current = next;
    if (next === 0 || frame.current !== 0) return;
    step();
  };
}
