import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addProjectLabel,
  chooseAndCreateProject,
  chooseAndRegisterProject,
  chooseAndRelocateProject,
  createTicket,
  editTicket,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
  removeProject,
  removeProjectLabel,
  reportVisibleUi,
  searchTickets,
  setProjectStarred,
  updateProjectLabel,
  updateProjectName,
  updateProjectTheme,
} from "./api";
import { Board } from "./Board";
import { CommandPalette } from "./CommandPalette";
import { CreatePanel } from "./CreatePanel";
import { CreateProjectForm, type ProjectDraft } from "./CreateProjectForm";
import { normalizeError } from "./errors";
import { filterTickets, isFiltering } from "./filtering";
import { IssueList } from "./IssueList";
import { isChord, singleKeyShortcutAllowed } from "./keyContext";
import { LABEL_COLORS } from "./labels";
import { MenuButton } from "./Menu";
import { mutate, type Mutation } from "./mutations";
import { ORDERINGS, type OrderingMode } from "./ordering";
import { QuickCreate } from "./QuickCreate";
import { useLongClawStore } from "./state";
import { ThemePicker } from "./ThemePicker";
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
  IndexedTicket,
  Label,
  ProjectReference,
  TicketEdit,
  TicketPriority,
  TicketStatus,
  TicketRow,
} from "./types";
import { ToastStack, WriteIndicator } from "./WriteFeedback";

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "plum", label: "Plum" },
];

const APPEARANCE_KEY = "longclaw.appearance";

/**
 * The board ordering preference, per project (ADR 0003). Device-local app state
 * and never project data, so it goes exactly where `appearance` goes: a webview
 * origin's `localStorage`, which in the packaged app is a file inside the OS
 * app-support container (`data-requirements.md:19`). It must never reach
 * `longclaw.yaml` or a ticket file, and this is the only place it is written.
 */
const ORDERING_KEY = "longclaw.boardOrdering";

/** The note `screen-specs.md:246-247` puts under the ordering menu, verbatim. */
const ORDERING_FOOTNOTE =
  "Ordering is a view preference on this board — it never rewrites files.";

function readOrderings(): Record<string, OrderingMode> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ORDERING_KEY) ?? "");
    if (!saved || typeof saved !== "object") return {};
    // A stored value this build does not know is dropped rather than trusted:
    // the preference is disposable, so the safe reading is the default one.
    return Object.fromEntries(
      Object.entries(saved as Record<string, unknown>).filter(
        (entry): entry is [string, OrderingMode] => entry[1] === "manual",
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Every row on every surface carries its ticket key, which is what lets one
 * selector serve the board's cards and the list's rows: the two never render at
 * once, and neither the focus call below nor the visible-UI probe cares which one
 * it found.
 */
const ROW = "[data-ticket-key]";

/** Moves focus onto a card or a row once it has been painted. */
function focusCard(key: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-ticket-key="${key}"]`)?.focus();
  });
}

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
      ".board-heading .primary",
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
  const boardOrdering = useLongClawStore((state) => state.boardOrdering);
  const setBoardOrdering = useLongClawStore((state) => state.setBoardOrdering);
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
  const [carriedDraft, setCarriedDraft] = useState<{
    title: string;
    status: TicketStatus;
  }>();
  /** Bumped when an external change lands for the open ticket. */
  const [panelReload, setPanelReload] = useState(0);
  /** Drives the acknowledgement age text and its decay. */
  const [now, setNow] = useState(() => Date.now());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  /** Board or list (`screen-specs.md:49`). View state, and it writes nothing. */
  const [view, setView] = useState<"board" | "list">("board");
  const [settingsName, setSettingsName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  /**
   * The content header's filter (`screen-specs.md:47`). Session-only app state
   * (`data-requirements.md:41`): plain component state, deliberately not beside
   * `appearance` and the ordering preference in `localStorage`, and never a
   * field on anything that crosses IPC.
   */
  const [filterQuery, setFilterQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTicketKey, setPaletteTicketKey] = useState<string>();
  const [paletteSearchResults, setPaletteSearchResults] =
    useState<TicketRow[]>();
  const paletteReturnFocus = useRef<HTMLElement | undefined>(undefined);
  const filterField = useRef<HTMLInputElement>(null);

  const project = projects.find((item) => item.id === activeProjectId);
  /** Priority until this project has been switched (ADR 0003's default). */
  const ordering: OrderingMode =
    (activeProjectId && boardOrdering[activeProjectId]) || "priority";
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

  const clearFilter = useCallback(() => {
    setFilterQuery("");
    // Rule 3 of the focus map: closing a layer never drops focus on the floor.
    filterField.current?.focus();
  }, []);
  const openTicket = useCallback(
    (key: string) => {
      setSelectedKey(key);
      // Opening a ticket is the review that decays its acknowledgement.
      reviewTicket(key);
    },
    [reviewTicket],
  );
  /** Closing returns focus to the card that opened the panel. */
  const closeTicket = useCallback((key?: string) => {
    setSelectedKey(undefined);
    if (key) focusCard(key);
  }, []);
  const localProjects = sortedProjects(projects);
  const starredProjects = sortedProjects(
    projects.filter((candidate) => candidate.starred),
  );

  async function loadProject(projectId: string) {
    const knownProject = useLongClawStore
      .getState()
      .projects.find((project) => project.id === projectId);
    setActiveProjectId(projectId);
    if (knownProject && !knownProject.reachable) {
      return;
    }
    setLoading(true);
    try {
      applySnapshot(await openProject(projectId));
    } catch (error) {
      const normalized = normalizeError(error);
      if (
        knownProject &&
        (normalized.code === "project_unavailable" ||
          normalized.code === "permission_denied" ||
          normalized.code === "invalid_project" ||
          normalized.code === "io")
      ) {
        markProjectReachable(projectId, false);
      }
      setError(normalized);
    } finally {
      setLoading(false);
    }
  }

  // A query about one project means nothing in the next one.
  useEffect(() => setFilterQuery(""), [activeProjectId]);

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
      selectedKey !== undefined || createSurface !== undefined || paletteOpen;
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
        !paletteOpen &&
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
        if (!field || createSurface !== undefined || paletteOpen) return;
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
  }, [clearFilter, createSurface, filtering, paletteOpen, selectedKey]);

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
    try {
      const saved = localStorage.getItem(APPEARANCE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setAppearance(saved);
      }
    } catch {
      setAppearance("system");
    }
  }, [setAppearance]);

  // The ordering preference is hydrated once and written back whenever it
  // changes, exactly as appearance is. Neither ever crosses IPC.
  useEffect(() => {
    const saved = readOrderings();
    for (const [projectId, ordering] of Object.entries(saved)) {
      setBoardOrdering(projectId, ordering);
    }
  }, [setBoardOrdering]);

  const hydrated = useRef(false);
  useEffect(() => {
    // Not on the first pass, or an empty store would erase what is on disk
    // before the hydration above has read it.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(ORDERING_KEY, JSON.stringify(boardOrdering));
    } catch {
      // The board still orders. Nothing here is a fact about a file.
    }
  }, [boardOrdering]);

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_KEY, appearance);
    } catch {
      // Appearance still works for this session.
    }
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
    const root = document.documentElement;
    const theme = project?.theme || "indigo";
    // The first stamp is the launch value; only a *change* crossfades.
    if (root.dataset.theme && root.dataset.theme !== theme) crossfade();
    root.dataset.theme = theme;
    setSettingsName(project?.name ?? "");
  }, [project?.name, project?.theme]);

  useEffect(() => {
    let active = true;
    let stopListening: undefined | (() => void);

    void (async () => {
      try {
        stopListening = await listenForProjectEvents((event) => {
          if (active) applyEvent(event);
        });
        const projects = await listProjects();
        if (!active) return;
        setProjects(projects);
        const reachable = projects.find((project) => project.reachable);
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

  // An external change to the open ticket makes the panel re-read the file, so
  // the description, checklist, and timeline it shows are the ones on disk.
  useEffect(() => {
    if (!selectedKey || lastEvent?.event.type !== "ticketChanged") return;
    if (lastEvent.event.data.ticket.key !== selectedKey) return;
    setPanelReload(lastEvent.sequence);
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
        document.visibilityState === "visible" &&
        activeProjectId &&
        project?.reachable &&
        !reconcileInFlight
      ) {
        reconcileInFlight = true;
        void reconcileProject(activeProjectId)
          .then(applySnapshot)
          .catch((error) => setError(normalizeError(error)))
          .finally(() => {
            reconcileInFlight = false;
          });
      }
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [activeProjectId, applySnapshot, project?.reachable, setError]);

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

  async function chooseProject() {
    try {
      const project = await chooseAndRegisterProject();
      if (!project) return;
      upsertProject(project);
      setQuickCreateOpen(false);
      await loadProject(project.id);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  async function createProject(draft: ProjectDraft) {
    try {
      const project = await chooseAndCreateProject(draft);
      if (!project) return;
      upsertProject(project);
      setQuickCreateOpen(false);
      await loadProject(project.id);
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

  async function renameProject() {
    if (!project || settingsName.trim() === project.name) return;
    try {
      const updated = await updateProjectName(project.id, settingsName);
      upsertProject(updated);
      await loadProject(updated.id);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  async function forgetProject(projectId: string) {
    try {
      await removeProject(projectId);
      removeProjectReference(projectId);
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
        review: () => openTicket(written.ticket.key),
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
        review: () => openTicket(ticket.key),
      }),
      failure: options.failure,
      // A conflict here cannot reach the panel's banner — these writes outlive
      // any panel — so the offer is to open the ticket and read the file as it
      // now is.
      review: () => openTicket(ticket.key),
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
   * A card dropped somewhere else in its column (ADR 0003). The board allocates
   * the rank — LongClaw owns rank allocation in v0 — and this writes it, the
   * same way the `P` menu's pick is written.
   *
   * The inverse is the rank the card had, and a card that had none is put back
   * to having none: `TicketEdit.rank` takes `null` to clear the key. Nothing
   * else in the app ever sends that, because leaving Manual mode is a view
   * preference and must not rewrite a file.
   */
  function reorderTicket(ticket: IndexedTicket, rank: string) {
    const projectId = activeProjectId;
    if (!projectId || rank === ticket.rank) return;

    void mutate(
      editMutation({
        projectId,
        ticket,
        optimistic: { rank },
        edit: { rank },
        inverse: { rank: ticket.rank ?? null },
        toast: `${ticket.key} moved`,
        inverseToast: `${ticket.key} back where it was`,
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

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div className="brand-lockup">
          <span className="brand-mark">LC</span>
          <strong>LongClaw</strong>
        </div>

        <nav className="project-nav" aria-label="Projects">
          <section className="project-actions">
            <button className="secondary" onClick={() => void chooseProject()}>
              Open folder
            </button>
            <button
              className="secondary"
              onClick={() => setQuickCreateOpen((open) => !open)}
            >
              Create project
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

        <div className="appearance-control">
          <span>Appearance</span>
          <select
            aria-label="Appearance"
            value={appearance}
            onChange={(event) =>
              setAppearance(event.target.value as "light" | "dark" | "system")
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </aside>

      <section className="main-panel">
        {error && (
          <section className="error-banner" role="alert">
            <strong>{error.code.replaceAll("_", " ")}</strong>
            <span>{error.message}</span>
            {error.recoverable && <small>Files were not rewritten.</small>}
          </section>
        )}

        {!project ? (
          <Welcome
            onCreate={(draft) => void createProject(draft)}
            onOpen={() => void chooseProject()}
          />
        ) : (
          <>
            <header className="project-toolbar">
              <div>
                <p className="eyebrow">LOCAL PROJECT</p>
                <h1>{project.name}</h1>
                <code>{project.rootPath}</code>
              </div>
              <div className="toolbar-actions">
                <button
                  className="secondary"
                  onClick={() => void toggleStar(project)}
                >
                  {project.starred ? "Starred" : "Star"}
                </button>
                <button
                  className="secondary"
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  Settings
                </button>
              </div>
            </header>

            {settingsOpen && (
              <section className="settings-panel" aria-label="Project settings">
                <label>
                  <span>Name</span>
                  <input
                    value={settingsName}
                    onChange={(event) => setSettingsName(event.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => void renameProject()}
                >
                  Rename
                </button>
                <ThemePicker
                  themes={THEMES}
                  value={project.theme}
                  onPick={(theme) => void changeTheme(theme)}
                />
                <button
                  className="secondary"
                  onClick={() => void relocateActiveProject(project.id)}
                >
                  Locate folder
                </button>
                <ProjectLabels
                  project={project}
                  onUpdated={upsertProject}
                  onError={setError}
                />
                <button
                  className="danger"
                  onClick={() => void forgetProject(project.id)}
                >
                  Remove from app
                </button>
              </section>
            )}

            {!project.reachable ? (
              <UnreachableProject
                project={project}
                onLocate={() => void relocateActiveProject(project.id)}
                onRemove={() => void forgetProject(project.id)}
              />
            ) : (
              <section className="workspace">
                <div
                  className="trace-strip"
                  aria-label="Project source of truth"
                >
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

                <div className="board-heading">
                  <div>
                    <p className="eyebrow">GENERATION {generation}</p>
                    <h2>{view === "board" ? "Board" : "List"}</h2>
                  </div>
                  <div className="toolbar-actions">
                    {/* `screen-specs.md:47-48` orders the content header:
                        filter field, then ordering control, then view segment. */}
                    <input
                      ref={filterField}
                      className="filter-field"
                      type="text"
                      value={filterQuery}
                      aria-label="Filter tickets"
                      placeholder="Filter tickets"
                      onChange={(event) => setFilterQuery(event.target.value)}
                    />
                    <div className="ordering-control">
                      <span>Order</span>
                      <MenuButton
                        label="Order"
                        options={ORDERINGS}
                        value={ordering}
                        footnote={ORDERING_FOOTNOTE}
                        onPick={(next) => setBoardOrdering(project.id, next)}
                      />
                    </div>
                    <ViewSegment view={view} onChange={setView} />
                    <WriteIndicator />
                    <span
                      className={
                        loading || reconciling
                          ? "disk-state busy"
                          : "disk-state"
                      }
                    >
                      {reconciling
                        ? "reconciling"
                        : loading
                          ? "reading"
                          : "watching"}
                    </span>
                    <button
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
                    <button
                      className="primary"
                      onClick={() => setCreateSurface("quick")}
                    >
                      New ticket
                    </button>
                  </div>
                </div>

                {tickets.length === 0 ? (
                  // A project with no tickets is the empty-project state, not a
                  // filter state, whatever is in the field.
                  <EmptyBoard
                    project={project}
                    onCreate={() => setCreateSurface("quick")}
                  />
                ) : (
                  <>
                    {noMatches && (
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
                        // empty board the designed state exists to replace.
                        scaffold={!noMatches}
                        now={now}
                        onSelect={openTicket}
                        onChangePriority={changePriority}
                        onChangeStatus={changeStatus}
                        onReorder={reorderTicket}
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
                        onSelect={openTicket}
                        onChangePriority={changePriority}
                        onChangeStatus={changeStatus}
                      />
                    )}
                  </>
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
            labels={project.labels}
            mark={externalMarks[selectedKey]}
            reloadSignal={panelReload}
            now={now}
            archived={openRow !== undefined && isArchived(openRow)}
            shortcutsActive={!paletteOpen && createSurface === undefined}
            onClose={() => closeTicket(selectedKey)}
            onArchive={(archived) => {
              if (openRow?.state === "indexed") setArchived(openRow, archived);
            }}
            onWrite={(result) =>
              applyLocalWrite(result.ticket, result.generation)
            }
            onError={setError}
          />
        )}

      {project && activeProjectId && createSurface === "quick" && (
        <QuickCreate
          projectName={project.name}
          provisionalKey={nextKey}
          onCancel={closeCreateSurface}
          onCreate={submitNewTicket}
          onOpenFullEditor={(draft) => {
            setCarriedDraft(draft);
            setCreateSurface("full");
          }}
        />
      )}

      {project && activeProjectId && createSurface === "full" && (
        <CreatePanel
          provisionalKey={nextKey}
          labels={project.labels}
          initialTitle={carriedDraft?.title}
          initialStatus={carriedDraft?.status}
          onCancel={closeCreateSurface}
          onCreate={(request) => submitNewTicket(request, { openPanel: true })}
        />
      )}

      {paletteOpen && project && (
        <CommandPalette
          project={project}
          ticket={commandTarget}
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
          onOrdering={(next) => setBoardOrdering(project.id, next)}
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
  view: "board" | "list";
  onChange: (view: "board" | "list") => void;
}) {
  return (
    <div className="view-segment" role="group" aria-label="View">
      {(["board", "list"] as const).map((id) => (
        <button
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
            key={project.id}
            className={[
              "project-link",
              project.id === props.activeProjectId ? "selected" : "",
              !project.reachable ? "unreachable" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => props.onOpen(project.id)}
          >
            <span className="theme-dot" />
            <strong>{project.name}</strong>
            <small>
              {project.reachable ? project.rootPath : "Unreachable"}
            </small>
            <span
              role="button"
              tabIndex={0}
              className="star-button"
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
 * Label definitions, which are project data rather than ticket data
 * (`file_format.md:213-231`). `screen-specs.md` § Project settings never
 * mentions them, so they sit in the panel that already owns the project file's
 * other fields: the name, the theme, and the folder.
 *
 * Nothing here writes a ticket. A slug is not editable — it is what every ticket
 * carrying the label stores — and removing a definition leaves the slug where it
 * is, to be rendered as itself.
 */
function ProjectLabels(props: {
  project: ProjectReference;
  onUpdated: (project: ProjectReference) => void;
  onError: (error: AppError) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const definitions = Object.entries(props.project.labels);

  /** Every write here returns the project as the file now reads. */
  async function run(write: () => Promise<ProjectReference>) {
    try {
      props.onUpdated(await write());
      return true;
    } catch (error) {
      // Rust owns the slug grammar and the name and colour rules, so its
      // refusal is the message — this never guesses at one of its own.
      props.onError(normalizeError(error));
      return false;
    }
  }

  return (
    <section className="label-settings" aria-label="Labels">
      <h3>Labels</h3>
      {definitions.length === 0 && (
        <p>No labels are defined in this project&apos;s longclaw.yaml yet.</p>
      )}
      {definitions.map(([definedSlug, label]) => (
        <LabelDefinition
          // Keyed by its values, so a row's drafts follow what landed on disk.
          key={`${definedSlug}:${label.name}:${label.color}`}
          slug={definedSlug}
          label={label}
          onSave={(next) =>
            void run(() =>
              updateProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
                ...next,
              }),
            )
          }
          onRemove={() =>
            void run(() =>
              removeProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
              }),
            )
          }
        />
      ))}
      <form
        className="label-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!slug.trim() || !name.trim()) return;
          void (async () => {
            const added = await run(() =>
              addProjectLabel({
                projectId: props.project.id,
                slug: slug.trim(),
                name: name.trim(),
                color,
              }),
            );
            if (!added) return;
            setSlug("");
            setName("");
          })();
        }}
      >
        <input
          value={slug}
          aria-label="New label slug"
          placeholder="slug"
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          value={name}
          aria-label="New label name"
          placeholder="Display name"
          onChange={(event) => setName(event.target.value)}
        />
        <ColorSelect
          label="New label color"
          value={color}
          onChange={setColor}
        />
        <button className="secondary" type="submit">
          Add label
        </button>
      </form>
    </section>
  );
}

/** One definition. The slug is shown as what it is: a key, not a field. */
function LabelDefinition(props: {
  slug: string;
  label: Label;
  onSave: (next: { name: string; color: string }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(props.label.name);
  const [color, setColor] = useState(props.label.color);
  const unchanged =
    name.trim() === props.label.name && color === props.label.color;
  return (
    <div className="label-row">
      <code>{props.slug}</code>
      <input
        value={name}
        aria-label={`Name of label ${props.slug}`}
        onChange={(event) => setName(event.target.value)}
      />
      <ColorSelect
        label={`Color of label ${props.slug}`}
        value={color}
        onChange={setColor}
      />
      <button
        className="secondary"
        disabled={unchanged}
        onClick={() => props.onSave({ name: name.trim(), color })}
      >
        {`Save label ${props.slug}`}
      </button>
      <button className="danger" onClick={props.onRemove}>
        {`Remove label ${props.slug}`}
      </button>
    </div>
  );
}

/** The eight ramp hues (D12), which are the only colours a label may take. */
function ColorSelect(props: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <select
      aria-label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {/* A colour the ramp does not hold still has to be selectable, or saving
          an unrelated rename would silently recolour the label. */}
      {!LABEL_COLORS.includes(props.value as (typeof LABEL_COLORS)[number]) && (
        <option value={props.value}>{props.value}</option>
      )}
      {LABEL_COLORS.map((color) => (
        <option key={color} value={color}>
          {color}
        </option>
      ))}
    </select>
  );
}

function Welcome(props: {
  onCreate: (draft: ProjectDraft) => void;
  onOpen: () => void;
}) {
  return (
    <section className="welcome-panel">
      <div className="welcome-copy">
        <p className="eyebrow">FIRST LAUNCH</p>
        <h1>Choose a folder and start local.</h1>
        <p>
          LongClaw writes project data into `.longclaw/` inside the selected
          folder. No account is required.
        </p>
        <button className="secondary" onClick={props.onOpen}>
          Open existing folder
        </button>
      </div>

      <CreateProjectForm
        className="create-card"
        themes={THEMES}
        submitLabel="Create project in folder"
        onSubmit={props.onCreate}
      />
    </section>
  );
}

function EmptyBoard(props: {
  project: ProjectReference;
  onCreate: () => void;
}) {
  return (
    <div className="empty-board">
      <strong>Create your first ticket</strong>
      <p>
        Every ticket is one file. This one will live under
        <code> {props.project.rootPath}/.longclaw/tickets/</code>.
      </p>
      <button className="primary" onClick={props.onCreate}>
        New ticket
      </button>
    </div>
  );
}

/**
 * The no-match state (`states.md:37-41`, `screen-specs.md:130-131`): a centered
 * panel, the query echoed back, and a secondary Clear filter that `Esc` also
 * reaches. Built beside `EmptyBoard` and wearing its treatment, because both
 * answer the same question — why is there nothing here?
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
      <p>
        Nothing here matches <code>{props.query}</code>.
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
      <button className="secondary" onClick={props.onClear}>
        Clear filter
      </button>
    </div>
  );
}

function UnreachableProject(props: {
  project: ProjectReference;
  onLocate: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="unreachable-panel">
      <p className="eyebrow">UNREACHABLE</p>
      <h2>{props.project.name}</h2>
      <code>{props.project.rootPath}</code>
      <p>
        The registry entry was kept, but the folder cannot be opened from this
        path. Select its new location or remove only this app reference.
      </p>
      <div className="toolbar-actions">
        <button className="primary" onClick={props.onLocate}>
          Locate folder
        </button>
        <button className="danger" onClick={props.onRemove}>
          Remove from app
        </button>
      </div>
    </section>
  );
}
