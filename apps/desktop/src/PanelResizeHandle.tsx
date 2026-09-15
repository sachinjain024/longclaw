/**
 * The ticket panel's left edge, as a control (LC-238s).
 *
 * The same handle serves both panels — the ticket panel and full create — the
 * way `.ticket-panel` serves both: the overlay is the same overlay in the same
 * place, and a width that changed between viewing a ticket and creating one
 * would be a flinch.
 *
 * **The width is a custom property on the root, not React state.** A drag that
 * held the width in state would re-render the panel's whole subtree —
 * description, checklist and timeline — on every `mousemove`, so the gesture
 * restamps `--ticket-panel-width` and nothing renders until it ends. The number
 * kept here is for the *control*: a separator reports where it stands
 * (`aria-valuenow`), and that is a once-per-gesture fact.
 *
 * **It is a `separator`, not a button.** The ARIA window-splitter pattern is
 * what this is — a thing that sits between two regions and reports a position —
 * and it is the pattern `←`/`→` on a focused handle belongs to. A mouse-only
 * handle would be the same gap the panel's controls had before Step 17 and its
 * checklist rows had before LC-185 (`keyboard-focus-map.md:62`, rule 1).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { readPanelWidth, rememberPanelWidth } from "./devicePreferences";
import {
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  panelResizeInert,
  panelWidthFromDrag,
  panelWidthFromKey,
  reachablePanelWidth,
  stampPanelWidth,
} from "./panelWidth";

/** What a gesture in flight needs to remember, and nothing more. */
type Drag = { pointerId: number; fromX: number; fromWidth: number };

export function PanelResizeHandle() {
  const [stored, setStored] = useState(readPanelWidth);
  const [viewport, setViewport] = useState(() => window.innerWidth);
  const drag = useRef<Drag | undefined>(undefined);

  /**
   * The width as it is drawn, which is what every gesture starts from: the
   * stored width is what the reader chose, and `styles.css` draws as much of it
   * as 88% of this window has room for.
   */
  const drawn = reachablePanelWidth(stored, viewport);
  const inert = panelResizeInert(viewport);

  /**
   * Before the first paint of the panel this handle belongs to, so the panel
   * opens at the remembered width rather than snapping to it a frame later.
   * A layout effect and not an effect for exactly that reason.
   */
  useLayoutEffect(() => {
    stampPanelWidth(drawn);
  }, [drawn]);

  // Whether the handle has anywhere to go is a question about the window, and
  // the window is resizable while the panel is open.
  useEffect(() => {
    const measure = () => setViewport(window.innerWidth);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /**
   * One settled width: painted, held for the control, and written to disk.
   *
   * **Only a gesture reaches here**, which is what keeps the stored width the
   * reader's. It is written from `drawn` rather than from `stored`, so a reader
   * who narrows the panel on a laptop stores what they narrowed it *to* — and
   * a remembered 1,400px is spent only because someone moved the edge, never
   * because a smaller display drew less of it. A press that cannot move the
   * edge writes nothing at all (`onKeyDown`), so trying to widen a panel
   * already at this window's cap leaves the wider remembered width alone.
   */
  function commit(width: number) {
    stampPanelWidth(width);
    setStored(width);
    rememberPanelWidth(width);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (inert || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      fromX: event.clientX,
      fromWidth: drawn,
    };
    // Capture, so a pointer that leaves the 9px strip mid-gesture — which it
    // will, since the strip is what moves — keeps reporting to this handle.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  /**
   * Where this event has taken the width, or `undefined` when it belongs to a
   * gesture this handle is not holding. One function because all three pointer
   * handlers ask the same question of the same three fields, and asking it
   * three times is three places for the sign of `deltaX` to go wrong.
   */
  function widthAt(event: PointerEvent<HTMLDivElement>): number | undefined {
    const held = drag.current;
    if (!held || held.pointerId !== event.pointerId) return undefined;
    return panelWidthFromDrag(
      held.fromWidth,
      event.clientX - held.fromX,
      window.innerWidth,
    );
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const next = widthAt(event);
    // Straight to the property: this runs on every frame of the gesture.
    if (next !== undefined) stampPanelWidth(next);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const next = widthAt(event);
    if (next === undefined) return;
    drag.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    commit(next);
  }

  /**
   * A cancelled gesture keeps what it had already drawn rather than springing
   * back: the pointer went away, which is not the reader taking the width back.
   * It is committed here because `pointerup` is the event that will not arrive.
   */
  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    const next = widthAt(event);
    if (next === undefined) return;
    drag.current = undefined;
    commit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (inert) return;
    const next = panelWidthFromKey(
      drawn,
      event.key,
      event.shiftKey,
      window.innerWidth,
    );
    if (next === undefined) return;
    // Both halves matter: the arrows are the page's scroll and the board's
    // focus otherwise, and the board's handler is on `document`.
    event.preventDefault();
    event.stopPropagation();
    if (next !== drawn) commit(next);
  }

  return (
    <div
      className="panel-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Panel width"
      aria-valuenow={drawn}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={reachablePanelWidth(PANEL_WIDTH_MAX, viewport)}
      aria-valuetext={`${drawn} pixels`}
      // A window with 24px or less of travel in it has nothing to offer, and
      // the handle says so rather than accepting a gesture and refusing it:
      // still a focus stop, still announced, plainly not available.
      aria-disabled={inert || undefined}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    />
  );
}
