/**
 * The priority glyphs, from `components.md:153-163`.
 *
 * Six levels, monochrome except Urgent: a filled square with an exclamation for
 * Urgent, a bordered mono chip carrying its own number for P1–P4, and a bare
 * dash for None, which wears no chip because it is not a level (LC-243d). D4
 * retired the old High/Medium/Low bars — the number carries the level, so no
 * chip is ever filled and none of them takes the theme accent.
 *
 * Every glyph carries its name, because a priority conveyed by shape and colour
 * alone is a priority half the people looking at the board cannot read
 * (`accessibility.md`). Where a text label already sits beside it — a menu row,
 * a trigger that names its own value — pass `decorative` instead of saying it
 * twice.
 */

import { classes } from "./classes";
import { priorityLabel } from "./tickets";
import type { TicketPriority } from "./types";

export function PriorityGlyph(props: {
  priority: TicketPriority;
  /** 13px rather than 14px, the size a board card uses. */
  small?: boolean;
  decorative?: boolean;
}) {
  const naming = props.decorative
    ? { "aria-hidden": true as const }
    : {
        role: "img",
        "aria-label": `Priority: ${priorityLabel(props.priority)}`,
      };
  const size = props.small ? 13 : 14;

  if (props.priority === "urgent") {
    return (
      <svg
        className="priority-glyph"
        width={size}
        height={size}
        viewBox="0 0 14 14"
        {...naming}
      >
        <rect x="1" y="1" width="12" height="12" rx="3" />
        {/* Both marks are the master's rects (`assets/glyphs.svg`): the dot is
            a 1.5 square with rx 0.75, which is a circle drawn the same way as
            the bar above it rather than a second kind of shape. */}
        <rect
          className="mark"
          x="6.25"
          y="3.4"
          width="1.5"
          height="4.6"
          rx="0.75"
        />
        <rect
          className="mark"
          x="6.25"
          y="9.2"
          width="1.5"
          height="1.5"
          rx="0.75"
        />
      </svg>
    );
  }

  // The dash on its own, as the prototype draws it (`prototype.js:102`) and as
  // the sheet holds it — the master's rect on the master's 14×14 grid, so this
  // is a copy `glyph-drift-guard` can actually compare.
  //
  // D-23 went the other way and LC-85 shipped it: the dash took the frame P1–P4
  // wear, so the five levels shared one slot and None was not the one level
  // drawn unlike the rest. What that reasoning missed is that the frame is the
  // chip, and a chip is a thing a ticket *has*. Framing the absence of a level
  // draws a box around nothing and puts a second empty rectangle on every card
  // that has said nothing about priority — which is most of them on a young
  // board. LC-243d reopened it against the prototype and settled it there.
  if (props.priority === "none") {
    return (
      <svg
        className="priority-glyph priority-dash"
        width={size}
        height={size}
        viewBox="0 0 14 14"
        {...naming}
      >
        <rect x="2.5" y="6.2" width="9" height="1.6" rx="0.8" />
      </svg>
    );
  }

  return (
    <span
      className={classes("priority-chip", props.small && "small")}
      {...naming}
    >
      {props.priority.toUpperCase()}
    </span>
  );
}
