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
 *
 * The tab stop itself is `useRovingFocus` (`rovingFocus.ts`), shared with the
 * list. What is the board's own is that a move here has two dimensions.
 *
 * ## Dragging over a windowed column
 *
 * Dragging is native HTML5 drag events rather than a library: the whole of it is
 * the four handlers below, and a drag library would be a new transitive
 * dependency for a feature whose hard part it does not solve anyway.
 *
 * A drop means one of two things, and which one it is comes from where the card
 * lands rather than from anything the human has to choose first:
 *
 * - **Into another column** it is a status change, the same write the `S` menu
 *   makes. Both orders have it, because a status is project data and Priority is
 *   a view preference (LC-60).
 * - **Inside its own column** it is a rank, which is Manual's alone (ADR 0003).
 *   In Priority a card's own column takes no drop at all, so the pointer says so
 *   rather than the card sliding back with nothing written.
 *
 * In Manual the two are one write: a card arriving in a column is given a place in
 * it, so the drop lands where it was let go rather than wherever the card's old
 * rank happens to sort.
 *
 * The hard part is that most of the column is not in the document. So a drop is
 * never read off the element under the pointer — `gapAt` in `boardGeometry.ts`
 * turns the pointer's offset into the sizer into a gap index over the same
 * offsets the window is cut from, which answers for a card 3,000 rows below the
 * viewport exactly as it answers for the one under the pointer. Reaching that
 * position is the other half: hanging the drag near either edge of the column
 * scrolls it, on an animation frame, for as long as the pointer stays there.
 *
 * A drop is a mutation and the board holds no project id, so it is raised as
 * `onMoveCard` and written in `App.tsx`, beside `changePriority`.
 *
 * There is no keyboard equivalent, deliberately: `keyboard-focus-map.md:158-161`
 * puts reordering within a column outside v0 and names `S` — the status move —
 * as the keyboard path that exists for the column a ticket is in.
 */

import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, RefObject } from "react";
import { presentCard } from "./boardCard";
import {
  CARD_GAP,
  cardStrides,
  gapAt,
  runningOffsets,
  windowFor,
} from "./boardGeometry";
import { classes } from "./classes";
import { acknowledgement, isFresh } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import {
  groupByStatus,
  seatsFor,
  type Seat,
  type StatusGroup,
} from "./grouping";
import { singleKeyShortcutAllowed } from "./keyContext";
import { LabelChip } from "./LabelChip";
import {
  comparatorFor,
  rankForDrop,
  rankForInsert,
  type OrderingMode,
} from "./ordering";
import { PriorityGlyph } from "./PriorityGlyph";
import { PulseDot } from "./PulseDot";
import { itemFor, moveFor, useRovingFocus } from "./rovingFocus";
import type { FocusRequest } from "./rovingFocus";
import { StatusDot } from "./StatusDot";
import {
  metaFieldFor,
  TicketMetaMenu,
  type MetaMenuTarget,
} from "./TicketMetaMenu";
import type {
  IndexedTicket,
  Label,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";
import { useViewportHeight } from "./viewportHeight";

/** Cards rendered beyond each edge of the viewport, so a scroll shows no gap. */
const OVERSCAN = 4;

/**
 * How close to an edge a drag has to hang before the scroller under it moves,
 * and how far it travels each frame. A drop position off screen has to be
 * reachable — down a column that is taller than the window, and across a board
 * that is wider than it.
 */
const AUTO_SCROLL_EDGE = 44;
const AUTO_SCROLL_STEP = 14;

/** -1 near the low edge of a box, 1 near the high one, 0 anywhere between. */
function towardsEdge(position: number, low: number, high: number): number {
  if (position > high - AUTO_SCROLL_EDGE) return 1;
  if (position < low + AUTO_SCROLL_EDGE) return -1;
  return 0;
}

/**
 * Scrolls a container for as long as a drag hangs near its edge, one animation
 * frame at a time. Both scrollers on the board need it and neither can reach a
 * position off screen without it: the columns down, the grid across.
 *
 * Stepping once when the drift starts rather than waiting for the first frame
 * is also what makes the edge feel like it responded.
 */
function useEdgeDrift(
  target: RefObject<HTMLDivElement | null>,
  axis: "scrollTop" | "scrollLeft",
  onScrolled?: (position: number) => void,
): (next: number) => void {
  const drift = useRef(0);
  const frame = useRef(0);

  function step() {
    frame.current = 0;
    const element = target.current;
    if (!element || drift.current === 0) return;
    element[axis] += drift.current * AUTO_SCROLL_STEP;
    onScrolled?.(element[axis]);
    frame.current = requestAnimationFrame(step);
  }

  return function driftBy(next: number) {
    drift.current = next;
    if (next === 0 || frame.current !== 0) return;
    step();
  };
}

/** How far one key press travels. Steps, not positions. */
interface Move {
  columns: number;
  cards: number;
}

/**
 * What letting go of a card asks for: the column it landed in when that is not
 * the one it came from, the place it took in that column when the board is in
 * Manual, or both. Never neither — a drop that would write nothing is refused
 * before it is raised.
 */
export interface BoardMove {
  status?: TicketStatus;
  rank?: string;
}

/**
 * What one column is doing about the drag in flight. Present only on a column
 * the card could actually land in, which is what `dragover` answers with.
 */
interface ColumnDrop {
  /** Where the line goes, when a position in this column is being chosen. */
  gap?: number;
  /** True while the pointer is here and the card would arrive from elsewhere. */
  incoming: boolean;
}

/**
 * The board's columns. Bucketing and ordering are shared with the list
 * (`grouping.ts`); what is the board's own is that every status keeps a column
 * whether or not it holds anything — the fixed v0 set is the scaffold (ADR 0002).
 */
function layOutColumns(
  tickets: TicketRow[],
  ordering: OrderingMode,
  scaffold: boolean,
): {
  columns: StatusGroup[];
  seats: Map<string, Seat>;
} {
  const columns = groupByStatus(tickets, {
    compare: comparatorFor(ordering),
    keepEmpty: scaffold,
  });
  return { columns, seats: seatsFor(columns) };
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

/** The card a move lands on, or undefined when the move runs off the board. */
function moveTo(
  columns: StatusGroup[],
  from: Seat,
  move: Move,
): string | undefined {
  if (move.columns === 0) {
    return columns[from.group].tickets[from.index + move.cards]?.key;
  }
  // Sideways skips empty columns, because an empty one holds nothing to focus,
  // and clamps into the column it lands in (keyboard-focus-map.md § Board).
  for (
    let column = from.group + move.columns;
    column >= 0 && column < columns.length;
    column += move.columns
  ) {
    const tickets = columns[column].tickets;
    if (tickets.length === 0) continue;
    return tickets[Math.min(from.index, tickets.length - 1)].key;
  }
  return undefined;
}

/** The class a card wears, which is also how the roving focus finds one. */
const CARD = ".ticket-row";

export function Board(props: {
  tickets: TicketRow[];
  selectedKey?: string;
  marks: ExternalMarks;
  /** The project's label definitions, for the chips a card's slugs resolve to. */
  labels: Record<string, Label>;
  /** Priority or Manual: a device-local view preference, never project data. */
  ordering: OrderingMode;
  /**
   * Whether to keep a column for a status holding nothing — the fixed v0 set as
   * a scaffold (ADR 0002), which is the board's default and the point of it.
   * `App.tsx` drops it in exactly one case: a filter that matched nothing, where
   * six empty columns would be the empty board the designed state replaces.
   */
  scaffold?: boolean;
  now: number;
  onSelect: (key: string) => void;
  /** Raised by the `P` menu. The board holds no project id and writes nothing. */
  onChangePriority: (ticket: IndexedTicket, next: TicketPriority) => void;
  /** Raised by the `S` menu, on the same terms. */
  onChangeStatus: (ticket: IndexedTicket, next: TicketStatus) => void;
  /**
   * Raised by a drop: a column, a place in one, or both. The rank is allocated
   * here — LongClaw owns rank allocation in v0 — and the write is App's.
   */
  onMoveCard: (ticket: IndexedTicket, move: BoardMove) => void;
  /**
   * Raised by a column's `+`, with that column's status
   * (`keyboard-focus-map.md:44`). The board opens no surface of its own; App
   * decides that a create preseeded with a status is quick create.
   */
  onCreateInStatus: (status: TicketStatus) => void;
  /**
   * Focus a card from outside the board — the new card after a create, the card
   * behind a closing panel. It goes through the roving focus rather than the DOM
   * because a card past the window is not in the DOM to be focused.
   */
  focusRequest?: FocusRequest;
}) {
  const scaffold = props.scaffold ?? true;
  const { columns, seats } = useMemo(
    () => layOutColumns(props.tickets, props.ordering, scaffold),
    [props.tickets, props.ordering, scaffold],
  );
  /** The card whose `S`/`P` menu is open, and which of the two it is. */
  const [metaMenu, setMetaMenu] = useState<MetaMenuTarget>();
  /** The card being dragged, and which gap of which column it is hanging over. */
  const [dragKey, setDragKey] = useState<string>();
  const [hover, setHover] = useState<{ column: number; gap: number }>();
  const grid = useRef<HTMLDivElement>(null);
  /**
   * The board is wider than the window — six columns of 264px — so a drag has
   * to be able to reach a column that is off the side of it, the same way it
   * reaches a card below the fold.
   */
  const driftAcross = useEdgeDrift(grid, "scrollLeft");

  const {
    rovingKey,
    onFocusItem: onFocusCard,
    requestFocus,
  } = useRovingFocus({
    seats,
    firstKey: columns.find((column) => column.tickets.length > 0)?.tickets[0]
      ?.key,
    root: grid,
    selector: CARD,
    request: props.focusRequest,
  });

  // Stable, so `draggable` and its two handlers cost the memoized cards nothing:
  // a card re-renders during a drag only because it is the one being dragged.
  const onDragCard = useCallback((key?: string) => {
    setDragKey(key);
    if (key === undefined) setHover(undefined);
  }, []);

  function ticketAt(seat: Seat): TicketRow {
    return columns[seat.group].tickets[seat.index];
  }

  /** The seat the dragged card came from, which is what a drop is read against. */
  const dragSeat = dragKey === undefined ? undefined : seats.get(dragKey);
  /** Whether a place inside a column is a thing this board can write (ADR 0003). */
  const placesByHand = props.ordering === "manual";

  /**
   * Whether letting go over this column would write anything.
   *
   * Every column a status names takes a card from another one: that drop is a
   * status change. A card's own column takes it back only in Manual, where a
   * place in the column is a thing to write; in Priority there is nothing a
   * drop there could mean. The synthetic unreadable column names no status, so
   * nothing lands in it — there would be no field to write.
   */
  function accepts(columnIndex: number): boolean {
    if (dragSeat === undefined) return false;
    if (columns[columnIndex].status === undefined) return false;
    return dragSeat.group !== columnIndex || placesByHand;
  }

  /**
   * Where the pointer is now. `dragover` fires many times a second, and the
   * position is the same for most of them, so the same position keeps the same
   * object: React bails out of the render, exactly as it did when this was a
   * bare gap index and nothing but the column's own board changed.
   */
  function onDragOverGap(columnIndex: number, gap: number) {
    setHover((current) =>
      current?.column === columnIndex && current.gap === gap
        ? current
        : { column: columnIndex, gap },
    );
  }

  /** What a column is doing about the drag, for the column to render. */
  function dropFor(columnIndex: number): ColumnDrop | undefined {
    if (!accepts(columnIndex)) return undefined;
    const over = hover?.column === columnIndex ? hover : undefined;
    return {
      // The line is where the card would sit, so it is only drawn where the
      // position is being chosen: in Priority the column decides, not the gap.
      gap: over && placesByHand ? over.gap : undefined,
      incoming: over !== undefined && dragSeat?.group !== columnIndex,
    };
  }

  function onDrop(columnIndex: number, gap: number) {
    const column = columns[columnIndex];
    const moving = dragSeat === undefined ? undefined : ticketAt(dragSeat);
    const from = dragSeat?.group;
    onDragCard(undefined);
    if (!moving || moving.state !== "indexed" || !accepts(columnIndex)) return;

    if (from === columnIndex) {
      // Back in its own column: a place in it, and only in Manual (ADR 0003).
      const rank = rankForDrop(column.tickets, moving.key, gap);
      if (rank !== undefined) props.onMoveCard(moving, { rank });
      return;
    }

    props.onMoveCard(moving, {
      status: column.status,
      // Priority allocates no rank, here as anywhere: the order inside the new
      // column is not something the human chose by dropping into it (ADR 0003).
      ...(placesByHand ? { rank: rankForInsert(column.tickets, gap) } : {}),
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // The open menu owns the keys it handles; the board must not also move focus
    // out from under it.
    if (event.defaultPrevented) return;
    if (!singleKeyShortcutAllowed(event.target)) return;
    // The card the key was pressed on, not the one the last render believed was
    // focused: a click that has not been committed yet would otherwise move the
    // human off a card they are already standing on.
    const on = (event.target as HTMLElement).closest?.(CARD);
    // Only a card, or the grid itself, is standing anywhere the board's keys
    // mean something. A key pressed on a control inside the grid — a column's
    // `+` today — belongs to that control, and falling back to the roving key
    // would move focus, or open a menu, on whatever card was last left behind.
    if (!on && event.target !== grid.current) return;
    const fromKey = (on as HTMLElement | null)?.dataset.ticketKey ?? rovingKey;
    const from = fromKey === undefined ? undefined : seats.get(fromKey);
    if (!from || fromKey === undefined) return;

    const field = metaFieldFor(event.key);
    if (field) {
      // Inert on a file that would not read: there is no field to write to
      // (`keyboard-focus-map.md:48`).
      if (ticketAt(from).state !== "indexed") return;
      event.preventDefault();
      setMetaMenu({ key: fromKey, field });
      return;
    }

    const move = moveFor(MOVES, event.key);
    if (!move) return;

    event.preventDefault();
    const next = moveTo(columns, from, move);
    if (next === undefined || next === fromKey) return;
    requestFocus(next);
  }

  const focusSeat = rovingKey === undefined ? undefined : seats.get(rovingKey);
  const openSeat =
    props.selectedKey === undefined ? undefined : seats.get(props.selectedKey);

  /**
   * `dragstart` bubbles, so the board picks the dragged card up once here rather
   * than handing every card a callback of its own — which is what keeps the card
   * memoized on nothing but its ticket and two booleans.
   */
  function onDragStart(event: DragEvent<HTMLDivElement>) {
    const on = (event.target as HTMLElement).closest?.(".ticket-row");
    const key = (on as HTMLElement | null)?.dataset.ticketKey;
    if (key === undefined) return;
    const seat = seats.get(key);
    // A file this build cannot read has no field to write either half of a move
    // into, which is also why its card is not `draggable` in the first place.
    if (!seat || ticketAt(seat).state !== "indexed") return;
    // WebKit will not start a drag with an empty data transfer.
    event.dataTransfer?.setData("text/plain", key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    setDragKey(key);
  }

  /**
   * The drag, seen by the board rather than by one column: what carries it
   * across a board wider than the window, and what notices when the pointer is
   * over no column at all.
   *
   * `dragover` reaches here after the column under the pointer has had it, so
   * `defaultPrevented` is exactly the question "did a column take this?" — the
   * gaps between columns, a column header, and a column that refuses the drop
   * all leave it alone, and none of them should leave a column lit up.
   */
  function onGridDragOver(event: DragEvent<HTMLDivElement>) {
    if (dragKey === undefined) return;
    if (!event.defaultPrevented) setHover(undefined);
    const box = grid.current?.getBoundingClientRect();
    if (box) driftAcross(towardsEdge(event.clientX, box.left, box.right));
  }

  return (
    <div
      className="board-grid"
      ref={grid}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragOver={onGridDragOver}
      // The columns stop their own drift; this one belongs to the board, so it
      // is stopped where the drag ends however it ended — dropped on a column,
      // let go over nothing, or taken off the board entirely. Leaving *for a
      // column* is not leaving: `dragleave` fires on the way into every child,
      // and stopping there would stutter the scroll it is meant to carry.
      onDragLeave={(event) => {
        const to = event.relatedTarget as Node | null;
        if (!to || !grid.current?.contains(to)) driftAcross(0);
      }}
      onDragEnd={() => driftAcross(0)}
      onDrop={() => driftAcross(0)}
    >
      {columns.map((column, columnIndex) => (
        <BoardColumn
          key={column.id}
          title={column.title}
          status={column.status}
          tickets={column.tickets}
          selectedKey={props.selectedKey}
          rovingKey={rovingKey}
          anchors={[focusSeat, openSeat]
            .filter((seat) => seat?.group === columnIndex)
            .map((seat) => (seat as Seat).index)}
          marks={props.marks}
          labels={props.labels}
          now={props.now}
          dragKey={dragSeat?.group === columnIndex ? dragKey : undefined}
          drop={dropFor(columnIndex)}
          onCreate={props.onCreateInStatus}
          onSelect={props.onSelect}
          onFocusCard={onFocusCard}
          onDragCard={onDragCard}
          onDragOverGap={(gap) => onDragOverGap(columnIndex, gap)}
          onDropCard={(gap) => onDrop(columnIndex, gap)}
        />
      ))}
      {metaMenu && (
        <TicketMetaMenu
          target={metaMenu}
          tickets={props.tickets}
          anchor={itemFor(grid.current, CARD, metaMenu.key) ?? null}
          onChangeStatus={props.onChangeStatus}
          onChangePriority={props.onChangePriority}
          onClose={() => {
            setMetaMenu(undefined);
            // A pick re-sorts the column, so the card is asked for by key again
            // rather than left to whatever node the menu was hanging off.
            requestFocus();
          }}
        />
      )}
    </div>
  );
}

/**
 * One column: its own scroll container, sized to the whole column but holding
 * only the cards the scroll position touches, plus its anchors.
 */
function BoardColumn(props: {
  title: string;
  /** Absent on the synthetic unreadable column, which no status names. */
  status?: TicketStatus;
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
  labels: Record<string, Label>;
  now: number;
  /** The card being dragged, when it is one of this column's. */
  dragKey?: string;
  /** What this column would do with the drag, or nothing if it takes no drop. */
  drop?: ColumnDrop;
  /** Raised by the header's `+`, with this column's status. */
  onCreate: (status: TicketStatus) => void;
  onSelect: (key: string) => void;
  onFocusCard: (key: string) => void;
  onDragCard: (key?: string) => void;
  onDragOverGap: (gap: number) => void;
  onDropCard: (gap: number) => void;
}) {
  const stack = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useViewportHeight(stack);
  /** A drag hanging at the top or bottom of the column keeps it scrolling. */
  const driftBy = useEdgeDrift(stack, "scrollTop", setScrollTop);

  const offsets = useMemo(
    () => runningOffsets(cardStrides(props.tickets, props.marks, props.now)),
    [props.tickets, props.marks, props.now],
  );
  const range = windowFor(offsets, scrollTop, viewport, OVERSCAN);

  /** The gap under the pointer, measured against the sizer the cards sit in. */
  function gapUnder(event: DragEvent<HTMLDivElement>): number {
    const top = sizer.current?.getBoundingClientRect().top ?? 0;
    return gapAt(offsets, event.clientY - top);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (props.drop === undefined) return;
    // Accepting the drop, which is what `preventDefault` means here. A column
    // that has no `drop` refuses it by leaving the event alone, and the pointer
    // says so rather than the card sliding back with nothing written.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    props.onDragOverGap(gapUnder(event));

    const box = stack.current?.getBoundingClientRect();
    if (box) driftBy(towardsEdge(event.clientY, box.top, box.bottom));
  }

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
    <section
      className={classes(
        "board-column",
        // Two things, because they happen at different moments: the column opens
        // up as soon as a card it could take is in the air, and lights up when
        // the pointer is actually over it.
        props.drop && "drop-open",
        props.drop?.incoming && "drop-target",
      )}
    >
      {/* The `+` is the heading's sibling rather than its child, though it sits
          on the same line: a heading's accessible name is its text, and a button
          inside it would rename every column to "Todo 4 New ticket in Todo" for
          anyone moving through the board by heading. */}
      <div className="board-column-head">
        <h3>
          {/* The dot the status wears everywhere; the header beside it names it,
              which is the one place the dot is allowed to go unlabelled. */}
          {props.status && <StatusDot status={props.status} decorative />}
          {props.title}
          <span>{props.tickets.length}</span>
        </h3>
        {/* The column's own control, revealed on hover or focus (prototype.css
            `.col-add`). The synthetic unreadable column has none: it names no
            status, so there is nothing a create here could be preseeded with. */}
        {props.status && (
          <ColumnAdd
            title={props.title}
            status={props.status}
            onCreate={props.onCreate}
          />
        )}
      </div>
      <div
        className="board-stack"
        ref={stack}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onDragOver={onDragOver}
        onDragLeave={() => driftBy(0)}
        // `dragend` bubbles from the card, which is why the card itself carries
        // no handler: a per-card callback would change identity on every scroll
        // and un-memoize the whole column.
        onDragEnd={() => {
          driftBy(0);
          props.onDragCard(undefined);
        }}
        onDrop={(event) => {
          if (props.drop === undefined) return;
          event.preventDefault();
          const gap = gapUnder(event);
          driftBy(0);
          props.onDropCard(gap);
        }}
      >
        <div
          className="board-sizer"
          ref={sizer}
          style={{ height: offsets[offsets.length - 1] }}
        >
          {props.drop?.gap !== undefined && (
            <div
              className="drop-line"
              aria-hidden="true"
              style={{
                top: Math.max(0, offsets[props.drop.gap] - CARD_GAP / 2),
              }}
            />
          )}
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
                labels={props.labels}
                // The acknowledgement clock ticks every second. Handing it to a
                // card with nothing to acknowledge would re-render the column once
                // a second for a number none of those cards read.
                now={mark ? props.now : 0}
                // A file this build cannot read has no frontmatter to write a
                // status or a rank into, so it is not draggable — the same
                // reason `P` is inert on one (`keyboard-focus-map.md:48`).
                draggable={ticket.state === "indexed"}
                dragging={ticket.key === props.dragKey}
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
 * A column header's `+`: quick create, preseeded with that column's status
 * (`screen-specs.md` § Board, `keyboard-focus-map.md:44`).
 *
 * It is named for the column rather than labelled `+`, because six of these sit
 * on the board and "New ticket" six times over says nothing about which one was
 * reached. The tooltip and the accessible name are the same sentence.
 */
function ColumnAdd(props: {
  title: string;
  status: TicketStatus;
  onCreate: (status: TicketStatus) => void;
}) {
  const name = `New ticket in ${props.title}`;
  return (
    <button
      type="button"
      className="column-add"
      tabIndex={0}
      title={name}
      aria-label={name}
      onClick={() => props.onCreate(props.status)}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d="M7 2.5 V11.5 M2.5 7 H11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
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
  labels: Record<string, Label>;
  now: number;
  /** True on a card with frontmatter to write a move into. */
  draggable: boolean;
  dragging: boolean;
  onSelect: (key: string) => void;
  onFocusCard: (key: string) => void;
}) {
  const { ticket, mark } = props;
  const row = presentCard(ticket, props.labels);
  const fresh = isFresh(mark, props.now);
  return (
    <button
      className={classes(
        "ticket-row",
        props.selected && "selected",
        ticket.state === "degraded" && "degraded",
        fresh && "fresh",
        fresh && mark?.actorType === "human" && "human-fresh",
        props.draggable && "draggable",
        props.dragging && "dragging",
      )}
      style={{ top: props.top }}
      data-ticket-key={ticket.key}
      draggable={props.draggable}
      tabIndex={props.tabStop ? 0 : -1}
      onClick={() => props.onSelect(ticket.key)}
      onFocus={() => props.onFocusCard(ticket.key)}
    >
      <span className="card-top">
        <span className="ticket-key">
          {ticket.key}
          {fresh && <PulseDot mark={mark} now={props.now} />}
        </span>
        {row.priority && <PriorityGlyph priority={row.priority} small />}
      </span>
      <strong>{row.title}</strong>
      <span className="ticket-meta">
        {row.meta && <span className="fraction">{row.meta}</span>}
        {row.progress !== undefined && (
          <span className="progress" aria-hidden="true">
            <i style={{ width: `${Math.round(row.progress * 100)}%` }} />
          </span>
        )}
        {row.labels.map((label) => (
          <LabelChip key={label.slug} label={label} small />
        ))}
      </span>
      {fresh && mark && (
        <span className="actor">{acknowledgement(mark, props.now)}</span>
      )}
    </button>
  );
});
