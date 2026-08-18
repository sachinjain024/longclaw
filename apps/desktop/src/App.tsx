import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chooseAndRelocateProject,
  chooseOpenFolder,
  chooseProjectFolder,
  createProjectInFolder,
  createTicket,
  editTicket,
  folderHoldsProject,
  homeDir,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
  registerProject,
  removeProject,
  reportVisibleUi,
  searchTickets,
  setProjectStarred,
  updateProjectName,
  updateProjectTheme,
} from "./api";
import { Board } from "./Board";
import { classes } from "./classes";
import { CommandPalette } from "./CommandPalette";
import { ConfirmDialog, RemoveProjectConfirm } from "./ConfirmDialog";
import { CreatePanel } from "./CreatePanel";
import { CreateProjectForm, type ProjectDraft } from "./CreateProjectForm";
import { DEV_CHROME } from "./devChrome";
import {
  readActiveProjectId,
  readProjectWorkspaces,
  rememberActiveProject,
  rememberAppearance,
  rememberProjectWorkspaces,
  type ProjectWorkspace,
  type ProjectWorkspacePatch,
  type ViewMode,
} from "./devicePreferences";
import { normalizeError } from "./errors";
import {
  failureMessage,
  failurePath,
  failureTitle,
  isUnreachableFailure,
} from "./failure";
import { filterTickets, isFiltering } from "./filtering";
import { FolderGlyph } from "./FolderGlyph";
import { GearGlyph, KebabGlyph } from "./SettingsGlyphs";
import { IssueList } from "./IssueList";
import { isChord, singleKeyShortcutAllowed } from "./keyContext";
import { MenuButton } from "./Menu";
import { mutate, type Mutation, useMutationStore } from "./mutations";
import { ORDERINGS, type OrderingMode } from "./ordering";
import { OwlMark } from "./OwlMark";
import { ProjectSettings } from "./ProjectSettings";
import { QuickCreate } from "./QuickCreate";
import type { FocusRequest } from "./rovingFocus";
import { ProjectMenu, SettingsMenu } from "./SettingsMenu";
import { LANDING_SECTION, type SettingsSection } from "./settingsSections";
import type { TicketMove } from "./ticketMove";
import { useLongClawStore } from "./state";
import { ThemeDot } from "./ThemeSwatch";
import { TicketPanel } from "./TicketPanel";
import {
  isArchived,
  priorityLabel,
  provisionalTicket,
  provisionalTicketKey,
  statusLabel,
} from "./tickets";
import type {
  AppError,
  CreateTicketRequest,
  HeldConflict,
  IndexedTicket,
  ProjectReference,
  TicketDraft,
  TicketEdit,
  TicketPriority,
  TicketStatus,
  TicketRow,
  WriteResult,
} from "./types";
import { WarnGlyph } from "./WarnGlyph";
import { ToastStack, WriteIndicator } from "./WriteFeedback";

/**
 * One ticket's share of a gesture: the row it starts from, how it reads before
 * the write returns, and the two edits — the one being made and the one that
 * takes it back. Most gestures are one of these; a drop that had to give the
 * tickets above it a place is several (`editMutation`, LC-174).
 */
interface EditStep {
  ticket: IndexedTicket;
  optimistic: Partial<IndexedTicket>;
  edit: TicketEdit;
  inverse: TicketEdit;
}

/** Which of a step's two edits is being sent. The other one puts it back. */
type Direction = "make" | "take back";

/**
 * A create that was submitted into one project and would land in another,
 * waiting on the human to say which (LC-188).
 *
 * The request is held whole rather than re-read from the surface: the surface
 * stays mounted behind the dialog and its draft is still editable, and a create
 * must write the words that were on screen when **Create** was pressed.
 */
interface PendingCreate {
  request: Omit<CreateTicketRequest, "projectId">;
  /** Full create's ending, carried across the question (`screen-specs.md:270-271`). */
  openPanel: boolean;
  /**
   * Quick create's, when **Create more** is ticked (LC-201). Carried for the
   * same reason `openPanel` is: a run that crosses a project switch resumes
   * into the same loop after the confirm rather than being closed by it.
   */
  keepOpen: boolean;
  /** Where the draft was composed, for the dialog's own words. */
  fromProjectId: string;
}

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "plum", label: "Plum" },
  { id: "graphite", label: "Graphite" },
];

/**
 * The file every settings write lands in, for the header's disk-state
 * indicator — which says `writing ticket.md…` by default and would otherwise
 * name a ticket for a write that never touched one.
 */
const PROJECT_FILE = "longclaw.yaml";

/** The note `screen-specs.md:324-325` puts under the ordering menu, verbatim. */
const ORDERING_FOOTNOTE =
  "Ordering is a view preference on this board — it never rewrites files.";

/**
 * Every row on every surface carries its ticket key, which is what lets one
 * selector serve the board's cards and the list's rows: the two never render at
 * once, and neither the focus call below nor the visible-UI probe cares which one
 * it found.
 */
const ROW = "[data-ticket-key]";

/**
 * Where focus goes when the row it came from is not there to go back to, which
 * is what archiving does to it. Both surfaces carry exactly one tab stop — the
 * card or row the arrows move from — so that is the sensible landing place, and
 * the create button is the fallback when nothing is left to stand on.
 */
function focusSurface() {
  requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`${ROW}[tabindex="0"]`);
    const fallback = document.querySelector<HTMLElement>(
      ".content-header .primary",
    );
    (row ?? fallback)?.focus();
  });
}

function sortedProjects(projects: ProjectReference[]) {
  return [...projects].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

/**
 * The 150ms crossfade a theme or appearance change wears
 * (`screen-specs.md:364`): the root briefly carries `theme-transition`, under
 * which `styles.css` transitions color-bearing properties only. The timeout
 * outlives the class by a little so the transition finishes before the rule
 * disappears; back-to-back changes just extend the window.
 */
const crossfade = (() => {
  let timer: number | undefined;
  return () => {
    document.documentElement.classList.add("theme-transition");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 220);
  };
})();

export function App() {
  const projects = useLongClawStore((state) => state.projects);
  const activeProjectId = useLongClawStore((state) => state.activeProjectId);
  const appearance = useLongClawStore((state) => state.appearance);
  const tickets = useLongClawStore((state) => state.tickets);
  const generation = useLongClawStore((state) => state.generation);
  const lastSequence = useLongClawStore((state) => state.lastSequence);
  const lastEvent = useLongClawStore((state) => state.lastEvent);
  const loading = useLongClawStore((state) => state.loading);
  const reconciling = useLongClawStore((state) => state.reconciling);
  const error = useLongClawStore((state) => state.error);
  const setProjects = useLongClawStore((state) => state.setProjects);
  const upsertProject = useLongClawStore((state) => state.upsertProject);
  const removeProjectReference = useLongClawStore(
    (state) => state.removeProjectReference,
  );
  const markProjectReachable = useLongClawStore(
    (state) => state.markProjectReachable,
  );
  const setActiveProjectId = useLongClawStore(
    (state) => state.setActiveProjectId,
  );
  const setAppearance = useLongClawStore((state) => state.setAppearance);
  const applySnapshot = useLongClawStore((state) => state.applySnapshot);
  const applyEvent = useLongClawStore((state) => state.applyEvent);
  const applyLocalWrite = useLongClawStore((state) => state.applyLocalWrite);
  const addProvisionalTicket = useLongClawStore(
    (state) => state.addProvisionalTicket,
  );
  const removeTicket = useLongClawStore((state) => state.removeTicket);
  const reconcileFailed = useLongClawStore((state) => state.reconcileFailed);
  const externalMarks = useLongClawStore((state) => state.externalMarks);
  const reviewTicket = useLongClawStore((state) => state.reviewTicket);
  const sweepMarks = useLongClawStore((state) => state.sweepMarks);
  const setLoading = useLongClawStore((state) => state.setLoading);
  const setError = useLongClawStore((state) => state.setError);

  const [selectedKey, setSelectedKey] = useState<string>();
  /**
   * Which create surface is up, if either (`screen-specs.md:253-271`). One at a
   * time: quick create's **Open full editor →** is a move between them, carrying
   * what has been typed rather than throwing it away.
   */
  const [createSurface, setCreateSurface] = useState<"quick" | "full">();
  /**
   * What the create surface opens with: what quick create had typed when
   * **Open full editor →** moved between the two, and the status a board
   * column's `+` preseeds. Cleared whenever create closes, either way.
   *
   * `priority` is optional because the two writers know different amounts: the
   * move between surfaces carries a priority somebody chose, while a column's
   * `+` chooses a status and nothing else (LC-186). Absent means "nobody said",
   * and each surface's own default answers it.
   */
  const [carriedDraft, setCarriedDraft] = useState<TicketDraft>();
  /**
   * The project the open create surface was raised in.
   *
   * A create surface outlives a project switch — the sidebar stays live behind
   * it — so the project a draft was composed against is the one that was on
   * screen when it opened, not the one `activeProjectId` holds by the time
   * **Create** is pressed. Reading it at submit is what filed the ticket in a
   * project the human was no longer looking at (LC-188).
   */
  const [createProjectId, setCreateProjectId] = useState<string>();
  /**
   * A create the sidebar moved out from under, held while the human answers
   * where it should land. The draft stays in the surface behind the dialog, so
   * cancelling costs nothing that was typed.
   */
  const [pendingCreate, setPendingCreate] = useState<PendingCreate>();
  /** Bumped when an external change lands for the open ticket. */
  const [panelReload, setPanelReload] = useState(0);
  /** Bumped when the open ticket disappears from disk. */
  const [panelRemoved, setPanelRemoved] = useState(0);
  /** Drives the acknowledgement age text and its decay. */
  const [now, setNow] = useState(() => Date.now());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  /**
   * The folder quick create was handed, which is only ever `Open folder`
   * falling through to it after the picker answered with a plain one (LC-170).
   * Its own button leaves this unset: that flow is form first, folder second,
   * and picks the folder at submit.
   */
  const [quickCreateFolder, setQuickCreateFolder] = useState<string>();
  /** Per-project workspace choices. Device-local, and never project data. */
  const [projectWorkspaces, setProjectWorkspaces] = useState<
    Record<string, ProjectWorkspace>
  >(readProjectWorkspaces);
  /**
   * Which settings section is open, and whether settings is open at all — one
   * piece of state, because they are one question (LC-208). A menu row names a
   * section, so opening the panel and choosing its pane is a single act.
   */
  const [settingsSection, setSettingsSection] = useState<SettingsSection>();
  const settingsOpen = settingsSection !== undefined;
  /** The gear's dropdown, which stands between the gear and the panel now. */
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  /**
   * The side-panel row whose `⋮` is open, and the button it hangs off.
   *
   * The **id**, not the project: this menu writes to the project it is open on
   * and stays up while the write lands, so a captured `ProjectReference` would
   * be a snapshot of the project as it was before its own edits. The theme
   * check would sit on the preset you just replaced, the star row would go on
   * offering `Unstar project` after unstarring — and, worse than either,
   * `toggleStar` reads `starred` off what it is handed, so a second press
   * would re-send the same value instead of putting it back.
   */
  const [projectMenu, setProjectMenu] = useState<{
    projectId: string;
    anchor: HTMLElement;
  }>();
  /** A removal raised from the `⋮` menu, waiting on the confirm that names it. */
  const [removingProject, setRemovingProject] = useState<ProjectReference>();
  /* Settings' own **Remove from app** waits on its answer inside the panel
     that offers it (`ProjectSettings.tsx`); the unreachable screen and the `⋮`
     menu keep their own. All three raise the same `RemoveProjectConfirm`. */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTicketKey, setPaletteTicketKey] = useState<string>();
  const [paletteSearchResults, setPaletteSearchResults] =
    useState<TicketRow[]>();
  /** The current user's home directory, for tilde-abbreviating paths. */
  const [homePath, setHomePath] = useState<string | null>(null);
  /**
   * Whether the project registry has been read yet. The difference between "no
   * projects" and "not asked yet", which is what keeps first launch's
   * full-window welcome (D-10) from flashing over every ordinary launch.
   */
  const [registryRead, setRegistryRead] = useState(false);
  const paletteReturnFocus = useRef<HTMLElement | undefined>(undefined);
  const filterField = useRef<HTMLInputElement>(null);
  /** The gear the settings dialog opens from, and the focus it owes on close. */
  const settingsButton = useRef<HTMLButtonElement>(null);

  const project = projects.find((item) => item.id === activeProjectId);
  /** The project whose `⋮` menu is open, as the store holds it *now*. */
  const menuProject = projects.find(
    (item) => item.id === projectMenu?.projectId,
  );
  /**
   * A project whose folder the last read could not reach.
   *
   * Nothing is creatable here (`states.md:80-98`): quick create used to open over
   * the unreachable screen offering `LC-1` as the next key, because the key is
   * guessed from rows on screen and there are none — a collision waiting to
   * happen the moment the folder came back (LC-140).
   */
  const unreachable = project !== undefined && !project.reachable;
  /**
   * Whether the active project's rows are actually in hand.
   *
   * `setActiveProjectId` puts `generation` back to 0 and only a snapshot puts a
   * number on it, so this is the difference between *this project has no
   * tickets* and *this project has not answered yet*. Creating against the
   * second one is the LC-140 collision from the other direction: the next key is
   * guessed off the rows on screen, and against an empty board the guess is
   * `KEY-1` — a key that already belongs to a ticket the app has simply not read
   * yet. A switch made mid-draft is how a human reaches that window (LC-188).
   */
  const boardLoaded = project !== undefined && generation > 0;
  /**
   * A project's name by id. Only one surface needs it — the dialog that names
   * the project a held draft came *from*, which by definition is not the open
   * one, so `project` cannot answer for it.
   */
  const projectName = (projectId: string) =>
    projects.find((candidate) => candidate.id === projectId)?.name ??
    "another project";
  const workspace = activeProjectId
    ? projectWorkspaces[activeProjectId]
    : undefined;
  const view = workspace?.view ?? "board";
  const filterQuery = workspace?.filterQuery ?? "";
  const updateWorkspace = useCallback(
    (patch: ProjectWorkspacePatch) => {
      if (!activeProjectId) return;
      setProjectWorkspaces((current) => ({
        ...current,
        [activeProjectId]: { ...current[activeProjectId], ...patch },
      }));
    },
    [activeProjectId],
  );
  const setView = useCallback(
    (next: ViewMode) => updateWorkspace({ view: next }),
    [updateWorkspace],
  );
  const setFilterQuery = useCallback(
    (next: string) => updateWorkspace({ filterQuery: next }),
    [updateWorkspace],
  );
  /** Priority until this project has been switched (ADR 0003's default). */
  const ordering: OrderingMode = workspace?.ordering ?? "priority";
  /** The row the panel is open on, read from the store both surfaces read. */
  const openRow = tickets.find((ticket) => ticket.key === selectedKey);
  const paletteTicket = tickets.find(
    (ticket) => ticket.key === paletteTicketKey,
  );
  const commandTarget =
    paletteTicket?.state === "indexed"
      ? paletteTicket
      : openRow?.state === "indexed"
        ? openRow
        : undefined;

  /**
   * The rows the surface draws. Narrowed once, here, so the board and the list
   * cannot disagree about what a query means — and before grouping rather than
   * inside it, because a filter says nothing about status (`filtering.ts`).
   */
  const visibleTickets = useMemo(
    () => filterTickets(tickets, filterQuery),
    [tickets, filterQuery],
  );
  const filtering = isFiltering(filterQuery);
  /**
   * Whether the query left the surface in front of you with nothing to draw.
   *
   * The board never draws an archived ticket (ADR 0004), so a query that matches
   * only archived ones is still "no matches" there while the list has a row for
   * it. Unreadable files are not an answer to a query either — they are exempt
   * from the filter, not matched by it.
   */
  const noMatches =
    filtering &&
    !visibleTickets.some(
      (row) => row.state === "indexed" && (view === "list" || !isArchived(row)),
    );
  const unreadableShown = noMatches
    ? visibleTickets.filter((row) => row.state === "degraded").length
    : 0;
  /**
   * Whether the panel is the thing on screen. One expression, because two — the
   * panel's own condition and the workspace class that centres it — would be
   * two places to keep in agreement about the same state. A project with no
   * tickets at all is the empty-project state whatever is in the field, and
   * that state stands inside the surface rather than instead of it.
   */
  const showNoMatches = noMatches && tickets.length > 0;
  /**
   * The empty-project state (`states.md:28-35`): a reachable project with no
   * ticket directories at all. It is not a filter state — the guide stands
   * whatever is in the field — and it is not a state that replaces the
   * workspace: the surface stays whole and hosts the guide (D-20/LC-86).
   */
  const emptyProject = tickets.length === 0;

  /**
   * The key the next create will probably claim, shown by both create surfaces
   * as the provisional ID. A guess off the rows on screen: Rust allocates the
   * real one from the project's own directory names.
   *
   * Undefined until the board has answered, because the guess off no rows is
   * `KEY-1` and that is a key the project has usually already spent. The
   * surfaces say `opening…` and refuse to create rather than showing it — a
   * create surface outlives a project switch, so this is a state a human
   * reaches by clicking a project while a draft is up (LC-140, LC-188).
   */
  const nextKey =
    project && boardLoaded
      ? provisionalTicketKey(project.key, tickets)
      : undefined;

  /**
   * Leaving create without creating. Focus goes back to the surface behind it —
   * its roving row, or the New ticket button that opened this — because rule 3
   * of the focus map is that closing a layer never drops focus on the floor.
   */
  function closeCreateSurface() {
    setCreateSurface(undefined);
    setCarriedDraft(undefined);
    focusSurface();
  }

  /**
   * Focus a card or row by key, through whichever surface is up.
   *
   * It used to be a `document.querySelector(…).focus()`, and both surfaces
   * render only the rows their scroll position touches — so a create that landed
   * past the window, or a panel closing over a row scrolled out of sight, focused
   * nothing and left `<body>` holding it. The surfaces answer this by moving
   * their tab stop first, which mounts the row, and taking focus after. Found by
   * the Step 17 accessibility audit; `keyboard-focus-map.md:16-18,131,161`.
   */
  const [cardFocus, setCardFocus] = useState<FocusRequest>();
  const focusCard = useCallback((key: string) => {
    setCardFocus((previous) => ({ key, nonce: (previous?.nonce ?? 0) + 1 }));
  }, []);

  const clearFilter = useCallback(() => {
    setFilterQuery("");
    // Rule 3 of the focus map: closing a layer never drops focus on the floor.
    filterField.current?.focus();
  }, [setFilterQuery]);
  /**
   * The guide card's action, on both surfaces. Plain quick create rather than
   * the column's preseeded one: quick create opens on Todo already, and the
   * guide is only ever standing in a project with nothing to preseed against.
   */
  const createFirstTicket = useCallback(() => setCreateSurface("quick"), []);
  /**
   * The guide, handed to whichever surface is drawn. Undefined is how a surface
   * is told it has no guide to host, so the board branch and the list branch
   * cannot come to disagree about which state they are in.
   */
  const guide = emptyProject ? createFirstTicket : undefined;
  const openTicket = useCallback(
    (key: string) => {
      setSelectedKey(key);
      setHeldConflict(undefined);
      // Opening a ticket is the review that decays its acknowledgement.
      reviewTicket(key);
    },
    [reviewTicket],
  );
  /** Closing returns focus to the card that opened the panel. */
  const closeTicket = useCallback(
    (key?: string) => {
      setSelectedKey(undefined);
      setHeldConflict(undefined);
      if (key) focusCard(key);
    },
    [focusCard],
  );

  /**
   * The edit a board-raised write was refused for, on its way to the panel.
   *
   * A conflict outside the panel used to offer **Open ticket** and nothing else:
   * the refused edit went back in the revert, so a human who still wanted their
   * change had to remember it and redo it against whatever they found. Holding
   * it here is what lets the panel put the ordinary two-way choice on screen —
   * and the panel is the only place it can go, because Keep mine must write
   * against a file the human has been shown rather than one nobody looked at
   * (V0-29; the question [plan 23](docs/plans/completed/23-…) left open).
   *
   * It is deliberately short-lived: opening any ticket or closing the panel
   * drops it, so a choice left behind is left behind.
   */
  const [heldConflict, setHeldConflict] = useState<HeldConflict>();

  /** Where an unresolved conflict goes: to the panel, holding its edit. */
  function handToPanel(ticketKey: string, edit: TicketEdit) {
    return (error: AppError) => {
      openTicket(ticketKey);
      setHeldConflict({ ticketKey, error, edit });
    };
  }
  const localProjects = sortedProjects(projects);
  const starredProjects = sortedProjects(
    projects.filter((candidate) => candidate.starred),
  );

  async function loadProject(projectId: string) {
    const knownProject = useLongClawStore
      .getState()
      .projects.find((project) => project.id === projectId);
    // A ticket panel is open on a key, and a key belongs to one project. Left
    // open across a switch it re-aims at the new project and asks it for a
    // ticket that was never in it, which is the second half of LC-188. A
    // relocate and a rename both re-load the project they are already on, so
    // this is a switch and not every load.
    if (projectId !== activeProjectId) {
      closeTicket();
      setPaletteTicketKey(undefined);
    }
    setActiveProjectId(projectId);
    // An unreachable project is opened like any other, deliberately. The flag is
    // the last read's answer, not a fact about the disk, so refusing to try
    // again is what kept a project unreachable after its folder came back
    // (LC-141) — and the open is the re-probe.
    setLoading(true);
    try {
      applySnapshot(await openProject(projectId));
    } catch (error) {
      const normalized = normalizeError(error);
      if (knownProject && isUnreachableFailure(normalized)) {
        // The panel says this one, with the path and the two actions that answer
        // it; a banner over the top would say it twice (D-59).
        markProjectReachable(projectId, false);
        setError(undefined);
        return;
      }
      setError(normalized);
    } finally {
      setLoading(false);
    }
  }

  /**
   * `⌘F` and the filter's rung of the `Esc` ladder (`keyboard-focus-map.md:19-31`).
   *
   * `⌘F` takes the chord from the webview's own find deliberately: WebKit would
   * search the windowed DOM and report one hit in a column of four hundred. It
   * stands down when there is no field to focus, so a webview with no project
   * open keeps its default behaviour.
   *
   * `Esc` clears the filter **last**, after menu → modal → description edit →
   * ticket panel. The first three stop the event themselves — `Menu` and
   * `DescriptionEditor` both call `stopPropagation`, so it never reaches this
   * listener — and the panel and the create modal are checked by state, because
   * the panel closes on `Esc` without preventing anything.
   */
  useEffect(() => {
    /**
     * The gear's menu or a row's `⋮` (LC-208). They are the ladder's *top*
     * rung, and they stop their own `Esc` — but a rung still has to be counted
     * here, because everything below reads this to stand down.
     */
    const menuOpen = settingsMenuOpen || projectMenu !== undefined;
    const layerOpen =
      selectedKey !== undefined ||
      createSurface !== undefined ||
      paletteOpen ||
      menuOpen ||
      // Settings is a modal since LC-125, so it takes a rung of this ladder:
      // its own `Esc` closes it, and that press must not also empty the filter
      // on the board behind it.
      settingsOpen;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isChord(event, "k")) {
        event.preventDefault();
        if (paletteOpen) return;
        // A menu is a layer, and the palette must not arrive underneath one.
        if (menuOpen) return;
        paletteReturnFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : undefined;
        setPaletteTicketKey(
          (document.activeElement as HTMLElement | null)?.dataset.ticketKey,
        );
        setPaletteOpen(true);
        return;
      }
      // `C` is global (`keyboard-focus-map.md:32`) but not *above* a modal: a
      // palette row and a create surface's buttons are focusable and are not
      // text inputs, so the suspension rule alone would let `C` open quick
      // create underneath whatever is already up. A menu row is a `<button>`
      // and so is exactly that case again (LC-208).
      if (
        project &&
        !unreachable &&
        !paletteOpen &&
        !settingsOpen &&
        !menuOpen &&
        createSurface === undefined &&
        singleKeyShortcutAllowed(event.target) &&
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setCreateSurface("quick");
        return;
      }
      // `⌘,` is the platform's own settings chord, and both menus advertise it
      // (LC-208). It opens the panel on `General` from anywhere a layer is not
      // already up — including from inside a field, since it is a chord
      // (`keyboard-focus-map.md:12-14`) — and closes nothing: pressing it with
      // settings already open is a no-op rather than a toggle, because the
      // panel's way out is `Esc` and a chord that also closed would fight the
      // section the human just picked.
      //
      // "From anywhere" stops at the palette and quick create, and has to. The
      // palette stops only `⌘K`, `Tab` and `Esc`, so this handler still sees
      // the press underneath it; `.settings-panel` and `.modal-scrim` are both
      // `--lc-z-modal` and the palette renders later in this file, so the panel
      // would open *behind* the surface that is holding focus — a layer nobody
      // can see, reach, or `Esc` past in one press. The menus go on advertising
      // it because they are the layer it dismisses.
      if (isChord(event, ",")) {
        if (!project || paletteOpen || createSurface !== undefined) return;
        event.preventDefault();
        // Whichever menu advertised the chord goes with the panel opening.
        setSettingsMenuOpen(false);
        setProjectMenu(undefined);
        closeTicket();
        setSettingsSection((current) => current ?? LANDING_SECTION);
        return;
      }
      if (isChord(event, "f")) {
        const field = filterField.current;
        if (
          !field ||
          createSurface !== undefined ||
          paletteOpen ||
          menuOpen ||
          settingsOpen
        )
          return;
        event.preventDefault();
        field.focus();
        // "Selects existing query" (`keyboard-focus-map.md:31`), so the next
        // keystroke replaces it rather than appending to it.
        field.select();
        return;
      }
      if (event.key !== "Escape" || layerOpen || !filtering) return;
      clearFilter();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // `project` is here because the `C` branch reads it. It was missing, and the
    // listener installed on mount — before any project had loaded — kept an
    // `undefined` project for as long as none of the others changed, so `C` did
    // nothing on a board that had just come up. The Step 17 accessibility audit
    // found it; `keyboard-focus-map.md:32` is the line it was breaking.
  }, [
    clearFilter,
    createSurface,
    filtering,
    paletteOpen,
    project,
    projectMenu,
    selectedKey,
    settingsMenuOpen,
    settingsOpen,
    unreachable,
  ]);

  /**
   * Takes the palette down. The results belong to a query that is gone — kept,
   * they would be the first thing the next `⌘K` → search showed, under somebody
   * else's query.
   */
  function dismissPalette() {
    setPaletteOpen(false);
    setPaletteSearchResults(undefined);
  }

  /** Dismiss plus the focus return the map owes an ordinary close (`:148`). */
  function closePalette() {
    dismissPalette();
    requestAnimationFrame(() => paletteReturnFocus.current?.focus());
  }

  useEffect(() => {
    // The launch value was restored before this component first rendered
    // (`devicePreferences.ts`), so the first pass records what it already says
    // and only a change made here reaches the file.
    rememberAppearance(appearance);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const stamp = () => {
      const root = document.documentElement;
      const next =
        appearance === "system"
          ? query.matches
            ? "dark"
            : "light"
          : appearance;
      // The first stamp is the launch value; only a *change* crossfades.
      if (root.dataset.theme && root.dataset.theme !== next) {
        crossfade();
      }
      root.dataset.theme = next;
    };
    stamp();
    // "System" is a live preference, not a launch-time read: macOS switching
    // appearance while the app is open re-stamps the root. An explicit
    // override subscribes too but keeps stamping its own value, so the
    // listener's lifetime is simply the effect's.
    query.addEventListener("change", stamp);
    return () => query.removeEventListener("change", stamp);
  }, [appearance]);

  useEffect(() => {
    if (!activeProjectId) return;
    rememberActiveProject(activeProjectId);
  }, [activeProjectId]);

  const latestProjectWorkspaces = useRef(projectWorkspaces);
  useEffect(() => {
    latestProjectWorkspaces.current = projectWorkspaces;
    // The filter changes on every keystroke. Coalesce a burst so persistence
    // never adds synchronous JSON work to the input-to-paint path.
    const timer = window.setTimeout(
      () => rememberProjectWorkspaces(projectWorkspaces),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [projectWorkspaces]);
  useEffect(
    () => () => rememberProjectWorkspaces(latestProjectWorkspaces.current),
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    const theme = project?.theme || "indigo";
    // The first stamp is the launch value; only a *change* crossfades.
    if (root.dataset.lcTheme && root.dataset.lcTheme !== theme) crossfade();
    root.dataset.lcTheme = theme;
  }, [project?.theme]);

  useEffect(() => {
    let active = true;
    let stopListening: undefined | (() => void);

    void (async () => {
      try {
        stopListening = await listenForProjectEvents((event) => {
          if (active) applyEvent(event);
        });
        const [projects, home] = await Promise.all([listProjects(), homeDir()]);
        if (!active) return;
        setProjects(projects);
        // Batched with the list itself, so no frame ever sees "read, and empty"
        // before the projects arrive.
        setRegistryRead(true);
        if (home) setHomePath(home);
        const remembered = readActiveProjectId();
        const reachable =
          projects.find(
            (project) => project.id === remembered && project.reachable,
          ) ?? projects.find((project) => project.reachable);
        if (reachable) await loadProject(reachable.id);
        else if (projects[0]) setActiveProjectId(projects[0].id);
      } catch (error) {
        if (active) setError(normalizeError(error));
      }
    })();

    return () => {
      active = false;
      stopListening?.();
    };
  }, [applyEvent, applySnapshot, setError, setLoading, setProjects]);

  // A folder that goes away while a create surface is up takes the surface with
  // it. Only hiding it would leave a half-typed ticket to reappear over a board
  // that has moved on by the time the folder comes back (LC-140).
  useEffect(() => {
    if (!unreachable) return;
    setCreateSurface(undefined);
    setCarriedDraft(undefined);
    setPendingCreate(undefined);
  }, [unreachable]);

  // Which project a create surface belongs to is decided when it opens and never
  // re-read while it is up, which is the whole of LC-188: the sidebar stays live
  // behind the surface, and a draft belongs to the board it was typed over.
  // Quick create's **Open full editor →** is a move between two modes of one
  // surface rather than a new one, so the origin it already holds stands — which
  // is why this keeps an origin it has and only fills in one it does not.
  useEffect(() => {
    if (createSurface === undefined) {
      setCreateProjectId(undefined);
      setPendingCreate(undefined);
      return;
    }
    setCreateProjectId((origin) => origin ?? activeProjectId);
  }, [createSurface, activeProjectId]);

  // An external change to the open ticket makes the panel re-read the file, so
  // the description, checklist, and timeline it shows are the ones on disk.
  useEffect(() => {
    if (!selectedKey || !lastEvent) return;
    if (
      lastEvent.event.type === "ticketChanged" &&
      lastEvent.event.data.ticket.key === selectedKey
    ) {
      setPanelReload(lastEvent.sequence);
      return;
    }
    if (
      lastEvent.event.type === "ticketRemoved" &&
      lastEvent.event.data.ticketKey === selectedKey
    ) {
      setPanelRemoved(lastEvent.sequence);
    }
  }, [lastEvent, selectedKey]);

  // Acknowledgements age visibly and then decay on their own.
  const hasMarks = Object.keys(externalMarks).length > 0;
  useEffect(() => {
    if (!hasMarks) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      sweepMarks(at);
    }, 1_000);
    return () => clearInterval(timer);
  }, [hasMarks, sweepMarks]);

  // A lost event cannot be caught up incrementally, so the store stops applying
  // events and says so; the snapshot is fetched here, because asking Rust for the
  // truth is the app's job rather than the cache's (ADR 0006). Exactly one request
  // goes out: the flag stays raised until a snapshot lands, and every event that
  // arrives meanwhile is dropped rather than queued.
  useEffect(() => {
    if (!reconciling) return;
    if (!activeProjectId) {
      reconcileFailed();
      return;
    }
    let active = true;
    void reconcileProject(activeProjectId)
      .then((snapshot) => {
        if (!active) return;
        // Both here rather than in a `finally`: applying the snapshot lowers
        // `reconciling`, which re-runs this effect and marks this pass inactive
        // before a `finally` would ever get to run.
        applySnapshot(snapshot);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        // Surfaced, not retried. The next gap asks again; a timer here would
        // rebuild the same silent-failure problem one layer up.
        setError(normalizeError(error));
        reconcileFailed();
      });
    return () => {
      active = false;
    };
  }, [
    reconciling,
    activeProjectId,
    applySnapshot,
    reconcileFailed,
    setError,
    setLoading,
  ]);

  useEffect(() => {
    let reconcileInFlight = false;
    const reconcile = () => {
      if (
        document.visibilityState !== "visible" ||
        !activeProjectId ||
        reconcileInFlight
      ) {
        return;
      }
      reconcileInFlight = true;
      // Coming back to an unreachable project asks the registry rather than the
      // engine: there is no engine to ask, and re-listing is what notices a
      // folder that was remounted while the window was in the background
      // (LC-141). A project that has recovered is then opened for real.
      if (!project?.reachable) {
        void listProjects()
          .then((registered) => {
            setProjects(registered);
            const recovered = registered.find(
              (candidate) =>
                candidate.id === activeProjectId && candidate.reachable,
            );
            if (recovered) return loadProject(recovered.id);
          })
          .catch((error) => setError(normalizeError(error)))
          .finally(() => {
            reconcileInFlight = false;
          });
        return;
      }
      void reconcileProject(activeProjectId)
        .then(applySnapshot)
        .catch((error) => {
          // A failed read *is* the unreachable trigger (`states.md:80-98`), and
          // treating it as an ordinary error is how the app went on showing
          // cached rows as though they were live (LC-139).
          const normalized = normalizeError(error);
          if (isUnreachableFailure(normalized)) {
            markProjectReachable(activeProjectId, false);
            return;
          }
          setError(normalized);
        })
        .finally(() => {
          reconcileInFlight = false;
        });
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("focus", reconcile);
    };
    // `loadProject` is deliberately not listed: it is redefined on every render,
    // and the recovery path only reads it when the listener fires.
  }, [
    activeProjectId,
    applySnapshot,
    markProjectReachable,
    project?.reachable,
    setError,
    setProjects,
  ]);

  useLayoutEffect(() => {
    if (!activeProjectId) return;
    const frame = requestAnimationFrame(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW));
      void reportVisibleUi({
        projectId: activeProjectId,
        rowCount: rows.length,
        rowTitles: rows
          .map((row) => row.querySelector("strong")?.textContent ?? "")
          .filter(Boolean),
        lastSequence,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeProjectId, lastSequence, tickets]);

  /**
   * What every path that ends in a project does with it. `null` is a cancelled
   * picker, which is an answer rather than a failure and leaves the screen
   * where it was.
   */
  async function adoptProject(project: ProjectReference | null) {
    if (!project) return;
    upsertProject(project);
    closeQuickCreate();
    await loadProject(project.id);
  }

  /** Shut, and holding no folder: the next open decides that again. */
  function closeQuickCreate() {
    setQuickCreateOpen(false);
    setQuickCreateFolder(undefined);
  }

  /**
   * The sidebar's quick create: form first, folder second, because a 240px
   * panel has no room for a second step and the folder is the last thing it
   * needs. Its picker runs through the same branch as every other
   * (`screen-specs.md:99-101`) — the draft is already answered by the time the
   * folder is, so an initialised folder opens rather than being refused, and
   * the answers that were never going to be used go with the form. That
   * refusal is the one LC-170 was filed over, three questions and all; this
   * surface just asked them in the other order.
   */
  async function createProject(draft: ProjectDraft) {
    const folder = await pickFolderAndOpenIfProject(chooseProjectFolder);
    if (folder) await createProjectIn(folder, draft);
  }

  /**
   * The folder picker as first launch's opening question (D-11), and then the
   * one question that decides which screen its answer leads to
   * (`screen-specs.md:99-101`): a folder that already holds a project opens,
   * and a plain one goes on to the create form. Which button was pressed picks
   * the picker's title and nothing else — before LC-170 each button owned one
   * half of that branch and neither fell through, so `Create a project` on an
   * initialised repo asked for a name, a key and a theme and then refused, and
   * `Open a folder` on a plain one refused outright.
   *
   * What comes back is the folder to run a create form for, or `null` when
   * there is no next screen to show: a cancelled picker, a project that has
   * just been opened, or a failure already on the error banner. The caller owns
   * the form, because the surface that asked owns which step it is on —
   * `Welcome` its own, the sidebar its quick create.
   */
  async function pickFolderAndOpenIfProject(
    pick: () => Promise<string | null>,
  ) {
    try {
      const chosen = await pick();
      // A cancelled picker is an answer rather than a failure.
      if (!chosen) return null;
      if (!(await folderHoldsProject(chosen))) return chosen;
      await adoptProject(await registerProject(chosen));
      return null;
    } catch (error) {
      setError(normalizeError(error));
      return null;
    }
  }

  const chooseCreateFolder = () =>
    pickFolderAndOpenIfProject(chooseProjectFolder);
  const chooseOpenProject = () => pickFolderAndOpenIfProject(chooseOpenFolder);

  /** Create in the folder the picker already answered with (D-11). */
  async function createProjectIn(rootPath: string, draft: ProjectDraft) {
    try {
      await adoptProject(await createProjectInFolder(rootPath, draft));
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  async function relocateActiveProject(projectId: string) {
    try {
      const project = await chooseAndRelocateProject(projectId);
      if (!project) return;
      upsertProject(project);
      await loadProject(project.id);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /**
   * A write to `longclaw.yaml`, with the acknowledgement every other write in
   * this app already gets (LC-208).
   *
   * The settings writes went out through bare `await`s: the header's disk-state
   * indicator never moved, no toast was raised, and a rename that landed looked
   * exactly like a rename that was dropped — the field simply kept the name you
   * typed. `mutate()` cannot serve them, because it is built around a
   * `WriteResult` for one ticket and an `expectedHash` a project file has no
   * equivalent of. This is the same contract at project scale: mark the disk
   * busy, say what changed and where it landed, and put the previous value
   * behind an Undo when the change is one field with one inverse.
   */
  async function writeProjectFile<T>(options: {
    /** Present tense, for the toast: `Renamed to "Longclaw"`. */
    message: string;
    write: () => Promise<T>;
    onWritten: (result: T) => void;
    /** The inverse, where there is a one-field one. `⌘Z` runs it. */
    undo?: () => void;
    /** Runs before the write, and again with `false` if it is refused. */
    optimistic?: (applied: boolean) => void;
  }) {
    const { beginWrite, endWrite, raise } = useMutationStore.getState();
    options.optimistic?.(true);
    beginWrite(PROJECT_FILE);
    try {
      options.onWritten(await options.write());
      endWrite(PROJECT_FILE);
      raise({ message: options.message, tone: "default", undo: options.undo });
      return true;
    } catch (error) {
      options.optimistic?.(false);
      endWrite();
      setError(normalizeError(error));
      return false;
    }
  }

  async function toggleStar(project: ProjectReference) {
    await writeProjectFile({
      message: project.starred
        ? `Unstarred ${project.name}`
        : `Starred ${project.name}`,
      write: () => setProjectStarred(project.id, !project.starred),
      onWritten: upsertProject,
      undo: () => void toggleStar({ ...project, starred: !project.starred }),
    });
  }

  /**
   * Theme applies instantly (`screen-specs.md:116-118`): the reference flips
   * before the write returns — the crossfade is the acknowledgement — and a
   * refused write flips it back and says so. No snapshot re-fetch: the theme
   * is a fact about `longclaw.yaml`, not about tickets, so re-loading the
   * project would only put a skeleton where the spec puts a color transition.
   */
  /**
   * The project is a parameter rather than the open one, because the side
   * panel's `⋮` menu restyles a row without opening it (LC-208) — a project's
   * dot in the sidebar carries its own preset, so the change is visible from
   * there without a switch.
   */
  async function changeTheme(
    target: ProjectReference | undefined,
    theme: string,
  ) {
    if (!target || target.theme === theme) return;
    const previous = target;
    const label = THEMES.find((option) => option.id === theme)?.label ?? theme;
    await writeProjectFile({
      message: `Theme set to ${label}`,
      // The crossfade is the *instant* acknowledgement the spec asks for; the
      // toast is the durable one, and the only thing that says the preset
      // reached the file rather than just the window.
      optimistic: (applied) =>
        upsertProject(applied ? { ...target, theme } : previous),
      write: () => updateProjectTheme(target.id, theme),
      onWritten: upsertProject,
      undo: () => void changeTheme({ ...target, theme }, previous.theme),
    });
  }

  async function renameProject(name: string) {
    if (!project || name.trim() === project.name) return;
    const previous = project;
    const adopt = (updated: ProjectReference) => {
      upsertProject(updated);
      void loadProject(updated.id);
    };
    await writeProjectFile({
      message: `Renamed to ${name.trim()}`,
      write: () => updateProjectName(previous.id, name),
      onWritten: adopt,
      // Its own write, not a second call to this function. `renameProject`
      // reads the open project from the render it was defined in, and the undo
      // runs from the render *before* the rename landed — so the guard at the
      // top would compare the old name against the old name and return, and
      // Undo would be a button that does nothing.
      undo: () =>
        void writeProjectFile({
          message: `Renamed back to ${previous.name}`,
          write: () => updateProjectName(previous.id, previous.name),
          onWritten: adopt,
        }),
    });
  }

  /** Closes the settings panel and hands focus back to the gear that opened it. */
  function closeSettings() {
    setSettingsSection(undefined);
    requestAnimationFrame(() => settingsButton.current?.focus());
  }

  /**
   * Forgets a project, from settings' danger zone or a row's `⋮` (LC-208).
   *
   * The two are not the same removal, and the difference is which project it
   * was. Removing the **open** one takes its board with it, so the settings
   * panel has nothing left to describe and the gear it was opened from is
   * gone — the shell falls back to the welcome column, whose first control is
   * where focus has to land. Removing **another** one is a change to the
   * sidebar and nothing else: whatever was on screen stays, settings stays
   * open if it was open, and focus belongs back where the sidebar can still
   * take it rather than on a welcome screen that is not being shown.
   */
  async function forgetProject(projectId: string) {
    const wasOpen = projectId === activeProjectId;
    try {
      await removeProject(projectId);
      removeProjectReference(projectId);
      setRemovingProject(undefined);
      setProjectMenu(undefined);
      if (!wasOpen) {
        // The `⋮` this was raised from went with its row, so focus is placed
        // on the surface that is still there rather than left on `<body>`.
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(".project-nav .project-link")
            ?.focus(),
        );
        return;
      }
      setSettingsSection(undefined);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".welcome-actions button")?.focus(),
      );
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /**
   * **Create**, pressed on either create surface.
   *
   * The write itself is `writeNewTicket`. This is the one question asked in
   * front of it: a draft composed over one project's board and submitted over
   * another's is not obviously meant for either, so it is put to the human
   * rather than resolved by whichever project happens to be active (LC-188).
   * The surface stays up behind the dialog, holding what was typed.
   */
  function submitNewTicket(
    request: Omit<CreateTicketRequest, "projectId">,
    options?: { openPanel?: boolean; keepOpen?: boolean },
  ) {
    if (createProjectId !== undefined && createProjectId !== activeProjectId) {
      setPendingCreate({
        request,
        openPanel: options?.openPanel === true,
        keepOpen: options?.keepOpen === true,
        fromProjectId: createProjectId,
      });
      return;
    }
    writeNewTicket(request, {
      openPanel: options?.openPanel === true,
      keepOpen: options?.keepOpen === true,
    });
  }

  /**
   * Creating never blocks on the disk write (`screen-specs.md:260-262`): the
   * card appears at once under a key guessed from the board, the surface closes,
   * and whatever key Rust allocated replaces the guess when the write lands.
   *
   * `openPanel` is full create's ending (`screen-specs.md:270-271`): the panel swaps
   * to view mode of **the real ticket**, so it can only open once the write has
   * returned a key — view mode reads the file, and there is no file to read
   * before then. The card is still optimistic, and focus rides it in the
   * meantime, so nothing waits and focus never lands on the floor.
   *
   * `keepOpen` is quick create's Create more loop (LC-201), and it is the exact
   * negation of the two things every other create does: the surface stays up,
   * and **focus does not follow the card** — neither optimistically nor when
   * the write returns. The second one is the whole reason this is a flag rather
   * than a caller's afterthought: `onWritten` fires when the disk answers,
   * which during a run is while the human is typing the next ticket's title,
   * and a create that stole the caret mid-word would read as dropped
   * keystrokes rather than as a focus bug.
   *
   * It always writes into the project on screen *now*, which is what makes the
   * question in `submitNewTicket` the only place the destination is decided.
   */
  function writeNewTicket(
    request: Omit<CreateTicketRequest, "projectId">,
    { openPanel, keepOpen }: { openPanel: boolean; keepOpen: boolean },
  ) {
    const projectId = activeProjectId;
    if (!projectId || !project) return;
    // Unreachable, and deliberately silent: both create surfaces disable their
    // own **Create** while the key is unknown and the confirm disables its own,
    // so refusing here has no user to tell. It stands as the last guard on the
    // thing that actually goes wrong — a guess of `KEY-1` against a board that
    // has not answered, taking a real ticket's seat through
    // `addProvisionalTicket`, which keys by key (LC-140, LC-188).
    if (!boardLoaded) return;
    const guessKey = provisionalTicketKey(project.key, tickets);
    if (!keepOpen) setCreateSurface(undefined);
    setCarriedDraft(undefined);

    void mutate({
      apply: () => {
        addProvisionalTicket(
          provisionalTicket(guessKey, request, new Date().toISOString()),
        );
        if (!keepOpen) focusCard(guessKey);
        return () => removeTicket(guessKey);
      },
      write: () => createTicket({ projectId, ...request }),
      onWritten: (written) => {
        removeTicket(guessKey);
        applyLocalWrite(written.ticket, written.generation);
        if (openPanel) openTicket(written.ticket.key);
        else if (!keepOpen) focusCard(written.ticket.key);
      },
      toast: (written) => `${written.ticket.key} created`,
      // v0 has no ticket deletion (ADR 0004), so the inverse of a create is an
      // archive. The copy says so rather than implying the file went away.
      undo: (written) => ({
        path: written.ticket.relativePath,
        write: () =>
          editTicket({
            projectId,
            ticketKey: written.ticket.key,
            expectedHash: written.ticket.contentHash,
            edit: { archived: true },
          }),
        onWritten: (result) =>
          applyLocalWrite(result.ticket, result.generation),
        toast: () =>
          `${written.ticket.key} archived — v0 never deletes a ticket file`,
        review: handToPanel(written.ticket.key, { archived: true }),
      }),
      // The create itself sends no hash, so it cannot conflict; its inverse can.
      failure: (error) => `The ticket could not be created. ${error.message}`,
    });
  }

  /**
   * One edit to one ticket, raised outside the panel: the board's `P` menu, a
   * drop, an archive. All three are the same shape — show it now, write it, and
   * offer the inverse — so they are built here rather than written out three
   * times with three chances to disagree about the hash or the conflict offer.
   *
   * The inverse is an ordinary mutation with no `undo` of its own, which is the
   * scope `data-requirements.md:121` sets: the inverse of the last mutation, not
   * a history stack. `Mutation.undo` returning a `Mutation` is what enforces it,
   * and this must not be tempted into recursing to build the inverse.
   *
   * The panel's own edits do not come through here: `save()` in `TicketPanel`
   * carries a conflict banner, a draft, and a reload this knows nothing about.
   */
  function editMutation(options: {
    /** Captured by the caller, because a mutation outlives its render. */
    projectId: string;
    ticket: IndexedTicket;
    /** How the row reads before the write returns. */
    optimistic: Partial<IndexedTicket>;
    edit: TicketEdit;
    inverse: TicketEdit;
    /**
     * Other tickets this same gesture writes, written before the ticket itself.
     *
     * A drop into a group where nothing has a rank has to give the tickets
     * above it a place, or there is no position for the dragged one to take
     * (`ordering.ts`, LC-174). It is one thing the human did, so it is one
     * mutation: one disk-state indicator, one toast, one Undo — and a failure
     * part-way through puts back what it has already written rather than
     * leaving a group half-ordered.
     */
    backfill?: EditStep[];
    toast: string;
    inverseToast: string;
    failure?: (error: AppError) => string;
  }): Mutation {
    const { projectId, ticket } = options;
    // The backfill first and the dragged ticket last, so its receipt is the one
    // the toast, the indicator and the Undo are all built from. The ordinary
    // edit is this list of one, which is what keeps a single path.
    const steps: EditStep[] = [
      ...(options.backfill ?? []),
      {
        ticket,
        optimistic: options.optimistic,
        edit: options.edit,
        inverse: options.inverse,
      },
    ];

    /** What each step's forward write left on disk, for the inverse to send. */
    let landed: WriteResult[] = [];

    /** One step, written and shown. The row reads as the disk does afterwards. */
    const send = (step: EditStep, expectedHash: string, going: Direction) =>
      editTicket({
        projectId,
        ticketKey: step.ticket.key,
        expectedHash,
        edit: going === "make" ? step.edit : step.inverse,
      }).then((result) => {
        applyLocalWrite(result.ticket, result.generation);
        return result;
      });

    /**
     * One pass over the gesture: every ticket in order, reporting the last
     * one's receipt. `going` is which of each step's two edits is being sent,
     * and the other one is what unwinds a pass that failed part-way.
     */
    const pass =
      (hash: (step: EditStep, index: number) => string, going: Direction) =>
      async (): Promise<WriteResult> => {
        const done: WriteResult[] = [];
        try {
          for (const [index, step] of steps.entries()) {
            done.push(await send(step, hash(step, index), going));
          }
        } catch (error) {
          // Best effort, and in reverse: half a gesture on disk is a position
          // nobody chose, and worse than the failure the human is about to be
          // told about. What will not go back is left to the watcher to report.
          for (let index = done.length - 1; index >= 0; index -= 1) {
            await send(
              steps[index],
              done[index].ticket.contentHash,
              going === "make" ? "take back" : "make",
            ).catch(() => {});
          }
          throw error;
        }
        if (going === "make") landed = done;
        return done[done.length - 1];
      };

    return {
      path: ticket.relativePath,
      // The row shows the change at once; a failed write puts it back exactly as
      // it was read.
      apply: () => {
        for (const step of steps) {
          applyLocalWrite({ ...step.ticket, ...step.optimistic }, generation);
        }
        return () => {
          for (const step of steps) applyLocalWrite(step.ticket, generation);
        };
      },
      write: pass((step) => step.ticket.contentHash, "make"),
      onWritten: (result) => applyLocalWrite(result.ticket, result.generation),
      toast: () => options.toast,
      undo: (result) => ({
        path: result.ticket.relativePath,
        // The hash each step's own first write left, so the inverse is not
        // refused as stale by its own predecessor.
        write: pass(
          (step, index) => landed[index].ticket.contentHash,
          "take back",
        ),
        onWritten: (undone) =>
          applyLocalWrite(undone.ticket, undone.generation),
        toast: () => options.inverseToast,
        review: handToPanel(ticket.key, options.inverse),
      }),
      failure: options.failure,
      // A conflict here cannot reach the panel's banner while the write is in
      // flight — these writes outlive any panel — so the refused edit travels
      // to the panel instead, where it gets the same two-way choice a save made
      // in the panel would have got.
      review: handToPanel(ticket.key, options.edit),
    };
  }

  /**
   * The `P` menu on a focused card. The panel has `save()` over the same seam;
   * a card on the board is outside it, so this goes to `mutate()` directly.
   */
  function changePriority(ticket: IndexedTicket, next: TicketPriority) {
    const projectId = activeProjectId;
    if (!projectId || next === ticket.priority) return;

    void mutate(
      editMutation({
        projectId,
        ticket,
        optimistic: { priority: next },
        edit: { priority: next },
        inverse: { priority: ticket.priority },
        toast: `${ticket.key} → ${priorityLabel(next)}`,
        inverseToast: `${ticket.key} back to ${priorityLabel(ticket.priority)}`,
      }),
    );
  }

  function changeStatus(ticket: IndexedTicket, next: TicketStatus) {
    const projectId = activeProjectId;
    if (!projectId || next === ticket.status) return;
    void mutate(
      editMutation({
        projectId,
        ticket,
        optimistic: { status: next },
        edit: { status: next },
        inverse: { status: ticket.status },
        toast: `${ticket.key} → ${statusLabel(next)}`,
        inverseToast: `${ticket.key} status restored`,
      }),
    );
  }

  /**
   * A card let go somewhere else on the board: another column (LC-60), another
   * place in its own column (ADR 0003), or — in Manual — both at once, because a
   * card arriving in a column is given a place in it.
   *
   * One gesture, one mutation. The card's own status and rank are one edit —
   * two writes would be two files' worth of undo for one drop, and the card
   * would sit in the new column at the old rank in between. A drop that also
   * had to give the cards above it a place carries them in the same mutation
   * for the same reason (LC-174): the `backfill` is written first, so the card has
   * something to sit under, and one Undo takes the whole gesture back.
   *
   * The board allocates the ranks — LongClaw owns rank allocation in v0 — and
   * this writes them, the same way the `P` menu's pick is written.
   *
   * The inverse is what each card had, and a card that had no rank is put back
   * to having none: `TicketEdit.rank` takes `null` to clear the key. Nothing
   * else in the app ever sends that, because leaving Manual mode is a view
   * preference and must not rewrite a file.
   */
  function moveCard(ticket: IndexedTicket, move: TicketMove) {
    const projectId = activeProjectId;
    if (!projectId) return;
    // `TicketDocument::apply` refuses an edit that changes nothing, so a half
    // of the move that is already true is left out of it rather than sent.
    const status = move.status === ticket.status ? undefined : move.status;
    const rank = move.rank === ticket.rank ? undefined : move.rank;
    // The cards a place had to be made for. The surface names them by key; the
    // row that carries the hash a write is sent against is the store's, so it
    // is looked up here — and a key the store no longer holds is dropped rather
    // than written blind.
    const backfill = (move.backfill ?? []).flatMap<EditStep>((one) => {
      const row = tickets.find((held) => held.key === one.key);
      if (row?.state !== "indexed" || row.rank === one.rank) return [];
      return [
        {
          ticket: row,
          optimistic: { rank: one.rank },
          edit: { rank: one.rank },
          inverse: { rank: row.rank ?? null },
        },
      ];
    });
    if (status === undefined && rank === undefined && backfill.length === 0) {
      return;
    }
    // The same two fields either way: what the row shows at once, and what the
    // write carries. A `TicketEdit` is a `Partial<IndexedTicket>` in this much.
    const change = { ...(status && { status }), ...(rank && { rank }) };

    void mutate(
      editMutation({
        projectId,
        ticket,
        optimistic: change,
        edit: change,
        backfill,
        inverse: {
          ...(status && { status: ticket.status }),
          ...(rank && { rank: ticket.rank ?? null }),
        },
        // The column is the salient half when there is one: it is the change the
        // human will look for on the board, and the rank is where it landed.
        toast: status
          ? `${ticket.key} → ${statusLabel(status)}`
          : `${ticket.key} moved`,
        inverseToast: status
          ? `${ticket.key} back in ${statusLabel(ticket.status)}`
          : `${ticket.key} back where it was`,
        failure: (error) =>
          `${ticket.key} could not be moved. ${error.message}`,
      }),
    );
  }

  /**
   * Archive and unarchive (ADR 0004): a date in the frontmatter, never a move
   * and never a delete. It is raised here rather than through the panel's
   * `save()` because archiving closes the panel — the toast, its Undo, the
   * revert a failed write owes, and the conflict a stale hash would raise all
   * have to outlive the component that asked for them, and this one does.
   */
  function setArchived(ticket: IndexedTicket, archived: boolean) {
    const projectId = activeProjectId;
    // `TicketDocument::apply` refuses an edit that changes nothing.
    if (!projectId || archived === isArchived(ticket)) return;
    // Archiving hides the ticket, so the panel it was raised from goes with it;
    // unarchiving puts it back on the board and leaves the panel open
    // (`screen-specs.md:219-223`).
    if (archived) {
      closeTicket();
      focusSurface();
    }

    void mutate(
      editMutation({
        projectId,
        ticket,
        // The card leaves the board now. The timestamp is a guess only until the
        // write returns with the one Rust actually recorded.
        optimistic: {
          archivedAt: archived ? new Date().toISOString() : undefined,
        },
        edit: { archived },
        // Genuinely clean, unlike undoing a create: the inverse of an archive is
        // an unarchive, and the file ends where it started.
        inverse: { archived: !archived },
        toast: `${ticket.key} ${archived ? "archived" : "unarchived"}`,
        inverseToast: `${ticket.key} ${archived ? "unarchived" : "archived"}`,
        failure: (error) =>
          `${ticket.key} could not be ${archived ? "archived" : "unarchived"}. ${error.message}`,
      }),
    );
  }

  /* First launch is the whole window (`screen-specs.md:88`, D-10). The shell
     used to stay up around it: a 240px sidebar reading `No starred projects`
     and `No local projects` beside a screen whose entire subject is that there
     are none — the same statement twice, the second time in a form the user
     can do nothing with. The prototype's own renderer draws the line in the
     same place: `app.projects.length === 0 ? welcomeHTML() : shellHTML()`.

     Gated on the registry having been read, not on the list alone: `projects`
     is empty for the first frame of every launch, and without the gate every
     returning user would see this screen flash before their board arrived. A
     registry read that *failed* is not an empty registry, so it keeps the
     shell — that is the one surface that can show the error and still offer
     `Create project` and `Open folder`. */
  if (registryRead && projects.length === 0) {
    return (
      <main className="welcome-shell">
        {error && <ErrorBanner error={error} />}
        <Welcome
          onChooseFolder={chooseCreateFolder}
          onCreate={(rootPath, draft) => void createProjectIn(rootPath, draft)}
          onOpen={chooseOpenProject}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div className="brand-lockup">
          <OwlMark size={22} />
          <strong>LongClaw</strong>
        </div>

        {/* Above the sections, under the lockup: the sidebar is the surface
            that lists projects, so "add one" belongs on it, and `.project-nav`
            has no `overflow-y` — at the foot these scroll out of reach once the
            list is long enough. Founder decision, 2026-08-06; the spec was
            amended to match (`screen-specs.md` § App shell, LC-73).

            The hierarchy is the point, and it is what makes this not the two
            filled buttons D-0B flagged: `New ticket` is the app's primary and
            keeps the only filled accent on screen, so create is `secondary` and
            open is the quiet `ghost` beneath it (`components.md:49-53`). */}
        <section className="project-actions">
          <button
            tabIndex={0}
            className="secondary"
            onClick={() =>
              quickCreateOpen ? closeQuickCreate() : setQuickCreateOpen(true)
            }
          >
            Create project
          </button>
          <button
            tabIndex={0}
            className="ghost"
            onClick={() =>
              void chooseOpenProject().then((folder) => {
                // A plain folder is an offer to create one there rather than a
                // refusal (LC-170). The form below is this surface's create
                // step, so the fall-through lands in it with the folder already
                // answered — the same two screens the welcome column runs, in
                // the space the sidebar has.
                if (folder) {
                  setQuickCreateFolder(folder);
                  setQuickCreateOpen(true);
                }
              })
            }
          >
            Open folder
          </button>
          {quickCreateOpen && (
            <CreateProjectForm
              // Remounted when the folder changes: the form reads it once, to
              // prefill the name and the key and to take the caret.
              key={quickCreateFolder ?? ""}
              className="quick-create"
              themes={THEMES}
              folder={quickCreateFolder}
              // Naming the step that is actually next. `Choose folder` is a
              // promise the fall-through has already kept.
              submitLabel={
                quickCreateFolder === undefined
                  ? "Choose folder"
                  : "Create project"
              }
              onSubmit={(draft) =>
                quickCreateFolder === undefined
                  ? void createProject(draft)
                  : void createProjectIn(quickCreateFolder, draft)
              }
            />
          )}
        </section>

        <nav className="project-nav" aria-label="Projects">
          <ProjectSection
            title="Starred"
            empty="No starred projects"
            projects={starredProjects}
            activeProjectId={activeProjectId}
            onOpen={(id) => void loadProject(id)}
            menuFor={projectMenu?.projectId}
            onMenu={(project, anchor) =>
              setProjectMenu({ projectId: project.id, anchor })
            }
            onCloseMenu={() => setProjectMenu(undefined)}
          />
          <ProjectSection
            title="Local"
            empty="No local projects"
            projects={localProjects}
            activeProjectId={activeProjectId}
            onOpen={(id) => void loadProject(id)}
            menuFor={projectMenu?.projectId}
            onMenu={(project, anchor) =>
              setProjectMenu({ projectId: project.id, anchor })
            }
            onCloseMenu={() => setProjectMenu(undefined)}
          />
        </nav>

        <div className="side-panel-footer">
          {/* Appearance is an app preference, not project data, and the spec
              puts its 3-up segment in project settings (`screen-specs.md:331`),
              not here — the native `<select>` that used to sit above this line
              was the only OS chrome left in the sidebar (LC-72). Until the
              settings modal carries the segment (LC-127), the palette's
              `Toggle appearance` command is the control. */}
          {/* The claim the whole product rests on, stated where the shell can
              always show it (`screen-specs.md:34`). */}
          <p className="trust-line">v0 · local · no account</p>
        </div>
      </aside>

      <section className="main-panel">
        {/* The code used to be the heading here, so an ordinary read-only
            folder announced itself as `permission denied` (V0-29). */}
        {/* Not while the project is unreachable: that state is one centered
            panel (`states.md:80-98`), and a banner over the top of it said the
            same thing twice — the second time in registry-speak (D-59). */}
        {error && !unreachable && <ErrorBanner error={error} />}

        {!project ? (
          /* Projects the registry has, none of them open — what removing the
             open one leaves behind while others remain. Nothing at all until
             the registry *has* answered: a welcome column drawn over an unread
             registry is a statement about projects nobody has counted, and it
             is replaced a frame later by the board it was standing in front
             of. */
          registryRead && (
            <Welcome
              onChooseFolder={chooseCreateFolder}
              onCreate={(rootPath, draft) =>
                void createProjectIn(rootPath, draft)
              }
              onOpen={chooseOpenProject}
            />
          )
        ) : (
          <>
            {/* One row, not three (`screen-specs.md:64-69`): the project's
                identity on the left, every board control on the right. The
                `LOCAL PROJECT` eyebrow and the `Board`/`List` heading that used
                to stand above this are gone — the sidebar already says which
                project you are in, and the view segment's pressed state already
                says which surface you are standing on. Between them they cost
                ~230px of chrome before the first card. */}
            <header className="content-header">
              {/* Two units, not five (LC-149). Everything that says *which
                  project this is* is one box and every control is the other, so
                  the only place the header can break is between them — which is
                  the wrap `screen-specs.md` § Content header allows. Ungrouped,
                  the disk-state
                  line was a fourth item on this side that arrived when a write
                  left and took a line of its own below 830px, putting a third
                  row under a header the spec draws as one. */}
              <div className="header-identity">
                {/* The prototype's title stack: the name over its path, the
                    gear beside the stack (LC-223, item 20). */}
                <div className="title-stack">
                  <h1>{project.name}</h1>
                  <div className="path-line">
                    <PathChip path={project.rootPath} homePath={homePath} />
                    {/* One disk-state line, beside the path chip and before the
                    spacer, where `screen-specs.md:44-53` puts it — and silent
                    when the disk is quiet (D-07). The `● watching` chip this
                    replaces said the same thing at every idle moment, which
                    is a dev trace rather than designed chrome. `reading` is
                    the one word here D-07 did not ask for: the design answers
                    a load with a board skeleton (`states.md:45-52`) that is
                    not built, so until LC-159 builds it this line is the only
                    thing that says a read is in flight. */}
                    {project.reachable && (
                      <WriteIndicator
                        busy={
                          reconciling
                            ? "reconciling"
                            : loading
                              ? "reading"
                              : undefined
                        }
                      />
                    )}
                  </div>
                </div>
                {/* `aria-haspopup="menu"` and a real `aria-expanded`: what the
                    gear opens is a menu now (LC-208), which is a region that
                    stays part of the page under its trigger — the very thing
                    LC-125 removed the expanded state for when this opened a
                    dialog instead. The menu is what opens the dialog. */}
                <button
                  tabIndex={0}
                  ref={settingsButton}
                  className={classes(
                    "ghost small settings-button",
                    settingsMenuOpen && "open",
                  )}
                  aria-label="Project settings"
                  aria-haspopup="menu"
                  aria-expanded={settingsMenuOpen}
                  title="Project settings"
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                >
                  <GearGlyph />
                </button>
                {settingsMenuOpen && (
                  <SettingsMenu
                    project={project}
                    themes={THEMES}
                    appearance={appearance}
                    anchor={settingsButton.current}
                    onAppearance={setAppearance}
                    onTheme={(theme) => void changeTheme(project, theme)}
                    onOpenSection={(section) => {
                      closeTicket();
                      setSettingsSection(section);
                    }}
                    // The board's own re-read (ADR 0006), which the menu is the
                    // first surface to offer by hand: the watcher is what
                    // normally keeps this current, and this is the way back
                    // when a person has reason to doubt it.
                    onReload={() => {
                      void reconcileProject(project.id)
                        .then(applySnapshot)
                        .catch((error) => setError(normalizeError(error)));
                    }}
                    onClose={() => setSettingsMenuOpen(false)}
                  />
                )}
              </div>
              {/* The controls belong to the board, so they appear only when
                  there is one: an unreachable project keeps its identity row and
                  gets `UnreachableProject` below it instead. */}
              {project.reachable && (
                <div className="toolbar-actions">
                  {/* `screen-specs.md:47-48` orders the content header:
                      filter field, then ordering control, then view segment. */}
                  {/* The chip is overlaid inside the field's right edge, as
                      the prototype draws it (`prototype.js:495-498`). It is
                      `aria-hidden` and paired with `aria-keyshortcuts` so the
                      field's accessible name stays "Filter tickets" rather
                      than becoming "Filter tickets ⌘F" (LC-71). */}
                  <div className="filter-wrap">
                    {/* The OS stays out of this field (LC-90). WebKit offered
                        its own saved-value popover under it — a native
                        dropdown inside a local-first app, which is both
                        off-brand and a small privacy surprise. Turning
                        autofill off is four attributes rather than one:
                        `autoComplete` is the request, `name` is what the
                        heuristics read when they ignore it, and the two
                        text-assist attributes are the same class of unasked-
                        for help over a query that is a substring, not prose.
                        The prototype's field carries two of the four
                        (`prototype.js:496`); a WebKit that ignores the
                        request is why the other two are here. */}
                    <input
                      ref={filterField}
                      className="input filter-field"
                      type="text"
                      name="longclaw-filter"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={filterQuery}
                      aria-label="Filter tickets"
                      aria-keyshortcuts="Meta+F"
                      placeholder="Filter tickets"
                      onChange={(event) => setFilterQuery(event.target.value)}
                    />
                    <kbd className="kbd-chip filter-kbd" aria-hidden="true">
                      ⌘F
                    </kbd>
                  </div>
                  <div className="ordering-control">
                    <span>Order</span>
                    <MenuButton
                      label="Order"
                      options={ORDERINGS}
                      value={ordering}
                      footnote={ORDERING_FOOTNOTE}
                      onPick={(next) => updateWorkspace({ ordering: next })}
                    />
                  </div>
                  <ViewSegment view={view} onChange={setView} />
                  {DEV_CHROME && (
                    <button
                      tabIndex={0}
                      className="secondary"
                      onClick={() => {
                        if (!activeProjectId) return;
                        void rebuildIndex(activeProjectId)
                          .then(applySnapshot)
                          .catch((error) => setError(normalizeError(error)));
                      }}
                    >
                      Rebuild index
                    </button>
                  )}
                  <button
                    tabIndex={0}
                    className="primary"
                    aria-keyshortcuts="C"
                    onClick={() => setCreateSurface("quick")}
                  >
                    New ticket
                    <kbd aria-hidden="true">C</kbd>
                  </button>
                </div>
              )}
            </header>

            {!project.reachable ? (
              <UnreachableProject
                project={project}
                onLocate={() => void relocateActiveProject(project.id)}
                onRemove={() => void forgetProject(project.id)}
              />
            ) : (
              // The no-match state is the one thing that stands *instead of*
              // the surfaces rather than above them, so the workspace becomes
              // the column it is centred in (LC-91).
              <section
                className={classes(
                  "workspace",
                  showNoMatches && "workspace-state",
                )}
              >
                {showNoMatches && (
                  <NoMatches
                    query={filterQuery}
                    unreadable={unreadableShown}
                    onClear={clearFilter}
                  />
                )}
                {view === "board" ? (
                  <Board
                    tickets={visibleTickets}
                    // What the surface draws is narrowed; what a drop is
                    // decided over is not (LC-187, `ticketMove.ts`).
                    unfiltered={tickets}
                    selectedKey={selectedKey}
                    marks={externalMarks}
                    labels={project.labels}
                    ordering={ordering}
                    // Six empty columns beside a "No matches" panel is the
                    // empty board the designed state exists to replace — but a
                    // project with no tickets *is* the scaffold plus the guide,
                    // so this stands down for the query and not for the state
                    // that owns the columns it would remove (D-20/LC-86).
                    scaffold={!showNoMatches}
                    now={now}
                    focusRequest={cardFocus}
                    onSelect={openTicket}
                    onChangePriority={changePriority}
                    onChangeStatus={changeStatus}
                    onMoveTicket={moveCard}
                    // A column's `+` is the same quick create `C` opens,
                    // arriving with the column it was pressed in already
                    // chosen (`keyboard-focus-map.md:44`).
                    onCreateInStatus={(status) => {
                      // A whole draft, empty but for the column: "nothing
                      // typed yet" is `""` and `[]` rather than absent, which
                      // is what keeps one shape between the preseed and the
                      // draft the door carries back.
                      setCarriedDraft({
                        title: "",
                        description: "",
                        status,
                        priority: "none",
                        labels: [],
                      });
                      setCreateSurface("quick");
                    }}
                    onCreateFirst={guide}
                  />
                ) : (
                  // Both surfaces are projections of the same store state
                  // and hold no rows of their own, which is what makes them
                  // agree after an app edit, a file edit, a restart, or a
                  // rebuild — and now after a query.
                  <IssueList
                    tickets={visibleTickets}
                    unfiltered={tickets}
                    selectedKey={selectedKey}
                    marks={externalMarks}
                    labels={project.labels}
                    ordering={ordering}
                    now={now}
                    focusRequest={cardFocus}
                    onSelect={openTicket}
                    onChangePriority={changePriority}
                    onChangeStatus={changeStatus}
                    // The same move the board raises, because the same gesture
                    // means the same thing on both projections (`ticketMove.ts`).
                    onMoveTicket={moveCard}
                    onCreateFirst={guide}
                  />
                )}
              </section>
            )}
          </>
        )}
      </section>

      {/* Create mode takes the panel's place rather than stacking on it: they
          are the same surface in two modes, not two overlays. */}
      {project &&
        activeProjectId &&
        selectedKey &&
        project.reachable &&
        createSurface !== "full" && (
          <TicketPanel
            projectId={activeProjectId}
            ticketKey={selectedKey}
            // Abbreviated the same way the header's own chip is, so the two
            // places the app writes this path agree on how it looks.
            projectPath={tildeAbbreviate(project.rootPath, homePath)}
            labels={project.labels}
            mark={externalMarks[selectedKey]}
            reloadSignal={panelReload}
            removedSignal={panelRemoved}
            heldConflict={
              heldConflict?.ticketKey === selectedKey ? heldConflict : undefined
            }
            now={now}
            archived={openRow !== undefined && isArchived(openRow)}
            // The file the row the card was drawn from names, so one the board
            // already knows will not parse opens as the raw-file modal rather
            // than as a panel that turns into one — and the modal has a path to
            // title itself with before the read comes back (LC-134).
            degradedPath={
              openRow?.state === "degraded" ? openRow.relativePath : undefined
            }
            shortcutsActive={
              !paletteOpen && !settingsOpen && createSurface === undefined
            }
            onClose={() => closeTicket(selectedKey)}
            onArchive={(archived) => {
              if (openRow?.state === "indexed") setArchived(openRow, archived);
            }}
            onWrite={(result) =>
              applyLocalWrite(result.ticket, result.generation)
            }
            // A file that parses again leaves the index holding a degraded row
            // the watcher may not correct for a while, so the one surface that
            // knows it is stale asks for the truth (ADR 0006). The whole
            // project rather than the ticket: a file that would not parse had
            // no row to replace, and the snapshot is the app's one way to get
            // one back.
            onReparsed={() => {
              void reconcileProject(activeProjectId)
                .then(applySnapshot)
                .catch((error) => setError(normalizeError(error)));
            }}
            onError={setError}
          />
        )}

      {/* Settings sits beside the board as the shell's third grid column
          (LC-223, the prototype's arrangement) — the board stays live so a
          preset can be tried against it. The right edge holds one record at a
          time, so every opener closes the ticket panel first — and the panel
          stays mounted over an unreachable project, which is one of the two
          screens that needs `Locate…` most. */}
      {project && settingsSection !== undefined && (
        <ProjectSettings
          project={project}
          hasTickets={tickets.length > 0}
          appearance={appearance}
          themes={THEMES}
          section={settingsSection}
          onSection={setSettingsSection}
          onAppearance={setAppearance}
          onRename={(name) => void renameProject(name)}
          onTheme={(theme) => void changeTheme(project, theme)}
          onLocate={() => void relocateActiveProject(project.id)}
          onRemove={() => void forgetProject(project.id)}
          onWrite={(message, write) =>
            writeProjectFile({ message, write, onWritten: upsertProject })
          }
          onClose={closeSettings}
        />
      )}

      {/* The side panel's own settings reach (LC-208). It is built here rather
          than inside `ProjectSection` so that one menu is open at a time across
          both sections, and so its rows can reach `App`'s writes without the
          list having to carry six more props per row. */}
      {/* Read fresh on every render, so the menu's own writes are visible in
          it. A project removed while its menu is up takes the menu with it,
          which is the same answer by the same route. */}
      {menuProject && projectMenu && (
        <ProjectMenu
          project={menuProject}
          themes={THEMES}
          appearance={appearance}
          anchor={projectMenu.anchor}
          onAppearance={setAppearance}
          // The row's own project, which may not be the open one — a preset is
          // visible from the sidebar without switching, since every row's dot
          // carries its project's own theme.
          onTheme={(theme) => void changeTheme(menuProject, theme)}
          // A section, on the other hand, is about a project you are looking
          // at: the panel shows the open project, so the row opens first and
          // the section lands on it.
          onOpenSection={(section) => {
            if (menuProject.id !== activeProjectId)
              void loadProject(menuProject.id);
            closeTicket();
            setSettingsSection(section);
          }}
          onStar={() => void toggleStar(menuProject)}
          onRemove={() => setRemovingProject(menuProject)}
          onClose={() => setProjectMenu(undefined)}
        />
      )}

      {/* The `⋮` menu's removal, behind the confirm that names the path and
          repeats the guarantee — the same one settings and the unreachable
          screen raise (LC-144). */}
      {removingProject && (
        <RemoveProjectConfirm
          project={removingProject}
          onCancel={() => setRemovingProject(undefined)}
          onConfirm={() => void forgetProject(removingProject.id)}
        />
      )}

      {/* Both create surfaces are gated on the folder answering. Nothing is
          creatable on an unreachable project (`states.md:80-98`): the key would
          be guessed from a board with no rows, so the next create offered
          `LC-1` — a collision waiting for the folder to come back (LC-140). */}
      {project &&
        activeProjectId &&
        !unreachable &&
        createSurface === "quick" && (
          <QuickCreate
            projectName={project.name}
            projectTheme={project.theme}
            provisionalKey={nextKey}
            labels={project.labels}
            initialStatus={carriedDraft?.status}
            initialPriority={carriedDraft?.priority}
            onCancel={closeCreateSurface}
            onCreate={(request, { createMore }) =>
              submitNewTicket(request, { keepOpen: createMore })
            }
            onOpenFullEditor={(draft) => {
              setCarriedDraft(draft);
              setCreateSurface("full");
            }}
          />
        )}

      {project &&
        activeProjectId &&
        !unreachable &&
        createSurface === "full" && (
          <CreatePanel
            provisionalKey={nextKey}
            labels={project.labels}
            initialDraft={carriedDraft}
            onCancel={closeCreateSurface}
            onCreate={(request) =>
              submitNewTicket(request, { openPanel: true })
            }
          />
        )}

      {/* Over the create surface rather than instead of it: the draft behind
          this is still the answer if the question is cancelled (LC-188). */}
      {pendingCreate && project && createSurface !== undefined && (
        <ConfirmDialog
          title="The active project changed"
          body={
            <>
              <p>
                This ticket was started in{" "}
                <strong>{projectName(pendingCreate.fromProjectId)}</strong>, and{" "}
                <strong>{project.name}</strong> is the project on screen now.
                Create it in <strong>{project.name}</strong>?
              </p>
              {/* No "still opening" branch to write here: **Create** is
                  disabled on both surfaces until the board answers, so a
                  project with no key to offer cannot raise this dialog. */}
              <p>
                It lands in <code>{project.rootPath}</code> as{" "}
                <code>{nextKey}</code>, the next key free in this project.
              </p>
            </>
          }
          confirmLabel={`Create in ${project.name}`}
          // Nothing is destroyed either way: this asks where a write goes.
          confirmTone="primary"
          onConfirm={() => {
            const held = pendingCreate;
            setPendingCreate(undefined);
            writeNewTicket(held.request, {
              openPanel: held.openPanel,
              keepOpen: held.keepOpen,
            });
          }}
          onCancel={() => setPendingCreate(undefined)}
        />
      )}

      {paletteOpen && project && (
        <CommandPalette
          project={project}
          ticket={commandTarget}
          // The project's rows, not the filtered ones: a key is what you type
          // to reach a ticket the surface behind the palette is not showing.
          tickets={tickets}
          projects={localProjects}
          appearance={appearance}
          themes={THEMES}
          ordering={ordering}
          onClose={closePalette}
          // Both of these hand focus somewhere specific — the new card, the
          // panel — so they dismiss the palette without the focus return
          // `closePalette` owes an ordinary close.
          onCreate={() => {
            dismissPalette();
            setCreateSurface("quick");
          }}
          onOpenTicket={(key) => {
            dismissPalette();
            openTicket(key);
          }}
          onProject={(projectId) => void loadProject(projectId)}
          onChangeStatus={(next) => {
            if (commandTarget) changeStatus(commandTarget, next);
          }}
          onChangePriority={(next) => {
            if (commandTarget) changePriority(commandTarget, next);
          }}
          onToggleStar={() => void toggleStar(project)}
          onToggleAppearance={() =>
            setAppearance(
              appearance === "system"
                ? "light"
                : appearance === "light"
                  ? "dark"
                  : "system",
            )
          }
          onTheme={(theme) => void changeTheme(project, theme)}
          onView={(next) => setView(next)}
          view={view}
          onArchive={() => {
            if (commandTarget)
              setArchived(commandTarget, !isArchived(commandTarget));
          }}
          onOrdering={(next) => updateWorkspace({ ordering: next })}
          searchResults={paletteSearchResults}
          onSearch={(query) => {
            if (!activeProjectId) return;
            void searchTickets(activeProjectId, query)
              .then((result) => setPaletteSearchResults(result.tickets))
              .catch((error) => setError(normalizeError(error)));
          }}
        />
      )}

      <ToastStack />
    </main>
  );
}

/**
 * The Board | List segment in the content header (`screen-specs.md:69`). A pair
 * of buttons rather than a radio group: each one is a place to go, and `pressed`
 * is what says which one you are standing in.
 */
function ViewSegment(props: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="view-segment" role="group" aria-label="View">
      {(["board", "list"] as const).map((id) => (
        <button
          tabIndex={0}
          key={id}
          className={props.view === id ? "selected" : ""}
          aria-pressed={props.view === id}
          onClick={() => props.onChange(id)}
        >
          {id === "board" ? "Board" : "List"}
        </button>
      ))}
    </div>
  );
}

/**
 * Abbreviate a home-relative path to `~/…` for display. The clause lives in
 * LC-68, which carries D-06's remaining work; `cc_ui_diffs.md` § Step 2 was the
 * original citation and was deleted 2026-08-07.
 * Only the actual home directory — supplied by the native layer — is
 * abbreviated. The clipboard and tooltip keep the full absolute path.
 */
function tildeAbbreviate(path: string, home: string | null): string {
  if (!home) return path;
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  return path;
}

/**
 * The project path as a chip (`screen-specs.md:64-67`, D-06): mono 12px, a
 * folder glyph, truncated to the header with `text-overflow: ellipsis`, and a
 * click that copies the full path and says so with a toast. The bare wrapping
 * `<code>` it replaces consumed two lines for a long path; this one never does.
 * The display text is tilde-abbreviated; the clipboard and `title` keep the
 * full path.
 */
function PathChip(props: { path: string; homePath: string | null }) {
  const raise = useMutationStore((state) => state.raise);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(props.path);
      raise({ message: "Path copied", tone: "default" });
    } catch {
      raise({ message: "Could not copy path", tone: "danger" });
    }
  }, [props.path, raise]);
  return (
    <button
      tabIndex={0}
      className="path-chip"
      aria-label={`Copy path — ${props.path}`}
      title={props.path}
      onClick={() => void copy()}
    >
      <FolderGlyph />
      <span className="txt">{tildeAbbreviate(props.path, props.homePath)}</span>
    </button>
  );
}

function ProjectSection(props: {
  title: string;
  empty: string;
  projects: ProjectReference[];
  activeProjectId?: string;
  onOpen: (projectId: string) => void;
  /** The row's `⋮`, handed the project and the button to hang the menu off. */
  onMenu: (project: ProjectReference, anchor: HTMLElement) => void;
  /** The same `⋮` pressed again, which takes its own menu back down. */
  onCloseMenu: () => void;
  /** Which row's menu is up, so its `⋮` can hold the pressed state. */
  menuFor?: string;
}) {
  return (
    <section className="project-section">
      <h2>{props.title}</h2>
      {props.projects.length === 0 ? (
        <p>{props.empty}</p>
      ) : (
        props.projects.map((project) => (
          /* Two buttons side by side, not one inside the other. The star used
             to be a span carrying `role="button"` *inside* the row's own
             button — interactive content nested in a button, which is invalid
             HTML, and whose accessible name leaked into the row's. With the
             `⋮` beside it that started to matter: the row would have announced
             itself as "Fixture Project, Fixture Project menu" (LC-208). */
          <div
            key={project.id}
            className={classes(
              "project-row",
              project.id === props.activeProjectId && "selected",
            )}
          >
            <button
              tabIndex={0}
              className={classes(
                "project-link",
                project.id === props.activeProjectId && "selected",
                !project.reachable && "unreachable",
              )}
              // The path is the row's whole subject and does not fit on it; the
              // content header and settings show it in full.
              title={
                project.reachable
                  ? project.rootPath
                  : `Unreachable · ${project.rootPath}`
              }
              onClick={() => props.onOpen(project.id)}
            >
              {/* The dot carries the project's own preset, so a row can show a
                  theme this window is not currently wearing. Unreachable swaps
                  it for the warn triangle (`screen-specs.md:60`) — said in
                  words too, because a glyph is never the only channel. */}
              {project.reachable ? (
                <ThemeDot theme={project.theme} />
              ) : (
                <>
                  <span className="project-warn" aria-hidden="true">
                    ⚠
                  </span>
                  {/* The glyph is decoration; this is the channel that actually
                      reaches a screen reader. `aria-label` on a bare span is not
                      reliably exposed, so the word is real text. */}
                  <span className="visually-hidden">Unreachable</span>
                </>
              )}
              <strong>{project.name}</strong>
              {/* The star is a mark now, not a control (LC-208). It was a
                  `★`/`☆` toggle whose only name was the glyph, which says the
                  state and never the action; the `⋮` beside it offers `Star
                  project` / `Unstar project` in words. A row that is not
                  starred shows nothing here, so the mark means something. */}
              {project.starred && (
                <span className="star-mark">
                  <span aria-hidden="true">★</span>
                  {/* The glyph is decoration; this is the channel that reaches
                      a screen reader, in the same shape the unreachable row's
                      `Unreachable` uses — real text, because an `aria-label` on
                      a bare span is not reliably exposed. */}
                  <span className="visually-hidden">Starred</span>
                </span>
              )}
            </button>
            {/* The ticket's second home for settings: "the Menu which gets
                opened through 3 vertical dots in front of Project Name". */}
            <button
              tabIndex={0}
              type="button"
              aria-haspopup="menu"
              aria-expanded={props.menuFor === project.id}
              // Named for its row, because a sidebar of identical `Project
              // menu` buttons is a list nobody can navigate by name.
              aria-label={`${project.name} menu`}
              title="Project menu"
              // Not `ghost`: that variant is a 30px labelled control, and its
              // `min-height` and its `:hover:not(:disabled)` — a full step of
              // specificity above anything this class can say — were quietly
              // winning. The `⋮` came out 30px tall instead of 20 and hovered
              // to the same `wash` its row hovers to, which is *why* pointing
              // at it looked like pointing at the row. It is not a button
              // variant; it is a row affordance, and it says so itself.
              className={classes(
                "row-menu-button",
                props.menuFor === project.id && "open",
              )}
              // A toggle, as the gear is. Click-away runs on `mousedown` and
              // excludes the anchor (`popover.ts`), so a `⋮` that only ever
              // opened could not be closed by pressing it again — the press
              // that opened it was the only one it answered.
              onClick={(event) =>
                props.menuFor === project.id
                  ? props.onCloseMenu()
                  : props.onMenu(project, event.currentTarget)
              }
            >
              <KebabGlyph />
            </button>
          </div>
        ))
      )}
    </section>
  );
}

/**
 * The app's one error surface. It hangs above whatever is below it, which is
 * the board on most launches and the welcome screen on the first: a folder that
 * already holds a project is refused by the create path, and the screen that
 * asked for the folder is the screen that has to say so.
 *
 * The code used to be the heading here, so an ordinary read-only folder
 * announced itself as `permission denied` (V0-29).
 */
function ErrorBanner(props: { error: AppError }) {
  return (
    <section className="error-banner" role="alert">
      <strong>{failureTitle(props.error)}</strong>
      <span>
        {failureMessage(props.error)}
        {/* The one thing the banner has room for that a toast does not. */}
        {failurePath(props.error) && (
          <code className="failure-path">{failurePath(props.error)}</code>
        )}
      </span>
    </section>
  );
}

/**
 * First launch (`screen-specs.md:88-110`, `states.md:22-27`), as one centered
 * column and two steps.
 *
 * It was one step in two columns: copy on the left and a create form always on
 * the right, asking for a name and a key with nowhere to put them, because the
 * folder picker did not run until the form was submitted (D-11). Now the folder
 * is the first question — the picker, then the form that shows what it
 * answered — which is what lets the form make the promise the screen exists to
 * make (D-13).
 *
 * The step lives here rather than in `App` because it is not app state: it is
 * over the moment the project exists, and unmounting this component is the only
 * way out of it.
 */
function Welcome(props: {
  onChooseFolder: () => Promise<string | null>;
  onCreate: (rootPath: string, draft: ProjectDraft) => void;
  /**
   * The same shape as `onChooseFolder`, because after LC-170 both buttons can
   * end on either screen: what the folder turned out to hold decides, and the
   * button only decides what the picker is titled. A path back means the create
   * form is the next step, whichever button asked for it.
   */
  onOpen: () => Promise<string | null>;
}) {
  /** The folder the picker answered with, and therefore which step is up. */
  const [folder, setFolder] = useState<string>();

  /** What both buttons do with an answer: a path is step two, `null` is not. */
  const showCreateForm = (chosen: string | null) => {
    if (chosen) setFolder(chosen);
  };

  if (folder !== undefined) {
    return (
      <section className="welcome-panel">
        <div className="create-form">
          <h2>New project</h2>
          <CreateProjectForm
            themes={THEMES}
            folder={folder}
            submitLabel="Create project"
            onBack={() => setFolder(undefined)}
            onSubmit={(draft) => props.onCreate(folder, draft)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="welcome-panel">
      {/* 52px mark, display greeting, and the trust line the spec closes this
          screen with (`screen-specs.md:90-94`). This is also the no-projects
          state — there is no separate empty app screen and no account step
          anywhere in the flow. */}
      <OwlMark size={52} />
      <h1>Plan with your agents.</h1>
      {/* Value rather than mechanism, deciding D-14: the mechanism now has a
          better place to be stated than a subtitle — the next step names the
          folder and the `/.longclaw` inside it, in the path the user just
          picked. What nothing else on this screen says is what the files are
          *for*, so this says that. */}
      <p className="welcome-subtitle">
        Tickets live as plain files in a folder you choose — ideally inside your
        repo. Humans plan, agents execute, and both write to the same record.
      </p>
      {/* Two peer buttons, create primary (D-12). The single `Open existing
          folder` these replace left creation with no button of its own: it was
          the submit of the form beside it, labelled `Create project in
          folder`, which made the screen's main path the one thing on it
          without a name. */}
      <div className="welcome-actions">
        {/* A cancelled picker, and a folder that turned out to hold a project
            and was opened, both leave this screen exactly as it was. */}
        <button
          tabIndex={0}
          className="primary"
          onClick={() => void props.onChooseFolder().then(showCreateForm)}
        >
          Create a project
        </button>
        <button
          tabIndex={0}
          className="secondary"
          onClick={() => void props.onOpen().then(showCreateForm)}
        >
          Open a folder
        </button>
      </div>
      <p className="trust-line">
        no account · no cloud · your files, on your disk
      </p>
    </section>
  );
}

/**
 * The no-match state (`states.md:37-41`, `screen-specs.md:164-165`): a centered
 * panel, the query echoed back, and a secondary Clear filter that `Esc` also
 * reaches. The one state that stands *instead of* the surfaces — the
 * empty-project guide (`GuideCard.tsx`) stands inside them.
 *
 * `role="status"` because a filter that empties the screen without saying so is
 * hostile to a screen-reader user; it is named, so it is distinguishable from the
 * toast stack, which is a live region too.
 */
function NoMatches(props: {
  query: string;
  /** Unreadable files still on screen, which the filter never hides. */
  unreadable: number;
  onClear: () => void;
}) {
  return (
    <div className="no-matches" role="status" aria-label="No matches">
      <strong>No matches</strong>
      {/* Quoted, because an unquoted echo of a query that is mostly whitespace
          — or all of it — reads as a sentence with a hole in it, and the one
          thing this panel owes the human is what was asked (LC-92). The curly
          pair is the prototype's (`prototype.js:571`) and sits in the sentence
          rather than inside the `<code>`: the mono slot holds the query, and
          the quotes are the sentence's own punctuation around it. */}
      <p>
        Nothing here matches “<code>{props.query}</code>”.
      </p>
      {props.unreadable > 0 && (
        <p>
          {props.unreadable === 1
            ? "1 unreadable file is"
            : `${props.unreadable} unreadable files are`}{" "}
          still shown: a file this build cannot parse has no text to match, so
          the filter never hides one.
        </p>
      )}
      <button tabIndex={0} className="secondary" onClick={props.onClear}>
        Clear filter
      </button>
    </div>
  );
}

/**
 * The whole main area when a project's folder cannot be read (`states.md:80-98`).
 *
 * Every line of it was saying the wrong thing. An `UNREACHABLE` eyebrow over the
 * project's own name never said what had happened, where the spec's 30px warn
 * triangle and **Folder not found** say it at a glance (LC-143). The copy
 * described the registry — a file nobody has opened — instead of the two things
 * a person needs: why a folder goes missing, and that their tickets are safe
 * (LC-145). And **Locate folder** wore the primary indigo while **Remove from
 * app** fired on one click: the recovery and the removal, drawn the wrong way
 * round (LC-144).
 */
function UnreachableProject(props: {
  project: ProjectReference;
  onLocate: () => void;
  onRemove: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  return (
    <section className="unreachable-panel">
      <span className="state-icon">
        <WarnGlyph size={30} />
      </span>
      <h2>Folder not found</h2>
      <code>{props.project.rootPath}</code>
      <p>
        The project folder moved, or its disk isn&rsquo;t mounted. Your tickets
        are safe in their files — LongClaw never deletes or rewrites them, and
        this project stays listed until you decide.
      </p>
      <div className="toolbar-actions">
        {/* Secondary, not primary: this opens a picker, and the app has no
            business making the more assertive of the two buttons the one that
            starts by asking a question. */}
        <button tabIndex={0} className="secondary" onClick={props.onLocate}>
          Locate folder…
        </button>
        <button
          tabIndex={0}
          className="ghost"
          onClick={() => setConfirmingRemove(true)}
        >
          Remove from app
        </button>
      </div>
      {confirmingRemove && (
        <RemoveProjectConfirm
          project={props.project}
          onConfirm={() => {
            setConfirmingRemove(false);
            props.onRemove();
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </section>
  );
}
