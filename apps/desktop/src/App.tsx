import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chooseAndCreateProject,
  chooseAndRegisterProject,
  chooseAndRelocateProject,
  chooseProjectFolder,
  createProjectInFolder,
  createTicket,
  editTicket,
  homeDir,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
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
import { RemoveProjectConfirm } from "./ConfirmDialog";
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
import { IssueList } from "./IssueList";
import { isChord, singleKeyShortcutAllowed } from "./keyContext";
import { MenuButton } from "./Menu";
import { mutate, type Mutation, useMutationStore } from "./mutations";
import { ORDERINGS, type OrderingMode } from "./ordering";
import { OwlMark } from "./OwlMark";
import { ProjectSettings } from "./ProjectSettings";
import { QuickCreate } from "./QuickCreate";
import type { FocusRequest } from "./rovingFocus";
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
  TicketEdit,
  TicketPriority,
  TicketStatus,
  TicketRow,
} from "./types";
import { WarnGlyph } from "./WarnGlyph";
import { ToastStack, WriteIndicator } from "./WriteFeedback";

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "plum", label: "Plum" },
];

/** The note `screen-specs.md:246-247` puts under the ordering menu, verbatim. */
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
 * (`screen-specs.md:286`): the root briefly carries `theme-transition`, under
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
   * Which create surface is up, if either (`screen-specs.md:198-216`). One at a
   * time: quick create's **Open full editor →** is a move between them, carrying
   * what has been typed rather than throwing it away.
   */
  const [createSurface, setCreateSurface] = useState<"quick" | "full">();
  /**
   * What the create surface opens with: what quick create had typed when
   * **Open full editor →** moved between the two, and the status a board
   * column's `+` preseeds. Cleared whenever create closes, either way.
   */
  const [carriedDraft, setCarriedDraft] = useState<{
    title: string;
    status: TicketStatus;
  }>();
  /** Bumped when an external change lands for the open ticket. */
  const [panelReload, setPanelReload] = useState(0);
  /** Bumped when the open ticket disappears from disk. */
  const [panelRemoved, setPanelRemoved] = useState(0);
  /** Drives the acknowledgement age text and its decay. */
  const [now, setNow] = useState(() => Date.now());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  /** Per-project workspace choices. Device-local, and never project data. */
  const [projectWorkspaces, setProjectWorkspaces] = useState<
    Record<string, ProjectWorkspace>
  >(readProjectWorkspaces);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* Settings' own **Remove from app** waits on its answer inside the dialog
     that offers it (`ProjectSettings.tsx`); the unreachable screen keeps its
     own. Both raise the same `RemoveProjectConfirm`. */
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
  /**
   * A project whose folder the last read could not reach.
   *
   * Nothing is creatable here (`states.md:80-98`): quick create used to open over
   * the unreachable screen offering `LC-1` as the next key, because the key is
   * guessed from rows on screen and there are none — a collision waiting to
   * happen the moment the folder came back (LC-140).
   */
  const unreachable = project !== undefined && !project.reachable;
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
   */
  const nextKey = project ? provisionalTicketKey(project.key, tickets) : "";

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
   * the Step 17 accessibility audit; `keyboard-focus-map.md:16-18,123,152`.
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
    const layerOpen =
      selectedKey !== undefined ||
      createSurface !== undefined ||
      paletteOpen ||
      // Settings is a modal since LC-125, so it takes a rung of this ladder:
      // its own `Esc` closes it, and that press must not also empty the filter
      // on the board behind it.
      settingsOpen;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isChord(event, "k")) {
        event.preventDefault();
        if (paletteOpen) return;
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
      // create underneath whatever is already up.
      if (
        project &&
        !unreachable &&
        !paletteOpen &&
        !settingsOpen &&
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
      if (isChord(event, "f")) {
        const field = filterField.current;
        if (
          !field ||
          createSurface !== undefined ||
          paletteOpen ||
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
    selectedKey,
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
      if (root.dataset.appearance && root.dataset.appearance !== next) {
        crossfade();
      }
      root.dataset.appearance = next;
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
    if (root.dataset.theme && root.dataset.theme !== theme) crossfade();
    root.dataset.theme = theme;
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
  }, [unreachable]);

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
      const trace =
        document.querySelector<HTMLElement>(".trace-status")?.innerText ?? "";
      void reportVisibleUi({
        projectId: activeProjectId,
        rowCount: rows.length,
        rowTitles: rows
          .map((row) => row.querySelector("strong")?.textContent ?? "")
          .filter(Boolean),
        lastSequence,
        traceText: trace,
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
    setQuickCreateOpen(false);
    await loadProject(project.id);
  }

  async function chooseProject() {
    try {
      await adoptProject(await chooseAndRegisterProject());
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  async function createProject(draft: ProjectDraft) {
    try {
      await adoptProject(await chooseAndCreateProject(draft));
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /**
   * The folder picker as first launch's opening question (D-11). The answer
   * belongs to the screen that asked — `Welcome` holds which step it is on —
   * so this hands it back rather than storing it, and turns a picker that
   * threw into the app's one error surface on the way past.
   */
  async function chooseCreateFolder() {
    try {
      return await chooseProjectFolder();
    } catch (error) {
      setError(normalizeError(error));
      return null;
    }
  }

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

  async function toggleStar(project: ProjectReference) {
    try {
      upsertProject(await setProjectStarred(project.id, !project.starred));
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /**
   * Theme applies instantly (`screen-specs.md:96-98`): the reference flips
   * before the write returns — the crossfade is the acknowledgement — and a
   * refused write flips it back and says so. No snapshot re-fetch: the theme
   * is a fact about `longclaw.yaml`, not about tickets, so re-loading the
   * project would only put a skeleton where the spec puts a color transition.
   */
  async function changeTheme(theme: string) {
    if (!project || project.theme === theme) return;
    const previous = project;
    upsertProject({ ...project, theme });
    try {
      const updated = await updateProjectTheme(project.id, theme);
      upsertProject(updated);
    } catch (error) {
      upsertProject(previous);
      setError(normalizeError(error));
    }
  }

  async function renameProject(name: string) {
    if (!project || name.trim() === project.name) return;
    try {
      const updated = await updateProjectName(project.id, name);
      upsertProject(updated);
      await loadProject(updated.id);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /** Closes the settings dialog and hands focus back to the gear that opened it. */
  function closeSettings() {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsButton.current?.focus());
  }

  async function forgetProject(projectId: string) {
    try {
      await removeProject(projectId);
      removeProjectReference(projectId);
      // The gear this dialog was opened from goes with the project, so the
      // ordinary focus return has nothing to return to: the welcome screen is
      // what the shell shows next, and its first control is where focus lands.
      setSettingsOpen(false);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".welcome-actions button")?.focus(),
      );
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  /**
   * Creating never blocks on the disk write (`screen-specs.md:204-207`): the
   * card appears at once under a key guessed from the board, the surface closes,
   * and whatever key Rust allocated replaces the guess when the write lands.
   *
   * `openPanel` is full create's ending (`screen-specs.md:214`): the panel swaps
   * to view mode of **the real ticket**, so it can only open once the write has
   * returned a key — view mode reads the file, and there is no file to read
   * before then. The card is still optimistic, and focus rides it in the
   * meantime, so nothing waits and focus never lands on the floor.
   */
  function submitNewTicket(
    request: Omit<CreateTicketRequest, "projectId">,
    options?: { openPanel?: boolean },
  ) {
    const projectId = activeProjectId;
    if (!projectId || !project) return;
    const guessKey = provisionalTicketKey(project.key, tickets);
    setCreateSurface(undefined);
    setCarriedDraft(undefined);

    void mutate({
      apply: () => {
        addProvisionalTicket(
          provisionalTicket(guessKey, request, new Date().toISOString()),
        );
        focusCard(guessKey);
        return () => removeTicket(guessKey);
      },
      write: () => createTicket({ projectId, ...request }),
      onWritten: (written) => {
        removeTicket(guessKey);
        applyLocalWrite(written.ticket, written.generation);
        if (options?.openPanel) openTicket(written.ticket.key);
        else focusCard(written.ticket.key);
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
    toast: string;
    inverseToast: string;
    failure?: (error: AppError) => string;
  }): Mutation {
    const { projectId, ticket } = options;
    const write = (expectedHash: string, edit: TicketEdit) => () =>
      editTicket({ projectId, ticketKey: ticket.key, expectedHash, edit });

    return {
      path: ticket.relativePath,
      // The row shows the change at once; a failed write puts it back exactly as
      // it was read.
      apply: () => {
        applyLocalWrite({ ...ticket, ...options.optimistic }, generation);
        return () => applyLocalWrite(ticket, generation);
      },
      write: write(ticket.contentHash, options.edit),
      onWritten: (result) => applyLocalWrite(result.ticket, result.generation),
      toast: () => options.toast,
      undo: (result) => ({
        path: result.ticket.relativePath,
        // The hash the first write left, so the inverse is not refused as stale
        // by its own predecessor.
        write: write(result.ticket.contentHash, options.inverse),
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
   * One edit either way. Two writes would be two files' worth of undo for one
   * gesture, and the card would sit in the new column at the old rank in between.
   * The board allocates the rank — LongClaw owns rank allocation in v0 — and
   * this writes it, the same way the `P` menu's pick is written.
   *
   * The inverse is what the card had, and a card that had no rank is put back
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
    if (status === undefined && rank === undefined) return;
    // The same two fields either way: what the row shows at once, and what the
    // write carries. A `TicketEdit` is a `Partial<IndexedTicket>` in this much.
    const change = { ...(status && { status }), ...(rank && { rank }) };

    void mutate(
      editMutation({
        projectId,
        ticket,
        optimistic: change,
        edit: change,
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
    // (`screen-specs.md:164-168`).
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
          onOpen={() => void chooseProject()}
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
            onClick={() => setQuickCreateOpen((open) => !open)}
          >
            Create project
          </button>
          <button
            tabIndex={0}
            className="ghost"
            onClick={() => void chooseProject()}
          >
            Open folder
          </button>
          {quickCreateOpen && (
            <CreateProjectForm
              className="quick-create"
              themes={THEMES}
              submitLabel="Choose folder"
              onSubmit={(draft) => void createProject(draft)}
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
            onStar={(project) => void toggleStar(project)}
          />
          <ProjectSection
            title="Local"
            empty="No local projects"
            projects={localProjects}
            activeProjectId={activeProjectId}
            onOpen={(id) => void loadProject(id)}
            onStar={(project) => void toggleStar(project)}
          />
        </nav>

        <div className="side-panel-footer">
          {/* Appearance is an app preference, not project data, and the spec
              puts its 3-up segment in project settings (`screen-specs.md:253`),
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
              onOpen={() => void chooseProject()}
            />
          )
        ) : (
          <>
            {/* One row, not three (`screen-specs.md:44-49`): the project's
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
                <h1>{project.name}</h1>
                {/* `aria-haspopup`, not the `aria-expanded` this carried while
                    settings was an inline section: what it opens is a modal
                    dialog now, and an expanded state describes a region that
                    stays part of the page under its trigger (LC-125). */}
                <button
                  tabIndex={0}
                  ref={settingsButton}
                  className="ghost small settings-button"
                  aria-label="Project settings"
                  aria-haspopup="dialog"
                  title="Project settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    aria-hidden="true"
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="2.1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M7 1.6 V3.4 M7 10.6 V12.4 M1.6 7 H3.4 M10.6 7 H12.4 M3.2 3.2 L4.5 4.5 M9.5 9.5 L10.8 10.8 M10.8 3.2 L9.5 4.5 M4.5 9.5 L3.2 10.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
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
                      className="filter-field"
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
                {DEV_CHROME && (
                  <div
                    className="trace-strip"
                    aria-label="Project source of truth"
                  >
                    {/* The generation stamp lost its eyebrow when the header
                        collapsed to one row; it belongs with the rest of the
                        storage telemetry rather than above the board. */}
                    <p className="eyebrow">GENERATION {generation}</p>
                    <span className="trace-node">FOLDER</span>
                    <span className="trace-arrow">/</span>
                    <span className="trace-node">.longclaw</span>
                    <span className="trace-arrow">/</span>
                    <span className="trace-node active">tickets</span>
                    <span className="trace-status">
                      {lastEvent
                        ? `event ${lastEvent.sequence} - ${lastEvent.event.type}`
                        : "project files are the source of truth"}
                    </span>
                  </div>
                )}

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
                      setCarriedDraft({ title: "", status });
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

      {/* Settings is a layer over the board rather than a section inside it
          (LC-125), so it is built here with the app's other modals — and it
          stays mounted over an unreachable project, which is one of the two
          screens that needs `Locate…` most. */}
      {project && settingsOpen && (
        <ProjectSettings
          project={project}
          hasTickets={tickets.length > 0}
          appearance={appearance}
          themes={THEMES}
          onAppearance={setAppearance}
          onRename={(name) => void renameProject(name)}
          onTheme={(theme) => void changeTheme(theme)}
          onLocate={() => void relocateActiveProject(project.id)}
          onRemove={() => void forgetProject(project.id)}
          onUpdated={upsertProject}
          onError={setError}
          onClose={closeSettings}
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
            initialStatus={carriedDraft?.status}
            onCancel={closeCreateSurface}
            onCreate={submitNewTicket}
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
            initialTitle={carriedDraft?.title}
            initialStatus={carriedDraft?.status}
            onCancel={closeCreateSurface}
            onCreate={(request) =>
              submitNewTicket(request, { openPanel: true })
            }
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
          onTheme={(theme) => void changeTheme(theme)}
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
 * The Board | List segment in the content header (`screen-specs.md:49`). A pair
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
 * The project path as a chip (`screen-specs.md:44-47`, D-06): mono 12px, a
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
  onStar: (project: ProjectReference) => void;
}) {
  return (
    <section className="project-section">
      <h2>{props.title}</h2>
      {props.projects.length === 0 ? (
        <p>{props.empty}</p>
      ) : (
        props.projects.map((project) => (
          <button
            tabIndex={0}
            key={project.id}
            className={[
              "project-link",
              project.id === props.activeProjectId ? "selected" : "",
              !project.reachable ? "unreachable" : "",
            ]
              .filter(Boolean)
              .join(" ")}
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
                theme this window is not currently wearing. Unreachable swaps it
                for the warn triangle (`screen-specs.md:40`) — said in words too,
                because a glyph is never the only channel. */}
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
            <span
              role="button"
              tabIndex={0}
              className={
                project.starred ? "star-button starred" : "star-button"
              }
              onClick={(event) => {
                event.stopPropagation();
                props.onStar(project);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                props.onStar(project);
              }}
            >
              {project.starred ? "★" : "☆"}
            </span>
          </button>
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
  onOpen: () => void;
}) {
  /** The folder the picker answered with, and therefore which step is up. */
  const [folder, setFolder] = useState<string>();

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
          screen with (`screen-specs.md:89-94`). This is also the no-projects
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
        <button
          tabIndex={0}
          className="primary"
          onClick={() => {
            void props.onChooseFolder().then((chosen) => {
              // A cancelled picker leaves the screen exactly as it was.
              if (chosen) setFolder(chosen);
            });
          }}
        >
          Create a project
        </button>
        <button tabIndex={0} className="secondary" onClick={props.onOpen}>
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
 * The no-match state (`states.md:37-41`, `screen-specs.md:130-131`): a centered
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
