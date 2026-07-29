import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  chooseAndRegisterProject,
  listProjects,
  listenForProjectEvents,
  openProject,
  rebuildIndex,
  reconcileProject,
  reportVisibleUi,
  runStreamProbe,
  searchTickets,
  writeTicketTitle,
} from "./api";
import { useSpikeStore } from "./store";
import type { AppError, TicketView } from "./types";

function normalizeError(error: unknown): AppError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  ) {
    return error as AppError;
  }
  return {
    code: "internal",
    message: error instanceof Error ? error.message : String(error),
    recoverable: false,
  };
}

function sourceLabel(ticket: TicketView): string {
  if (ticket.degraded) return "Needs repair";
  if (ticket.lastActor?.type === "agent") {
    return `❯ ${ticket.lastActor.name ?? "agent"}`;
  }
  return ticket.lastActor?.name ?? "Disk";
}

export function App() {
  const state = useSpikeStore();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searchMs, setSearchMs] = useState<number>();
  const [streamText, setStreamText] = useState("");

  const selected = useMemo(
    () => state.tickets.find((ticket) => ticket.key === selectedKey),
    [selectedKey, state.tickets],
  );

  async function loadProject(projectId: string) {
    state.setLoading(true);
    try {
      state.applySnapshot(await openProject(projectId));
    } catch (error) {
      state.setError(normalizeError(error));
    } finally {
      state.setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let stopListening: undefined | (() => void);

    void (async () => {
      try {
        stopListening = await listenForProjectEvents((event) => {
          if (active) state.applyEvent(event);
        });
        const projects = await listProjects();
        if (!active) return;
        state.setProjects(projects);
        const reachable = projects.find((project) => project.reachable);
        if (reachable) await loadProject(reachable.id);
      } catch (error) {
        if (active) state.setError(normalizeError(error));
      }
    })();

    return () => {
      active = false;
      stopListening?.();
    };
    // The store actions are stable for the lifetime of this throwaway shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDraft(selected.title);
  }, [selected]);

  useEffect(() => {
    const reconcile = () => {
      if (document.visibilityState === "visible" && state.activeProjectId) {
        void reconcileProject(state.activeProjectId)
          .then(state.applySnapshot)
          .catch((error) => state.setError(normalizeError(error)));
      }
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [state.activeProjectId, state.applySnapshot, state.setError]);

  useLayoutEffect(() => {
    if (!state.activeProjectId || state.tickets.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(".ticket-row"),
      );
      const trace =
        document.querySelector<HTMLElement>(".trace-status")?.innerText ?? "";
      void reportVisibleUi({
        projectId: state.activeProjectId!,
        rowCount: rows.length,
        rowTitles: rows
          .map((row) => row.querySelector("strong")?.textContent ?? "")
          .filter(Boolean),
        lastSequence: state.lastSequence,
        traceText: trace,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    state.activeProjectId,
    state.lastSequence,
    state.tickets,
  ]);

  async function chooseProject() {
    try {
      const project = await chooseAndRegisterProject();
      if (!project) return;
      state.setProjects([
        ...state.projects.filter((item) => item.id !== project.id),
        project,
      ]);
      await loadProject(project.id);
    } catch (error) {
      state.setError(normalizeError(error));
    }
  }

  async function saveTitle() {
    if (!selected || !state.activeProjectId || !draft.trim()) return;
    try {
      const result = await writeTicketTitle({
        projectId: state.activeProjectId,
        ticketKey: selected.key,
        title: draft.trim(),
        expectedHash: selected.contentHash,
      });
      state.applyLocalWrite(result.ticket, result.generation);
    } catch (error) {
      state.setError(normalizeError(error));
    }
  }

  async function performSearch(value: string) {
    setQuery(value);
    if (!state.activeProjectId || !value.trim()) {
      setSearchMs(undefined);
      return;
    }
    try {
      const result = await searchTickets(state.activeProjectId, value);
      setSearchMs(result.elapsedMs);
    } catch (error) {
      state.setError(normalizeError(error));
    }
  }

  async function probeStream() {
    state.clearStreamFrames();
    setStreamText("");
    try {
      await runStreamProbe((frame) => {
        state.appendStreamFrame(frame);
        if (frame.event === "chunk") {
          setStreamText((value) =>
            value + new TextDecoder().decode(new Uint8Array(frame.data.bytes)),
          );
        }
      });
    } catch (error) {
      state.setError(normalizeError(error));
    }
  }

  const visibleTickets = query.trim()
    ? state.tickets.filter((ticket) =>
        `${ticket.key} ${ticket.title}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : state.tickets;

  const project = state.projects.find(
    (item) => item.id === state.activeProjectId,
  );

  return (
    <main className="app-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">TAURI V2 · ARCHITECTURE SPIKE</p>
          <h1>Watch the file boundary.</h1>
          <p className="lede">
            Real project files move through Rust, IPC, and view state. The
            green trace only appears for external writes.
          </p>
        </div>
        <button className="primary" onClick={() => void chooseProject()}>
          Open project folder…
        </button>
      </header>

      {state.error && (
        <section className="error-banner" role="alert">
          <strong>{state.error.code.replaceAll("_", " ")}</strong>
          <span>{state.error.message}</span>
          {state.error.recoverable && <small>Files were not rewritten.</small>}
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
          {state.lastEvent
            ? `event ${state.lastEvent.sequence} · ${state.lastEvent.event.type}`
            : "waiting for a real file event"}
        </span>
      </section>

      {!project ? (
        <section className="empty-state">
          <div className="folder-glyph">.longclaw/</div>
          <h2>Open the representative fixture</h2>
          <p>
            Choose <code>fixtures/representative-project</code>, then edit a
            ticket.md in any ordinary editor.
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
                  ? `${state.tickets.length} indexed records`
                  : `${searchMs.toFixed(2)} ms`}
              </small>
            </label>
            <button
              className="secondary"
              onClick={() => {
                if (!state.activeProjectId) return;
                void rebuildIndex(state.activeProjectId)
                  .then(state.applySnapshot)
                  .catch((error) => state.setError(normalizeError(error)));
              }}
            >
              Delete + rebuild index
            </button>
            <button className="secondary" onClick={() => void probeStream()}>
              Probe ordered stream
            </button>
            <output className="stream-output">
              {streamText || "PTY-shaped channel idle"}
            </output>
          </aside>

          <section className="ticket-area">
            <div className="section-heading">
              <div>
                <p className="eyebrow">GENERATION {state.generation}</p>
                <h2>Canonical ticket files</h2>
              </div>
              <span className={state.loading ? "disk-state busy" : "disk-state"}>
                {state.loading ? "reading…" : "watching"}
              </span>
            </div>

            <div className="ticket-grid">
              <div className="ticket-list">
                {visibleTickets.map((ticket) => (
                  <button
                    key={ticket.key}
                    className={[
                      "ticket-row",
                      ticket.key === selectedKey ? "selected" : "",
                      ticket.degraded ? "degraded" : "",
                      state.lastEvent?.event.type === "ticketChanged" &&
                      state.lastEvent.event.data.ticket.key === ticket.key
                        ? "fresh"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedKey(ticket.key)}
                  >
                    <span className="ticket-key">{ticket.key}</span>
                    <strong>{ticket.title}</strong>
                    <span className="ticket-meta">
                      {ticket.status} · {ticket.checkedCount}/
                      {ticket.checklistCount}
                    </span>
                    <span className="actor">{sourceLabel(ticket)}</span>
                  </button>
                ))}
              </div>

              <div className="inspector">
                {selected ? (
                  <>
                    <div className="inspector-heading">
                      <span className="ticket-key">{selected.key}</span>
                      <code>{selected.relativePath}</code>
                    </div>
                    {selected.degraded ? (
                      <div className="degraded-copy">
                        <h3>Shown without repair</h3>
                        <p>{selected.diagnostic}</p>
                        <p>
                          Fix the file externally. The watcher will retry after
                          its write burst settles.
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
