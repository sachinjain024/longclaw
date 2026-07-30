/**
 * Ticket vocabulary shared by the board, the panel, and creation.
 *
 * The status set is fixed in v0 (ADR 0002), so the order here is the order every
 * surface uses.
 */

import type { TicketStatus } from "./types";

export const STATUSES: { id: TicketStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
  { id: "canceled", label: "Canceled" },
];

/**
 * One checklist item per typed line, with an optional Markdown task prefix
 * accepted so pasting a list from anywhere works.
 */
export function checklistFromLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim())
    .filter(Boolean);
}
