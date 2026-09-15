import type { ReactNode } from "react";
import type { ViewMode } from "./devicePreferences";

/**
 * The two marks the header's Board | List segment wears, copied 1:1 from the
 * prototype's own glyphs (`prototype.js:115-116`) on the 14×14 grid the rest of
 * the set is drawn on and rendered at 12. Both are masters on
 * `assets/glyphs.svg` (`view-board`, `view-list`) and are registered with
 * `glyph-drift-guard.mjs`, which is what keeps this table and the sheet drawing
 * the same mark — the sheet is a docs change and this file is an app change,
 * and neither review sees the other.
 *
 * Solid rects rather than the stroked geometry most of this set uses: at 12px a
 * board is three columns of falling height and a list is three rules, and a
 * 1.3px stroke around a 3.2px column leaves a sliver of interior that reads as
 * noise. `currentColor` because the button owns every state the mark has — the
 * pressed pill flips both the fill and the glyph to `--lc-on-accent-human` in
 * one move.
 *
 * Decorative. The button carries the word, and a mark that repeated it would
 * say it twice (`accessibility.md`).
 */
const MARKS: Record<ViewMode, ReactNode> = {
  // Falling heights, not a picture of today's board: the columns say "columns",
  // and a real board has six of them.
  board: (
    <>
      <rect x="1.5" y="2" width="3.2" height="10" rx="1" />
      <rect x="5.9" y="2" width="3.2" height="7" rx="1" />
      <rect x="10.3" y="2" width="3.2" height="4.5" rx="1" />
    </>
  ),
  list: (
    <>
      <rect x="1.5" y="2.5" width="11" height="1.7" rx="0.85" />
      <rect x="1.5" y="6.15" width="11" height="1.7" rx="0.85" />
      <rect x="1.5" y="9.8" width="11" height="1.7" rx="0.85" />
    </>
  ),
};

export function ViewGlyph(props: { view: ViewMode }) {
  return (
    <svg
      className={`view-glyph view-glyph-${props.view}`}
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden="true"
    >
      {MARKS[props.view]}
    </svg>
  );
}
