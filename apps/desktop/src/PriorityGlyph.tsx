/**
 * The priority glyphs, from `components.md:153-163`.
 *
 * Six levels, monochrome except Urgent: a filled square with an exclamation for
 * Urgent, a bordered mono chip carrying its own number for P1–P4, and a dash for
 * None — in the same chip frame, because the five of them share one slot. D4
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

  // The dash components.md keeps for None, inside the frame P1–P4 wear. The two
  // share one slot — the card's ID row, a menu row's glyph column — and an
  // unframed dash beside four framed numbers reads as a stray hyphen rather
  // than as a level (D-23).
  if (props.priority === "none") {
    return (
      <span
        className={classes("priority-chip", "none", props.small && "small")}
        {...naming}
      >
        <svg
          className="priority-dash"
          width="9"
          height="2"
          viewBox="0 0 9 2"
          aria-hidden="true"
        >
          <rect y="0.2" width="9" height="1.6" rx="0.8" />
        </svg>
      </span>
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
