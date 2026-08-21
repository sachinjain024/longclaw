/**
 * The dense issue list: every ticket in the project, grouped by status.
 *
 * The board answers "what is in flight" and shows six columns whether or not they
 * hold anything. The list answers "what exists": only statuses with tickets get a
 * group (`screen-specs.md:169-170`), Canceled is reliably visible here rather than
 * conditionally on the board, and the archived tickets ADR 0004 keeps off the board
 * get their own collapsed group at the bottom.
 *
 * It is one scroller rather than six, so its geometry is `listGeometry.ts` over the
 * same windowing arithmetic the board uses (`boardGeometry.ts`), and its tab stop is
 * the same `useRovingFocus` (`rovingFocus.ts`) — a move here is one dimension. Group headers are
 * `position: sticky`, which is why the groups are laid out in the scroller's normal
 * flow at stated heights and only the rows inside a body are placed absolutely — a
 * sticky element has nothing to stick to inside an absolutely positioned parent.
 *
 * **Dragging** is the board's gesture on this surface's axis (LC-60): a row into
 * another group is a status change, a row moved inside its group in Manual is a
 * rank, and what a drop writes is `ticketMove.ts` for both surfaces rather than
 * a second opinion here. `screen-specs.md` § Issue list originally gave the list
 * no drag affordance because a 36px row has no room for a handle — which is
 * still true, and why the affordance is the grab cursor. The archived group is
 * the one group that neither takes a drop nor gives one: archiving is a date and
 * not a status (ADR 0004).
 *
 * **Roles.** A row is one activation target that opens the panel, not a grid of
 * navigable cells, so this is a `section` per group with a heading that carries the
 * count — exactly the board's contract, and for the same reason. `role="table"` or
 * `role="grid"` would promise cell navigation this surface does not implement and
 * would need `aria-rowcount`/`aria-rowindex` bookkeeping against a DOM that holds
 * only a window of the rows. The count in the heading is what tells a screen-reader
 * user how big a group is when only twenty of its rows exist.
 */

import { memo, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { acknowledgementClass } from "./attribution";
import { windowFor } from "./boardGeometry";
import { classes } from "./classes";
import { pickUp, towardsEdge, useEdgeDrift } from "./dragging";
import { isAcknowledged } from "./acknowledgement";
import type { ExternalMark, ExternalMarks } from "./acknowledgement";
import {
  groupByStatus,
  seatsFor,
  type Seat,
  type StatusGroup,
} from "./grouping";
import { GuideCard } from "./GuideCard";
import { singleKeyShortcutAllowed } from "./keyContext";
import { LabelChip } from "./LabelChip";
import {
  dropAt,
  GROUP_HEADER_HEIGHT,
  groupBodyHeight,
  listGeometry,
  rowTop,
} from "./listGeometry";
import { presentRow } from "./listRow";
import { comparatorFor, orderColumn, type OrderingMode } from "./ordering";
import { PriorityGlyph } from "./PriorityGlyph";
import { PulseDot } from "./PulseDot";
import { itemFor, moveFor, useRovingFocus } from "./rovingFocus";
import type { FocusRequest } from "./rovingFocus";
import { StatusDot } from "./StatusDot";
import { isArchived } from "./tickets";
import {
  opensContextMenu,
  TicketContextMenu,
  useTicketContextMenu,
} from "./TicketContextMenu";
import {
  metaFieldFor,
  TicketMetaMenu,
  type MetaMenuTarget,
} from "./TicketMetaMenu";
import {
  moveForDrop,
  takesDrop,
  type DropSpot,
  type TicketMove,
} from "./ticketMove";
import type {
  IndexedTicket,
  Label,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";
import { useViewportHeight } from "./viewportHeight";

/** Rows rendered beyond each edge of the viewport, so a scroll shows no gap. */
const OVERSCAN = 6;

/** The archived group is the one group no status names (ADR 0004). */
const ARCHIVED = "archived";

/** How far one key press travels. The list is one dimension. */
const MOVES: Record<string, number> = {
  ArrowDown: 1,
  ArrowUp: -1,
  j: 1,
  k: -1,
};

/**
 * The row a move lands on, or undefined at either end. Groups are a visual
 * grouping and not a boundary: `screen-specs.md:135` says navigation follows the
 * visual order, and the row under the next header is the next row down.
 */
function moveTo(
  groups: StatusGroup[],
  from: Seat,
  step: number,
): string | undefined {
  const within = groups[from.group].tickets[from.index + step];
  if (within) return within.key;
  for (
    let group = from.group + step;
    group >= 0 && group < groups.length;
    group += step
  ) {
    const tickets = groups[group].tickets;
    if (tickets.length === 0) continue;
    return (step > 0 ? tickets[0] : tickets[tickets.length - 1]).key;
  }
  return undefined;
}

/** The class a row wears, which is also how the roving focus finds one. */
const ROW = ".list-row";

export function IssueList(props: {
  tickets: TicketRow[];
  /**
   * Every ticket the project holds, which `tickets` is the filtered view of —
   * the same prop the board takes and for the same reason (LC-187,
   * `ticketMove.ts`). Absent means nothing is hidden.
   */
  unfiltered?: TicketRow[];
  selectedKey?: string;
  marks: ExternalMarks;
  labels: Record<string, Label>;
  /**
   * The board's ordering preference, which the rows inside a group follow too
   * (`screen-specs.md:146`) — and which decides, here as there, whether a place
   * inside a group is a thing a drop can write (ADR 0003).
   */
  ordering: OrderingMode;
  now: number;
  onSelect: (key: string) => void;
  /** Raised by the `P` menu. The list holds no project id and writes nothing. */
  onChangePriority: (ticket: IndexedTicket, next: TicketPriority) => void;
  /** Raised by the `S` menu, on the same terms. */
  onChangeStatus: (ticket: IndexedTicket, next: TicketStatus) => void;
  /** Raised by the context menu's archive row, which is App's to write. */
  onArchive: (ticket: IndexedTicket) => void;
  /**
   * Raised by the context menu's Copy file path row. The path a row holds is
   * relative to a project folder the list has never been told (LC-222).
   */
  onCopyPath: (ticket: TicketRow) => void;
  /**
   * Raised by a drop: a group, a place in one, or both (`ticketMove.ts`). The
   * board raises the same move for the same gesture, because a group here and a
   * column there are the same status.
   */
  onMoveTicket: (ticket: IndexedTicket, move: TicketMove) => void;
  /**
   * Present only in the empty-project state. The list has no Todo column to
   * host the guide, so it sits in a card frame of the list's own — the same
   * `surface` a group body wears — rather than replacing the surface with a
   * full-width panel (D-26/LC-89).
   */
  onCreateFirst?: () => void;
  /** Focus a row from outside the list; see `Board`'s own, and `rovingFocus.ts`. */
  focusRequest?: FocusRequest;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  /** The row whose `S`/`P` menu is open, and which of the two it is. */
  const [metaMenu, setMetaMenu] = useState<MetaMenuTarget>();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useViewportHeight(scroller);
  /** The row being dragged, and which gap of which group it is hanging over. */
  const [dragKey, setDragKey] = useState<string>();
  const [hover, setHover] = useState<{ group: number; gap: number }>();
  /** A drag hanging at the top or bottom of the one scroller keeps it moving. */
  const driftBy = useEdgeDrift(scroller, "scrollTop", setScrollTop);

  const archived = useMemo(
    () => props.tickets.filter(isArchived),
    [props.tickets],
  );
  const compare = comparatorFor(props.ordering);
  /**
   * A status with nothing in it draws no group (`screen-specs.md:169`) — which
   * is right at rest and wrong with a row in the air, because a status you
   * cannot see is a status you cannot drop into. Worse, it is self-sealing:
   * dragging a group's last row out would take that status off the surface and
   * leave no way to drag anything back. So the whole set is kept for exactly as
   * long as the drag lasts, which is the list's answer to the reserve the board
   * makes in every column (LC-60).
   */
  const dragging = dragKey !== undefined;
  const groups = useMemo(() => {
    // `groupByStatus` buckets by status, and archived is not one (ADR 0004), so
    // what comes back is the live tickets whatever is handed in. Why this
    // surface asks for the unreadable group first and the board takes it last is
    // argued once, where the option is declared.
    const live = groupByStatus(props.tickets, {
      compare,
      keepEmpty: dragging,
      unreadable: "first",
    });
    if (archived.length === 0) return live;
    // Always present, so the header keeps its place and its count; empty while
    // collapsed, which is what makes the geometry and the seats agree with what
    // is on screen.
    return [
      ...live,
      {
        id: ARCHIVED,
        title: "Archived",
        tickets: archiveOpen ? orderColumn(archived, compare) : [],
      } as StatusGroup,
    ];
  }, [props.tickets, archived, archiveOpen, compare, dragging]);

  const seats = useMemo(() => seatsFor(groups), [groups]);
  const { slots, offsets } = useMemo(() => listGeometry(groups), [groups]);

  const {
    rovingKey,
    onFocusItem: onFocusRow,
    requestFocus,
  } = useRovingFocus({
    seats,
    firstKey: groups.find((group) => group.tickets.length > 0)?.tickets[0]?.key,
    root: scroller,
    selector: ROW,
    request: props.focusRequest,
  });

  /** The row whose context menu is open, and everything that opens or closes it. */
  const contextMenu = useTicketContextMenu({
    root: scroller,
    selector: ROW,
    requestFocus,
  });

  const range = windowFor(offsets, scrollTop, viewport, OVERSCAN);
  const shown = new Map<number, number[]>();
  const show = (group: number, row: number) => {
    const held = shown.get(group);
    if (held) held.push(row);
    else shown.set(group, [row]);
  };
  for (let slot = range.start; slot < range.end; slot += 1) {
    if (slots[slot].row >= 0) show(slots[slot].group, slots[slot].row);
  }
  // The row the human is standing on and the one they have open stay mounted
  // wherever they have been scrolled to. Unmounting the focused row mid-scroll
  // would drop focus onto the body without saying so.
  const focusSeat = rovingKey === undefined ? undefined : seats.get(rovingKey);
  const openSeat =
    props.selectedKey === undefined ? undefined : seats.get(props.selectedKey);
  for (const seat of [focusSeat, openSeat]) {
    if (seat && !shown.get(seat.group)?.includes(seat.index)) {
      show(seat.group, seat.index);
    }
  }
  // Drawn in visual order, so the accessibility tree reads down the group even
  // though an anchor can sit anywhere in it.
  for (const rows of shown.values()) rows.sort((left, right) => left - right);

  /** The seat the dragged row came from, which is what a drop is read against. */
  const dragSeat = dragKey === undefined ? undefined : seats.get(dragKey);

  /** However the drag ended — dropped, cancelled, taken off the surface. */
  function endDrag() {
    setDragKey(undefined);
    setHover(undefined);
  }

  function onDragStart(event: DragEvent<HTMLDivElement>) {
    const key = pickUp(event, { selector: ROW, groups, seats });
    if (key !== undefined) setDragKey(key);
  }

  /**
   * Which group and gap the pointer is over, in the scroller's own content
   * coordinates — which is what the geometry is stated in, and the only way a
   * drop over a row 3,000 down that is not in the document is answerable.
   *
   * The top band is the one place the two coordinate systems disagree. A group
   * header is `position: sticky`, so while a group is scrolled through, its
   * header sits opaquely over that group's own rows: the content under the
   * pointer there is not what the pointer is pointing at. A drop on a pinned
   * header means the top of the group it belongs to, which is the group whose
   * rows are underneath the band — and hanging there scrolls the list up to
   * show it, because the band is inside the drift edge.
   */
  function spotUnder(event: DragEvent<HTMLDivElement>): DropSpot | undefined {
    const element = scroller.current;
    if (!element) return undefined;
    const offset = event.clientY - element.getBoundingClientRect().top;
    const position = offset + element.scrollTop;
    const spot = dropAt({ slots, offsets }, position);
    if (!spot || offset >= GROUP_HEADER_HEIGHT) return spot;
    return { group: spot.group, gap: 0 };
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (dragKey === undefined) return;
    const over = spotUnder(event);
    // A group that would write nothing refuses the drop by leaving the event
    // alone: the archive, the unreadable group, and — in Priority — the row's
    // own group. The pointer says so rather than the row sliding back.
    if (!over || !takesDrop(groups, dragSeat, over.group, props.ordering)) {
      setHover(undefined);
    } else {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      // `dragover` fires many times a second at the same position, so the same
      // position keeps the same object and React bails out of the render.
      setHover((current) =>
        current && current.group === over.group && current.gap === over.gap
          ? current
          : over,
      );
    }

    const box = scroller.current?.getBoundingClientRect();
    if (box) driftBy(towardsEdge(event.clientY, box.top, box.bottom));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (dragKey === undefined) return;
    const over = spotUnder(event);
    const drop =
      over &&
      moveForDrop(groups, dragSeat, over, props.ordering, props.unfiltered);
    event.preventDefault();
    driftBy(0);
    endDrag();
    if (drop) props.onMoveTicket(drop.ticket, drop.move);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.defaultPrevented) return;
    if (!singleKeyShortcutAllowed(event.target)) return;
    // The row the key was pressed on, not the one the last render believed was
    // focused: the Archived toggle is a tab stop of its own and is not a row.
    const on = (event.target as HTMLElement).closest?.(ROW);
    const fromKey = (on as HTMLElement | null)?.dataset.ticketKey;
    const from = fromKey === undefined ? undefined : seats.get(fromKey);
    // `fromKey` is named in the second half so what follows can read it: a seat
    // only exists for a row that had one, but nothing in the type says so.
    if (!from || fromKey === undefined) return;

    if (opensContextMenu(event)) {
      // Offered on a degraded row too, unlike `S` and `P`: what it holds for
      // one is the file's path, which is what a degraded row has
      // (`ticketMenu.tsx`).
      event.preventDefault();
      contextMenu.openOn(fromKey);
      return;
    }

    const field = metaFieldFor(event.key);
    if (field) {
      // Inert on a file that would not read: there is no field to write to
      // (`keyboard-focus-map.md:48`).
      const row = groups[from.group].tickets[from.index];
      if (row.state !== "indexed") return;
      event.preventDefault();
      setMetaMenu({ key: row.key, field });
      return;
    }

    const step = moveFor(MOVES, event.key);
    if (step === undefined) return;

    event.preventDefault();
    const next = moveTo(groups, from, step);
    if (next === undefined || next === fromKey) return;
    requestFocus(next);
  }

  return (
    <div
      className="issue-list"
      ref={scroller}
      onKeyDown={onKeyDown}
      onContextMenu={contextMenu.onContextMenu}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      // `dragend` bubbles from the row, which is why the row itself carries no
      // handler: a per-row callback would change identity on every scroll and
      // un-memoize the whole list.
      onDragEnd={() => {
        driftBy(0);
        endDrag();
      }}
      // Leaving *for a row* is not leaving: `dragleave` fires on the way into
      // every child, and clearing there would flicker the group's wash off and
      // on again as the pointer crosses each row.
      onDragLeave={(event) => {
        const to = event.relatedTarget as Node | null;
        if (to && scroller.current?.contains(to)) return;
        driftBy(0);
        setHover(undefined);
      }}
    >
      {props.onCreateFirst && (
        <div className="list-guide">
          <GuideCard variant="panel" onCreate={props.onCreateFirst} />
        </div>
      )}
      {groups.map((group, index) => (
        <ListGroup
          key={group.id}
          group={group}
          archived={group.id === ARCHIVED}
          archivedCount={archived.length}
          archiveOpen={archiveOpen}
          onToggleArchive={() => setArchiveOpen((open) => !open)}
          shown={shown.get(index) ?? []}
          selectedKey={props.selectedKey}
          rovingKey={rovingKey}
          marks={props.marks}
          labels={props.labels}
          now={props.now}
          dragKey={dragSeat?.group === index ? dragKey : undefined}
          // Where the row would land, and whether it would arrive from another
          // group — the line is only drawn where a place is being chosen, which
          // in Priority is nowhere (ADR 0003).
          dropGap={
            hover?.group === index && props.ordering === "manual"
              ? hover.gap
              : undefined
          }
          incoming={hover?.group === index && dragSeat?.group !== index}
          onSelect={props.onSelect}
          onFocusRow={onFocusRow}
        />
      ))}
      {contextMenu.target && (
        <TicketContextMenu
          key={contextMenu.instance}
          target={contextMenu.target}
          tickets={props.tickets}
          anchor={contextMenu.anchor}
          onOpen={props.onSelect}
          onChangeStatus={props.onChangeStatus}
          onChangePriority={props.onChangePriority}
          onArchive={props.onArchive}
          onCopyPath={props.onCopyPath}
          onClose={contextMenu.close}
        />
      )}
      {metaMenu && (
        <TicketMetaMenu
          target={metaMenu}
          tickets={props.tickets}
          anchor={itemFor(scroller.current, ROW, metaMenu.key) ?? null}
          onChangeStatus={props.onChangeStatus}
          onChangePriority={props.onChangePriority}
          onClose={() => {
            setMetaMenu(undefined);
            // A pick re-buckets the row, so it is asked for by key again rather
            // than left to whatever node the menu was hanging off.
            requestFocus(metaMenu.key);
          }}
        />
      )}
    </div>
  );
}

/**
 * One group: a sticky header over a `surface` card of rows. The body reserves the
 * whole group's height so the scrollbar tells the truth about rows that are not
 * currently drawn, and so the group below it sits where the geometry says it does.
 */
function ListGroup(props: {
  group: StatusGroup;
  archived: boolean;
  archivedCount: number;
  archiveOpen: boolean;
  onToggleArchive: () => void;
  shown: number[];
  selectedKey?: string;
  rovingKey?: string;
  marks: ExternalMarks;
  labels: Record<string, Label>;
  now: number;
  /** The row being dragged, when it is one of this group's. */
  dragKey?: string;
  /** Where letting go would put it, as a gap between this group's rows. */
  dropGap?: number;
  /** True while the pointer is here and the row would arrive from elsewhere. */
  incoming: boolean;
  onSelect: (key: string) => void;
  onFocusRow: (key: string) => void;
}) {
  const { group } = props;
  const count = props.archived ? props.archivedCount : group.tickets.length;

  return (
    <section
      className={classes(
        "list-group",
        props.archived && "archived",
        props.incoming && "drop-target",
      )}
    >
      {props.archived ? (
        // A real button with expanded state, which is the keyboard path archive
        // has (`keyboard-focus-map.md:125`); there is no single-key binding.
        <button
          tabIndex={0}
          className="list-group-header"
          aria-expanded={props.archiveOpen}
          onClick={props.onToggleArchive}
        >
          <span className="folder-glyph" aria-hidden="true">
            ▤
          </span>
          {group.title}
          <span className="list-group-count">{count}</span>
          <span className="list-group-reveal">
            {props.archiveOpen ? "Hide" : "Show"}
          </span>
        </button>
      ) : (
        <h3 className="list-group-header">
          {group.status && <StatusDot status={group.status} decorative />}
          {group.title}
          <span className="list-group-count">{count}</span>
        </h3>
      )}
      {group.tickets.length > 0 && (
        <div
          className="list-group-body"
          style={{ height: groupBodyHeight(group.tickets.length) }}
        >
          {props.dropGap !== undefined && (
            <div
              className="list-drop-line"
              aria-hidden="true"
              style={{ top: rowTop(props.dropGap) }}
            />
          )}
          {props.shown.map((index) => {
            const ticket = group.tickets[index];
            return (
              <ListRow
                key={ticket.key}
                ticket={ticket}
                top={rowTop(index)}
                divided={index > 0}
                selected={ticket.key === props.selectedKey}
                tabStop={ticket.key === props.rovingKey}
                mark={props.marks[ticket.key]}
                labels={props.labels}
                now={props.now}
                // An archived ticket is off the board entirely (ADR 0004), so
                // dropping one into a status group would move something the
                // human cannot see the result of; and a file this build cannot
                // read has no frontmatter to write a move into.
                draggable={!props.archived && ticket.state === "indexed"}
                dragging={ticket.key === props.dragKey}
                onSelect={props.onSelect}
                onFocusRow={props.onFocusRow}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * One row, in the order `screen-specs.md:175-180` sets: status dot, mono ID,
 * priority glyph, title, acknowledgement dot, checklist fraction, up to two label chips,
 * relative updated time. No assignee slot in v0 (ADR 0001).
 *
 * Memoized on its own ticket, so a change to one ticket re-renders one row. Unlike
 * a board card it does read `now` unconditionally, because every row shows an age
 * — there is nothing to withhold the clock from.
 */
const ListRow = memo(function ListRow(props: {
  ticket: TicketRow;
  top: number;
  /** Every row but the group's first draws the hairline above it. */
  divided: boolean;
  selected: boolean;
  tabStop: boolean;
  mark?: ExternalMark;
  labels: Record<string, Label>;
  now: number;
  /** True on a row with frontmatter to write a move into, and not archived. */
  draggable: boolean;
  dragging: boolean;
  onSelect: (key: string) => void;
  onFocusRow: (key: string) => void;
}) {
  const { ticket, mark } = props;
  const row = presentRow(ticket, props.labels, props.now);
  // A file that would not parse has nothing in it to acknowledge a change to: beside a
  // path and a parser error, the dot was a green light on a broken row. The
  // board card has the same dot for the same reason and is not fixed here —
  // suppressing it there also moves `cardStrides`, and a treatment that
  // disagrees with the geometry is worse than the dot. That is LC-164.
  const acknowledged = isAcknowledged(mark, props.now) && !row.degraded;
  return (
    <button
      className={classes(
        "list-row",
        props.divided && "divided",
        props.selected && "selected",
        row.degraded && "degraded",
        acknowledged && "acknowledged",
        acknowledged && mark && acknowledgementClass(mark.actorType),
        props.draggable && "draggable",
        props.dragging && "dragging",
      )}
      style={{ top: props.top }}
      data-ticket-key={ticket.key}
      draggable={props.draggable}
      tabIndex={props.tabStop ? 0 : -1}
      onClick={() => props.onSelect(ticket.key)}
      onFocus={() => props.onFocusRow(ticket.key)}
    >
      {row.status ? (
        <StatusDot status={row.status} small />
      ) : (
        <span className="row-warn" role="img" aria-label="Unreadable file">
          ⚠
        </span>
      )}
      <span className="list-row-key">{ticket.key}</span>
      {row.priority && <PriorityGlyph priority={row.priority} small />}
      <strong>{row.title}</strong>
      {acknowledged && <PulseDot mark={mark} now={props.now} />}
      {row.checklist && (
        <span className="list-row-checklist">{row.checklist}</span>
      )}
      {row.labels.map((label) => (
        <LabelChip key={label.slug} label={label} small />
      ))}
      {/* The row is a single focusable unit, so this names what opening it shows
          — the panel renders the raw file for a ticket that would not parse —
          rather than being a second control nested inside a button. */}
      {row.degraded && (
        <span className="list-row-raw">
          {row.degraded.readOnly ? "Newer format" : "View raw file"}
        </span>
      )}
      <span className="list-row-updated">{row.updated}</span>
    </button>
  );
});
