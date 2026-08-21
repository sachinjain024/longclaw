/**
 * The three things every popover in this app does, and got wrong separately
 * before it did them here.
 *
 * `Menu` (status · priority · ordering · labels) and `SettingsMenu` (the gear's
 * dropdown and a project row's `⋮`) are different components on purpose — one
 * is a flat list of one field's values, the other is rows of mixed kinds with
 * captions, rules and a submenu. What they are not different about is where the
 * popover goes, where focus came from, and what a press outside it means, and
 * each had its own copy of all three (LC-208).
 *
 * Placement comes in two kinds, and only the first was here until LC-222: under
 * an **anchor**, which is where a menu with a trigger goes, and at a **point**,
 * which is where a menu with no trigger at all goes — the ticket context menu,
 * which opens wherever the pointer was and so is the only one that can be asked
 * to draw itself off the side of the window.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** How far below (or beside) its anchor a popover sits. */
export const POPOVER_GAP = 4;

/** How close to the window's edge a popover is allowed to stand. */
const VIEWPORT_MARGIN = 8;

/** Where a popover was asked for, in viewport coordinates. */
export interface Point {
  x: number;
  y: number;
}

interface Box {
  width: number;
  height: number;
}

/**
 * Where a popover opened **at a point** goes (LC-222).
 *
 * The anchored placement below does no viewport arithmetic at all, and is right
 * not to: a trigger is somewhere a person could reach, so a menu hung under one
 * is somewhere they can see. A context menu has no such guarantee — it opens
 * where the pointer was, and the pointer can be a row above the bottom of the
 * window — so this flips the popover back over the point rather than letting it
 * run off, which is the gesture every platform's own context menu makes.
 *
 * Pure, and the whole of the decision: the hook below is measurement and state.
 */
export function placeAtPoint(
  point: Point,
  size: Box,
  viewport: Box,
): { top: number; left: number } {
  return {
    left: fitAxis(point.x, size.width, viewport.width),
    top: fitAxis(point.y, size.height, viewport.height),
  };
}

/**
 * One axis: start at the point, and when that would run past the far edge, end
 * at it instead. A popover with room on neither side stands at the margin —
 * cut off at the bottom, where the rows it loses are the ones a person can
 * scroll or resize to, rather than at the top, where they simply are not there.
 */
function fitAxis(at: number, extent: number, limit: number): number {
  if (at + extent <= limit - VIEWPORT_MARGIN) return at;
  return Math.max(
    VIEWPORT_MARGIN,
    Math.min(at - extent, limit - VIEWPORT_MARGIN - extent),
  );
}

/**
 * `placeAtPoint`, measured against the popover it is placing.
 *
 * Two passes rather than one: nothing knows how tall a menu is until its rows
 * exist, so it is drawn at the point and corrected in a layout effect — before
 * paint, so the correction is not a frame the human sees. The alternative is
 * arithmetic over row counts and CSS variables, which would be a second opinion
 * about the menu's height and would go stale the first time a row grew.
 */
export function usePointPlacement(
  point: Point,
  popover: React.RefObject<HTMLElement | null>,
) {
  const [position, setPosition] = useState({ top: point.y, left: point.x });
  useLayoutEffect(() => {
    const box = popover.current?.getBoundingClientRect();
    if (!box) return;
    const next = placeAtPoint(point, box, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setPosition((held) =>
      held.top === next.top && held.left === next.left ? held : next,
    );
    // The point, not the box: a menu that grew a row — a submenu opening
    // beside it does not — is not a reason to walk out from under the pointer
    // that is using it, which is the same rule the anchored placement keeps.
  }, [point.x, point.y, popover]);
  return position;
}

/**
 * Where the popover goes: under its anchor, left edges aligned, in fixed
 * viewport coordinates so a scrolling column cannot carry it away from what it
 * belongs to.
 *
 * Measured **once**, when it opens. The row a popover hangs off can move
 * underneath it — a multi-select menu stays up while its own picks grow the
 * labels row a chip at a time, and the content header's disk-state line arrives
 * mid-write and pushes the identity box around — so a popover that re-measured
 * on every render would walk out from under the pointer that is using it.
 */
export function usePopoverPlacement(
  anchor: HTMLElement | null,
  /** Right-align: the popover's right edge sits on the anchor's, for a
   *  trigger at the window's far edge (the header gear). The caller states
   *  the popover's width — measured after render would move it a frame late. */
  width?: number,
) {
  const placed = useRef<{ top: number; left: number } | undefined>(undefined);
  if (!placed.current && anchor) {
    const rect = anchor.getBoundingClientRect();
    const left = width ? Math.max(8, rect.right - width) : rect.left;
    placed.current = { top: rect.bottom + POPOVER_GAP, left };
  }
  return placed.current;
}

/**
 * Focus back where it came from when the popover goes, whatever took it down —
 * a pick, `Escape`, or a click on the board (`keyboard-focus-map.md:14`).
 *
 * Captured on open, because by the time the cleanup runs the popover holds
 * focus itself. The anchor is the answer whenever there is one; what had focus
 * at the moment of opening is the honest fallback. `isConnected` is the guard
 * that matters: a card that has since scrolled out of its column, or a project
 * row removed by the very menu that was standing on it, is not somewhere to
 * send anything.
 */
export function useFocusReturn(anchor: HTMLElement | null) {
  const returnTo = useRef<HTMLElement | null | undefined>(undefined);
  if (returnTo.current === undefined) {
    returnTo.current = anchor ?? (document.activeElement as HTMLElement | null);
  }
  useEffect(
    () => () => {
      const element = returnTo.current;
      if (element?.isConnected) element.focus();
    },
    [],
  );
  return returnTo;
}

/**
 * A press anywhere else takes the popover down — on `mousedown`, which is when
 * a person has decided, rather than on the `click` that follows.
 *
 * The anchor is excluded, and that exclusion is the whole subtlety: without it
 * a trigger cannot close its own menu. The press dismisses on `mousedown`,
 * React re-renders with the menu shut, and the `click` that follows lands on a
 * handler that now reads `open === false` and opens it straight back up — so
 * the menu can only ever be shut with `Esc` or by clicking somewhere else.
 * `Menu` has always excluded its anchor for this reason; the gear and the `⋮`
 * both went a round of review without it.
 */
export function useDismissOnPressOutside(props: {
  popover: React.RefObject<HTMLElement | null>;
  anchor: HTMLElement | null;
  onDismiss: () => void;
  /** A nested list is inside its parent's popover; the outermost one answers. */
  enabled?: boolean;
}) {
  const { popover, anchor, onDismiss, enabled = true } = props;
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover.current?.contains(target)) return;
      // The trigger's own press is its toggle, not a dismissal.
      if (anchor?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [anchor, enabled, onDismiss, popover]);
}
