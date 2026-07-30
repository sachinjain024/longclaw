import { beforeEach, describe, expect, it } from "vitest";
import ipcContractJson from "../src-tauri/tests/fixtures/ipc-contract.json";
import { useLongClawStore } from "./state";
import type { StreamEnvelope } from "./types";

interface IpcContractFixture {
  projectEventEnvelopes: {
    ticketChanged: StreamEnvelope;
    ticketRemoved: StreamEnvelope;
    indexRebuilt: StreamEnvelope;
    projectUnavailable: StreamEnvelope;
  };
}

// Rust serializes the same fixture in core/model.rs. These tests exercise the
// frontend consumer against payloads locked to the Rust JSON contract.
const ipcContract = ipcContractJson as IpcContractFixture;
const changedEnvelope = ipcContract.projectEventEnvelopes.ticketChanged;

if (changedEnvelope.event.type !== "ticketChanged") {
  throw new Error("IPC fixture ticketChanged envelope has the wrong variant");
}
const initialTicket = changedEnvelope.event.data.ticket;

describe("Rust project-event JSON applied to visible state", () => {
  beforeEach(() => {
    useLongClawStore.setState({
      projects: [],
      activeProjectId: changedEnvelope.projectId,
      appearance: "system",
      tickets: [initialTicket],
      generation: 0,
      lastSequence: 0,
      lastEvent: undefined,
      streamFrames: [],
      loading: false,
      error: undefined,
    });
  });

  it("removes a row for an externally deleted ticket.md", () => {
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.ticketRemoved);

    expect(useLongClawStore.getState().tickets).toEqual([]);
    expect(useLongClawStore.getState().lastSequence).toBe(2);
  });

  it("shows the real unavailable project path", () => {
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.projectUnavailable);

    expect(useLongClawStore.getState().error).toMatchObject({
      code: "project_unavailable",
      message: "Project folder is unavailable: /tmp/LongClaw Fixture",
      recoverable: true,
    });
  });

  it("keeps an unreadable ticket visible with its diagnostic", () => {
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.indexRebuilt);

    const tickets = useLongClawStore.getState().tickets;
    expect(tickets).toHaveLength(2);
    const degraded = tickets.find((ticket) => ticket.state === "degraded");
    expect(degraded).toMatchObject({
      state: "degraded",
      key: "LC-98",
      readOnly: false,
      relativePath: ".longclaw/tickets/LC-98/ticket.md",
      diagnostic: { code: "parse_failed", line: 6 },
    });
    expect(useLongClawStore.getState().generation).toBe(7);
  });

  it("carries the attribution an external change arrived with", () => {
    useLongClawStore.setState({ tickets: [] });
    useLongClawStore.getState().applyEvent(changedEnvelope);

    const [ticket] = useLongClawStore.getState().tickets;
    expect(ticket.state).toBe("indexed");
    if (ticket.state !== "indexed") throw new Error("expected an indexed row");
    expect(ticket.lastActivity?.actor).toEqual({
      type: "agent",
      id: "claude-code",
      name: "Claude Code",
    });
    expect(ticket.contentHash).toBe("abc123");
  });

  it("ignores an event that arrived out of order", () => {
    const store = useLongClawStore.getState();
    store.applyEvent(ipcContract.projectEventEnvelopes.indexRebuilt);
    store.applyEvent(ipcContract.projectEventEnvelopes.ticketRemoved);

    // The removal has a lower sequence than the rebuild, so it does not apply.
    expect(useLongClawStore.getState().tickets).toHaveLength(2);
    expect(useLongClawStore.getState().lastSequence).toBe(3);
  });

  it("upserts and removes local project references without keeping stale active rows", () => {
    const project = {
      id: "local-project",
      name: "Local Project",
      rootPath: "/tmp/local-project",
      key: "LP",
      theme: "indigo",
      starred: false,
      reachable: true,
    };

    useLongClawStore.getState().upsertProject(project);
    useLongClawStore.getState().applySnapshot({
      project,
      tickets: [initialTicket],
      generation: 1,
      rebuiltInMs: 0,
    });
    useLongClawStore
      .getState()
      .upsertProject({ ...project, starred: true, theme: "clay" });

    expect(useLongClawStore.getState().projects).toMatchObject([
      { id: "local-project", starred: true, theme: "clay" },
    ]);

    useLongClawStore.getState().removeProjectReference("local-project");

    expect(useLongClawStore.getState().projects).toEqual([]);
    expect(useLongClawStore.getState().activeProjectId).toBeUndefined();
    expect(useLongClawStore.getState().tickets).toEqual([]);
  });

  it("selects an unreachable project without keeping rows from the last project", () => {
    useLongClawStore.setState({
      projects: [
        {
          id: "missing-project",
          name: "Missing Project",
          rootPath: "/tmp/missing-project",
          key: "MP",
          theme: "indigo",
          starred: false,
          reachable: false,
        },
      ],
      activeProjectId: changedEnvelope.projectId,
      tickets: [initialTicket],
      generation: 4,
      lastSequence: 9,
      lastEvent: changedEnvelope,
    });

    useLongClawStore.getState().setActiveProjectId("missing-project");

    expect(useLongClawStore.getState()).toMatchObject({
      activeProjectId: "missing-project",
      tickets: [],
      generation: 0,
      lastSequence: 0,
      lastEvent: undefined,
    });
  });

  it("marks a project unreachable while preserving the registry entry", () => {
    useLongClawStore.setState({
      projects: [
        {
          id: "moved-project",
          name: "Moved Project",
          rootPath: "/tmp/moved-project",
          key: "MP",
          theme: "indigo",
          starred: true,
          reachable: true,
        },
      ],
    });

    useLongClawStore.getState().markProjectReachable("moved-project", false);

    expect(useLongClawStore.getState().projects).toEqual([
      {
        id: "moved-project",
        name: "Moved Project",
        rootPath: "/tmp/moved-project",
        key: "MP",
        theme: "indigo",
        starred: true,
        reachable: false,
      },
    ]);
  });
});
