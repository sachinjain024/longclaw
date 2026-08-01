/**
 * What one board card says: the two lines of copy that differ between a ticket
 * that read and a file that would not.
 *
 * Separate from the component because it is the card's only decision, and the
 * only part of it worth reading on its own. It falls out of that separation that
 * a card presents itself exactly once per render, which is what lets
 * `Board.test.tsx` assert that a change to one ticket re-renders one card.
 */

import { resolveLabels, type ResolvedLabel } from "./labels";
import { checklistFraction } from "./tickets";
import type { Label, TicketPriority, TicketRow } from "./types";

export interface CardCopy {
  title: string;
  meta: string;
  /** Drawn as its glyph. A file that would not parse has none to draw. */
  priority?: TicketPriority;
  /** Already capped to what the footer holds; a degraded file has none. */
  labels: ResolvedLabel[];
}

/**
 * How many chips the footer holds. It never wraps
 * (`screen-specs.md:121-122`), so the checklist fraction costs a chip.
 */
const CARD_LABEL_LIMIT = 2;
const CARD_LABEL_LIMIT_BESIDE_A_FRACTION = 1;

/** A file that will not parse still belongs to the project, so it still reads. */
export function presentCard(
  ticket: TicketRow,
  definitions: Record<string, Label>,
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
    priority: ticket.priority,
    labels: resolveLabels(
      ticket.labels,
      definitions,
      fraction ? CARD_LABEL_LIMIT_BESIDE_A_FRACTION : CARD_LABEL_LIMIT,
    ),
  };
}
