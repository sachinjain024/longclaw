/**
 * The priority glyphs, from `components.md:134-144`.
 *
 * Six levels, monochrome except Urgent: a filled square with an exclamation for
 * Urgent, a bordered mono chip carrying its own number for P1–P4, and a dash for
 * None. D4 retired the old High/Medium/Low bars — the number carries the level,
 * so no chip is ever filled and none of them takes the theme accent.
 *
 * Every glyph carries its name, because a priority conveyed by shape and colour
 * alone is a priority half the people looking at the board cannot read
 * (`accessibility.md`). Where a text label already sits beside it — a menu row,
 * a trigger that names its own value — pass `decorative` instead of saying it
 * twice.
 */

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
        <rect
          className="mark"
          x="6.4"
          y="3.6"
          width="1.2"
          height="4.6"
          rx="0.6"
        />
        <circle className="mark" cx="7" cy="10.1" r="0.85" />
      </svg>
    );
  }

  if (props.priority === "none") {
    return (
      <svg
        className="priority-glyph none"
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
      className={props.small ? "priority-chip small" : "priority-chip"}
      {...naming}
    >
      {props.priority.toUpperCase()}
    </span>
  );
}
