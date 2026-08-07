/**
 * Scrolling a container for as long as a drag hangs near its edge.
 *
 * A drop position off screen has to be reachable, and there are three scrollers
 * that need it: a board column down, the board grid across, and the issue list
 * down. All three are the same loop over a different axis, so it is written
 * once — the alternative is three copies that drift apart in feel.
 */

import { useRef } from "react";
import type { RefObject } from "react";

/**
 * How close to an edge a drag has to hang before the scroller under it moves,
 * and how far it travels each frame.
 */
export const AUTO_SCROLL_EDGE = 44;
export const AUTO_SCROLL_STEP = 14;

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
