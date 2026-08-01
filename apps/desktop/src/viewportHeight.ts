/**
 * How tall a scroll container currently is, which is half of what decides the
 * window of rows the board column and the issue list draw.
 *
 * Measured rather than assumed, and re-measured on resize, because the window is
 * cut from `clientHeight`: a container that grew without being re-measured would
 * leave a strip of empty space below the last drawn row. `ResizeObserver` is
 * absent in jsdom, so the first measurement stands there — which is the right
 * answer for a test, where nothing resizes.
 */

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export function useViewportHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setHeight(element.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
