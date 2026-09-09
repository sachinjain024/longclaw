/**
 * What one list row says.
 *
 * The list row is denser than a board card and says more: it carries its own
 * status dot, because unlike a card it is not standing under a column that names
 * the status, and the due date when the project enables it (LC-227).
 *
 * Separate from the component for the same reason `boardCard.ts` is: it is the
 * row's only decision, and presenting exactly once per render is what lets
 * `IssueList.test.tsx` assert that a change to one ticket re-renders one row.
 */

import { presentDue } from "./dueChip";
import { resolveLabels, type ResolvedLabel } from "./labels";
import { checklistFraction } from "./tickets";
import type {
  Label,
  PropertiesConfig,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

export interface RowCopy {
  /** The title, or the file's path when the file would not read. */
  title: string;
  /** Absent on a degraded row: nothing in the file said what status it had. */
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Already capped to the two the row holds (`screen-specs.md:178`). */
  labels: ResolvedLabel[];
  /** `1/3`, and empty when the ticket has no checklist (`components.md:190`). */
  checklist: string;
  /** The same due-date treatment the board carries. */
  due?: ReturnType<typeof presentDue>;
  /** Set only for a file that would not read, which shows its name instead. */
  degraded?: { path: string; readOnly: boolean };
}

/** The row holds two chips; unlike the card, nothing competes with them. */
const ROW_LABEL_LIMIT = 2;

export function presentRow(
  ticket: TicketRow,
  definitions: Record<string, Label>,
  properties: PropertiesConfig,
  now: number,
): RowCopy {
  if (ticket.state === "degraded") {
    return {
      title: ticket.relativePath,
      labels: [],
      checklist: "",
      degraded: { path: ticket.relativePath, readOnly: ticket.readOnly },
    };
  }
  return {
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    labels: resolveLabels(ticket.labels, definitions, ROW_LABEL_LIMIT),
    checklist: checklistFraction(ticket),
    due: presentDue(ticket, properties, now),
  };
}
