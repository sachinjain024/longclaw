/**
 * The marks the settings surfaces wear (LC-208) — the gear and the `⋮` that
 * open them, and the four that name a row inside them.
 *
 * One file rather than six, and named for the surface rather than for any one
 * mark: these exist only because the settings menus and panel do, they change
 * together when those change, and `FolderGlyph`/`WarnGlyph`'s one-mark-per-file
 * shape is for marks the whole app reuses.
 *
 * A mark the app already draws belongs to whichever file already draws it —
 * `Rename…` wears `PencilGlyph`, not a second pencil written here.
 */

/**
 * The settings mark: a toothed cog, wherever settings is offered.
 *
 * It replaces a ring with eight straight rays, which at 14px read as a sun or a
 * loading spinner rather than as a gear (LC-208) — the rays are the same length
 * and the same weight all the way round, so nothing in the silhouette says
 * *machine*. The teeth are trapezoids on the ring's outside, which is the shape
 * the eye resolves at this size, and the prototype's own path.
 *
 * Decorative. Every caller names itself in words — the header button's
 * `aria-label`, the menu row's text, the panel header's heading — so a glyph
 * that also announced "settings" would say it twice (`accessibility.md`).
 */
export function GearGlyph() {
  return (
    <svg
      className="gear-glyph"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5.9 1.5 L8.1 1.5 L8.4 2.9 A4.3 4.3 0 0 1 9.6 3.6 L10.95 3.15 L12.05 5.05 L11 6 A4.4 4.4 0 0 1 11 8 L12.05 8.95 L10.95 10.85 L9.6 10.4 A4.3 4.3 0 0 1 8.4 11.1 L8.1 12.5 L5.9 12.5 L5.6 11.1 A4.3 4.3 0 0 1 4.4 10.4 L3.05 10.85 L1.95 8.95 L3 8 A4.4 4.4 0 0 1 3 6 L1.95 5.05 L3.05 3.15 L4.4 3.6 A4.3 4.3 0 0 1 5.6 2.9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The three dots that open a project's own menu in the side panel, on the row
 * the ticket puts it on ("the Menu which gets opened through 3 vertical dots in
 * front of Project Name", LC-208).
 */
export function KebabGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="2.8" r="1.2" fill="currentColor" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" />
      <circle cx="7" cy="11.2" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** The tag mark on the settings menu's `Labels` row, from the label chip. */
export function TagGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M1.8 6.6 L6.6 1.8 L12.2 1.8 L12.2 7.4 L7.4 12.2 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="4.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Three columns of unequal height: the board, as the `Status fields` row. */
export function ColumnsGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="1.8"
        y="3"
        width="2.8"
        height="8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="5.6"
        y="3"
        width="2.8"
        height="5.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="9.4"
        y="3"
        width="2.8"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** A keycap row: the `Keyboard shortcuts` menu row and its nav entry. */
export function KeyboardGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="1.5"
        y="3.8"
        width="11"
        height="6.4"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M4 8.2 H10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3.6 6 H4.4 M6.6 6 H7.4 M9.6 6 H10.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The circular arrow on `Reload from disk`. */
export function ReloadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M11.6 7 A4.6 4.6 0 1 1 9.9 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.2 1.6 L10.2 3.7 L8.1 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
