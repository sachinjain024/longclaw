// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as api from "./api";
import { resetMutations } from "./mutations";
import { useLongClawStore } from "./state";
import type { WriteResult } from "./types";

vi.mock("./api", () => ({
  chooseAndCreateProject: vi.fn(),
  chooseAndRegisterProject: vi.fn(),
  chooseAndRelocateProject: vi.fn(),
  createTicket: vi.fn(),
  editTicket: vi.fn(),
  listProjects: vi.fn(),
  listenForProjectEvents: vi.fn(),
  openProject: vi.fn(),
  readTicket: vi.fn(),
  rebuildIndex: vi.fn(),
  reconcileProject: vi.fn(),
  removeProject: vi.fn(),
  reportVisibleUi: vi.fn(),
  setProjectStarred: vi.fn(),
  updateProjectName: vi.fn(),
  updateProjectTheme: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  resetMutations();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false })),
  });
  vi.mocked(api.listProjects).mockResolvedValue([]);
  vi.mocked(api.listenForProjectEvents).mockResolvedValue(() => {});
  useLongClawStore.setState({
    projects: [],
    activeProjectId: undefined,
    tickets: [],
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

describe("recovering from a lost project event", () => {
  const project = {
    id: "project-fixture",
    name: "Fixture Project",
    rootPath: "/tmp/LongClaw Fixture",
    key: "LC",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  it("fetches one snapshot, says it is reconciling, and resumes", async () => {
    vi.mocked(api.reconcileProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 9,
      rebuiltInMs: 1,
      sequence: 12,
    });
    useLongClawStore.setState({
      projects: [project],
      activeProjectId: project.id,
      lastSequence: 4,
      reconciling: true,
      loading: true,
    });

    render(<App />);

    expect(screen.getByText("reconciling")).toBeTruthy();
    await vi.waitFor(() => {
      expect(useLongClawStore.getState().reconciling).toBe(false);
      expect(useLongClawStore.getState().loading).toBe(false);
    });
    expect(api.reconcileProject).toHaveBeenCalledTimes(1);
    expect(api.reconcileProject).toHaveBeenCalledWith(project.id);
    expect(useLongClawStore.getState().lastSequence).toBe(12);
  });

  it("surfaces a failed snapshot instead of retrying behind the user's back", async () => {
    vi.mocked(api.reconcileProject).mockRejectedValue({
      code: "project_unavailable",
      message: "Project folder is unavailable: /tmp/LongClaw Fixture",
      recoverable: true,
    });
    useLongClawStore.setState({
      projects: [project],
      activeProjectId: project.id,
      lastSequence: 4,
      reconciling: true,
      loading: true,
    });

    render(<App />);

    await vi.waitFor(() => {
      expect(useLongClawStore.getState().reconciling).toBe(false);
    });
    expect(api.reconcileProject).toHaveBeenCalledTimes(1);
    expect(useLongClawStore.getState().error).toMatchObject({
      code: "project_unavailable",
    });
    // The boundary is untouched, so the staleness is still known about rather
    // than papered over by a failed recovery.
    expect(useLongClawStore.getState().lastSequence).toBe(4);
  });
});

describe("optimistic create, write feedback, and undo (V0-17)", () => {
  const project = {
    id: "project-fixture",
    name: "Fixture Project",
    rootPath: "/tmp/LongClaw Fixture",
    key: "LC",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  function created(): WriteResult {
    return {
      ticket: {
        state: "indexed",
        key: "LC-1",
        id: "019c8c7e",
        title: "Prove the round trip",
        status: "todo",
        priority: "none",
        labels: [],
        createdAt: "2026-07-31T09:00:00Z",
        updatedAt: "2026-07-31T09:00:00Z",
        checkedCount: 0,
        checklistCount: 0,
        commentCount: 0,
        attachmentCount: 0,
        contentHash: "hash-created",
        relativePath: ".longclaw/tickets/LC-1/ticket.md",
      },
      generation: 2,
      changes: [],
    };
  }

  async function openBoard() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByText("Board");
  }

  function submitNewTicket(title: string) {
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: title },
    });
    fireEvent.click(screen.getByText("Create ticket"));
  }

  it("must-pass 1: the card appears before the create write returns", async () => {
    let settle: (result: WriteResult) => void = () => {};
    vi.mocked(api.createTicket).mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    await openBoard();

    submitNewTicket("Prove the round trip");

    // The modal is gone and the card is on the board while the write is out.
    expect(screen.queryByLabelText("Create a ticket")).toBeNull();
    expect(screen.getByText("Prove the round trip")).toBeTruthy();
    expect(api.createTicket).toHaveBeenCalledTimes(1);
    await screen.findByText(/writing/);

    settle(created());

    await screen.findByText("LC-1 created");
  });

  it("must-pass 2: a failed create reverts the optimistic card and says so", async () => {
    vi.mocked(api.createTicket).mockRejectedValue({
      code: "permission_denied",
      message: "The tickets folder is read-only",
      recoverable: true,
    });
    await openBoard();

    submitNewTicket("Prove the round trip");

    expect(screen.getByText("Prove the round trip")).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("Prove the round trip")).toBeNull(),
    );
    expect(screen.getByText(/could not be created/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("undoes a create by archiving, because v0 never deletes a ticket file", async () => {
    vi.mocked(api.createTicket).mockResolvedValue(created());
    vi.mocked(api.editTicket).mockResolvedValue({
      ...created(),
      generation: 3,
    });
    await openBoard();
    submitNewTicket("Prove the round trip");
    await screen.findByText("LC-1 created");

    fireEvent.keyDown(document.body, { key: "z", metaKey: true });

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-created",
      edit: { archived: true },
    });
    // The copy is honest about what undo actually did to the file.
    expect(await screen.findByText(/LC-1 archived/)).toBeTruthy();
  });
});

describe("priority from the board (V0-08)", () => {
  const project = {
    id: "project-fixture",
    name: "Fixture Project",
    rootPath: "/tmp/LongClaw Fixture",
    key: "LC",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  const ticket = {
    state: "indexed" as const,
    key: "LC-1",
    id: "019c8c7e",
    title: "Prove the round trip",
    status: "todo" as const,
    priority: "p3" as const,
    labels: [],
    createdAt: "2026-07-31T09:00:00Z",
    updatedAt: "2026-07-31T09:00:00Z",
    checkedCount: 0,
    checklistCount: 0,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: "hash-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
  };

  function written(): WriteResult {
    return {
      ticket: { ...ticket, priority: "urgent", contentHash: "hash-2" },
      generation: 2,
      changes: [],
    };
  }

  async function openBoard() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [ticket],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByText("Board");
  }

  function pressPAndPick(option: RegExp) {
    const card = document.querySelector<HTMLElement>(
      '.ticket-row[data-ticket-key="LC-1"]',
    );
    if (!card) throw new Error("no card for LC-1");
    card.focus();
    fireEvent.keyDown(card, { key: "p" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: option }));
  }

  it("writes the picked priority and offers to take it back", async () => {
    vi.mocked(api.editTicket).mockResolvedValue(written());
    await openBoard();

    pressPAndPick(/Urgent/);

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-1",
      edit: { priority: "urgent" },
    });
    await screen.findByText("LC-1 \u2192 Urgent");

    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-2",
      edit: { priority: "p3" },
    });
    await screen.findByText("LC-1 back to P3");
  });

  it("draws the new priority before the write returns and puts it back if it fails", async () => {
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "io",
      message: "No space left on device",
      recoverable: true,
    });
    await openBoard();

    pressPAndPick(/Urgent/);

    expect(
      document.querySelector('[aria-label="Priority: Urgent"]'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        document.querySelector('[aria-label="Priority: P3"]'),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/No space left on device/)).toBeTruthy();
  });
});

describe("project creation", () => {
  it("derives a backend-valid key for digit-leading project names", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Key").value).toBe("J4");
  });

  it("does not overwrite a key the user has edited", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Key"), {
      target: { value: "AB" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Key").value).toBe("AB");
  });

  it("blocks invalid keys before the folder picker is opened", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Key"), {
      target: { value: "3J4" },
    });
    const submit = screen.getByText<HTMLButtonElement>(
      "Create project in folder",
    );
    fireEvent.click(submit);

    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText(/uppercase letters and digits, starting with a letter/i),
    ).toBeTruthy();
    expect(api.chooseAndCreateProject).not.toHaveBeenCalled();
  });

  it("creates the project the form describes", async () => {
    // The picker was cancelled: the request still has to be the one the form
    // described, which is what this asserts.
    vi.mocked(api.chooseAndCreateProject).mockResolvedValue(null);
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "My Project" },
    });
    fireEvent.click(screen.getByText("Create project in folder"));

    expect(api.chooseAndCreateProject).toHaveBeenCalledWith({
      name: "My Project",
      key: "MP",
      theme: "indigo",
    });
  });
});
