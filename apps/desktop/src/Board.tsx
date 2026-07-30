/**
 * The status board: one column per status, plus a column for files this build
 * cannot read, because a ticket that will not parse still belongs to the project.
 */

import { acknowledgement, isFresh } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import { STATUSES } from "./tickets";
import type { TicketRow, TicketStatus } from "./types";

export function ticketStatus(ticket: TicketRow): TicketStatus | "unreadable" {
  return ticket.state === "indexed" ? ticket.status : "unreadable";
}

function present(ticket: TicketRow) {
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

export function Board(props: {
  tickets: TicketRow[];
  selectedKey?: string;
  marks: ExternalMarks;
  now: number;
  onSelect: (key: string) => void;
}) {
  const unreadable = props.tickets.filter(
    (ticket) => ticketStatus(ticket) === "unreadable",
  );
  return (
    <div className="board-grid">
      {STATUSES.map((status) => (
        <BoardColumn
          key={status.id}
          title={status.label}
          tickets={props.tickets.filter(
            (ticket) => ticketStatus(ticket) === status.id,
          )}
          selectedKey={props.selectedKey}
          marks={props.marks}
          now={props.now}
          onSelect={props.onSelect}
        />
      ))}
      {unreadable.length > 0 && (
        <BoardColumn
          title="Unreadable"
          tickets={unreadable}
          selectedKey={props.selectedKey}
          marks={props.marks}
          now={props.now}
          onSelect={props.onSelect}
        />
      )}
    </div>
  );
}

function BoardColumn(props: {
  title: string;
  tickets: TicketRow[];
  selectedKey?: string;
  marks: Record<string, ExternalMark>;
  now: number;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="board-column">
      <h3>
        {props.title}
        <span>{props.tickets.length}</span>
      </h3>
      {props.tickets.map((ticket) => (
        <BoardCard
          key={ticket.key}
          ticket={ticket}
          selected={ticket.key === props.selectedKey}
          mark={props.marks[ticket.key]}
          now={props.now}
          onSelect={props.onSelect}
        />
      ))}
    </section>
  );
}

/**
 * One board card. A change that came from disk wears the acknowledgement — the
 * ring, the pulse dot, and a footer naming the actor the file recorded — until a
 * human opens the ticket or the window passes.
 */
function BoardCard(props: {
  ticket: TicketRow;
  selected: boolean;
  mark?: ExternalMark;
  now: number;
  onSelect: (key: string) => void;
}) {
  const { ticket, mark } = props;
  const row = present(ticket);
  const fresh = isFresh(mark, props.now);
  return (
    <button
      className={[
        "ticket-row",
        props.selected ? "selected" : "",
        ticket.state === "degraded" ? "degraded" : "",
        fresh ? "fresh" : "",
        fresh && mark?.actorType === "human" ? "human-fresh" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-ticket-key={ticket.key}
      onClick={() => props.onSelect(ticket.key)}
    >
      <span className="ticket-key">
        {ticket.key}
        {fresh && <span className="pulse-dot" aria-hidden="true" />}
      </span>
      <strong>{row.title}</strong>
      <span className="ticket-meta">{row.meta}</span>
      {fresh && mark && (
        <span className="actor">{acknowledgement(mark, props.now)}</span>
      )}
    </button>
  );
}
