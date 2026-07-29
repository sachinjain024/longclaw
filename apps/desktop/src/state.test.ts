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
});
