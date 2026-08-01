/**
 * The `S`/`P` menu, anchored to a focused card or row.
 *
 * Both surfaces grew the same four steps — find the ticket by key, refuse a
 * degraded one, pick the option list, hand the anchor to `Menu` — and when they
 * were written twice they modelled it twice: the board kept two parallel pieces
 * of state and the list kept one. One shape, here, so `S` on a card and `S` on a
 * row cannot drift apart.
 *
 * It writes nothing. The pick is raised to `App`, which owns `mutate()`.
 */

import { Menu } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import type {
  IndexedTicket,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

/** Which field the single-key press opened. `S` → status, `P` → priority. */
export type MetaField = "status" | "priority";

/** The ticket a menu is open on, if one is. Nothing more is needed to reopen it. */
export type MetaMenuTarget = { key: string; field: MetaField };

/**
 * Reads the key a single-key press should act on: the card the key was pressed
 * on, not the one the last render believed was focused.
 */
export function metaFieldFor(key: string): MetaField | undefined {
  const pressed = key.toLowerCase();
  if (pressed === "s") return "status";
  if (pressed === "p") return "priority";
  return undefined;
}

export function TicketMetaMenu(props: {
  target: MetaMenuTarget;
  /** Every row the surface holds. A degraded one has no value to change. */
  tickets: TicketRow[];
  /** The card or row the menu hangs off, and the element focus returns to. */
  anchor: HTMLElement | null;
  onChangeStatus: (ticket: IndexedTicket, next: TicketStatus) => void;
  onChangePriority: (ticket: IndexedTicket, next: TicketPriority) => void;
  onClose: () => void;
}) {
  const ticket = props.tickets.find(
    (candidate) => candidate.key === props.target.key,
  );
  if (ticket?.state !== "indexed") return null;
  const status = props.target.field === "status";

  return (
    <Menu
      label={status ? "Status" : "Priority"}
      options={status ? STATUS_OPTIONS : PRIORITY_OPTIONS}
      selected={[ticket[props.target.field]]}
      anchor={props.anchor}
      onPick={(next) => {
        if (status) props.onChangeStatus(ticket, next as TicketStatus);
        else props.onChangePriority(ticket, next as TicketPriority);
      }}
      onClose={props.onClose}
    />
  );
}
