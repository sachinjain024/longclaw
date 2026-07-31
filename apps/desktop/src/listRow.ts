/**
 * What one list row says.
 *
 * The list row is denser than a board card and says more: it carries its own
 * status dot, because unlike a card it is not standing under a column that names
 * the status, and it carries a relative updated time, because "what exists" is a
 * question about age in a way that "what is in flight" is not
 * (`screen-specs.md:141-146`).
 *
 * Separate from the component for the same reason `boardCard.ts` is: it is the
 * row's only decision, and presenting exactly once per render is what lets
 * `IssueList.test.tsx` assert that a change to one ticket re-renders one row.
 */

import { describeAge } from "./freshness";
import { resolveLabels, type ResolvedLabel } from "./labels";
import type { Label, TicketPriority, TicketRow, TicketStatus } from "./types";

export interface RowCopy {
  /** The title, or the file's path when the file would not read. */
  title: string;
  /** Absent on a degraded row: nothing in the file said what status it had. */
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Already capped to the two the row holds (`screen-specs.md:144`). */
  labels: ResolvedLabel[];
  /** `1/3`, and empty when the ticket has no checklist (`components.md:180`). */
  checklist: string;
  /** Relative, mono, right-aligned. Empty when the date will not parse. */
  updated: string;
  /** Set only for a file that would not read, which shows its name instead. */
  degraded?: { path: string; readOnly: boolean };
}

/** The row holds two chips; unlike the card, nothing competes with them. */
const ROW_LABEL_LIMIT = 2;

export function presentRow(
  ticket: TicketRow,
  definitions: Record<string, Label>,
  now: number,
): RowCopy {
  if (ticket.state === "degraded") {
    return {
      title: ticket.relativePath,
      labels: [],
      checklist: "",
      updated: "",
      degraded: { path: ticket.relativePath, readOnly: ticket.readOnly },
    };
  }
  const updatedAt = Date.parse(ticket.updatedAt);
  return {
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    labels: resolveLabels(ticket.labels, definitions, ROW_LABEL_LIMIT),
    checklist:
      ticket.checklistCount > 0
        ? `${ticket.checkedCount}/${ticket.checklistCount}`
        : "",
    // A date the file wrote in a shape this build cannot read is left blank
    // rather than shown as an invented age.
    updated: Number.isNaN(updatedAt) ? "" : describeAge(updatedAt, now),
  };
}
