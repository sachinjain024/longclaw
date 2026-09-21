/**
 * How wide the ticket panel is, and the arithmetic every way of changing it
 * shares (LC-238s).
 *
 * The panel was a fixed `min(560px, 88vw)`, which on a wide display is a narrow
 * column of description and timeline beside a lot of unused workspace. It is
 * now dragged by its left edge and remembered for this machine
 * (`devicePreferences.ts`, ADR 0012).
 *
 * **Two of these numbers are decisions, not comfort limits.** LC-227 puts the
 * properties rail behind a container query at 660px — 560 plus the rail plus
 * the gap — so a default under 660 ships that rail switched off, and a drag
 * that went under it would fold the rail away mid-gesture. 800 is LC-227's
 * measured recommendation: the main column is 507px there, one pixel under what
 * a 560px panel gives the description today, so the rail costs the reader
 * nothing.
 *
 * **The window's cap is applied where the panel is drawn, and never written
 * back.** `styles.css` draws `min(var(--ticket-panel-width), 88vw)`, so a width
 * restored against a monitor that is no longer attached cannot open a panel
 * wider than the window, nothing has to listen for a resize, and an afternoon
 * on a laptop does not cost the reader the width they dragged on a large
 * display. What is stored is the width they chose; what is drawn is as much of
 * it as fits.
 */

/**
 * The container query LC-227's properties rail is behind
 * (`styles.css:3192`). `scripts/panel-width-guard.mjs` is what holds this
 * number and that query together: they are two statements of one bound, and
 * the one that goes stale reads exactly like the one that did not. Not a
 * vitest file — the suite loads no stylesheet, and a `?raw` import of one
 * comes back empty under the CSS transform.
 */
export const PANEL_RAIL_FLOOR = 660;

/** What a panel nobody has dragged opens at. */
export const PANEL_WIDTH_DEFAULT = 800;

/**
 * The narrowest a drag may go, which is the rail's floor: under it the
 * properties fold back into stacked rows, and a gesture is not a place to
 * switch a feature off.
 */
export const PANEL_WIDTH_MIN = PANEL_RAIL_FLOOR;

/**
 * The widest width this build will store or accept back. It is a sanity bound
 * on a hand-editable document rather than a limit anyone drags into — the
 * window's own cap is always the smaller of the two on a real display, and this
 * is what stops a document saying `900000`.
 */
export const PANEL_WIDTH_MAX = 4_000;

/**
 * The share of the window the panel may cover — `88vw`, the ceiling the panel
 * has had since the spec (`screen-specs.md:214`). The board and list stay
 * visible and clickable behind it, so the workspace keeps a strip that is
 * always the board's rather than the panel's.
 */
export const PANEL_WIDTH_CAP = 0.88;

/** One press of an arrow key, and one press with `⇧` held. */
export const PANEL_WIDTH_STEP = 16;
export const PANEL_WIDTH_STEP_COARSE = 64;

/**
 * How much travel the handle needs before it is worth offering. At
 * `tauri.conf.json`'s 760px minimum window the cap is 668px and the floor is
 * 660 — 8px of travel, which is a control that looks like it works and does
 * not.
 */
const HANDLE_TRAVEL_FLOOR = 24;

/** Whether a width from the preferences document is one this build can use. */
export function isStoredPanelWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= PANEL_WIDTH_MIN &&
    value <= PANEL_WIDTH_MAX
  );
}

/** The widest the panel may be drawn in a window this wide. */
function capFor(viewportWidth: number): number {
  return Math.floor(viewportWidth * PANEL_WIDTH_CAP);
}

/**
 * `width` brought inside what this window and this build allow — the floor
 * first, so a window too narrow for the floor still stores 660 and lets CSS
 * draw the 88% it has room for.
 */
export function reachablePanelWidth(
  width: number,
  viewportWidth: number,
): number {
  const ceiling = Math.max(
    PANEL_WIDTH_MIN,
    Math.min(PANEL_WIDTH_MAX, capFor(viewportWidth)),
  );
  return Math.min(Math.max(Math.round(width), PANEL_WIDTH_MIN), ceiling);
}

/**
 * Where a drag has taken the width. The handle is on the panel's *left* edge
 * and the panel is anchored right, so leftward travel — a negative `deltaX` —
 * is the panel getting wider.
 */
export function panelWidthFromDrag(
  startWidth: number,
  deltaX: number,
  viewportWidth: number,
): number {
  return reachablePanelWidth(startWidth - deltaX, viewportWidth);
}

/**
 * The width after an arrow press on the handle, or `undefined` for a key that
 * is not one — which is how the handler knows to leave the event alone.
 *
 * A press that is already against the floor answers the floor rather than
 * nothing: the arithmetic says what the width *is*, and refusing here would
 * make the caller decide again whether a clamp counts as a change.
 */
export function panelWidthFromKey(
  width: number,
  key: string,
  coarse: boolean,
  viewportWidth: number,
): number | undefined {
  const step = coarse ? PANEL_WIDTH_STEP_COARSE : PANEL_WIDTH_STEP;
  if (key === "ArrowLeft")
    return reachablePanelWidth(width + step, viewportWidth);
  if (key === "ArrowRight") {
    return reachablePanelWidth(width - step, viewportWidth);
  }
  return undefined;
}

/**
 * Whether this window leaves the handle anywhere to go. Below roughly 778px
 * the cap and the floor are within 24px of each other, and the handle reports
 * itself disabled rather than accepting a gesture it cannot honour.
 */
export function panelResizeInert(viewportWidth: number): boolean {
  return capFor(viewportWidth) - PANEL_WIDTH_MIN < HANDLE_TRAVEL_FLOOR;
}

/**
 * The custom property `styles.css` draws the panel and its handle from.
 *
 * Deliberately not `--lc-`prefixed: everything with that prefix is generated
 * from `tokens/design-tokens.json`, and this is runtime state a gesture writes
 * rather than a value of the design system.
 */
export const PANEL_WIDTH_PROPERTY = "--ticket-panel-width";

/**
 * Puts the width where CSS reads it: on the root, in pixels.
 *
 * On the root rather than on the panel because the handle and the panel are
 * two elements drawing from one number, and the handle's own `right` is the
 * panel's left edge. `PanelResizeHandle` stamps it in a **layout** effect, so
 * the value is in force before the panel it belongs to is painted — an effect
 * would be a frame of the default width and a panel that visibly snaps — and
 * restamps it on every frame of a gesture without a React render.
 *
 * Nothing stamps it at launch, and nothing needs to: no panel is open when the
 * app comes up, and the `800px` fallback in `styles.css` is the same default
 * `readPanelWidth` answers with.
 */
export function stampPanelWidth(width: number) {
  document.documentElement.style.setProperty(
    PANEL_WIDTH_PROPERTY,
    `${width}px`,
  );
}
