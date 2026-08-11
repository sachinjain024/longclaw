/**
 * Keeps a checklist's add-row under the human's eye as the list above it grows.
 *
 * The add-row is the list's next row (`GhostBox`), so an appended item lands
 * *exactly where the field was standing* and the field moves one row down. In a
 * panel scrolled so the field sits near the bottom edge — which is where anyone
 * who has just scrolled the checklist into view is typing from — one Enter puts
 * it under the edge. The field still holds focus and the caret is still in it,
 * but what the human is now looking at is the row they just made, so the surface
 * reads as having dropped them: LC-193, filed as "after entering one checklist
 * item, the next input row isn't focussed".
 *
 * `keyboard-focus-map.md:63` promises the field keeps focus for rapid entry, and
 * a field that keeps focus off the bottom of the pane keeps the letter of that
 * and none of it. So the scroller follows the row down.
 *
 * Two things it deliberately does not do:
 *
 *   - **It does not scroll unless the field has focus.** The gate is where the
 *     human is, not where the write came from: an item an agent appends while
 *     the panel is merely open must not move the page under somebody reading the
 *     activity, and one that arrives while they are typing in the field moves
 *     the field, so following it is the same courtesy either way.
 *   - **It scrolls by `nearest`, so a field already in view does not move.** The
 *     scroll is the minimum that puts the row back, not a jump to a position.
 *
 * It watches the count rather than the field's own box, which is the cheap
 * question and the one that answers the report: a list that gains a row moves
 * the field by a row. A list that keeps its length and changes height under it —
 * an item edited into two wrapped lines by something outside — is not followed,
 * and there is no way into that from this surface.
 */

import { useLayoutEffect, useRef } from "react";

export function useAddRowInView(count: number) {
  const field = useRef<HTMLInputElement>(null);
  // Layout rather than effect: the row is inserted and the scroller corrected in
  // one frame, so the field is never painted under the edge on the way back.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element || document.activeElement !== element) return;
    // jsdom lays nothing out and has no `scrollIntoView` (`rovingFocus.ts:126`
    // guards the same call for the same reason).
    element.scrollIntoView?.({ block: "nearest" });
  }, [count]);
  return field;
}
