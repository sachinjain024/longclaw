import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  chooseAndCreateProject,
  chooseAndRegisterProject,
  chooseAndRelocateProject,
  editTicket,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
  removeProject,
  reportVisibleUi,
  setProjectStarred,
  updateProjectName,
  updateProjectTheme,
} from "./api";
import { useLongClawStore } from "./state";
import type {
  AppError,
  ErrorCode,
  ProjectReference,
  TicketRow,
  TicketStatus,
} from "./types";

const ERROR_CODES = new Set<ErrorCode>([
  "cancelled",
  "invalid_project",
  "project_unavailable",
  "ticket_not_found",
  "parse_failed",
  "unsupported_version",
  "conflict",
  "permission_denied",
  "io",
  "internal",
]);

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "plum", label: "Plum" },
];

const STATUSES: { id: TicketStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
  { id: "canceled", label: "Canceled" },
];

const APPEARANCE_KEY = "longclaw.appearance";

function isAppError(error: unknown): error is AppError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Partial<AppError>;
  return (
    typeof candidate.code === "string" &&
    ERROR_CODES.has(candidate.code as ErrorCode) &&
    typeof candidate.message === "string" &&
    typeof candidate.recoverable === "boolean"
  );
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return {
    code: "internal",
    message: error instanceof Error ? error.message : String(error),
    recoverable: false,
  };
}

function ticketStatus(ticket: TicketRow): TicketStatus | "unreadable" {
  return ticket.state === "indexed" ? ticket.status : "unreadable";
}

function present(ticket: TicketRow) {
  if (ticket.state === "degraded") {
    return {
      title: ticket.relativePath,
      meta: ticket.readOnly ? "newer format" : "needs repair",
      source: "Unreadable",
    };
  }
  const actor = ticket.lastActivity?.actor;
  const source =
    actor?.type === "agent"
      ? `Agent: ${actor.name ?? actor.id ?? "unknown"}`
      : actor?.type === "human"
        ? "You"
        : actor?.type === "unknown"
          ? "Changed on disk"
          : "Disk";
  return {
    title: ticket.title,
    meta: `${ticket.priority} - ${ticket.checkedCount}/${ticket.checklistCount}`,
    source,
  };
}

function defaultProjectName() {
  return "Untitled Project";
}

function defaultProjectKey(name: string) {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 4);
  return letters || "LC";
}

function sortedProjects(projects: ProjectReference[]) {
  return [...projects].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function App() {
  const projects = useLongClawStore((state) => state.projects);
  const activeProjectId = useLongClawStore((state) => state.activeProjectId);
  const appearance = useLongClawStore((state) => state.appearance);
  const tickets = useLongClawStore((state) => state.tickets);
  const generation = useLongClawStore((state) => state.generation);
  const lastSequence = useLongClawStore((state) => state.lastSequence);
  const lastEvent = useLongClawStore((state) => state.lastEvent);
  const loading = useLongClawStore((state) => state.loading);
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
  const setLoading = useLongClawStore((state) => state.setLoading);
  const setError = useLongClawStore((state) => state.setError);

  const [selectedKey, setSelectedKey] = useState<string>();
  const [draft, setDraft] = useState("");
  const [createName, setCreateName] = useState(defaultProjectName());
  const [createKey, setCreateKey] = useState("LC");
  const [createTheme, setCreateTheme] = useState("indigo");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = projects.find((item) => item.id === activeProjectId);
  const selected = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedKey),
    [selectedKey, tickets],
  );
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

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_KEY, appearance);
    } catch {
      // Appearance still works for this session.
    }
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    document.documentElement.dataset.appearance =
      appearance === "system" ? system : appearance;
  }, [appearance]);

  useEffect(() => {
    document.documentElement.dataset.theme = project?.theme || "indigo";
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

  useEffect(() => {
    if (selected?.state !== "indexed") return;
    setDraft(selected.title);
  }, [selected]);

  useEffect(() => {
    const reconcile = () => {
      if (
        document.visibilityState === "visible" &&
        activeProjectId &&
        project?.reachable
      ) {
        void reconcileProject(activeProjectId)
          .then(applySnapshot)
          .catch((error) => setError(normalizeError(error)));
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
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(".ticket-row"),
      );
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

  async function createProject() {
    try {
      const project = await chooseAndCreateProject({
        name: createName.trim() || defaultProjectName(),
        key: createKey.trim().toUpperCase() || defaultProjectKey(createName),
        theme: createTheme,
      });
      if (!project) return;
      upsertProject(project);
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

  async function changeTheme(theme: string) {
    if (!project) return;
    try {
      const updated = await updateProjectTheme(project.id, theme);
      upsertProject(updated);
      await loadProject(updated.id);
    } catch (error) {
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

  async function saveTitle() {
    if (selected?.state !== "indexed" || !activeProjectId || !draft.trim()) {
      return;
    }
    try {
      const result = await editTicket({
        projectId: activeProjectId,
        ticketKey: selected.key,
        expectedHash: selected.contentHash,
        edit: { title: draft.trim() },
      });
      applyLocalWrite(result.ticket, result.generation);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  const unreadableTickets = tickets.filter(
    (ticket) => ticketStatus(ticket) === "unreadable",
  );

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
              <form
                className="quick-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createProject();
                }}
              >
                <label>
                  <span>Name</span>
                  <input
                    value={createName}
                    onChange={(event) => {
                      setCreateName(event.target.value);
                      setCreateKey(defaultProjectKey(event.target.value));
                    }}
                  />
                </label>
                <label>
                  <span>Key</span>
                  <input
                    value={createKey}
                    onChange={(event) =>
                      setCreateKey(event.target.value.toUpperCase())
                    }
                  />
                </label>
                <label>
                  <span>Theme</span>
                  <select
                    value={createTheme}
                    onChange={(event) => setCreateTheme(event.target.value)}
                  >
                    {THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="submit">
                  Choose folder
                </button>
              </form>
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
            createName={createName}
            createKey={createKey}
            createTheme={createTheme}
            onCreateName={(name) => {
              setCreateName(name);
              setCreateKey(defaultProjectKey(name));
            }}
            onCreateKey={setCreateKey}
            onCreateTheme={setCreateTheme}
            onCreate={() => void createProject()}
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
                <label>
                  <span>Theme</span>
                  <select
                    value={project.theme}
                    onChange={(event) => void changeTheme(event.target.value)}
                  >
                    {THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary"
                  onClick={() => void relocateActiveProject(project.id)}
                >
                  Locate folder
                </button>
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
                    <h2>Board</h2>
                  </div>
                  <div className="toolbar-actions">
                    <span
                      className={loading ? "disk-state busy" : "disk-state"}
                    >
                      {loading ? "reading" : "watching"}
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
                  </div>
                </div>

                {tickets.length === 0 ? (
                  <EmptyBoard project={project} />
                ) : (
                  <div className="board-grid">
                    {STATUSES.map((status) => (
                      <BoardColumn
                        key={status.id}
                        title={status.label}
                        tickets={tickets.filter(
                          (ticket) => ticketStatus(ticket) === status.id,
                        )}
                        selectedKey={selectedKey}
                        onSelect={setSelectedKey}
                      />
                    ))}
                    {unreadableTickets.length > 0 && (
                      <BoardColumn
                        title="Unreadable"
                        tickets={unreadableTickets}
                        selectedKey={selectedKey}
                        onSelect={setSelectedKey}
                      />
                    )}
                  </div>
                )}

                <Inspector
                  selected={selected}
                  draft={draft}
                  onDraft={setDraft}
                  onSave={() => void saveTitle()}
                />
              </section>
            )}
          </>
        )}
      </section>
    </main>
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

function Welcome(props: {
  createName: string;
  createKey: string;
  createTheme: string;
  onCreateName: (name: string) => void;
  onCreateKey: (key: string) => void;
  onCreateTheme: (theme: string) => void;
  onCreate: () => void;
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

      <form
        className="create-card"
        onSubmit={(event) => {
          event.preventDefault();
          props.onCreate();
        }}
      >
        <label>
          <span>Project name</span>
          <input
            value={props.createName}
            onChange={(event) => props.onCreateName(event.target.value)}
          />
        </label>
        <label>
          <span>Ticket key</span>
          <input
            value={props.createKey}
            onChange={(event) =>
              props.onCreateKey(event.target.value.toUpperCase())
            }
          />
        </label>
        <label>
          <span>Theme</span>
          <select
            value={props.createTheme}
            onChange={(event) => props.onCreateTheme(event.target.value)}
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" type="submit">
          Create project in folder
        </button>
      </form>
    </section>
  );
}

function EmptyBoard({ project }: { project: ProjectReference }) {
  return (
    <div className="empty-board">
      <strong>Empty board</strong>
      <p>
        The project is ready. Ticket files will live under
        <code> {project.rootPath}/.longclaw/tickets/</code>.
      </p>
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

function BoardColumn(props: {
  title: string;
  tickets: TicketRow[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="board-column">
      <h3>
        {props.title}
        <span>{props.tickets.length}</span>
      </h3>
      {props.tickets.map((ticket) => {
        const row = present(ticket);
        return (
          <button
            key={ticket.key}
            className={[
              "ticket-row",
              ticket.key === props.selectedKey ? "selected" : "",
              ticket.state === "degraded" ? "degraded" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => props.onSelect(ticket.key)}
          >
            <span className="ticket-key">{ticket.key}</span>
            <strong>{row.title}</strong>
            <span className="ticket-meta">{row.meta}</span>
            <span className="actor">{row.source}</span>
          </button>
        );
      })}
    </section>
  );
}

function Inspector(props: {
  selected?: TicketRow;
  draft: string;
  onDraft: (value: string) => void;
  onSave: () => void;
}) {
  const selected = props.selected;
  return (
    <aside className="inspector">
      {selected ? (
        <>
          <div className="inspector-heading">
            <span className="ticket-key">{selected.key}</span>
            <code>{selected.relativePath}</code>
          </div>
          {selected.state === "degraded" ? (
            <div className="degraded-copy">
              <h3>
                {selected.readOnly ? "Shown read-only" : "Shown without repair"}
              </h3>
              <p>
                {selected.diagnostic.line
                  ? `${selected.relativePath}:${selected.diagnostic.line} - ${selected.diagnostic.message}`
                  : selected.diagnostic.message}
              </p>
            </div>
          ) : (
            <label className="title-editor">
              <span>Title</span>
              <textarea
                value={props.draft}
                onChange={(event) => props.onDraft(event.target.value)}
                rows={4}
              />
              <button
                className="primary"
                disabled={props.draft.trim() === selected.title}
                onClick={props.onSave}
              >
                Save atomically
              </button>
            </label>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          Select a ticket to inspect the file-backed row.
        </div>
      )}
    </aside>
  );
}
