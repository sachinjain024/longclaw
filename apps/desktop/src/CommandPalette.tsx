/**
 * The `⌘K` command palette (`screen-specs.md:296-315`).
 *
 * A combobox over a listbox, not a menu: the input is what the human types into
 * and the rows are what it filters, so the input keeps DOM focus throughout and
 * the active row is published with `aria-activedescendant` rather than by moving
 * focus. That is also why `↑↓` and `Enter` are handled here rather than by the
 * rows — a row never holds focus, so it never sees the key.
 *
 * The palette is one screen in seven modes: a root command list and six
 * sub-modes (`:309`). Every mode is declared once, in `MODES` below — its rows,
 * its crumb, what a pick does, and any note under the list — because when the
 * mode was branched on at each of those four points, adding one meant editing
 * four places and forgetting the fourth was silent.
 *
 * The root is the one mode that answers with something other than its own rows:
 * a query shaped like a ticket key is offered as the ticket it names (LC-171),
 * because typing a key is the fastest thing anyone knows how to do and it used
 * to be filtered against command labels, which no key matches. That match is
 * read from the project's own rows rather than asked of `search_tickets` — a
 * key is the one query already answerable from what is in memory, and answering
 * it there is synchronous, exact, and cannot be truncated by the search's
 * hundred-result cap or refused by a folder the app cannot reach.
 *
 * It writes nothing. Every command is raised to `App`, which owns `mutate()`
 * and is therefore the only place a ticket file is written from.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./metaOptions";
import { ticketKeyNames, ticketKeyQuery } from "./tickets";
import { ORDERINGS, type OrderingMode } from "./ordering";
import type { ViewMode } from "./devicePreferences";
import { FolderGlyph } from "./FolderGlyph";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import { tabStops } from "./tabStops";
import { ThemeSwatch } from "./ThemeSwatch";
import type {
  IndexedTicket,
  ProjectReference,
  TicketRow,
  TicketPriority,
  TicketStatus,
} from "./types";

/** The root list, and the six sub-modes it opens (`screen-specs.md:309`). */
type Mode =
  "root" | "status" | "priority" | "theme" | "project" | "search" | "ordering";

/** One row of whichever mode is in force. Never a ticket, and never a command. */
type PaletteRow = {
  id: string;
  label: string;
  /** The option's own glyph: a status dot, a priority mark, a pair swatch. */
  glyph?: ReactNode;
  /** Mono ticket key before the label. Search rows only (`screen-specs.md:314`). */
  monoKey?: string;
  /** Quiet trailing note on the row itself, e.g. `· archived` (`:209`). */
  tag?: string;
  /** The value already in force. Wears the menus' trailing check (`Menu.tsx`). */
  current?: boolean;
  /** Right-aligned single-key hint, so the palette is where shortcuts are found. */
  hint?: string;
  disabled?: boolean;
  /** Why it is disabled. Disabled rows stay visible *with their reason* (`:106-107`). */
  reason?: string;
  /** A root row that opens a sub-mode instead of running. */
  opens?: Mode;
  /** What a root row does, including whether it closes the palette. */
  run?: () => void;
};

/** How long typing settles before the search sub-mode asks Rust (`plan 27`). */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * `TicketIndex::search` truncates at this many rows (`core/index.rs:24`) and
 * says nothing about having done it, so the surface has to. Kept in step with
 * the Rust constant by hand: a result set of exactly this size is reported as
 * capped, which is the honest reading of a silent truncation.
 */
const SEARCH_LIMIT = 100;

/**
 * What search reads that the header filter does not (`filtering.ts:20-28`).
 * Plan 21 asked for this to be said on screen rather than discovered.
 */
const SEARCH_SCOPE_NOTE =
  "Searches keys, titles, labels, and descriptions in the index — more than the header filter, which reads the rows on screen.";

/** The ordering menu's note, and the sub-mode carries it too (`:246-247`). */
const ORDERING_FOOTNOTE =
  "Ordering is a view preference on this board — it never rewrites files.";

/** Shown on a disabled row that needs a ticket and has none (`:233-235`). */
const NO_TARGET = "Open or focus a ticket";

/** Shown on a row that would write into a folder the app cannot reach (LC-140). */
const NO_FOLDER = "The project folder cannot be reached";

function RootGlyph({ children }: { children: ReactNode }) {
  return (
    <span className="palette-root-glyph" aria-hidden="true">
      {children}
    </span>
  );
}

/**
 * A ticket as a row (`screen-specs.md:236`): mono key, status dot, title, and
 * the `· archived` tag.
 *
 * Search mode's rows are built here, and so is the one the root offers for a
 * key-shaped query (LC-171) — one builder, so a ticket cannot be drawn one way
 * in search and another at the root.
 */
function ticketRow(ticket: TicketRow): PaletteRow {
  return {
    id: ticket.key,
    monoKey: ticket.key,
    glyph:
      ticket.state === "indexed" ? (
        <StatusDot status={ticket.status} decorative />
      ) : (
        <span className="search-degraded" aria-hidden="true">
          !
        </span>
      ),
    label: ticket.state === "indexed" ? ticket.title : "unreadable file",
    tag:
      ticket.state === "indexed" && ticket.archivedAt ? "archived" : undefined,
  };
}

export function CommandPalette(props: {
  /** The project every command runs against: the active one, never another. */
  project: ProjectReference;
  /**
   * The open or focused ticket (`:311`). Absent is a real state — it is what
   * disables status, priority and archive rather than letting them fail.
   */
  ticket?: IndexedTicket;
  /**
   * What Rust returned for the current query. `undefined` means no answer has
   * come back yet, which is not the same as "no tickets" and must not be drawn
   * as the whole project.
   */
  searchResults?: TicketRow[];
  /**
   * Every row of the open project, in the state the surfaces read.
   *
   * The palette draws none of them: this is what a key typed at the root is
   * looked up in (LC-171), which is the whole project rather than the narrowed
   * list a surface happens to be showing — the point of typing a key is to
   * reach a ticket you are not looking at.
   */
  tickets: TicketRow[];
  /** The registry, for the go-to-project sub-mode. */
  projects: ProjectReference[];
  /** The stored preference, so the toggle row can name what it will leave. */
  appearance: "system" | "light" | "dark";
  /** The four fixed presets (D1). No custom colour exists to offer. */
  themes: Array<{ id: string; label: string }>;
  /** The board's current ordering, so the sub-mode can tick it. */
  ordering: OrderingMode;
  /** The surface in force, so the view row can name the one it will switch to. */
  view: ViewMode;
  /** Closes and returns focus to whatever held it before `⌘K`. */
  onClose: () => void;
  onCreate: () => void;
  onOpenTicket: (key: string) => void;
  onProject: (projectId: string) => void;
  onChangeStatus: (status: TicketStatus) => void;
  onChangePriority: (priority: TicketPriority) => void;
  onToggleStar: () => void;
  onToggleAppearance: () => void;
  onTheme: (theme: string) => void;
  onView: (view: ViewMode) => void;
  onArchive: () => void;
  onOrdering: (mode: OrderingMode) => void;
  /** Debounced. The palette holds no results of its own. */
  onSearch: (query: string) => void;
  /** Opens straight into a sub-mode. Tests use it; `⌘K` always opens at root. */
  initialMode?: Mode;
}) {
  const targetTicket = props.ticket;
  const [mode, setMode] = useState<Mode>(props.initialMode ?? "root");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Two palettes never coexist, but a test renders several in one document and
  // `aria-activedescendant` points at an id, which has to be unique to work.
  const rowId = useId();
  useEffect(() => input.current?.focus(), []);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  /** Entering a mode resets what the input filters and what `Enter` would run. */
  function enter(next: Mode) {
    setMode(next);
    setQuery("");
    setActive(0);
    // The empty query is a real query: Rust answers it with the first page of
    // the project, which is the search mode's opening state.
    if (next === "search") props.onSearch("");
  }

  /** The one way the palette opens a ticket, wherever the row was offered. */
  const openTicketRow = (row: PaletteRow) => props.onOpenTicket(row.id);

  /**
   * The key the root is being asked about, if it is being asked about one
   * (LC-171). Undefined for every other query, which then filters commands as
   * it always has.
   */
  const rootKey =
    mode === "root" ? ticketKeyQuery(query, props.project.key) : undefined;

  /**
   * The ticket that key names, or nothing when the project has no such ticket.
   *
   * By key rather than by substring: the query resolved to one key, and `LC-6`
   * must not offer `LC-60` as the ticket the human named. `ticketKeyNames` is
   * where that comparison lives, because a key minted from 2026-08-25 carries a
   * trailing character the person typing the number will not have (LC-232) —
   * `LC-234` has to find `LC-234x` without `LC-6` finding `LC-60`.
   */
  const rootKeyMatch = rootKey
    ? props.tickets.find((ticket) => ticketKeyNames(rootKey, ticket.key))
    : undefined;

  const unreachable = !props.project.reachable;
  const root: PaletteRow[] = [
    {
      id: "create",
      label: "Create ticket",
      glyph: <RootGlyph>+</RootGlyph>,
      hint: "C",
      // Nothing is creatable in a folder the app cannot read (`states.md:80-98`).
      // Disabled rather than hidden, with its reason, like every other row that
      // is unavailable rather than absent (`screen-specs.md:106-107`).
      disabled: unreachable,
      reason: unreachable ? NO_FOLDER : undefined,
      run: props.onCreate,
    },
    {
      id: "project",
      label: "Go to project…",
      glyph: <RootGlyph>→</RootGlyph>,
      opens: "project",
    },
    {
      id: "status",
      label: "Change status…",
      glyph: targetTicket ? (
        <StatusDot status={targetTicket.status} decorative />
      ) : (
        <StatusDot status="todo" decorative />
      ),
      hint: "S",
      opens: "status",
      disabled: !targetTicket,
      reason: targetTicket ? undefined : NO_TARGET,
    },
    {
      id: "priority",
      label: "Set priority…",
      glyph: (
        <PriorityGlyph priority={targetTicket?.priority ?? "none"} decorative />
      ),
      hint: "P",
      opens: "priority",
      disabled: !targetTicket,
      reason: targetTicket ? undefined : NO_TARGET,
    },
    {
      id: "search",
      label: "Search tickets…",
      glyph: <RootGlyph>⌕</RootGlyph>,
      opens: "search",
    },
    {
      id: "star",
      label: props.project.starred ? "Unstar project" : "Star project",
      glyph: <RootGlyph>★</RootGlyph>,
      run: () => {
        props.onToggleStar();
        props.onClose();
      },
    },
    {
      id: "appearance",
      label: `Toggle appearance (${props.appearance})`,
      glyph: <RootGlyph>☾</RootGlyph>,
      run: () => {
        props.onToggleAppearance();
        props.onClose();
      },
    },
    {
      id: "theme",
      label: "Change project theme…",
      glyph: <RootGlyph>◆</RootGlyph>,
      opens: "theme",
    },
    {
      id: "archive",
      label: targetTicket?.archivedAt ? "Unarchive ticket" : "Archive ticket",
      glyph: <FolderGlyph />,
      disabled: !targetTicket,
      reason: targetTicket ? undefined : NO_TARGET,
      run: () => {
        props.onArchive();
        props.onClose();
      },
    },
    {
      id: "ordering",
      label: "Change board ordering…",
      glyph: <RootGlyph>☷</RootGlyph>,
      opens: "ordering",
    },
    {
      id: "view",
      label: `Switch to ${props.view === "list" ? "board" : "list"} view`,
      glyph: <RootGlyph>☰</RootGlyph>,
      run: () => {
        props.onView(props.view === "list" ? "board" : "list");
        props.onClose();
      },
    },
    {
      id: "terminal",
      label: "New terminal",
      glyph: <RootGlyph>›_</RootGlyph>,
      disabled: true,
      hint: "PHASE 2",
      reason: "Terminals arrive in Phase 2",
    },
  ];

  /**
   * Every sub-mode, declared once: its crumb, its rows, what a pick does, and
   * the note that belongs under it. A pick always closes — a sub-mode is the
   * second half of one command, not a place to stand.
   */
  const MODES: Record<
    Exclude<Mode, "root">,
    {
      crumb: string;
      rows: PaletteRow[];
      run: (row: PaletteRow) => void;
      /** Rendered under the list. A claim about the mode, not a hint. */
      note?: string;
      /** Whether typing narrows the rows here. Search is answered by Rust. */
      filterLocally?: boolean;
    }
  > = {
    status: {
      crumb: "status",
      rows: STATUS_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        glyph: option.glyph,
        current: targetTicket?.status === option.id,
      })),
      run: (row) => {
        props.onChangeStatus(row.id as TicketStatus);
        props.onClose();
      },
      filterLocally: true,
    },
    priority: {
      crumb: "priority",
      rows: PRIORITY_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        glyph: option.glyph,
        current: targetTicket?.priority === option.id,
      })),
      run: (row) => {
        props.onChangePriority(row.id as TicketPriority);
        props.onClose();
      },
      filterLocally: true,
    },
    theme: {
      crumb: "theme",
      // The swatch is the point: a preset is a pair of accents, and naming it
      // in words is the one channel that cannot show which pair.
      rows: props.themes.map((theme) => ({
        id: theme.id,
        label: theme.label,
        glyph: <ThemeSwatch theme={theme.id} />,
        current: props.project.theme === theme.id,
      })),
      run: (row) => {
        props.onTheme(row.id);
        props.onClose();
      },
      filterLocally: true,
    },
    project: {
      crumb: "project",
      rows: props.projects.map((project) => ({
        id: project.id,
        label: project.name,
        // The sidebar's treatment for an unreachable project
        // (`screen-specs.md:61-62`), which the palette had no rule of its own
        // for: still listed, still openable — opening it is how a human reaches
        // the Locate folder action.
        tag: project.reachable ? undefined : "unreachable",
      })),
      run: (row) => {
        props.onProject(row.id);
        props.onClose();
      },
      filterLocally: true,
    },
    ordering: {
      // Read from `ordering.ts` rather than restated here: the control, the
      // board and this row list are one list or they will disagree.
      crumb: "ordering",
      rows: ORDERINGS.map((option) => ({
        id: option.id,
        label: option.label,
        current: props.ordering === option.id,
      })),
      run: (row) => {
        props.onOrdering(row.id as OrderingMode);
        props.onClose();
      },
      note: ORDERING_FOOTNOTE,
      filterLocally: true,
    },
    search: {
      crumb: "search",
      rows: (props.searchResults ?? []).map(ticketRow),
      run: openTicketRow,
      note: SEARCH_SCOPE_NOTE,
      // Rust answered this query; re-filtering here would hide the description
      // and label matches that are the reason to use search at all.
      filterLocally: false,
    },
  };

  const subMode = mode === "root" ? undefined : MODES[mode];
  const rows = subMode ? subMode.rows : root;
  const filtered =
    subMode && !subMode.filterLocally
      ? rows
      : rows.filter(
          (row) =>
            !query || row.label.toLowerCase().includes(query.toLowerCase()),
        );
  // First, and not filtered by the query that produced it: `LC-60` is not in
  // the ticket's title, and the row is the answer to it rather than a match on
  // it. `Enter` therefore lands on the ticket, which is why it was typed.
  const keyRow = rootKeyMatch ? ticketRow(rootKeyMatch) : undefined;
  const visibleRows = keyRow
    ? [{ ...keyRow, run: () => openTicketRow(keyRow) }, ...filtered]
    : filtered;

  function activate(row: PaletteRow) {
    if (row.disabled) return;
    if (row.opens) {
      enter(row.opens);
      return;
    }
    if (row.run) {
      row.run();
      return;
    }
    subMode?.run(row);
  }

  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === "Tab") {
      // `tabStops`, not a selector list: every option row below is a
      // `tabIndex={-1}` `<button>` by design, and a list whose first clause is
      // `button` counted all of them — so Tab off the input walked into the
      // rows the input is already driving through `aria-activedescendant`,
      // in whatever order jsdom's engine concatenated the clauses (LC-208).
      const focusable = tabStops(event.currentTarget);
      if (focusable.length > 0) {
        event.preventDefault();
        const current = focusable.indexOf(
          document.activeElement as HTMLElement,
        );
        focusable[
          (current + (event.shiftKey ? -1 : 1) + focusable.length) %
            focusable.length
        ]?.focus();
      }
      return;
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      if (mode === "root") props.onClose();
      else {
        setMode("root");
        setQuery("");
        setActive(0);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((x) => (x + 1) % Math.max(visibleRows.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(
        (x) =>
          (x - 1 + Math.max(visibleRows.length, 1)) %
          Math.max(visibleRows.length, 1),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = visibleRows[active];
      if (row) activate(row);
    }
  }

  const capped =
    mode === "search" && props.searchResults?.length === SEARCH_LIMIT;
  const awaitingResults =
    mode === "search" && props.searchResults === undefined;

  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
        onKeyDown={keyDown}
      >
        {/* `screen-specs.md:221`, `:310`: one 44px row carrying the crumb chip,
            the input, and the `esc` chip. */}
        <div className="palette-input-row">
          <span className="palette-input-glyph" aria-hidden="true">
            ⌕
          </span>
          {subMode && (
            <button
              tabIndex={0}
              type="button"
              className="kbd-chip palette-crumb"
              aria-label={`Back to commands from ${subMode.crumb}`}
              onClick={() => {
                setMode("root");
                setQuery("");
                setActive(0);
              }}
            >
              {subMode.crumb}
            </button>
          )}
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              // Still only the search sub-mode: the root's own key lookup reads
              // rows it already has, so it asks Rust nothing (LC-171).
              if (mode === "search") {
                clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(
                  () => props.onSearch(e.target.value),
                  SEARCH_DEBOUNCE_MS,
                );
              }
            }}
            placeholder={mode === "root" ? "Type a command…" : "Search…"}
            aria-label="Command palette input"
            role="combobox"
            aria-controls="command-palette-options"
            aria-expanded="true"
            aria-activedescendant={
              visibleRows[active] ? `${rowId}-${active}` : undefined
            }
          />
          <kbd className="kbd-chip palette-esc">esc</kbd>
        </div>
        <div
          id="command-palette-options"
          role="listbox"
          aria-label={subMode ? `${subMode.crumb} options` : "Commands"}
        >
          {visibleRows.map((row, index) => (
            <button
              // Never a tab stop: the input keeps focus and publishes the active
              // row through `aria-activedescendant`, so a row in the Tab order
              // would be a second, contradictory way to move through the list.
              tabIndex={-1}
              key={row.id}
              id={`${rowId}-${index}`}
              role="option"
              aria-selected={index === active}
              disabled={row.disabled}
              className={index === active ? "active" : ""}
              onClick={() => activate(row)}
            >
              {row.glyph && (
                <span className="palette-glyph-slot">{row.glyph}</span>
              )}
              {row.monoKey && <span className="search-key">{row.monoKey}</span>}
              <span className="palette-label">{row.label}</span>
              {row.tag && <small className="palette-tag">· {row.tag}</small>}
              {row.reason && <small>{row.reason}</small>}
              {row.hint && <kbd>{row.hint}</kbd>}
              {row.current && (
                <span className="palette-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
          {visibleRows.length === 0 && (
            // Derived from the header filter's no-match state
            // (`states.md:38-42`) — the palette has none of its own designed —
            // minus its Clear filter button, which becomes clearing the query.
            <div className="palette-empty" role="status">
              <strong>{awaitingResults ? "Searching…" : "No matches"}</strong>
              {!awaitingResults && (
                <p>
                  {query ? (
                    <>
                      Nothing here matches <code>{query}</code>.
                    </>
                  ) : mode === "search" ? (
                    "This project has no tickets to find yet."
                  ) : (
                    "No commands are available."
                  )}
                </p>
              )}
              {query && (
                <button
                  tabIndex={0}
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setQuery("");
                    setActive(0);
                    if (mode === "search") {
                      clearTimeout(searchTimer.current);
                      props.onSearch("");
                    }
                    input.current?.focus();
                  }}
                >
                  Clear query
                </button>
              )}
            </div>
          )}
        </div>
        {subMode?.note && <p className="palette-note">{subMode.note}</p>}
        {capped && (
          <p className="palette-note" role="status">
            {`Showing the first ${SEARCH_LIMIT} matches. Narrow the query to see the rest.`}
          </p>
        )}
        <footer>{`↑↓ navigate · ↵ run · esc ${
          mode === "root" ? "close" : "back"
        }`}</footer>
      </section>
    </div>
  );
}
