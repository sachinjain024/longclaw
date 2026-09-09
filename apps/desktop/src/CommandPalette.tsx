/**
 * The `⌘K` command palette (`screen-specs.md:296-315`).
 *
 * A combobox over a listbox, not a menu: the input is what the human types into
 * and the rows are what it filters, so the input keeps DOM focus throughout and
 * the active row is published with `aria-activedescendant` rather than by moving
 * focus. That is also why `↑↓` and `Enter` are handled here rather than by the
 * rows — a row never holds focus, so it never sees the key.
 *
 * The palette is one screen in a root command list and ten sub-modes (`:309`).
 * Every mode is declared once, in `MODES` below — its rows, its crumb, what a
 * pick does, and any note under the list — because when the mode was branched
 * on at each of those four points, adding one meant editing four places and
 * forgetting the fourth was silent.
 *
 * Four of the ten are the opt-in properties (LC-227), and they are the reason
 * that record now earns its keep twice over: they differ from each other only
 * in which values they offer, so they are built by one function rather than
 * written out four times, and a project that has enabled none of them draws
 * exactly the palette this file drew before them.
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
import { STATUS_OPTIONS, PRIORITY_OPTIONS, typeOptions } from "./metaOptions";
import { ticketKeyNames, ticketKeyQuery } from "./tickets";
import { ORDERINGS, type OrderingMode } from "./ordering";
import type { ViewMode } from "./devicePreferences";
import { CalendarGlyph } from "./DateField";
import { FolderGlyph } from "./FolderGlyph";
import { PriorityGlyph } from "./PriorityGlyph";
import {
  datePicks,
  displayDate,
  echoDate,
  enabledPropertyFields,
  estimateScale,
  fromIso,
  parseDate,
  PROPERTY_LABELS,
  readEstimate,
  toIso,
} from "./properties";
import { StatusDot } from "./StatusDot";
import { tabStops } from "./tabStops";
import { ThemeSwatch } from "./ThemeSwatch";
import { TypeGlyph } from "./TicketMenuGlyphs";
import type {
  IndexedTicket,
  ProjectReference,
  TicketProperty,
  TicketRow,
  TicketPriority,
  TicketStatus,
} from "./types";

/**
 * The root list, and the ten sub-modes it opens (`screen-specs.md:309`).
 *
 * A property's mode is named by the property, so `opens` needs no mapping from
 * one to the other — the four are `TicketProperty` verbatim, and adding a fifth
 * property to that type puts it here as a type error rather than as a mode that
 * silently never opens.
 */
type Mode =
  | "root"
  | "status"
  | "priority"
  | "theme"
  | "project"
  | "search"
  | "ordering"
  | TicketProperty;

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
  /**
   * What a property row writes, for the four modes whose rows are values
   * rather than commands (LC-227). Absent on the `Clear` row, which is exactly
   * what clearing is on the wire — an edit that empties the field rather than
   * one that omits it — so the mode's `run` needs no branch for it.
   */
  value?: string;
  /** What a root row does, including whether it closes the palette. */
  run?: () => void;
};

/**
 * One sub-mode, declared once: its crumb, its rows, what a pick does, and the
 * note that belongs under it.
 *
 * Named rather than inline because the four property modes are built by a
 * function now (LC-227), and a function needs a return type to be checked
 * against the record it fills.
 */
type SubMode = {
  crumb: string;
  rows: PaletteRow[];
  run: (row: PaletteRow) => void;
  /**
   * A row offered ahead of the rest and never filtered — the mode's answer to
   * the query rather than a match on it. The root has one of these too, for a
   * key-shaped query (LC-171); here it is a typed day (LC-227).
   */
  lead?: PaletteRow;
  /** Rendered under the list. A claim about the mode, not a hint. */
  note?: string;
  /** Whether typing narrows the rows here. Search is answered by Rust. */
  filterLocally?: boolean;
};

/** How long typing settles before the search sub-mode asks Rust (`plan 27`). */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * `TicketIndex::search` truncates at this many rows (`core/index.rs:25`) and
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
 * The mark each property's row wears — the same one its context-menu row wears,
 * so a property is recognisable across the two surfaces that offer it.
 *
 * Estimate is the one that differs, and deliberately. The context menu reserves
 * an empty slot for it, which it can afford because every neighbour is text;
 * here every root row carries a glyph, and an empty slot among ten filled ones
 * reads as an icon that failed to load rather than as a property without one.
 * `~` is the mark, because an estimate is the one property whose value is an
 * approximation in all three of the systems a project can pick.
 */
const PROPERTY_GLYPHS: Record<TicketProperty, ReactNode> = {
  type: <TypeGlyph />,
  estimate: <RootGlyph>~</RootGlyph>,
  start: <CalendarGlyph />,
  due: <CalendarGlyph />,
};

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
  /**
   * Today, at midnight, injected rather than read here (LC-227).
   *
   * The four quick picks a date mode offers and the day a typed one resolves to
   * are both answers about *when now is*, and a component that read the clock
   * itself could not be tested against a fixed day or moved by the day-boundary
   * recompute the watcher cannot push.
   */
  today: number;
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
  /**
   * One of the four opt-in properties set, or cleared with `undefined`.
   *
   * The same handler a card's context menu raises, so the palette writes down
   * the same path and says the same sentence about having done it.
   */
  onChangeProperty: (
    property: TicketProperty,
    value: string | undefined,
  ) => void;
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

  /**
   * What the target ticket holds for a property, read the way that property's
   * own control reads it — the treatment the status and priority rows already
   * get from their glyphs, which is the palette showing you the value before
   * you change it.
   *
   * A value this project cannot read is shown as the file writes it rather than
   * as an empty slot: the bytes are preserved on disk (invariant 16), and a row
   * that showed nothing would say the ticket holds nothing.
   */
  function heldValue(property: TicketProperty): string | undefined {
    const held = targetTicket?.[property];
    if (!held) return undefined;
    const config = props.project.properties;
    if (property === "estimate")
      return readEstimate(held, config.estimate)?.text;
    if (property === "type") return config.type.values[held]?.name ?? held;
    const day = fromIso(held);
    return day ? displayDate(day, props.today) : held;
  }

  /**
   * The query read as a day, when the query is one — a date mode's answer *to*
   * what was typed rather than a match on it.
   *
   * This is the palette's answer to the context menu's `Pick a date…`, and it
   * is a better one here: that menu can grow a calendar because it is anchored
   * to a card, and this is a combobox whose whole job is already to read what
   * you type. So the four picks are the shortcuts and the whole typed grammar
   * stays reachable — through `parseDate`, the one parser, rather than a second
   * that would disagree with it about `28 Sep` in some year nobody tests.
   *
   * The row is labelled with the day it resolved to, in full, for the reason
   * the field echoes it: `28 Sep` typed in December is next year, and a date
   * that lands a year out must not be silent.
   *
   * A refused form comes back as a disabled row wearing the sentence that names
   * its next move — but only when nothing else matched, because `tom` both
   * refuses as a month and narrows to `Tomorrow`, and a refusal beside the row
   * that answers you is noise. A query the app understands well enough to
   * reject deserves better than `No matches`; one it can answer twice should
   * only say so once.
   */
  function typedDate(
    property: TicketProperty,
    held: string | undefined,
    matched: boolean,
  ): PaletteRow | undefined {
    const parsed = parseDate(query, props.today);
    if (parsed.kind === "empty") return undefined;
    if (parsed.kind === "refused")
      return matched
        ? undefined
        : {
            id: `${property}-typed`,
            label: query,
            disabled: true,
            reason: parsed.why,
          };
    const iso = toIso(parsed.date);
    return {
      id: `${property}-typed`,
      label: echoDate(parsed.date),
      value: iso,
      current: held === iso,
    };
  }

  /**
   * One property's sub-mode: the values the project defines, the one in force
   * ticked, and `Clear` when there is something to clear.
   *
   * The same three answers `ticketMenu.tsx` gives one surface over, read from
   * the same three functions — `typeOptions`, `estimateScale`, `datePicks` —
   * because a second place that decides what a due date may be set to is a
   * second place that can come to disagree with the file format. The switch on
   * *which* property this is lives here and nowhere else in this file, which is
   * the bargain `propertyFace` strikes for the menu and `PropertyControl` for
   * the panel: one branch to write for a fifth property, not three to find.
   */
  function propertyMode(property: TicketProperty): SubMode {
    const config = props.project.properties;
    const held = targetTicket?.[property];
    let values: PaletteRow[];
    if (property === "type") {
      values = typeOptions(config.type.values)
        // Minus its `None` row: clearing is the row below, under the word every
        // other property mode uses for it.
        .filter((option) => option.id !== "")
        .map((option) => ({
          id: `${property}-value-${option.id}`,
          label: option.label,
          glyph: option.glyph,
          value: option.id,
          current: option.id === held,
        }));
    } else if (property === "estimate") {
      values = estimateScale(config.estimate).map((value) => ({
        id: `${property}-value-${value}`,
        // Through the reader the rest of the app shows an estimate with, so a
        // t-shirt size is upper case here exactly as it is on a card.
        label: readEstimate(value, config.estimate)?.text ?? value,
        value,
        current: value === held,
      }));
    } else {
      values = datePicks(props.today).map((pick) => ({
        id: `${property}-value-${pick.id}`,
        label: pick.label,
        // The day the pick resolves to, shown before the press. It is the whole
        // reason a row may offer what the typed grammar refuses: nothing is
        // computed silently when the row says its own answer.
        tag: displayDate(pick.day, props.today),
        value: toIso(pick.day),
        // Compared as the format spells it, which is exact rather than a day
        // apart: `toIso` is the canonical shape, so a stored date this build
        // cannot read matches no pick — and it is not one of them.
        current: held === toIso(pick.day),
      }));
    }
    const rows = [
      ...values,
      // `Clear`, only where there is something to clear. The context menu's
      // rule, unchanged: a row that cannot do anything is worse than no row,
      // because it says the ticket holds a value.
      ...(held ? [{ id: `${property}-clear`, label: "Clear" }] : []),
    ];
    return {
      // The settings row's name, so the crumb, the root row and the pane in
      // Settings all call the property the same thing.
      crumb: PROPERTY_LABELS[property].name.toLowerCase(),
      rows,
      lead:
        property === "type" || property === "estimate"
          ? undefined
          : typedDate(
              property,
              held,
              rows.some((row) =>
                row.label.toLowerCase().includes(query.toLowerCase()),
              ),
            ),
      run: (row) => {
        props.onChangeProperty(property, row.value);
        props.onClose();
      },
      filterLocally: true,
    };
  }

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
    // One row per property the project has turned on, and none at all for a
    // project that has turned none on — which is every project written before
    // this build, and the reason four more rows are affordable at the root of a
    // list that already has twelve.
    //
    // `enabledPropertyFields` rather than a list written out: the panel's rail,
    // both create surfaces and the context menu already read the four in that
    // order, and a fifth surface with an order of its own is the disagreement
    // that function exists to prevent.
    ...enabledPropertyFields(props.project.properties).map((property) => ({
      id: `property-${property}`,
      // `Set priority…` is the shape every row of this kind takes here, and
      // `PROPERTY_LABELS` is the one place the four are named — lower-cased
      // into the sentence rather than spelled a second time, so a renamed
      // property is renamed here too.
      label: `Set ${PROPERTY_LABELS[property].name.toLowerCase()}…`,
      glyph: PROPERTY_GLYPHS[property],
      tag: heldValue(property),
      opens: property,
      disabled: !targetTicket,
      reason: targetTicket ? undefined : NO_TARGET,
    })),
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
  const MODES: Record<Exclude<Mode, "root">, SubMode> = {
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
    // A mode per property whether or not the project has turned it on: the root
    // offers a row only for an enabled one, so a mode nothing opens costs
    // nothing, and the record stays total — which is what makes a fifth
    // property a type error here rather than a mode that never opens.
    type: propertyMode("type"),
    estimate: propertyMode("estimate"),
    start: propertyMode("start"),
    due: propertyMode("due"),
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
  // The two answers-to-the-query the palette has, and they cannot coexist: a
  // key is only read at the root and a typed day only inside a date mode. One
  // slot for both, so `Enter` on the first row means the same thing in each.
  const lead = keyRow
    ? { ...keyRow, run: () => openTicketRow(keyRow) }
    : subMode?.lead;
  const visibleRows = lead ? [lead, ...filtered] : filtered;

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
