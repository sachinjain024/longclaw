/**
 * What one board card says: the two lines of copy that differ between a ticket
 * that read and a file that would not.
 *
 * Separate from the component because it is the card's only decision, and the
 * only part of it worth reading on its own. It falls out of that separation that
 * a card presents itself exactly once per render, which is what lets
 * `Board.test.tsx` assert that a change to one ticket re-renders one card.
 */

import { hasSecondRow } from "./boardGeometry";
import { resolveLabel, resolveLabels, type ResolvedLabel } from "./labels";
import {
  dueChipText,
  dueRung,
  fromIso,
  readEstimate,
  type DueRung,
  type ReadEstimate,
} from "./properties";
import { checklistFraction } from "./tickets";
import type {
  Label,
  PropertiesConfig,
  TicketPriority,
  TicketRow,
} from "./types";

export interface CardCopy {
  title: string;
  meta: string;
  /** The checklist as a 0–1 ratio, for the meter drawn beside the fraction. */
  progress?: number;
  /** Drawn as its glyph. A file that would not parse has none to draw. */
  priority?: TicketPriority;
  /** Already capped to what the footer holds; a degraded file has none. */
  labels: ResolvedLabel[];
  /**
   * The due date, for the key row. It sits there rather than in the footer
   * because `.card-top` is pinned at 16px and a date is text, so it costs the
   * card no height at all — which is the whole reason a project that enables
   * only Due keeps today's board geometry exactly.
   */
  due?: { text: string; rung: DueRung };
  /**
   * The second footer row, when the ticket has something to put in it. Estimate
   * and type only: the due is in the key row, so a project with Due alone never
   * grows this row on any card.
   */
  second?: CardSecondRow;
}

export interface CardSecondRow {
  estimate?: ReadEstimate;
  /** A type renders as a chip, so it resolves the way a label does. */
  type?: ResolvedLabel;
}

/**
 * How many chips the footer holds. It never wraps
 * (`screen-specs.md:155-156`), so the checklist fraction costs a chip.
 */
const CARD_LABEL_LIMIT = 2;
const CARD_LABEL_LIMIT_BESIDE_A_FRACTION = 1;

/**
 * The chip the key row carries, or nothing.
 *
 * **Whenever a due date is defined**, not only when it has escalated: showing
 * only the sharp rungs made presence itself a reading of the rung, and left
 * "where is that date I set" unanswerable without opening the ticket.
 *
 * A value that will not read has no chip. It is still on disk and the panel
 * still shows it — a card is the one surface with no room to explain itself.
 */
function presentDue(
  ticket: TicketRow & { state: "indexed" },
  properties: PropertiesConfig,
  now: number,
): CardCopy["due"] {
  if (!properties.due.enabled || !ticket.due) return undefined;
  const day = fromIso(ticket.due);
  const rung = dueRung(
    ticket.due,
    now,
    properties.due.attentionDays,
    ticket.status,
    Boolean(ticket.archivedAt),
  );
  if (!day || !rung) return undefined;
  return { text: dueChipText(day, now, rung), rung };
}

/** A file that will not parse still belongs to the project, so it still reads. */
export function presentCard(
  ticket: TicketRow,
  definitions: Record<string, Label>,
  properties: PropertiesConfig,
  now: number,
): CardCopy {
  if (ticket.state === "degraded") {
    return {
      title: ticket.relativePath,
      meta: ticket.readOnly ? "newer format" : "needs repair",
      labels: [],
    };
  }
  // Whether there is a fraction is also what decides how many chips fit beside
  // it: the footer never wraps, so the fraction costs a chip.
  const fraction = checklistFraction(ticket);
  return {
    title: ticket.title,
    meta: fraction,
    due: presentDue(ticket, properties, now),
    second: hasSecondRow(ticket, properties)
      ? {
          estimate: properties.estimate.enabled
            ? readEstimate(ticket.estimate, properties.estimate)
            : undefined,
          type:
            properties.type.enabled && ticket.type
              ? resolveLabel(ticket.type, properties.type.values)
              : undefined,
        }
      : undefined,
    progress: fraction
      ? ticket.checkedCount / ticket.checklistCount
      : undefined,
    priority: ticket.priority,
    labels: resolveLabels(
      ticket.labels,
      definitions,
      fraction ? CARD_LABEL_LIMIT_BESIDE_A_FRACTION : CARD_LABEL_LIMIT,
    ),
  };
}
