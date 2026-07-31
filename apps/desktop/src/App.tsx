import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  chooseAndCreateProject,
  chooseAndRegisterProject,
  chooseAndRelocateProject,
  createTicket,
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
import { Board } from "./Board";
import { CreateProjectForm, type ProjectDraft } from "./CreateProjectForm";
import { normalizeError } from "./errors";
import { QuickCreate } from "./QuickCreate";
import { useLongClawStore } from "./state";
import { TicketPanel } from "./TicketPanel";
import type { CreateTicketRequest, ProjectReference } from "./types";

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "plum", label: "Plum" },
];

const APPEARANCE_KEY = "longclaw.appearance";

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
  const reconcileFailed = useLongClawStore((state) => state.reconcileFailed);
  const externalMarks = useLongClawStore((state) => state.externalMarks);
  const reviewTicket = useLongClawStore((state) => state.reviewTicket);
  const sweepMarks = useLongClawStore((state) => state.sweepMarks);
  const setLoading = useLongClawStore((state) => state.setLoading);
  const setError = useLongClawStore((state) => state.setError);

  const [selectedKey, setSelectedKey] = useState<string>();
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Bumped when an external change lands for the open ticket. */
  const [panelReload, setPanelReload] = useState(0);
  /** Drives the acknowledgement age text and its decay. */
  const [now, setNow] = useState(() => Date.now());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = projects.find((item) => item.id === activeProjectId);
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
    if (!key) return;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`.ticket-row[data-ticket-key="${key}"]`)
        ?.focus();
    });
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

  async function submitNewTicket(
    request: Omit<CreateTicketRequest, "projectId">,
  ) {
    if (!activeProjectId) return;
    setCreating(true);
    try {
      const result = await createTicket({
        projectId: activeProjectId,
        ...request,
      });
      applyLocalWrite(result.ticket, result.generation);
      setTicketFormOpen(false);
      openTicket(result.ticket.key);
    } catch (error) {
      setError(normalizeError(error));
    } finally {
      setCreating(false);
    }
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
                      onClick={() => setTicketFormOpen(true)}
                    >
                      New ticket
                    </button>
                  </div>
                </div>

                {tickets.length === 0 ? (
                  <EmptyBoard
                    project={project}
                    onCreate={() => setTicketFormOpen(true)}
                  />
                ) : (
                  <Board
                    tickets={tickets}
                    selectedKey={selectedKey}
                    marks={externalMarks}
                    now={now}
                    onSelect={openTicket}
                  />
                )}
              </section>
            )}
          </>
        )}
      </section>

      {project && activeProjectId && selectedKey && project.reachable && (
        <TicketPanel
          projectId={activeProjectId}
          ticketKey={selectedKey}
          mark={externalMarks[selectedKey]}
          reloadSignal={panelReload}
          now={now}
          onClose={() => closeTicket(selectedKey)}
          onWrite={(result) =>
            applyLocalWrite(result.ticket, result.generation)
          }
          onError={setError}
        />
      )}

      {project && activeProjectId && ticketFormOpen && (
        <QuickCreate
          projectKey={project.key}
          submitting={creating}
          onCancel={() => setTicketFormOpen(false)}
          onCreate={(request) => void submitNewTicket(request)}
        />
      )}
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
