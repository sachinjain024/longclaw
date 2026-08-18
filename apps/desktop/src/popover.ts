/**
 * The three things every anchored popover in this app does, and got wrong
 * separately before it did them here.
 *
 * `Menu` (status · priority · ordering · labels) and `SettingsMenu` (the gear's
 * dropdown and a project row's `⋮`) are different components on purpose — one
 * is a flat list of one field's values, the other is rows of mixed kinds with
 * captions, rules and a submenu. What they are not different about is where the
 * popover goes, where focus came from, and what a press outside it means, and
 * each had its own copy of all three (LC-208).
 */

import { useEffect, useRef } from "react";

/** How far below (or beside) its anchor a popover sits. */
export const POPOVER_GAP = 4;

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
