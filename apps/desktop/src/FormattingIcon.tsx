/**
 * The six formatting marks the description toolbar shows, from `components.md`
 * § Description editor and the `format-*` symbols in `assets/glyphs.svg`.
 *
 * One geometry per action, copied from the sheet on its own 14×14 grid and
 * drawn 1:1, so the stroke the foundations set specifies is the stroke that
 * ships. 13–14 is where the rest of the set sits, and a toolbar of six is no
 * place to be the loud one. Colour is `currentColor` because the button owns
 * the hover and disabled states.
 *
 * Decorative. The button carries the action's name (`markdownToolbar.ts`), and
 * a glyph that repeated it would say it twice (`accessibility.md`).
 */

import type { ReactNode } from "react";
import type { ToolbarAction } from "./markdownToolbar";

/** Keyed by the action union, so a new action cannot ship without its mark. */
const MARKS: Record<ToolbarAction, ReactNode> = {
  bold: (
    <>
      <path d="M3.5 2h3.6a2.6 2.6 0 0 1 .6 5.1 2.6 2.6 0 0 1-.6 5.1H3.5z" />
      <path d="M3.5 7h3.5" />
    </>
  ),
  italic: <path d="M9.5 2H5.7M8.4 2 5.7 12h3.8" />,
  code: (
    <path d="m5.2 3.5-2.6 3.5 2.6 3.5M8.8 3.5l2.6 3.5-2.6 3.5M8 2.2 6 11.8" />
  ),
  list: (
    <>
      <path d="M5.5 3.5h6M5.5 7h6M5.5 10.5h6" />
      {/* The dots are the same round cap at a heavier weight, not a shape. */}
      <path d="M2.5 3.5h.01M2.5 7h.01M2.5 10.5h.01" strokeWidth="2.6" />
    </>
  ),
  task: (
    <>
      <rect x="2" y="2" width="3.5" height="3.5" rx="0.8" />
      <path d="m2.8 4 .9.9 1-1.4M7.5 4h4M2 9h3.5M7.5 9h4" />
    </>
  ),
  link: (
    <path d="m5.7 8.4-.9.9a2.2 2.2 0 0 1-3.1-3.1l1.8-1.8a2.2 2.2 0 0 1 3.1 0M8.3 5.6l.9-.9a2.2 2.2 0 0 1 3.1 3.1l-1.8 1.8a2.2 2.2 0 0 1-3.1 0M4.8 7l4.4-1" />
  ),
};

export function FormattingIcon(props: { action: ToolbarAction }) {
  return (
    <svg
      className={`formatting-glyph formatting-${props.action}`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {MARKS[props.action]}
    </svg>
  );
}
