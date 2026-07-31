/**
 * The status dot, from `components.md` § Status and the `status` note in
 * `tokens/design-tokens.json`.
 *
 * One geometry for all six statuses: Todo is the unfilled ring the whole set is
 * derived from, Backlog is that ring dashed — a dash survives every kind of
 * colour blindness — and everything else is the same circle filled with its own
 * status colour. Done routes to the human accent (D5), which is why the colour is
 * a class rather than a prop: `--lc-status-done` is the only one that follows the
 * theme, and the stylesheet is where that is already known.
 *
 * The dot never appears without its label except on the board, where the column
 * header names it (`tokens/design-tokens.json` § status). Wherever a name already
 * sits beside it — a group header, a menu row, a column header — pass
 * `decorative`; the row is the one place it has to name itself, because a list row
 * shows no status text at all.
 */

import { statusLabel } from "./tickets";
import type { TicketStatus } from "./types";

/** The token suffix: the CSS custom properties are hyphenated, the ids are not. */
function tokenName(status: TicketStatus): string {
  return status.replaceAll("_", "-");
}

export function StatusDot(props: {
  status: TicketStatus;
  /** 13px rather than 14px, the size a list row uses. */
  small?: boolean;
  decorative?: boolean;
}) {
  const naming = props.decorative
    ? { "aria-hidden": true as const }
    : {
        role: "img",
        "aria-label": `Status: ${statusLabel(props.status)}`,
      };
  const size = props.small ? 13 : 14;
  const open = props.status === "todo" || props.status === "backlog";

  return (
    <svg
      className={`status-dot status-${tokenName(props.status)}`}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...naming}
    >
      <circle
        cx="7"
        cy="7"
        r={open ? 4.4 : 4.6}
        fill={open ? "none" : "currentColor"}
        stroke={open ? "currentColor" : "none"}
        strokeWidth={open ? 1.6 : 0}
        strokeDasharray={props.status === "backlog" ? "2.1 1.7" : undefined}
      />
    </svg>
  );
}
