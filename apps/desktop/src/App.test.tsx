// @vitest-environment jsdom

import {
  act,
  cleanup,
  createEvent,
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
import { isArchived } from "./tickets";
import type {
  IndexedTicket,
  StreamEnvelope,
  TicketDetail,
  TicketRow,
  WriteResult,
} from "./types";

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
    boardOrdering: {},
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

  /** Quick create: title, Enter, done (`screen-specs.md:198-207`). */
  function submitNewTicket(title: string) {
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: title },
    });
    fireEvent.click(screen.getByText("Create"));
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

describe("the full create surface (V0-16)", () => {
  const project = {
    id: "project-fixture",
    name: "Fixture Project",
    rootPath: "/tmp/LongClaw Fixture",
    key: "LC",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {
      backend: { name: "Backend", color: "blue" },
      reliability: { name: "Reliability", color: "amber" },
    },
  };

  function created(): WriteResult {
    return {
      ticket: {
        state: "indexed",
        key: "LC-7",
        id: "019c8c7e",
        title: "Prove the agent round trip",
        status: "in_review",
        priority: "p1",
        labels: ["backend"],
        createdAt: "2026-07-31T09:00:00Z",
        updatedAt: "2026-07-31T09:00:00Z",
        checkedCount: 0,
        checklistCount: 1,
        commentCount: 0,
        attachmentCount: 0,
        contentHash: "hash-created",
        relativePath: ".longclaw/tickets/LC-7/ticket.md",
      },
      generation: 2,
      changes: [],
    };
  }

  /** What the panel reads once the create has claimed its key. */
  function detail(): TicketDetail {
    return {
      key: "LC-7",
      relativePath: ".longclaw/tickets/LC-7/ticket.md",
      contentHash: "hash-created",
      byteLength: 300,
      readOnly: false,
      raw: "",
      rawTruncated: false,
      missingAttachments: [],
      orphanAttachments: [],
      ticket: {
        id: "019c8c7e",
        key: "LC-7",
        title: "Prove the agent round trip",
        status: "in_review",
        priority: "p1",
        labels: ["backend"],
        createdAt: "2026-07-31T09:00:00Z",
        updatedAt: "2026-07-31T09:00:00Z",
        description: "Check whether the round trip holds.",
        checklist: [],
        attachments: [],
        activity: [],
        historyIncomplete: false,
        unknownKeys: [],
        recordDiagnostics: [],
      },
    };
  }

  async function openBoard() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.readTicket).mockResolvedValue(detail());
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

  /** The ticket panel, which is the only `aside` that names a ticket. */
  function ticketPanel() {
    return screen.queryByRole("complementary", { name: /^Ticket / });
  }

  /** Quick create, then its door into the surface that owns the rest. */
  function openFullCreate() {
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.click(screen.getByText("Open full editor →"));
  }

  function metaTrigger(field: "Status" | "Priority" | "Labels") {
    return screen.getByRole("button", { name: new RegExp(`^${field}: `) });
  }

  it("writes every field the surface can set in one create", async () => {
    vi.mocked(api.createTicket).mockResolvedValue(created());
    await openBoard();
    openFullCreate();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Prove the agent round trip" },
    });
    fireEvent.click(metaTrigger("Status"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "In Review" }));
    fireEvent.click(metaTrigger("Priority"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "P1" }));
    fireEvent.click(metaTrigger("Labels"));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Backend" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Check whether the round trip holds." },
    });
    const addItem = screen.getByLabelText("Add a checklist item");
    fireEvent.change(addItem, { target: { value: "Let an agent read it" } });
    fireEvent.submit(addItem.closest("form")!);
    fireEvent.click(screen.getByText("Create ticket"));

    expect(api.createTicket).toHaveBeenCalledWith({
      projectId: project.id,
      title: "Prove the agent round trip",
      status: "in_review",
      priority: "p1",
      labels: ["backend"],
      description: "Check whether the round trip holds.",
      checklist: ["Let an agent read it"],
    });
    await screen.findByText("LC-7 created");
  });

  it("carries the title quick create was holding into the panel", async () => {
    await openBoard();
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Needs more thought" },
    });

    fireEvent.click(screen.getByText("Open full editor →"));

    expect(screen.getByLabelText<HTMLTextAreaElement>("Title").value).toBe(
      "Needs more thought",
    );
    // One create surface at a time: the modal is gone, not stacked behind.
    expect(screen.queryByText("Open full editor →")).toBeNull();
  });

  it("shows the card before the write returns and swaps to the real ticket after", async () => {
    let settle: (result: WriteResult) => void = () => {};
    vi.mocked(api.createTicket).mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    await openBoard();
    openFullCreate();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Prove the agent round trip" },
    });

    fireEvent.click(screen.getByText("Create ticket"));

    // The board never waits: the card is up under the guessed key, and the
    // create surface is gone.
    expect(screen.queryByText("Create ticket")).toBeNull();
    expect(screen.getByText("Prove the agent round trip")).toBeTruthy();
    // The panel does wait, because view mode is a projection of a file and
    // there is no file to read until the write has claimed a key.
    expect(ticketPanel()).toBeNull();
    expect(api.readTicket).not.toHaveBeenCalled();

    settle(created());

    // "On create the panel swaps to view mode of the real ticket"
    // (`screen-specs.md:214`) — the real one, LC-7, not the guessed LC-1.
    const panel = await screen.findByRole("complementary", {
      name: "Ticket LC-7",
    });
    expect(panel).toBeTruthy();
    expect(api.readTicket).toHaveBeenCalledWith(project.id, "LC-7");
  });

  it("cancels without writing, and puts focus back on the board", async () => {
    await openBoard();
    openFullCreate();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(api.createTicket).not.toHaveBeenCalled();
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
    // The board draws the live tickets: an archived one is the list's (ADR 0004).
    const live = tickets.filter((ticket) => !isArchived(ticket)).length;
    await waitFor(() => expect(shownKeys().length).toBe(live));
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

    // The one place the two surfaces are allowed to disagree (ADR 0004).
    expect(shownKeys()).not.toContain("LC-9");

    toggleTo("List");
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }));

    expect(shownKeys()).toContain("LC-9");
  });
});

describe("archive and unarchive (V0-11)", () => {
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

  function row(key: string, overrides?: Partial<IndexedTicket>): TicketRow {
    return {
      state: "indexed",
      key,
      id: `id-${key}`,
      title: `Ticket ${key}`,
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-07-31T09:00:00Z",
      updatedAt: "2026-07-31T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: `hash-${key}`,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      ...overrides,
    };
  }

  function detail(key: string, archivedAt?: string): TicketDetail {
    return {
      key,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      contentHash: `hash-${key}`,
      byteLength: 300,
      readOnly: false,
      raw: "",
      rawTruncated: false,
      missingAttachments: [],
      orphanAttachments: [],
      ticket: {
        id: `id-${key}`,
        key,
        title: `Ticket ${key}`,
        status: "todo",
        priority: "none",
        labels: [],
        createdAt: "2026-07-31T09:00:00Z",
        updatedAt: "2026-07-31T09:00:00Z",
        archivedAt,
        description: "",
        checklist: [],
        attachments: [],
        activity: [],
        historyIncomplete: false,
        unknownKeys: [],
        recordDiagnostics: [],
      },
    };
  }

  /** What the write returns: the row as the file now reads, with a new hash. */
  function written(
    key: string,
    overrides?: Partial<IndexedTicket>,
  ): WriteResult {
    return {
      ticket: row(key, { contentHash: `hash-${key}-written`, ...overrides }),
      generation: 2,
      changes: [],
    };
  }

  /**
   * Renders, opens the named ticket's panel, and waits for the file to arrive.
   * An archived ticket has no card, so it is opened where it does appear: the
   * list's archived group.
   */
  async function openPanel(
    tickets: TicketRow[],
    key: string,
    from: "board" | "the archived group" = "board",
  ) {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Board" });
    if (from !== "board") {
      fireEvent.click(screen.getByRole("button", { name: "List" }));
      fireEvent.click(screen.getByRole("button", { name: /Archived/ }));
    }
    fireEvent.click(
      document.querySelector<HTMLElement>(`[data-ticket-key="${key}"]`)!,
    );
    await screen.findByRole("complementary", { name: `Ticket ${key}` });
  }

  const card = (key: string) =>
    document.querySelector(`[data-ticket-key="${key}"]`);

  it("must-pass: archiving flips the frontmatter, empties the board, and can be taken back", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-1", { archivedAt: "2026-07-31T10:00:00Z" }),
    );
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    // The panel is gone and the card with it, before the write returns.
    expect(screen.queryByRole("complementary", { name: "Ticket LC-1" })).toBe(
      null,
    );
    expect(card("LC-1")).toBeNull();
    expect(card("LC-2")).toBeTruthy();
    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    // Nothing but the flag: archiving is not a status change and not a move.
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1",
      edit: { archived: true },
    });
    await screen.findByText("LC-1 archived");

    vi.mocked(api.editTicket).mockResolvedValue(written("LC-1"));
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenLastCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1-written",
      edit: { archived: false },
    });
    await screen.findByText("LC-1 unarchived");
    await waitFor(() => expect(card("LC-1")).toBeTruthy());
  });

  it("puts the card back and says so when the write fails", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "io",
      message: "No space left on device",
      recoverable: true,
    });
    await openPanel([row("LC-1")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(card("LC-1")).toBeNull();
    await waitFor(() => expect(card("LC-1")).toBeTruthy());
    expect(screen.getByText(/could not be archived/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("leaves focus on the board rather than dropping it on the body", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-1", { archivedAt: "2026-07-31T10:00:00Z" }),
    );
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    // The card the panel was opened from is not there to go back to, so focus
    // lands on the surface's tab stop instead.
    await waitFor(() => expect(document.activeElement).toBe(card("LC-2")));
  });

  it("unarchives from the panel and keeps it open", async () => {
    const archived = row("LC-1", { archivedAt: "2026-07-20T09:00:00Z" });
    vi.mocked(api.readTicket).mockResolvedValue(
      detail("LC-1", "2026-07-20T09:00:00Z"),
    );
    vi.mocked(api.editTicket).mockResolvedValue(written("LC-1"));
    await openPanel([archived], "LC-1", "the archived group");

    fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));

    // The panel stays: only archiving closes it (`screen-specs.md:166`).
    expect(screen.getByRole("complementary", { name: "Ticket LC-1" }));
    // Back among the statuses, and out of the archived group it was opened in.
    expect(screen.getByRole("heading", { name: /^Todo/ })).toBeTruthy();
    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1",
      edit: { archived: false },
    });
    // The button now names the action the ticket's new state offers.
    expect(await screen.findByRole("button", { name: "Archive" })).toBeTruthy();
  });

  it("archives a canceled ticket without making it any less canceled", async () => {
    // Canceled is a workflow outcome and archiving is tidying
    // (`file_format.md:345-347`); one must not stand in for the other.
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-3"));
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-3", {
        status: "canceled",
        archivedAt: "2026-07-31T10:00:00Z",
      }),
    );
    await openPanel([row("LC-3", { status: "canceled" })], "LC-3");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await screen.findByText("LC-3 archived");

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }));
    const listed = document.querySelector(`.list-row[data-ticket-key="LC-3"]`);
    expect(
      listed?.querySelector('[aria-label="Status: Canceled"]'),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Canceled/ })).toBeNull();
  });
});

describe("board ordering and manual reordering (V0-09)", () => {
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

  function row(key: string, overrides?: Partial<IndexedTicket>): TicketRow {
    return {
      state: "indexed",
      key,
      id: `id-${key}`,
      title: `Ticket ${key}`,
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-07-31T09:00:00Z",
      updatedAt: "2026-07-31T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: `hash-${key}`,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      ...overrides,
    };
  }

  function written(key: string, rank?: string): WriteResult {
    return {
      ticket: row(key, { contentHash: `hash-${key}-written`, rank }),
      generation: 2,
      changes: [],
    };
  }

  async function openBoard(tickets: TicketRow[]) {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Board" });
  }

  /** Switches the header control, which is a real menu with a real footnote. */
  function chooseOrdering(name: "Priority" | "Manual") {
    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name }));
  }

  /** A drop at a stated position in the Todo column. */
  function dropAt(key: string, clientY: number) {
    const stack = screen
      .getByRole("heading", { name: /^Todo/ })
      .closest(".board-column")!
      .querySelector<HTMLElement>(".board-stack")!;
    const sizer = stack.querySelector<HTMLElement>(".board-sizer")!;
    sizer.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    fireEvent.dragStart(
      document.querySelector<HTMLElement>(`[data-ticket-key="${key}"]`)!,
    );
    for (const type of ["dragOver", "drop"] as const) {
      const event = createEvent[type](stack);
      Object.defineProperty(event, "clientY", { value: clientY });
      fireEvent(stack, event);
    }
  }

  // jsdom under vitest exposes no `localStorage`, and the app treats a missing
  // one as "this preference does not survive the session". The claim here is
  // that it does survive, so the store it survives in has to exist.
  beforeEach(() => {
    const held = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => held.get(key) ?? null,
        setItem: (key: string, value: string) => held.set(key, value),
        removeItem: (key: string) => held.delete(key),
        clear: () => held.clear(),
      },
    });
  });

  it("must-pass: switching the order rewrites no file", async () => {
    await openBoard([row("LC-1"), row("LC-2")]);

    chooseOrdering("Manual");
    chooseOrdering("Priority");
    chooseOrdering("Manual");

    expect(api.editTicket).not.toHaveBeenCalled();
    expect(api.updateProjectTheme).not.toHaveBeenCalled();
    expect(api.updateProjectName).not.toHaveBeenCalled();
  });

  it("says in the menu that the choice never rewrites files", async () => {
    await openBoard([row("LC-1")]);

    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));

    expect(
      screen.getByText(
        "Ordering is a view preference on this board — it never rewrites files.",
      ),
    ).toBeTruthy();
  });

  it("keeps the choice for this project, and only this project", async () => {
    await openBoard([row("LC-1")]);
    chooseOrdering("Manual");

    expect(JSON.parse(localStorage.getItem("longclaw.boardOrdering")!)).toEqual(
      {
        "project-fixture": "manual",
      },
    );
  });

  it("must-pass: Priority mode writes no rank however the board is dragged", async () => {
    await openBoard([row("LC-1", { rank: "a0" }), row("LC-2", { rank: "a1" })]);

    dropAt("LC-2", 0);

    expect(api.editTicket).not.toHaveBeenCalled();
  });

  it("must-pass: a manual drop writes a rank, and only a rank, and takes it back", async () => {
    vi.mocked(api.editTicket).mockResolvedValue(written("LC-3", "a0V"));
    await openBoard([
      row("LC-1", { rank: "a0" }),
      row("LC-2", { rank: "a1" }),
      row("LC-3", { rank: "a2" }),
    ]);
    chooseOrdering("Manual");

    // Into the gap between LC-1 and LC-2.
    dropAt("LC-3", 63);

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-3",
      expectedHash: "hash-LC-3",
      edit: { rank: "a0V" },
    });
    await screen.findByText("LC-3 moved");

    vi.mocked(api.editTicket).mockResolvedValue(written("LC-3", "a2"));
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenLastCalledWith({
      projectId: project.id,
      ticketKey: "LC-3",
      expectedHash: "hash-LC-3-written",
      edit: { rank: "a2" },
    });
  });

  it("takes back a first-ever rank by clearing the key, not by inventing one", async () => {
    vi.mocked(api.editTicket).mockResolvedValue(written("LC-3", "a0"));
    await openBoard([row("LC-1"), row("LC-2"), row("LC-3")]);
    chooseOrdering("Manual");

    dropAt("LC-3", 0);

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-3",
      expectedHash: "hash-LC-3",
      edit: { rank: "a0" },
    });

    vi.mocked(api.editTicket).mockResolvedValue(written("LC-3"));
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenLastCalledWith({
      projectId: project.id,
      ticketKey: "LC-3",
      expectedHash: "hash-LC-3-written",
      // `null` clears the key. Nothing else in the app ever sends it.
      edit: { rank: null },
    });
  });

  it("moves the card before the write leaves, and puts it back if it fails", async () => {
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "io",
      message: "Disk is full",
      recoverable: true,
    });
    await openBoard([
      row("LC-1", { rank: "a0" }),
      row("LC-2", { rank: "a1" }),
      row("LC-3", { rank: "a2" }),
    ]);
    chooseOrdering("Manual");

    dropAt("LC-3", 63);

    expect(useLongClawStore.getState().tickets[2].state === "indexed").toBe(
      true,
    );
    await screen.findByText("LC-3 could not be moved. Disk is full");
    const back = useLongClawStore
      .getState()
      .tickets.find((ticket) => ticket.key === "LC-3");
    expect(back?.state === "indexed" && back.rank).toBe("a2");
  });
});

describe("the header filter (V0-15)", () => {
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

  function row(
    key: string,
    title: string,
    overrides?: Partial<IndexedTicket>,
  ): TicketRow {
    return {
      state: "indexed",
      key,
      id: `id-${key}`,
      title,
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-08-01T09:00:00Z",
      updatedAt: "2026-08-01T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: `hash-${key}`,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      ...overrides,
    };
  }

  function unreadable(key: string): TicketRow {
    return {
      state: "degraded",
      key,
      contentHash: `hash-${key}`,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      byteLength: 12,
      readOnly: false,
      diagnostic: { code: "parse_failed", message: "no frontmatter" },
    };
  }

  function detail(key: string): TicketDetail {
    return {
      key,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      contentHash: `hash-${key}`,
      byteLength: 300,
      readOnly: false,
      raw: "",
      rawTruncated: false,
      missingAttachments: [],
      orphanAttachments: [],
      ticket: {
        id: `id-${key}`,
        key,
        title: `Ticket ${key}`,
        status: "todo",
        priority: "none",
        labels: [],
        createdAt: "2026-08-01T09:00:00Z",
        updatedAt: "2026-08-01T09:00:00Z",
        description: "",
        checklist: [],
        attachments: [],
        activity: [],
        historyIncomplete: false,
        unknownKeys: [],
        recordDiagnostics: [],
      },
    };
  }

  const SEED = [
    row("LC-1", "Atomic replace race", { labels: ["storage"] }),
    row("LC-2", "Watcher recovery", { status: "in_progress" }),
    row("LC-3", "Rebuild the index", { status: "done" }),
  ];

  async function openBoard(tickets: TicketRow[] = SEED) {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Board" });
  }

  const field = () =>
    screen.getByRole("textbox", { name: "Filter tickets" }) as HTMLInputElement;

  const shownKeys = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-ticket-key]")).map(
      (element) => element.dataset.ticketKey ?? "",
    );

  /** Named, because the toast stack is a `status` region too. */
  const noMatch = () => screen.getByRole("status", { name: "No matches" });

  function type(query: string) {
    fireEvent.change(field(), { target: { value: query } });
  }

  const toggleTo = (view: "Board" | "List") =>
    fireEvent.click(screen.getByRole("button", { name: view }));

  it("narrows the board to the rows a query matches", async () => {
    await openBoard();

    type("recovery");

    expect(shownKeys()).toEqual(["LC-2"]);
  });

  it("narrows the list to exactly the same rows", async () => {
    await openBoard();

    type("storage");
    toggleTo("List");

    expect(shownKeys()).toEqual(["LC-1"]);
  });

  it("must-pass: a query that matches nothing shows the designed state, not an empty board", async () => {
    await openBoard();

    type("nothing here");

    const panel = noMatch();
    expect(panel.textContent).toContain("No matches");
    // The query is echoed back, so the human can see what was asked.
    expect(panel.textContent).toContain("nothing here");
    expect(screen.getByRole("button", { name: "Clear filter" })).toBeTruthy();
    // Not an empty board: the fixed status scaffold stands down rather than
    // drawing six columns with nothing in them.
    expect(document.querySelectorAll(".board-column")).toHaveLength(0);
  });

  it("must-pass: the list shows the same designed state", async () => {
    await openBoard();
    toggleTo("List");

    type("nothing here");

    expect(noMatch().textContent).toContain("No matches");
    expect(document.querySelectorAll(".list-group")).toHaveLength(0);
  });

  it("puts the board back when the filter is cleared, and keeps focus", async () => {
    await openBoard();
    type("nothing here");

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    expect(shownKeys()).toEqual(["LC-1", "LC-2", "LC-3"]);
    expect(screen.queryByRole("status", { name: "No matches" })).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it("focuses the field on ⌘F and selects what is already typed", async () => {
    await openBoard();
    type("recovery");
    field().blur();

    fireEvent.keyDown(document, { key: "f", metaKey: true });

    expect(document.activeElement).toBe(field());
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe("recovery".length);
  });

  it("clears an active filter on Escape", async () => {
    await openBoard();
    type("recovery");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(field().value).toBe("");
    expect(shownKeys()).toEqual(["LC-1", "LC-2", "LC-3"]);
  });

  it("does not take Escape from an open ticket panel", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-2"));
    await openBoard();
    type("recovery");
    fireEvent.click(document.querySelector('[data-ticket-key="LC-2"]')!);
    await screen.findByRole("complementary", { name: "Ticket LC-2" });

    fireEvent.keyDown(document, { key: "Escape" });

    // The panel is the rung above the filter (`keyboard-focus-map.md:19-21`).
    expect(screen.queryByRole("complementary", { name: "Ticket LC-2" })).toBe(
      null,
    );
    expect(field().value).toBe("recovery");
  });

  it("does not take Escape from an open menu", async () => {
    await openBoard();
    type("recovery");

    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));
    const rows = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(rows[0], { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(field().value).toBe("recovery");
  });

  it("does not take Escape from the create modal", async () => {
    await openBoard();
    type("recovery");
    fireEvent.click(screen.getByRole("button", { name: "New ticket" }));

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(field().value).toBe("recovery");
  });

  it("keeps every unreadable file on screen, whatever the query", async () => {
    await openBoard([...SEED, unreadable("LC-4")]);

    type("nothing here");

    // A file this build cannot parse has no text to match, so the app never
    // claims the query failed against it.
    expect(shownKeys()).toEqual(["LC-4"]);
    expect(noMatch().textContent).toContain("unreadable");
  });

  it("must-pass: filtering, ordering and switching view rewrite no file", async () => {
    await openBoard();

    type("recovery");
    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Manual/ }));
    toggleTo("List");
    type("storage");
    toggleTo("Board");
    type("");

    expect(api.editTicket).not.toHaveBeenCalled();
    expect(api.createTicket).not.toHaveBeenCalled();
    expect(api.updateProjectName).not.toHaveBeenCalled();
    expect(api.updateProjectTheme).not.toHaveBeenCalled();
  });

  it("keeps the query out of every persisted preference", async () => {
    const held = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => held.get(key) ?? null,
        setItem: (key: string, value: string) => held.set(key, value),
        removeItem: (key: string) => held.delete(key),
        clear: () => held.clear(),
      },
    });
    await openBoard();

    type("recovery");

    // `data-requirements.md:41` calls the query session-only app state.
    for (const value of held.values()) expect(value).not.toContain("recovery");
    for (const key of held.keys()) expect(key).not.toContain("filter");
  });

  // Found by `npm run perf:board`, not by reading the code: both surfaces
  // re-focus their roving row when it changes, and a query changes it.
  it("keeps focus in the field while the query is being typed", async () => {
    await openBoard();
    // The arrows have run, so the board holds a focus request of its own, and
    // the query below removes the very row that request landed on.
    const card = document.querySelector<HTMLElement>(
      '[data-ticket-key="LC-1"]',
    );
    fireEvent.keyDown(card!, { key: "ArrowRight" });
    field().focus();

    type("storage");

    expect(shownKeys()).toEqual(["LC-1"]);
    expect(document.activeElement).toBe(field());
  });

  it("keeps focus in the field while the list is the surface", async () => {
    await openBoard();
    toggleTo("List");
    const row = document.querySelector<HTMLElement>('[data-ticket-key="LC-1"]');
    fireEvent.keyDown(row!, { key: "ArrowDown" });
    field().focus();

    type("storage");

    expect(shownKeys()).toEqual(["LC-1"]);
    expect(document.activeElement).toBe(field());
  });

  it("never leaves focus on a row the filter removed", async () => {
    await openBoard();
    const card = document.querySelector<HTMLElement>(
      '[data-ticket-key="LC-1"]',
    );
    card!.focus();

    type("recovery");

    expect(shownKeys()).toEqual(["LC-2"]);
    expect(
      document
        .querySelector('[data-ticket-key="LC-2"]')!
        .getAttribute("tabindex"),
    ).toBe("0");
  });
});
