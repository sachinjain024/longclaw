// @vitest-environment jsdom

import {
  act,
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
import type { StreamEnvelope, TicketRow, WriteResult } from "./types";

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
  addProjectLabel: vi.fn(),
  updateProjectLabel: vi.fn(),
  removeProjectLabel: vi.fn(),
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
    await screen.findByRole("heading", { name: "Board" });
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
    await screen.findByRole("heading", { name: "Board" });
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

describe("label definitions in project settings (V0-10)", () => {
  const project = {
    id: "project-fixture",
    name: "Fixture Project",
    rootPath: "/tmp/LongClaw Fixture",
    key: "LC",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: { backend: { name: "Backend", color: "blue" } },
  };

  const ticket = {
    state: "indexed" as const,
    key: "LC-1",
    id: "019c8c7e",
    title: "Prove the round trip",
    status: "todo" as const,
    priority: "p3" as const,
    labels: ["backend"],
    createdAt: "2026-07-31T09:00:00Z",
    updatedAt: "2026-07-31T09:00:00Z",
    checkedCount: 0,
    checklistCount: 0,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: "hash-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
  };

  async function openSettings() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [ticket],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Board" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  }

  const chips = () =>
    Array.from(document.querySelectorAll(".ticket-row .label-chip")).map(
      (chip) => chip.textContent,
    );

  it("defines a label from the settings panel", async () => {
    vi.mocked(api.addProjectLabel).mockResolvedValue({
      ...project,
      labels: {
        ...project.labels,
        reliability: { name: "Reliability", color: "amber" },
      },
    });
    await openSettings();

    fireEvent.change(screen.getByLabelText("New label slug"), {
      target: { value: "reliability" },
    });
    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Reliability" },
    });
    fireEvent.change(screen.getByLabelText("New label color"), {
      target: { value: "amber" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    await waitFor(() => expect(api.addProjectLabel).toHaveBeenCalledTimes(1));
    expect(api.addProjectLabel).toHaveBeenCalledWith({
      projectId: project.id,
      slug: "reliability",
      name: "Reliability",
      color: "amber",
    });
    expect(
      (
        await screen.findByLabelText<HTMLInputElement>(
          "Name of label reliability",
        )
      ).value,
    ).toBe("Reliability");
  });

  it("must-pass 2: a renamed definition rewrites no ticket", async () => {
    vi.mocked(api.updateProjectLabel).mockResolvedValue({
      ...project,
      labels: { backend: { name: "Platform", color: "purple" } },
    });
    await openSettings();
    expect(chips()).toEqual(["Backend"]);

    fireEvent.change(screen.getByLabelText("Name of label backend"), {
      target: { value: "Platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save label backend" }));

    await waitFor(() =>
      expect(api.updateProjectLabel).toHaveBeenCalledTimes(1),
    );
    expect(api.updateProjectLabel).toHaveBeenCalledWith({
      projectId: project.id,
      slug: "backend",
      name: "Platform",
      color: "blue",
    });
    // The card follows the definition, and not one ticket was written.
    await waitFor(() => expect(chips()).toEqual(["Platform"]));
    expect(api.editTicket).not.toHaveBeenCalled();
  });

  it("must-pass 3: a removed definition leaves the slug on the ticket", async () => {
    vi.mocked(api.removeProjectLabel).mockResolvedValue({
      ...project,
      labels: {},
    });
    await openSettings();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove label backend" }),
    );

    await waitFor(() =>
      expect(api.removeProjectLabel).toHaveBeenCalledWith({
        projectId: project.id,
        slug: "backend",
      }),
    );
    await waitFor(() => expect(chips()).toEqual(["backend"]));
    expect(api.editTicket).not.toHaveBeenCalled();
  });

  it("surfaces a slug the format refuses rather than swallowing it", async () => {
    vi.mocked(api.addProjectLabel).mockRejectedValue({
      code: "parse_failed",
      message:
        'A label slug is lowercase letters and digits, optionally separated by - or _, starting with a letter; found "9lives"',
      recoverable: true,
    });
    await openSettings();

    fireEvent.change(screen.getByLabelText("New label slug"), {
      target: { value: "9lives" },
    });
    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Nine lives" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    expect(await screen.findByText(/found "9lives"/)).toBeTruthy();
  });
});

describe("the list and the board agree (V0-14)", () => {
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

  function ticket(
    key: string,
    overrides?: Partial<Extract<TicketRow, { state: "indexed" }>>,
  ): TicketRow {
    return {
      state: "indexed",
      key,
      id: `id-${key}`,
      title: `Ticket ${key}`,
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-07-30T09:00:00Z",
      updatedAt: "2026-07-30T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: `hash-${key}`,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      ...overrides,
    };
  }

  const SEED = [
    ticket("LC-1", { status: "todo", priority: "p2" }),
    ticket("LC-2", { status: "in_progress" }),
    ticket("LC-3", { status: "canceled" }),
  ];

  function snapshot(tickets: TicketRow[], sequence = 1) {
    return { project, tickets, generation: 1, rebuiltInMs: 1, sequence };
  }

  /** The keys each surface has on screen, in the order it drew them. */
  function shownKeys(): string[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>("[data-ticket-key]"),
    ).map((element) => element.dataset.ticketKey ?? "");
  }

  const toggleTo = (view: "Board" | "List") =>
    fireEvent.click(screen.getByRole("button", { name: view }));

  /** Renders, waits for the board, and returns the event listener Rust would use. */
  async function open(tickets: TicketRow[] = SEED) {
    let deliver: (envelope: StreamEnvelope) => void = () => {};
    vi.mocked(api.listenForProjectEvents).mockImplementation(
      async (handler) => {
        deliver = handler;
        return () => {};
      },
    );
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue(snapshot(tickets));
    render(<App />);
    await screen.findByRole("heading", { name: "Board" });
    await waitFor(() => expect(shownKeys().length).toBe(tickets.length));
    return {
      deliver: (envelope: StreamEnvelope) => act(() => deliver(envelope)),
    };
  }

  /** What both surfaces say, taken one after the other from the same state. */
  function bothSurfaces(): { board: string[]; list: string[] } {
    toggleTo("Board");
    const board = shownKeys();
    toggleTo("List");
    const list = shownKeys();
    toggleTo("Board");
    return { board, list };
  }

  it("shows the same tickets on the list as on the board", async () => {
    await open();

    const { board, list } = bothSurfaces();

    expect(new Set(list)).toEqual(new Set(board));
    expect(list).toHaveLength(3);
    // The board keeps every column of the fixed set; the list keeps only the
    // statuses that hold something. The tickets are the same either way.
    expect(list).toEqual(["LC-1", "LC-2", "LC-3"]);
  });

  it("agrees after an app edit", async () => {
    vi.mocked(api.editTicket).mockResolvedValue({
      ticket: ticket("LC-2", { status: "in_progress", priority: "urgent" }),
      generation: 2,
      changes: [],
    });
    await open();

    const card = document.querySelector<HTMLElement>(
      '.ticket-row[data-ticket-key="LC-2"]',
    );
    card?.focus();
    fireEvent.keyDown(card as HTMLElement, { key: "p" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Urgent/ }));
    await waitFor(() => expect(api.editTicket).toHaveBeenCalled());

    toggleTo("List");
    expect(
      document
        .querySelector('.list-row[data-ticket-key="LC-2"]')
        ?.querySelector('[aria-label="Priority: Urgent"]'),
    ).toBeTruthy();
    const { board, list } = bothSurfaces();
    expect(new Set(list)).toEqual(new Set(board));
  });

  it("agrees after an external edit lands from disk", async () => {
    const { deliver } = await open();

    deliver({
      contractVersion: 1,
      sequence: 2,
      projectId: project.id,
      emittedAt: "2026-07-31T10:00:00Z",
      event: {
        type: "ticketChanged",
        data: {
          source: "external",
          coalescedEvents: 1,
          detectedInMs: 1,
          attribution: {
            id: "evt-1",
            kind: "update",
            occurredAt: "2026-07-31T10:00:00Z",
            actor: { type: "agent", name: "Claude Code" },
          },
          // The agent moved it to Done, which is a column the board draws
          // empty and a group the list did not have at all.
          ticket: ticket("LC-1", {
            status: "done",
            title: "Moved by an agent",
          }),
        },
      },
    });

    const { board, list } = bothSurfaces();
    expect(new Set(list)).toEqual(new Set(board));
    toggleTo("List");
    expect(
      document.querySelector('.list-row[data-ticket-key="LC-1"]')?.textContent,
    ).toContain("Moved by an agent");
    expect(screen.getByRole("heading", { name: /Done/ }).textContent).toBe(
      "Done1",
    );
  });

  it("agrees after a rebuild", async () => {
    const { deliver } = await open();

    deliver({
      contractVersion: 1,
      sequence: 2,
      projectId: project.id,
      emittedAt: "2026-07-31T10:00:00Z",
      event: {
        type: "indexRebuilt",
        data: {
          reason: "manual",
          snapshot: snapshot(
            [...SEED, ticket("LC-4", { status: "in_review" })],
            2,
          ),
        },
      },
    });

    const { board, list } = bothSurfaces();
    expect(new Set(list)).toEqual(new Set(board));
    expect(list).toContain("LC-4");
  });

  it("agrees after a restart", async () => {
    await open();
    toggleTo("List");
    const before = shownKeys();
    cleanup();

    // A restart is a fresh mount over a fresh snapshot: the surfaces hold no
    // rows of their own, so neither can carry anything across it.
    useLongClawStore.setState({ projects: [], activeProjectId: undefined });
    await open();
    toggleTo("List");

    expect(shownKeys()).toEqual(before);
    const { board, list } = bothSurfaces();
    expect(new Set(list)).toEqual(new Set(board));
  });

  it("shows the archived tickets the board does not", async () => {
    await open([
      ...SEED,
      ticket("LC-9", { status: "done", archivedAt: "2026-07-20T09:00:00Z" }),
    ]);

    toggleTo("List");
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }));

    expect(shownKeys()).toContain("LC-9");
  });
});
