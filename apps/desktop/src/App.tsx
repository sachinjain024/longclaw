import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  chooseAndRegisterProject,
  editTicket,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
  reportVisibleUi,
  runStreamProbe,
  searchTickets,
} from "./api";
import { useLongClawStore } from "./state";
import type { AppError, ErrorCode, TicketRow } from "./types";

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

interface RowPresentation {
  title: string;
  meta: string;
  source: string;
}

/**
 * Everything a row renders, decided in one place. Branching on `state` per field
 * lets the labels drift apart — a read-only newer-format row saying both "newer
 * format" and "can't parse".
 */
function present(ticket: TicketRow): RowPresentation {
  if (ticket.state === "degraded") {
    return ticket.readOnly
      ? {
          title: ticket.relativePath,
          meta: "newer format",
          source: "Read-only",
        }
      : {
          title: ticket.relativePath,
          meta: "can't parse",
          source: "Needs repair",
        };
  }
  const actor = ticket.lastActivity?.actor;
  const source =
    actor?.type === "agent"
      ? `❯ ${actor.name ?? actor.id ?? "agent"}`
      : actor?.type === "human"
        ? "You"
        : actor?.type === "unknown"
          ? "Changed on disk"
          : "Disk";
  return {
    title: ticket.title,
    meta: `${ticket.status} · ${ticket.checkedCount}/${ticket.checklistCount}`,
    source,
  };
}

export function App() {
  const projects = useLongClawStore((state) => state.projects);
  const activeProjectId = useLongClawStore((state) => state.activeProjectId);
  const tickets = useLongClawStore((state) => state.tickets);
  const generation = useLongClawStore((state) => state.generation);
  const lastSequence = useLongClawStore((state) => state.lastSequence);
  const lastEvent = useLongClawStore((state) => state.lastEvent);
  const loading = useLongClawStore((state) => state.loading);
  const error = useLongClawStore((state) => state.error);
  const setProjects = useLongClawStore((state) => state.setProjects);
  const applySnapshot = useLongClawStore((state) => state.applySnapshot);
  const applyEvent = useLongClawStore((state) => state.applyEvent);
  const applyLocalWrite = useLongClawStore((state) => state.applyLocalWrite);
  const appendStreamFrame = useLongClawStore(
    (state) => state.appendStreamFrame,
  );
  const clearStreamFrames = useLongClawStore(
    (state) => state.clearStreamFrames,
  );
  const setLoading = useLongClawStore((state) => state.setLoading);
  const setError = useLongClawStore((state) => state.setError);

  const [selectedKey, setSelectedKey] = useState<string>();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searchMs, setSearchMs] = useState<number>();
  const [streamText, setStreamText] = useState("");
  const showDevelopmentDiagnostics = import.meta.env.DEV;

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedKey),
    [selectedKey, tickets],
  );

  async function loadProject(projectId: string) {
    setLoading(true);
    try {
      applySnapshot(await openProject(projectId));
    } catch (error) {
      setError(normalizeError(error));
    } finally {
      setLoading(false);
    }
  }

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
      if (document.visibilityState === "visible" && activeProjectId) {
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
  }, [activeProjectId, applySnapshot, setError]);

  useLayoutEffect(() => {
    if (!activeProjectId || tickets.length === 0) return;
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
      setProjects([
        ...projects.filter((item) => item.id !== project.id),
        project,
      ]);
      await loadProject(project.id);
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

  async function performSearch(value: string) {
    setQuery(value);
    if (!activeProjectId || !value.trim()) {
      setSearchMs(undefined);
      return;
    }
    try {
      const result = await searchTickets(activeProjectId, value);
      setSearchMs(result.elapsedMs);
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  async function probeStream() {
    clearStreamFrames();
    setStreamText("");
    try {
      await runStreamProbe((frame) => {
        appendStreamFrame(frame);
        if (frame.event === "chunk") {
          setStreamText(
            (value) =>
              value +
              new TextDecoder().decode(new Uint8Array(frame.data.bytes)),
          );
        }
      });
    } catch (error) {
      setError(normalizeError(error));
    }
  }

  const visibleTickets = query.trim()
    ? tickets.filter((ticket) =>
        `${ticket.key} ${present(ticket).title}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : tickets;

  const project = projects.find((item) => item.id === activeProjectId);

  useEffect(() => {
    const appearance = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.dataset.theme = project?.theme || "indigo";
  }, [project?.theme]);

  return (
    <main className="app-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">LONGCLAW DESKTOP · LOCAL FIRST</p>
          <h1>Plan from files on disk.</h1>
          <p className="lede">
            Project files move through Rust-owned persistence, typed IPC, and a
            thin view cache. Local diagnostics stay on this machine.
          </p>
        </div>
        <button className="primary" onClick={() => void chooseProject()}>
          Open project folder…
        </button>
      </header>

      {error && (
        <section className="error-banner" role="alert">
          <strong>{error.code.replaceAll("_", " ")}</strong>
          <span>{error.message}</span>
          {error.recoverable && <small>Files were not rewritten.</small>}
        </section>
      )}

      <section className="trace-strip" aria-label="Architecture trace">
        <span className="trace-node">DISK</span>
        <span className="trace-arrow">→</span>
        <span className="trace-node">RUST</span>
        <span className="trace-arrow">→</span>
        <span className="trace-node">IPC</span>
        <span className="trace-arrow">→</span>
        <span className="trace-node active">VISIBLE STATE</span>
        <span className="trace-status">
          {lastEvent
            ? `event ${lastEvent.sequence} · ${lastEvent.event.type}`
            : "waiting for a real file event"}
        </span>
      </section>

      {!project ? (
        <section className="empty-state">
          <div className="folder-glyph">.longclaw/</div>
          <h2>Open a LongClaw project</h2>
          <p>
            For visual review, run <code>npm run dev:fixture</code> or choose
            <code> fixtures/representative-project</code>. Production behavior
            does not depend on fixture data.
          </p>
          <button className="primary" onClick={() => void chooseProject()}>
            Choose folder
          </button>
        </section>
      ) : (
        <div className="workspace">
          <aside className="rail">
            <div className="project-heading">
              <span className="theme-dot" />
              <div>
                <strong>{project.name}</strong>
                <code>{project.rootPath}</code>
              </div>
            </div>
            <label className="search-field">
              <span>Search disposable index</span>
              <input
                value={query}
                onChange={(event) => void performSearch(event.target.value)}
                placeholder="Key or title"
              />
              <small>
                {searchMs === undefined
                  ? `${tickets.length} indexed records`
                  : `${searchMs.toFixed(2)} ms`}
              </small>
            </label>
            <button
              className="secondary"
              onClick={() => {
                if (!activeProjectId) return;
                void rebuildIndex(activeProjectId)
                  .then(applySnapshot)
                  .catch((error) => setError(normalizeError(error)));
              }}
            >
              Delete + rebuild index
            </button>
            {showDevelopmentDiagnostics && (
              <>
                <button
                  className="secondary"
                  onClick={() => void probeStream()}
                >
                  Probe ordered stream
                </button>
                <output className="stream-output">
                  {streamText || "PTY-shaped channel idle"}
                </output>
              </>
            )}
          </aside>

          <section className="ticket-area">
            <div className="section-heading">
              <div>
                <p className="eyebrow">GENERATION {generation}</p>
                <h2>Canonical ticket files</h2>
              </div>
              <span className={loading ? "disk-state busy" : "disk-state"}>
                {loading ? "reading…" : "watching"}
              </span>
            </div>

            <div className="ticket-grid">
              <div className="ticket-list">
                {visibleTickets.map((ticket) => {
                  const row = present(ticket);
                  return (
                    <button
                      key={ticket.key}
                      className={[
                        "ticket-row",
                        ticket.key === selectedKey ? "selected" : "",
                        ticket.state === "degraded" ? "degraded" : "",
                        lastEvent?.event.type === "ticketChanged" &&
                        lastEvent.event.data.ticket.key === ticket.key
                          ? "fresh"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedKey(ticket.key)}
                    >
                      <span className="ticket-key">{ticket.key}</span>
                      <strong>{row.title}</strong>
                      <span className="ticket-meta">{row.meta}</span>
                      <span className="actor">{row.source}</span>
                    </button>
                  );
                })}
              </div>

              <div className="inspector">
                {selected ? (
                  <>
                    <div className="inspector-heading">
                      <span className="ticket-key">{selected.key}</span>
                      <code>{selected.relativePath}</code>
                    </div>
                    {selected.state === "degraded" ? (
                      <div className="degraded-copy">
                        <h3>
                          {selected.readOnly
                            ? "Shown read-only"
                            : "Shown without repair"}
                        </h3>
                        <p>
                          {selected.diagnostic.line
                            ? `${selected.relativePath}:${selected.diagnostic.line} — ${selected.diagnostic.message}`
                            : selected.diagnostic.message}
                        </p>
                        <p>
                          {selected.readOnly
                            ? "A newer version of LongClaw wrote this file. Nothing here was changed."
                            : "Fix the file in an editor. The watcher re-reads it once the write settles."}
                        </p>
                      </div>
                    ) : (
                      <label className="title-editor">
                        <span>Title</span>
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          rows={4}
                        />
                        <button
                          className="primary"
                          disabled={draft.trim() === selected.title}
                          onClick={() => void saveTitle()}
                        >
                          Save atomically
                        </button>
                        <small>
                          Save carries the content hash you started from. A
                          newer disk version returns a typed conflict.
                        </small>
                      </label>
                    )}
                  </>
                ) : (
                  <div className="inspector-empty">
                    Select a ticket to exercise UI → IPC → disk.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
