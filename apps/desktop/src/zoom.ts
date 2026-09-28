/**
 * `⌘+`, `⌘-` and `⌘0`: how large the app is drawn (LC-258c).
 *
 * The layout was built for a zoomed viewport long before anything could zoom
 * it — `a11y:audit`'s A5 row tests 200%, and `styles.css` has a query below the
 * window's minimum width that only zoom reaches. This is the way in.
 *
 * **The webview names an intent and Rust decides the level** (`zoom.rs`). The
 * ladder lives there — the frontend knows only that 100 is actual size — so nothing here can ask for a size the
 * layout has not been looked at, and the level that comes back is the one to
 * remember. The View menu sends the same intents as an event, so a menu click
 * and a chord are one path from request to remembered level.
 *
 * Installed by `main.tsx` rather than by `App`: zoom belongs to the window, not
 * to anything drawn in it, and it has to answer whatever is on screen —
 * including a modal, a menu, or a field.
 */

import {
  listenForZoomRequests,
  restoreZoomLevel,
  zoomApp,
  type ZoomIntent,
} from "./api";
import { forgetZoom, readZoom, rememberZoom } from "./devicePreferences";
import { isChord } from "./keyContext";

/**
 * The zoom a keypress asks for, or `undefined` for one that is not a zoom chord.
 *
 * Read through `isChord`, so `Ctrl` reaches these exactly as it reaches `⌘K`.
 *
 * **`⌘+` is not a key.** On a US layout `+` is `⇧=`, so zoom in answers the
 * unshifted `=` and does not ask for Shift — and answers `+` as well, for the
 * shifted press and for a layout that gives `+` a key of its own. `⌘0` is free:
 * `chordDigit` stops at 1 because there is no zeroth project (LC-230).
 *
 * `⌘0` is also read by the physical key, because on AZERTY the digits are the
 * shifted layer and the unshifted key types `à` — without this, actual size
 * would be the one zoom chord a French keyboard cannot press.
 */
export function zoomIntent(event: KeyboardEvent): ZoomIntent | undefined {
  if (isChord(event, "=") || isChord(event, "+")) return "in";
  if (isChord(event, "-")) return "out";
  if (isChord(event, "0")) return "reset";
  if ((event.metaKey || event.ctrlKey) && event.code === "Digit0") {
    return "reset";
  }
  return undefined;
}

/**
 * Presses go to the backend one at a time. Each answer is the level the step
 * landed on, and remembering them out of order would record a level the window
 * is not at — three quick presses must leave the document saying where the
 * third one put it.
 */
let pending: Promise<void> = Promise.resolve();

function requestZoom(intent: ZoomIntent): Promise<void> {
  pending = pending.then(async () => {
    try {
      rememberZoom(await zoomApp(intent));
    } catch {
      // The window stays at the size it was. Nothing to report it on, and
      // nothing that was written is now wrong.
    }
  });
  return pending;
}

/**
 * Puts the remembered level back — after `restoreDevicePreferences`, before
 * the first render, for the reason the appearance is stamped then: a frame at
 * 100% and then a jump to 150% is the zoom's flash of the wrong theme.
 *
 * A level Rust's ladder does not have is dropped from the document, the way
 * every unrecognised preference is. A host that cannot answer at all leaves
 * the value alone: it has said nothing about whether the level is good.
 */
export async function restoreZoom(): Promise<void> {
  const level = readZoom();
  if (level === undefined) return;
  try {
    if ((await restoreZoomLevel(level)) === null) forgetZoom();
  } catch {
    // No backend to apply it — a browser tab, a harness. Keep it for one.
  }
}

/**
 * Listens for the chords and the View menu. Answers the uninstaller.
 *
 * **Capture phase, on the window.** Zoom has to work from inside the filter
 * field and over every layer, and several surfaces stop their own keys from
 * propagating; a listener that ran after them would be a chord that works on
 * the board and not in the ticket panel. `preventDefault` keeps the key from
 * typing a `-` into a field, and tells WebKit the page took the key equivalent
 * so the View menu does not step a second time for the same press.
 */
export function installZoom(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const intent = zoomIntent(event);
    if (!intent) return;
    event.preventDefault();
    void requestZoom(intent);
  };
  window.addEventListener("keydown", onKeyDown, true);

  let unlisten: (() => void) | undefined;
  let removed = false;
  listenForZoomRequests((intent) => void requestZoom(intent)).then(
    (stop) => {
      if (removed) stop();
      else unlisten = stop;
    },
    () => {
      // No event channel: the chords still work, the menu has nothing to call.
    },
  );

  return () => {
    removed = true;
    window.removeEventListener("keydown", onKeyDown, true);
    unlisten?.();
  };
}
