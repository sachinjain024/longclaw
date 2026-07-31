/**
 * The status board: one column per status, plus one for files this build cannot
 * read, because a ticket that will not parse still belongs to the project.
 *
 * Each column scrolls on its own and renders only the cards its scroll position
 * touches (`screen-specs.md` § Board, `boardGeometry.ts`). A 5,000-ticket board
 * costs about 71 ms a frame to scroll when every card is in the document and
 * about 21 ms when only the visible ones are, so the window is what keeps a large
 * board inside the input-to-paint budget.
 *
 * Windowing takes the cards off the Tab order, so the board carries the roving
 * focus `keyboard-focus-map.md` § Board already asked for: arrows or
 * `j`/`k`/`h`/`l` move a single tab stop through the *visual* order, entering at
 * the first card of the first non-empty column. The focused card stays mounted
 * wherever it has been scrolled to, so a scroll can never silently drop focus
 * onto the body.
 */

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { presentCard } from "./boardCard";
import { cardStrides, columnOffsets, windowFor } from "./boardGeometry";
import { acknowledgement, isFresh, isPulsing } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import { STATUSES } from "./tickets";
import type { TicketRow, TicketStatus } from "./types";

/** Cards rendered beyond each edge of the viewport, so a scroll shows no gap. */
const OVERSCAN = 4;

export function ticketStatus(ticket: TicketRow): TicketStatus | "unreadable" {
  return ticket.state === "indexed" ? ticket.status : "unreadable";
}

interface Column {
  id: string;
  title: string;
  tickets: TicketRow[];
}

/** Where a card sits in the visual order, which is what the arrows follow. */
interface Seat {
  column: number;
  index: number;
}

/** How far one key press travels. Steps, not positions. */
interface Move {
  columns: number;
  cards: number;
}

/** One pass over the tickets rather than one filter per status. */
function layOutColumns(tickets: TicketRow[]): {
  columns: Column[];
  seats: Map<string, Seat>;
} {
  const byStatus = new Map<string, TicketRow[]>(
    STATUSES.map((status) => [status.id, []]),
  );
  const unreadable: TicketRow[] = [];
  for (const ticket of tickets) {
    const status = ticketStatus(ticket);
    if (status === "unreadable") unreadable.push(ticket);
    else byStatus.get(status)?.push(ticket);
  }

  const columns: Column[] = STATUSES.map((status) => ({
    id: status.id,
    title: status.label,
    tickets: byStatus.get(status.id) ?? [],
  }));
  if (unreadable.length > 0) {
    columns.push({
      id: "unreadable",
      title: "Unreadable",
      tickets: unreadable,
    });
  }

  const seats = new Map<string, Seat>();
  columns.forEach((column, columnIndex) =>
    column.tickets.forEach((ticket, index) =>
      seats.set(ticket.key, { column: columnIndex, index }),
    ),
  );
  return { columns, seats };
}

/**
 * The board's keys, from `keyboard-focus-map.md` § Board. The letters are listed
 * there in upper case and matched here in lower, because caps lock or a held
 * shift is still the same key to the person pressing it.
 */
const MOVES: Record<string, Move> = {
  ArrowDown: { columns: 0, cards: 1 },
  ArrowUp: { columns: 0, cards: -1 },
  ArrowRight: { columns: 1, cards: 0 },
  ArrowLeft: { columns: -1, cards: 0 },
  j: { columns: 0, cards: 1 },
  k: { columns: 0, cards: -1 },
  l: { columns: 1, cards: 0 },
  h: { columns: -1, cards: 0 },
};

function moveFor(key: string): Move | undefined {
  return MOVES[key] ?? MOVES[key.toLowerCase()];
}

/** The card a move lands on, or undefined when the move runs off the board. */
function moveTo(columns: Column[], from: Seat, move: Move): string | undefined {
  if (move.columns === 0) {
    return columns[from.column].tickets[from.index + move.cards]?.key;
  }
  // Sideways skips empty columns, because an empty one holds nothing to focus,
  // and clamps into the column it lands in (keyboard-focus-map.md § Board).
  for (
    let column = from.column + move.columns;
    column >= 0 && column < columns.length;
    column += move.columns
  ) {
    const tickets = columns[column].tickets;
    if (tickets.length === 0) continue;
    return tickets[Math.min(from.index, tickets.length - 1)].key;
  }
  return undefined;
}

/** Finds a mounted card by key without building a selector out of one. */
function cardFor(root: HTMLElement | null, key: string) {
  // A degraded row is keyed by its directory name, which nothing has vetted as
  // CSS, so the key is compared rather than interpolated.
  return Array.from(
    root?.querySelectorAll<HTMLElement>(".ticket-row") ?? [],
  ).find((element) => element.dataset.ticketKey === key);
}

export function Board(props: {
  tickets: TicketRow[];
  selectedKey?: string;
  marks: ExternalMarks;
  now: number;
  onSelect: (key: string) => void;
}) {
  const { columns, seats } = useMemo(
    () => layOutColumns(props.tickets),
    [props.tickets],
  );
  const [focusedKey, setFocusedKey] = useState<string>();
  /** Bumped only by a key press, so focus follows the arrows and nothing else. */
  const [focusRequest, setFocusRequest] = useState(0);
  const grid = useRef<HTMLDivElement>(null);

  // A card that was deleted, or that changed status, cannot hold the tab stop.
  const firstKey = columns.find((column) => column.tickets.length > 0)
    ?.tickets[0]?.key;
  const rovingKey =
    focusedKey !== undefined && seats.has(focusedKey) ? focusedKey : firstKey;

  const onFocusCard = useCallback((key: string) => setFocusedKey(key), []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const move = moveFor(event.key);
    if (!move) return;
    // The card the key was pressed on, not the one the last render believed was
    // focused: a click that has not been committed yet would otherwise move the
    // human off a card they are already standing on.
    const on = (event.target as HTMLElement).closest?.(".ticket-row");
    const fromKey = (on as HTMLElement | null)?.dataset.ticketKey ?? rovingKey;
    const from = fromKey === undefined ? undefined : seats.get(fromKey);
    if (!from) return;

    event.preventDefault();
    const next = moveTo(columns, from, move);
    if (next === undefined || next === fromKey) return;
    setFocusedKey(next);
    setFocusRequest((request) => request + 1);
  }

  // The column keeps its focused card mounted wherever it is, so the card the
  // arrows just moved to is always here to be focused and scrolled to.
  useLayoutEffect(() => {
    if (focusRequest === 0 || rovingKey === undefined) return;
    const card = cardFor(grid.current, rovingKey);
    card?.focus();
    card?.scrollIntoView?.({ block: "nearest" });
  }, [focusRequest, rovingKey]);

  const focusSeat = rovingKey === undefined ? undefined : seats.get(rovingKey);
  const openSeat =
    props.selectedKey === undefined ? undefined : seats.get(props.selectedKey);

  return (
    <div className="board-grid" ref={grid} onKeyDown={onKeyDown}>
      {columns.map((column, columnIndex) => (
        <BoardColumn
          key={column.id}
          title={column.title}
          tickets={column.tickets}
          selectedKey={props.selectedKey}
          rovingKey={rovingKey}
          anchors={[focusSeat, openSeat]
            .filter((seat) => seat?.column === columnIndex)
            .map((seat) => (seat as Seat).index)}
          marks={props.marks}
          now={props.now}
          onSelect={props.onSelect}
          onFocusCard={onFocusCard}
        />
      ))}
    </div>
  );
}

/**
 * One column: its own scroll container, sized to the whole column but holding
 * only the cards the scroll position touches, plus its anchors.
 */
function BoardColumn(props: {
  title: string;
  tickets: TicketRow[];
  selectedKey?: string;
  rovingKey?: string;
  /**
   * Indexes of cards that stay mounted wherever they have been scrolled to: the
   * one the human is standing on and the one they have open. Unmounting the
   * focused card mid-scroll would drop focus onto the body without saying so.
   */
  anchors: number[];
  marks: ExternalMarks;
  now: number;
  onSelect: (key: string) => void;
  onFocusCard: (key: string) => void;
}) {
  const stack = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useLayoutEffect(() => {
    const element = stack.current;
    if (!element) return;
    const measure = () => setViewport(element.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const offsets = useMemo(
    () => columnOffsets(cardStrides(props.tickets, props.marks, props.now)),
    [props.tickets, props.marks, props.now],
  );
  const range = windowFor(offsets, scrollTop, viewport, OVERSCAN);

  const shown: number[] = [];
  for (const index of props.anchors) {
    if (index < range.start || index >= range.end) shown.push(index);
  }
  for (let index = range.start; index < range.end; index += 1)
    shown.push(index);
  // Rendered in visual order, so the accessibility tree reads down the column
  // even though an anchor can sit anywhere in it.
  shown.sort((left, right) => left - right);

  return (
    <section className="board-column">
      <h3>
        {props.title}
        <span>{props.tickets.length}</span>
      </h3>
      <div
        className="board-stack"
        ref={stack}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div
          className="board-sizer"
          style={{ height: offsets[offsets.length - 1] }}
        >
          {shown.map((index) => {
            const ticket = props.tickets[index];
            const mark = props.marks[ticket.key];
            return (
              <BoardCard
                key={ticket.key}
                ticket={ticket}
                top={offsets[index]}
                selected={ticket.key === props.selectedKey}
                tabStop={ticket.key === props.rovingKey}
                mark={mark}
                // The acknowledgement clock ticks every second. Handing it to a
                // card with nothing to acknowledge would re-render the column once
                // a second for a number none of those cards read.
                now={mark ? props.now : 0}
                onSelect={props.onSelect}
                onFocusCard={props.onFocusCard}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * One board card. A change that came from disk wears the acknowledgement — the
 * ring, the pulse dot, and a footer naming the actor the file recorded — until a
 * human opens the ticket or the window passes.
 *
 * Memoized on its own ticket, so a change to one ticket re-renders one card and
 * not the column around it — the isolated subscription ADR 0006 wants, at the
 * card. React keys the card by ticket key, so a card scrolled out and back is the
 * same row remounting rather than a recycled node inheriting another ticket's
 * acknowledgement; `isPulsing` is what stops the remount replaying the pulse.
 */
const BoardCard = memo(function BoardCard(props: {
  ticket: TicketRow;
  top: number;
  selected: boolean;
  tabStop: boolean;
  mark?: ExternalMark;
  now: number;
  onSelect: (key: string) => void;
  onFocusCard: (key: string) => void;
}) {
  const { ticket, mark } = props;
  const row = presentCard(ticket);
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
      style={{ top: props.top }}
      data-ticket-key={ticket.key}
      tabIndex={props.tabStop ? 0 : -1}
      onClick={() => props.onSelect(ticket.key)}
      onFocus={() => props.onFocusCard(ticket.key)}
    >
      <span className="ticket-key">
        {ticket.key}
        {fresh && (
          <span
            className={
              isPulsing(mark, props.now) ? "pulse-dot pulsing" : "pulse-dot"
            }
            aria-hidden="true"
          />
        )}
      </span>
      <strong>{row.title}</strong>
      <span className="ticket-meta">{row.meta}</span>
      {fresh && mark && (
        <span className="actor">{acknowledgement(mark, props.now)}</span>
      )}
    </button>
  );
});
