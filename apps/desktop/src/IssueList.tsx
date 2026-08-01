/**
 * The dense issue list: every ticket in the project, grouped by status.
 *
 * The board answers "what is in flight" and shows six columns whether or not they
 * hold anything. The list answers "what exists": only statuses with tickets get a
 * group (`screen-specs.md:135-136`), Canceled is reliably visible here rather than
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
 * **Roles.** A row is one activation target that opens the panel, not a grid of
 * navigable cells, so this is a `section` per group with a heading that carries the
 * count — exactly the board's contract, and for the same reason. `role="table"` or
 * `role="grid"` would promise cell navigation this surface does not implement and
 * would need `aria-rowcount`/`aria-rowindex` bookkeeping against a DOM that holds
 * only a window of the rows. The count in the heading is what tells a screen-reader
 * user how big a group is when only twenty of its rows exist.
 */

import { memo, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { windowFor } from "./boardGeometry";
import { classes } from "./classes";
import { isFresh } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import {
  groupByStatus,
  seatsFor,
  type Seat,
  type StatusGroup,
} from "./grouping";
import { LabelChip } from "./LabelChip";
import { Menu } from "./Menu";
import { groupBodyHeight, listGeometry, rowTop } from "./listGeometry";
import { presentRow } from "./listRow";
import { comparatorFor, orderColumn, type OrderingMode } from "./ordering";
import { PriorityGlyph } from "./PriorityGlyph";
import { PulseDot } from "./PulseDot";
import { moveFor, useRovingFocus } from "./rovingFocus";
import { itemFor } from "./rovingFocus";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { StatusDot } from "./StatusDot";
import { isArchived } from "./tickets";
import { singleKeyShortcutAllowed } from "./keyContext";
import type { IndexedTicket, TicketStatus, TicketPriority } from "./types";
import type { Label, TicketRow } from "./types";
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
 * grouping and not a boundary: `screen-specs.md:115` says navigation follows the
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
  selectedKey?: string;
  marks: ExternalMarks;
  labels: Record<string, Label>;
  /**
   * The board's ordering preference, which the rows inside a group follow too
   * (`screen-specs.md:146`). Dragging is the board's alone: the spec gives the
   * list no drag affordance, and a dense 36px row is not one.
   */
  ordering: OrderingMode;
  now: number;
  onSelect: (key: string) => void;
  onChangePriority?: (ticket: IndexedTicket, next: TicketPriority) => void;
  onChangeStatus?: (ticket: IndexedTicket, next: TicketStatus) => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<
    { key: string; field: "status" | "priority" } | undefined
  >();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useViewportHeight(scroller);

  const archived = useMemo(
    () => props.tickets.filter(isArchived),
    [props.tickets],
  );
  const compare = comparatorFor(props.ordering);
  const groups = useMemo(() => {
    // `groupByStatus` buckets by status, and archived is not one (ADR 0004), so
    // what comes back is the live tickets whatever is handed in.
    const live = groupByStatus(props.tickets, { compare });
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
  }, [props.tickets, archived, archiveOpen, compare]);

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

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.defaultPrevented) return;
    if (!singleKeyShortcutAllowed(event.target)) return;
    // The row the key was pressed on, not the one the last render believed was
    // focused: the Archived toggle is a tab stop of its own and is not a row.
    const on = (event.target as HTMLElement).closest?.(ROW);
    const fromKey = (on as HTMLElement | null)?.dataset.ticketKey;
    const from = fromKey === undefined ? undefined : seats.get(fromKey);
    if (!from) return;

    const row = groups[from.group].tickets[from.index];
    if (
      row.state === "indexed" &&
      (event.key.toLowerCase() === "p" || event.key.toLowerCase() === "s")
    ) {
      event.preventDefault();
      setMenuFor({
        key: row.key,
        field: event.key.toLowerCase() === "p" ? "priority" : "status",
      });
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
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
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
          onSelect={props.onSelect}
          onFocusRow={onFocusRow}
        />
      ))}
      {menuFor &&
        (() => {
          const ticket = groups
            .flatMap((group) => group.tickets)
            .find((candidate) => candidate.key === menuFor.key);
          if (ticket?.state !== "indexed") return null;
          const options =
            menuFor.field === "status" ? STATUS_OPTIONS : PRIORITY_OPTIONS;
          return (
            <Menu
              label={menuFor.field === "status" ? "Status" : "Priority"}
              options={options}
              selected={[ticket[menuFor.field]]}
              anchor={itemFor(scroller.current, ROW, ticket.key) ?? null}
              onPick={(next) => {
                if (menuFor.field === "status")
                  props.onChangeStatus?.(ticket, next as TicketStatus);
                else props.onChangePriority?.(ticket, next as TicketPriority);
              }}
              onClose={() => {
                setMenuFor(undefined);
                requestFocus(ticket.key);
              }}
            />
          );
        })()}
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
  onSelect: (key: string) => void;
  onFocusRow: (key: string) => void;
}) {
  const { group } = props;
  const count = props.archived ? props.archivedCount : group.tickets.length;

  return (
    <section className={classes("list-group", props.archived && "archived")}>
      {props.archived ? (
        // A real button with expanded state, which is the keyboard path archive
        // has (`keyboard-focus-map.md:110`); there is no single-key binding.
        <button
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
 * One row, in the order `screen-specs.md:141-146` sets: status dot, mono ID,
 * priority glyph, title, fresh dot, checklist fraction, up to two label chips,
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
  onSelect: (key: string) => void;
  onFocusRow: (key: string) => void;
}) {
  const { ticket, mark } = props;
  const row = presentRow(ticket, props.labels, props.now);
  const fresh = isFresh(mark, props.now);
  return (
    <button
      className={classes(
        "list-row",
        props.divided && "divided",
        props.selected && "selected",
        row.degraded && "degraded",
        fresh && "fresh",
        fresh && mark?.actorType === "human" && "human-fresh",
      )}
      style={{ top: props.top }}
      data-ticket-key={ticket.key}
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
      {fresh && <PulseDot mark={mark} now={props.now} />}
      {row.checklist && (
        <span className="list-row-checklist">{row.checklist}</span>
      )}
      {row.labels.map((label) => (
        <LabelChip key={label.slug} label={label} small />
      ))}
      {/* The row is a single focusable unit, so this names what opening it shows
          — the panel renders the raw file for a ticket that would not parse —
          rather than being a second control nested inside a button. */}
      {row.degraded && <span className="list-row-raw">View raw file</span>}
      <span className="list-row-updated">{row.updated}</span>
    </button>
  );
});
