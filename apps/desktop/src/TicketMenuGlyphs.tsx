/**
 * The three marks a ticket's context menu wears that nothing else in the app
 * draws yet (LC-222).
 *
 * One file named for the surface, the shape `SettingsGlyphs.tsx` established: a
 * mark the whole app reuses gets a file of its own, a set that exists because
 * one surface does travels with it. The menu's other four marks are already
 * drawn elsewhere and are used from there — the status dot, the priority glyph,
 * and `FolderGlyph` on the row that copies the path, which is the same mark the
 * two path chips wear.
 *
 * All decorative. Every row names itself in words beside the mark, so a glyph
 * that also announced itself would say it twice (`accessibility.md`).
 */

/**
 * `Open ticket`: a box with a corner let out and an arrow leaving through it,
 * which is the shape the eye reads as *this goes somewhere* at 14px. The panel
 * it opens is beside the board rather than over it, so the arrow points that
 * way rather than up.
 */
export function OpenGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M8 2.5 L2.5 2.5 L2.5 11.5 L11.5 11.5 L11.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 6.6 L11.5 2.5 M8.6 2.5 L11.5 2.5 L11.5 5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `Archive ticket`: a lidded box. The lid is the whole silhouette — a bare
 * rectangle at this size is a card, a note, or a button, and the band across
 * the top is what makes it a thing you put something into and close.
 */
export function ArchiveGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="1.6"
        y="2.5"
        width="10.8"
        height="2.8"
        rx="0.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.8 5.3 L2.8 10.7 Q2.8 11.5 3.6 11.5 L10.4 11.5 Q11.2 11.5 11.2 10.7 L11.2 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 7.8 L8.2 7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** `Copy key`: the two offset sheets every clipboard in every app is drawn as. */
export function CopyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="7.5"
        height="7.5"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M9 3.2 Q9 1.5 7.3 1.5 L3.2 1.5 Q1.5 1.5 1.5 3.2 L1.5 7.3 Q1.5 9 3.2 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
