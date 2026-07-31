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
/** A fixed observation time, so acknowledgement decay is asserted, not timed. */
const OBSERVED_AT = 1_800_000_000_000;

const changedEvent = changedEnvelope.event;
if (changedEvent.type !== "ticketChanged") {
  throw new Error("IPC fixture ticketChanged envelope has the wrong variant");
}
const initialTicket = changedEvent.data.ticket;

/**
 * Applies an envelope as though every event before it had already arrived.
 *
 * The fixture envelopes carry sequences 1–4, and a store that has only ever seen
 * sequence 0 would rightly call sequence 3 a gap. A test about acknowledgement
 * decay or degraded rows is not a test about gaps, so it states its precondition
 * instead of relying on a store that never checked.
 */
function applyInSequence(envelope: StreamEnvelope, observedAt?: number) {
  useLongClawStore.setState({ lastSequence: envelope.sequence - 1 });
  useLongClawStore.getState().applyEvent(envelope, observedAt);
}

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
      externalMarks: {},
      streamFrames: [],
      loading: false,
      reconciling: false,
      error: undefined,
    });
  });

  it("removes a row for an externally deleted ticket.md", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.ticketRemoved);

    expect(useLongClawStore.getState().tickets).toEqual([]);
    expect(useLongClawStore.getState().lastSequence).toBe(2);
  });

  it("shows the real unavailable project path", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.projectUnavailable);

    expect(useLongClawStore.getState().error).toMatchObject({
      code: "project_unavailable",
      message: "Project folder is unavailable: /tmp/LongClaw Fixture",
      recoverable: true,
    });
  });

  it("keeps an unreadable ticket visible with its diagnostic", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.indexRebuilt);

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
    applyInSequence(changedEnvelope);

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

  it("acknowledges an agent change until the ticket is reviewed", () => {
    useLongClawStore.setState({ tickets: [] });
    applyInSequence(changedEnvelope, OBSERVED_AT);

    expect(useLongClawStore.getState().externalMarks).toEqual({
      "LC-3": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: OBSERVED_AT,
      },
    });

    // Opening the ticket is the review that decays the treatment.
    useLongClawStore.getState().reviewTicket("LC-3");

    expect(useLongClawStore.getState().externalMarks).toEqual({});
  });

  it("does not borrow the file's newest actor for a change that appended nothing", () => {
    // The fixture row's newest record is Claude Code's. This event carries no
    // attribution, which is what a hand edit in an editor produces — and the
    // acknowledgement must not put the agent's name on it.
    useLongClawStore.setState({ tickets: [] });
    const withoutAttribution: StreamEnvelope = {
      ...changedEnvelope,
      event: {
        type: "ticketChanged",
        data: { ...changedEvent.data, attribution: undefined },
      },
    };
    applyInSequence(withoutAttribution, OBSERVED_AT);

    const [ticket] = useLongClawStore.getState().tickets;
    expect(ticket.state === "indexed" && ticket.lastActivity?.actor.type).toBe(
      "agent",
    );
    expect(useLongClawStore.getState().externalMarks).toEqual({
      "LC-3": {
        actorType: "unknown",
        actorLabel: "actor unknown",
        at: OBSERVED_AT,
      },
    });
  });

  it("drops the acknowledgement when the ticket file goes away", () => {
    applyInSequence(changedEnvelope, OBSERVED_AT);
    applyInSequence(
      ipcContract.projectEventEnvelopes.ticketRemoved,
      OBSERVED_AT,
    );

    expect(useLongClawStore.getState().externalMarks).toEqual({});
  });

  it("forgets acknowledgements from another project", () => {
    applyInSequence(changedEnvelope, OBSERVED_AT);
    useLongClawStore.getState().setActiveProjectId("another-project");

    expect(useLongClawStore.getState().externalMarks).toEqual({});
  });

  it("keeps an app write out of the acknowledgement treatment", () => {
    useLongClawStore.getState().applyLocalWrite(initialTicket, 3);

    expect(useLongClawStore.getState().externalMarks).toEqual({});
    expect(useLongClawStore.getState().generation).toBe(3);
  });

  it("sweeps decayed acknowledgements", () => {
    applyInSequence(changedEnvelope, OBSERVED_AT);
    useLongClawStore.getState().sweepMarks(OBSERVED_AT + 119_000);

    expect(Object.keys(useLongClawStore.getState().externalMarks)).toEqual([
      "LC-3",
    ]);

    useLongClawStore.getState().sweepMarks(OBSERVED_AT + 120_001);

    expect(useLongClawStore.getState().externalMarks).toEqual({});
  });

  it("ignores an event that arrived out of order", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.indexRebuilt);
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.ticketRemoved);

    // The removal has a lower sequence than the rebuild, so it does not apply.
    expect(useLongClawStore.getState().tickets).toHaveLength(2);
    expect(useLongClawStore.getState().lastSequence).toBe(3);
  });

  it("stops applying events when one goes missing, and asks for a snapshot once", () => {
    applyInSequence(changedEnvelope);
    const beforeTheGap = useLongClawStore.getState().tickets;

    // Sequence 2 never arrived. Three is not the next event; it is evidence that
    // the board is already wrong.
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.indexRebuilt);

    expect(useLongClawStore.getState().reconciling).toBe(true);
    expect(useLongClawStore.getState().tickets).toBe(beforeTheGap);
    // The high-water mark must not move. Adopting it is how the change nobody
    // saw becomes unrecoverable.
    expect(useLongClawStore.getState().lastSequence).toBe(1);

    // Everything that arrives while the snapshot is in flight is dropped, not
    // queued, so no second recovery is requested and no history applies late.
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.projectUnavailable);

    expect(useLongClawStore.getState().reconciling).toBe(true);
    expect(useLongClawStore.getState().lastSequence).toBe(1);
    expect(useLongClawStore.getState().error).toBeUndefined();
  });

  it("converges on the state it would have had if nothing was lost", () => {
    applyInSequence(changedEnvelope, OBSERVED_AT);
    const marksBefore = useLongClawStore.getState().externalMarks;

    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.indexRebuilt);
    expect(useLongClawStore.getState().reconciling).toBe(true);

    const rebuilt = ipcContract.projectEventEnvelopes.indexRebuilt;
    if (rebuilt.event.type !== "indexRebuilt") {
      throw new Error(
        "IPC fixture indexRebuilt envelope has the wrong variant",
      );
    }
    useLongClawStore.getState().applySnapshot({
      ...rebuilt.event.data.snapshot,
      sequence: rebuilt.sequence,
    });

    // The same rows the lost event and the one after it would have produced.
    expect(useLongClawStore.getState().tickets).toHaveLength(2);
    expect(useLongClawStore.getState().generation).toBe(7);
    expect(useLongClawStore.getState().reconciling).toBe(false);
    // Resumed at the snapshot's own boundary, so the next event applies normally.
    expect(useLongClawStore.getState().lastSequence).toBe(3);
    // An agent's acknowledgement is not index state, and recovering the index
    // must not scrub the ring off a card it just touched.
    expect(useLongClawStore.getState().externalMarks).toEqual(marksBefore);

    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.projectUnavailable);

    expect(useLongClawStore.getState().lastSequence).toBe(4);
    expect(useLongClawStore.getState().error).toMatchObject({
      code: "project_unavailable",
    });
  });

  it("treats a late duplicate as reordering rather than a gap", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.indexRebuilt);

    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.ticketRemoved);

    expect(useLongClawStore.getState().reconciling).toBe(false);
    expect(useLongClawStore.getState().lastSequence).toBe(3);
  });

  it("does not read a project switch as a gap", () => {
    applyInSequence(changedEnvelope);

    // Another project's engine has its own counter, so its sequences say nothing
    // about this project's.
    useLongClawStore.getState().applyEvent({
      ...ipcContract.projectEventEnvelopes.indexRebuilt,
      projectId: "a-different-project",
    });

    expect(useLongClawStore.getState().reconciling).toBe(false);
    expect(useLongClawStore.getState().lastSequence).toBe(1);
  });

  it("lets the next gap ask again after a failed snapshot request", () => {
    applyInSequence(changedEnvelope);
    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.indexRebuilt);
    expect(useLongClawStore.getState().reconciling).toBe(true);

    useLongClawStore.getState().reconcileFailed();

    expect(useLongClawStore.getState().reconciling).toBe(false);
    expect(useLongClawStore.getState().loading).toBe(false);
    // Still no adopted high-water mark, so the staleness is not papered over.
    expect(useLongClawStore.getState().lastSequence).toBe(1);

    useLongClawStore
      .getState()
      .applyEvent(ipcContract.projectEventEnvelopes.projectUnavailable);

    expect(useLongClawStore.getState().reconciling).toBe(true);
  });

  it("never moves the sequence boundary backwards on an ordinary reconcile", () => {
    applyInSequence(ipcContract.projectEventEnvelopes.indexRebuilt);
    const rebuilt = ipcContract.projectEventEnvelopes.indexRebuilt;
    if (rebuilt.event.type !== "indexRebuilt") {
      throw new Error(
        "IPC fixture indexRebuilt envelope has the wrong variant",
      );
    }

    // A focus reconcile can carry a boundary read before the events already
    // applied on top of it. Adopting it would replay them.
    useLongClawStore.getState().applySnapshot({
      ...rebuilt.event.data.snapshot,
      sequence: 1,
    });

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
      sequence: 0,
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
