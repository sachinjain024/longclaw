/**
 * What one board card says.
 *
 * Its own module because it is the one thing a card does per render, which makes
 * it the honest place to count renders from: `Board.test.tsx` asserts that a
 * change to one ticket presents one card and not the board.
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
