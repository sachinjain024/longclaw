import { dueChipText, dueRung, fromIso, type DueRung } from "./properties";
import type { PropertiesConfig, TicketRow } from "./types";

/**
 * The chip a card or list row carries, or nothing.
 *
 * **Whenever a due date is defined**, not only when it has escalated: showing
 * only the sharp rungs made presence itself a reading of the rung, and left
 * "where is that date I set" unanswerable without opening the ticket.
 *
 * A value that will not read has no chip. It is still on disk and the panel
 * still shows it — a card is the one surface with no room to explain itself.
 */
export function presentDue(
  ticket: TicketRow & { state: "indexed" },
  properties: PropertiesConfig,
  now: number,
): { text: string; rung: DueRung } | undefined {
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
