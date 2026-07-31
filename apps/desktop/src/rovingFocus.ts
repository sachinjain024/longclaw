/**
 * The single tab stop a windowed surface navigates with, shared by the board and
 * the list.
 *
 * Windowing takes the rows off the Tab order, so both surfaces carry the roving
 * focus `keyboard-focus-map.md` asks for: one tab stop, moved by the arrow keys
 * through the visual order. The two surfaces disagree about what a move *is* —
 * the board moves in two dimensions and the list in one — so this owns only the
 * part that is the same: which row holds the tab stop, and when focus is
 * actually taken.
 *
 * **Focus answers a request, never a change of key.** This is the defect V0-15
 * fixed. `rovingKey` moves for reasons that have nothing to do with the human's
 * hands — a filter query re-buckets the rows and the tab stop lands somewhere
 * else — and a focus effect keyed on `rovingKey` would yank focus out of the
 * header field mid-word. WebKit then reads the next backspace as navigate-back.
 * So `requestFocus` is what moves focus, a key press is the only thing that
 * calls it, and `rovingKey` is read by the effect rather than obeyed by it.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Seat } from "./grouping";

/**
 * The move a key press means, or nothing when the surface does not bind the key.
 * The letters are listed upper case in `keyboard-focus-map.md` and matched here
 * in lower, because caps lock or a held shift is still the same key to the
 * person pressing it.
 */
export function moveFor<Move>(
  moves: Record<string, Move>,
  key: string,
): Move | undefined {
  return moves[key] ?? moves[key.toLowerCase()];
}

/** Finds a mounted row by key without building a selector out of one. */
export function itemFor(
  root: HTMLElement | null,
  selector: string,
  key: string,
): HTMLElement | undefined {
  // A degraded row is keyed by its directory name, which nothing has vetted as
  // CSS, so the key is compared rather than interpolated.
  return Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).find(
    (element) => element.dataset.ticketKey === key,
  );
}

export interface RovingFocus {
  /** The row holding the tab stop, if the surface has any rows at all. */
  rovingKey?: string;
  /** For a row's own `onFocus`: stable, so it costs a memoized row nothing. */
  onFocusItem: (key: string) => void;
  /**
   * Take focus. With a key, move the tab stop there first; without one, ask for
   * the row that already holds it — which is how the board re-finds a card after
   * a priority pick has re-sorted the column out from under the menu.
   */
  requestFocus: (key?: string) => void;
}

export function useRovingFocus(options: {
  /** Where every row sits, so a key that no longer exists cannot hold focus. */
  seats: Map<string, Seat>;
  /** Where the tab stop falls back to: the first row in visual order. */
  firstKey?: string;
  /** The surface's scroll root, searched for the row to focus. */
  root: RefObject<HTMLElement | null>;
  /** The row class this surface draws — `.ticket-row` or `.list-row`. */
  selector: string;
}): RovingFocus {
  const { seats, firstKey, root, selector } = options;
  const [focusedKey, setFocusedKey] = useState<string>();
  /** Bumped only by a key press, so focus follows the arrows and nothing else. */
  const [focusRequest, setFocusRequest] = useState(0);

  // A row that was deleted, or that changed status, cannot hold the tab stop.
  const rovingKey =
    focusedKey !== undefined && seats.has(focusedKey) ? focusedKey : firstKey;

  const onFocusItem = useCallback((key: string) => setFocusedKey(key), []);
  const requestFocus = useCallback((key?: string) => {
    if (key !== undefined) setFocusedKey(key);
    setFocusRequest((request) => request + 1);
  }, []);

  // The surface keeps its focused row mounted wherever it is, so the row the
  // arrows just moved to is always here to be focused and scrolled to.
  //
  // Only a new request moves focus. `rovingKey` is a dependency because the
  // effect reads it, not because a change to it is a reason to grab focus.
  const answered = useRef(0);
  useLayoutEffect(() => {
    if (focusRequest === 0 || focusRequest === answered.current) return;
    if (rovingKey === undefined) return;
    answered.current = focusRequest;
    const item = itemFor(root.current, selector, rovingKey);
    item?.focus();
    item?.scrollIntoView?.({ block: "nearest" });
  }, [focusRequest, rovingKey, root, selector]);

  return { rovingKey, onFocusItem, requestFocus };
}
