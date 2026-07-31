/**
 * What one board card says: the two lines of copy that differ between a ticket
 * that read and a file that would not.
 *
 * Separate from the component because it is the card's only decision, and the
 * only part of it worth reading on its own. It falls out of that separation that
 * a card presents itself exactly once per render, which is what lets
 * `Board.test.tsx` assert that a change to one ticket re-renders one card.
 */

import type { TicketRow } from "./types";

export interface CardCopy {
  title: string;
  meta: string;
}

/** A file that will not parse still belongs to the project, so it still reads. */
export function presentCard(ticket: TicketRow): CardCopy {
  if (ticket.state === "degraded") {
    return {
      title: ticket.relativePath,
      meta: ticket.readOnly ? "newer format" : "needs repair",
    };
  }
  return {
    title: ticket.title,
    meta: `${ticket.priority} · ${ticket.checkedCount}/${ticket.checklistCount}`,
  };
}
