/**
 * The focus map's rules for a modal (`keyboard-focus-map.md:16-23`), for every
 * surface that is one: focus moves in when it opens, is held until it is
 * dismissed, and goes back to whatever opened it.
 *
 * Shared by `ConfirmDialog` and the attachment viewer (LC-206), so the fix
 * either one learns — a disabled button is not a stop (LC-249a) — is the
 * other's too.
 */

import { useEffect, type RefObject } from "react";

/**
 * Moves focus to `initial()` on mount and back to the opener on unmount.
 *
 * The opener is read *before* focus moves, so the ref holds it rather than the
 * element this is about to focus. Focusing an opener that has left the
 * document does nothing, which is the right answer, not a special case.
 */
export function useModalEntry(initial: () => HTMLElement | null | undefined) {
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    initial()?.focus();
    return () => opener?.focus();
    // Entry and exit once, by design: a modal is entered when it opens.
  }, []);
}

/**
 * Rule 5: a modal holds focus until it is dismissed. Without this, `Tab` off
 * its last button walks straight into the screen the modal is covering.
 *
 * Disabled buttons are not stops. A disabled one is still in the document and
 * `focus()` on it does nothing, so a ring that included it would swallow every
 * other `Tab` while a write is out (LC-249a) — the browser's own ring skips
 * them, and this stands in for the browser's ring.
 */
export function holdFocus(
  modal: RefObject<HTMLElement | null>,
  event: React.KeyboardEvent,
) {
  const stops = Array.from(
    modal.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [],
  );
  if (stops.length === 0) return;
  event.preventDefault();
  const here = stops.indexOf(document.activeElement as HTMLElement);
  const next = here + (event.shiftKey ? -1 : 1);
  stops[(next + stops.length) % stops.length].focus();
}
