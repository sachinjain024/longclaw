// @vitest-environment jsdom

import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as api from "./api";
import { CARD_STRIDE } from "./boardGeometry";
import {
  resetDevicePreferences,
  restoreDevicePreferences,
} from "./devicePreferences";
import { resetMutations, useMutationStore } from "./mutations";
import { useLongClawStore } from "./state";
import { isArchived } from "./tickets";
import type {
  IndexedTicket,
  ProjectReference,
  StreamEnvelope,
  TicketDetail,
  TicketRow,
  WriteResult,
} from "./types";

vi.mock("./api", () => ({
  chooseAndCreateProject: vi.fn(),
  chooseAndRelocateProject: vi.fn(),
  chooseOpenFolder: vi.fn(),
  chooseProjectFolder: vi.fn(),
  createProjectInFolder: vi.fn(),
  createTicket: vi.fn(),
  editTicket: vi.fn(),
  folderHoldsProject: vi.fn(),
  homeDir: vi.fn(),
  listProjects: vi.fn(),
  listenForProjectEvents: vi.fn(),
  openProject: vi.fn(),
  readPreferences: vi.fn(),
  readTicket: vi.fn(),
  rebuildIndex: vi.fn(),
  reconcileProject: vi.fn(),
  registerProject: vi.fn(),
  removeProject: vi.fn(),
  reportVisibleUi: vi.fn(),
  searchTickets: vi.fn(),
  setProjectStarred: vi.fn(),
  updateProjectName: vi.fn(),
  updateProjectTheme: vi.fn(),
  writePreferences: vi.fn(),
  addProjectLabel: vi.fn(),
  updateProjectLabel: vi.fn(),
  removeProjectLabel: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // `testSetup.ts` hands every test a fresh store, so nothing needs clearing
  // here and nothing needs putting back.
});

/**
 * The preferences file, as far as this suite is concerned (LC-150). Device
 * preferences are a document Rust keeps rather than a storage key, so the
 * fixture is a fake backend that holds one — and a relaunch is `relaunch()`
 * below, which forgets what this process holds and reads the document again,
 * exactly as `src/main.tsx` does before its first render.
 */
let devicePreferences: Record<string, unknown> = {};

async function relaunch() {
  resetDevicePreferences();
  await restoreDevicePreferences();
}

beforeEach(() => {
  resetMutations();
  devicePreferences = {};
  resetDevicePreferences();
  vi.mocked(api.readPreferences).mockImplementation(async () => ({
    ...devicePreferences,
  }));
  vi.mocked(api.writePreferences).mockImplementation(async (document) => {
    devicePreferences = document;
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  });
  vi.mocked(api.listProjects).mockResolvedValue([]);
  vi.mocked(api.listenForProjectEvents).mockResolvedValue(() => {});
  vi.mocked(api.homeDir).mockResolvedValue("/home/user");
  // Every picked folder is a plain one unless a test says otherwise: that is the
  // answer that leads to the create form, which is where most of these are
  // going (LC-170).
  vi.mocked(api.folderHoldsProject).mockResolvedValue(false);
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

  /**
   * V0-29. The banner's heading was `error.code.replaceAll("_", " ")`, so an
   * ordinary read-only folder announced itself as *permission denied* over a
   * sentence Rust had written for a log.
   */
  it("names the file and the recovery rather than the error code", async () => {
    vi.mocked(api.reconcileProject).mockRejectedValue({
      code: "permission_denied",
      message:
        "Saving ticket failed for ticket.md. The file or the folder it is in is read-only.",
      recoverable: true,
      context: {
        path: "/tmp/LongClaw Fixture/.longclaw/tickets/LC-1/ticket.md",
        fileName: "ticket.md",
        cause: "readOnly",
      },
    });
    useLongClawStore.setState({
      projects: [project],
      activeProjectId: project.id,
      lastSequence: 4,
      reconciling: true,
      loading: true,
    });

    render(<App />);

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("That file could not be written");
    expect(banner.textContent).toContain(
      "/tmp/LongClaw Fixture/.longclaw/tickets/LC-1/ticket.md",
    );
    expect(banner.textContent).toContain("Give yourself write access");
    expect(banner.textContent).toContain("The file was left as it was.");
    expect(banner.textContent).not.toContain("permission denied");
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
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  /** Quick create: title, Enter, done (`screen-specs.md:253-262`). */
  function submitNewTicket(title: string, priority?: string) {
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: title },
    });
    if (priority) {
      fireEvent.click(screen.getByRole("button", { name: /^Priority: / }));
      fireEvent.click(screen.getByRole("menuitemradio", { name: priority }));
    }
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

  /**
   * LC-186. Quick create asked for a status and nothing else, so an urgent
   * ticket was filed at `none` and then edited — two writes for a fact the
   * person filing it already had. The claim is the whole path, not the modal's
   * own state: the priority chosen in the modal is in the request Rust is
   * handed, and it is on the optimistic card before that request comes back.
   */
  it("sends the priority chosen in quick create, and shows it before the write returns", async () => {
    vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
    await openBoard();

    submitNewTicket("Prove the round trip", "Urgent");

    expect(api.createTicket).toHaveBeenCalledWith({
      projectId: project.id,
      title: "Prove the round trip",
      // Empty rather than omitted, for the reason `none` is sent rather than
      // omitted: one create request shape rather than two (LC-201).
      description: "",
      status: "todo",
      priority: "urgent",
      labels: [],
    });
    // The card is the reason this matters: a create that dropped the priority
    // on the way would look right in the modal and wrong on the board.
    expect(screen.getByRole("img", { name: "Priority: Urgent" })).toBeTruthy();
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

  /**
   * Found by the Step 17 accessibility audit (plan 41, A1): `C` did nothing on a
   * board that had just finished loading.
   *
   * The global handler is one effect, and `project` was read from its closure
   * without being one of its dependencies — so the listener installed on mount,
   * when no project had loaded yet, stayed installed with `project === undefined`
   * and the `C` branch could never fire. Anything that *did* change a declared
   * dependency (opening the palette, typing in the filter, opening a ticket)
   * renewed the closure and quietly fixed it, which is why every existing test
   * missed it: they all reach quick create through the New ticket button.
   *
   * This is the keyboard-only path to creating a ticket
   * (`keyboard-focus-map.md:32`), so it fails the release blocker
   * `release-candidate.md` § Known issues defines by name.
   */
  it("opens quick create on `C` as soon as the board is on screen", async () => {
    await openBoard();

    fireEvent.keyDown(document.body, { key: "c" });

    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();
  });

  /**
   * Also found by the Step 17 accessibility audit (A1), at 600 tickets, and
   * reproduced here at the smallest size a column windows at.
   *
   * `focusCard` was a bare `document.querySelector(…).focus()`, and a column
   * renders only the cards the scroll position touches (plan 07). So a new
   * ticket that lands past the window is not in the DOM when the focus call goes
   * looking for it, and focus falls to `<body>` — which the focus map's rule 3
   * forbids outright, and which leaves a keyboard user with no way back to the
   * board but Tab from the top of the document.
   *
   * The same call is how the ticket panel returns focus to its card, so this
   * covers `keyboard-focus-map.md:161` at size as well as :123.
   */
  it("focuses the new card even when it lands outside the rendered window", async () => {
    const crowd: TicketRow[] = Array.from({ length: 30 }, (_, index) => ({
      ...(created().ticket as IndexedTicket),
      key: `LC-${index + 1}`,
      id: `crowd-${index + 1}`,
      title: `Existing ticket ${index + 1}`,
    }));
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: crowd,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    // Numeric collation puts LC-31 last in the column, which is past the window.
    vi.mocked(api.createTicket).mockResolvedValue({
      ...created(),
      ticket: {
        ...(created().ticket as IndexedTicket),
        key: "LC-31",
        title: "The thirty-first",
      },
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    expect(document.querySelector('[data-ticket-key="LC-30"]')).toBeNull();

    submitNewTicket("The thirty-first");
    await screen.findByText("LC-31 created");

    await waitFor(() =>
      expect(
        (document.activeElement as HTMLElement | null)?.dataset.ticketKey,
      ).toBe("LC-31"),
    );
  });

  /**
   * LC-201's Create more loop, at the seam that owns the surface.
   *
   * The modal's own half — what clears and what is kept — is covered in
   * `QuickCreate.test.tsx`. What only this seam can say is that the *app* stops
   * doing the two things it does on every other create: taking the surface off
   * the screen, and moving focus to the new card.
   */
  describe("the Create more loop (LC-201)", () => {
    function titleField() {
      return screen.getByLabelText("Title") as HTMLInputElement;
    }

    /** Scoped to the modal: the shell has a `Create project` too. */
    function createButton() {
      return within(screen.getByLabelText("Create a ticket")).getByRole(
        "button",
        { name: /^Create/ },
      );
    }

    /** Opens quick create and ticks the box, which is off on every open. */
    function openRun() {
      fireEvent.click(screen.getAllByText("New ticket")[0]);
      fireEvent.click(screen.getByRole("checkbox", { name: "Create more" }));
    }

    function type(title: string) {
      fireEvent.change(titleField(), { target: { value: title } });
      fireEvent.click(createButton());
    }

    it("files two tickets from one open modal, and keeps it open", async () => {
      vi.mocked(api.createTicket).mockResolvedValue(created());
      await openBoard();

      openRun();
      type("First of the run");
      type("Second of the run");

      // Two writes, two optimistic cards, and the surface still standing.
      expect(api.createTicket).toHaveBeenCalledTimes(2);
      expect(screen.getByText("First of the run")).toBeTruthy();
      expect(screen.getByText("Second of the run")).toBeTruthy();
      expect(screen.getByLabelText("Create a ticket")).toBeTruthy();
    });

    it("advances the key it guesses, so the run does not file under one key", async () => {
      vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
      await openBoard();

      openRun();
      expect(screen.getByText("Fixture Project · LC-1")).toBeTruthy();
      type("First of the run");

      // Read off the rows on screen, which now include the card the first
      // create raised. Still a guess; Rust allocates the real one.
      expect(screen.getByText("Fixture Project · LC-2")).toBeTruthy();
    });

    it("leaves the caret in the title rather than moving it to the new card", async () => {
      vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
      await openBoard();

      openRun();
      type("First of the run");

      expect(document.activeElement).toBe(titleField());
    });

    /**
     * The defect this feature would have shipped with.
     *
     * `writeNewTicket` moves focus to the card twice — once optimistically and
     * once in `onWritten`, when the disk write returns. During a run that
     * second one lands *while the next title is being typed*, and a create that
     * stole the caret mid-word would read as dropped keystrokes rather than as
     * a focus bug. It will not reproduce on a fast disk with a small project
     * unless a test holds the write open, which is what this does.
     */
    it("does not steal the caret when the write returns mid-word", async () => {
      let settle: (result: WriteResult) => void = () => {};
      vi.mocked(api.createTicket).mockReturnValue(
        new Promise<WriteResult>((resolve) => {
          settle = resolve;
        }),
      );
      await openBoard();

      openRun();
      type("First of the run");
      // The human is already typing the next one when the disk answers.
      fireEvent.change(titleField(), { target: { value: "Second of the r" } });
      settle(created());
      await screen.findByText("LC-1 created");

      expect(document.activeElement).toBe(titleField());
      expect(titleField().value).toBe("Second of the r");
    });

    /**
     * LC-220. The run's own Undo, which the toast has always offered and the
     * key could never reach.
     *
     * The loop ends by clearing the title and focusing it again, and `⌘Z` stood
     * down for any focused field on the grounds that the field's own undo owns
     * it — so during a run the offer was on screen and dead, which is worse
     * than not offering it. The box the caret is in has nothing to take back
     * here: the app emptied it, not the human.
     */
    it("undoes the create the run just filed, with the caret still in the title", async () => {
      vi.mocked(api.createTicket).mockResolvedValue(created());
      vi.mocked(api.editTicket).mockResolvedValue({
        ...created(),
        generation: 3,
      });
      await openBoard();

      openRun();
      // A real keystroke, because what the guard reads is the `input` event.
      fireEvent.input(titleField(), { target: { value: "First of the run" } });
      fireEvent.click(createButton());
      await screen.findByText("LC-1 created");
      expect(document.activeElement).toBe(titleField());

      fireEvent.keyDown(titleField(), { key: "z", metaKey: true });

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
      expect(api.editTicket).toHaveBeenCalledWith({
        projectId: project.id,
        ticketKey: "LC-1",
        expectedHash: "hash-created",
        edit: { archived: true },
      });
    });

    it("leaves ⌘Z to the title the human is part-way through typing", async () => {
      vi.mocked(api.createTicket).mockResolvedValue(created());
      await openBoard();

      openRun();
      fireEvent.input(titleField(), { target: { value: "First of the run" } });
      fireEvent.click(createButton());
      await screen.findByText("LC-1 created");
      // The next title, typed while the first one's toast is still up. Now the
      // field does have an edit of its own, and it keeps the key.
      fireEvent.input(titleField(), { target: { value: "Second of the r" } });

      fireEvent.keyDown(titleField(), { key: "z", metaKey: true });

      expect(api.editTicket).not.toHaveBeenCalled();
    });

    it("closes on the create whose box is not ticked, as it always has", async () => {
      vi.mocked(api.createTicket).mockResolvedValue(created());
      await openBoard();

      openRun();
      type("First of the run");
      fireEvent.click(screen.getByRole("checkbox", { name: "Create more" }));
      type("Last of the run");

      expect(screen.queryByLabelText("Create a ticket")).toBeNull();
    });

    it("hands the description and labels through the door to full create", async () => {
      await openBoard();

      fireEvent.click(screen.getAllByText("New ticket")[0]);
      fireEvent.change(titleField(), {
        target: { value: "Needs a checklist" },
      });
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Which lives over there." },
      });
      fireEvent.click(screen.getByText("Open full editor →"));

      // The door is what makes the narrow surface honest, so it may not be the
      // place two of the five fields quietly go missing.
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
        "Needs a checklist",
      );
      expect(
        (screen.getByLabelText("Description") as HTMLTextAreaElement).value,
      ).toBe("Which lives over there.");
    });

    it("sends the description and labels the run is carrying", async () => {
      vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
      await openBoard();

      openRun();
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Agents read this before they start." },
      });
      type("First of the run");

      // The whole path, not the modal's own state: what the modal held is what
      // Rust is handed, and `createMore` is not part of it.
      expect(api.createTicket).toHaveBeenCalledWith({
        projectId: project.id,
        title: "First of the run",
        description: "Agents read this before they start.",
        status: "todo",
        priority: "none",
        labels: [],
      });
    });
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
    await screen.findByRole("button", { name: "Board", pressed: true });
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
    // (`screen-specs.md:270-271`) — the real one, LC-7, not the guessed LC-1.
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
    await screen.findByRole("button", { name: "Board", pressed: true });
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

describe("the project path chip (LC-68)", () => {
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

  async function openBoard(override?: Partial<typeof project>) {
    const p = { ...project, ...override };
    vi.mocked(api.listProjects).mockResolvedValue([p]);
    vi.mocked(api.openProject).mockResolvedValue({
      project: p,
      tickets: [ticket],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    return p;
  }

  beforeEach(() => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("renders the path as a chip with the full path as the title", async () => {
    await openBoard();

    const chip = screen.getByRole("button", { name: /Copy path/ });
    expect(chip).toBeTruthy();
    expect(chip.getAttribute("title")).toBe(project.rootPath);
  });

  it("abbreviates only the actual home directory and keeps the full path for copy", async () => {
    const home = "/Users/sachin";
    vi.mocked(api.homeDir).mockResolvedValue(home);
    const p = await openBoard({ rootPath: `${home}/dev/longclaw` });

    const chip = screen.getByRole("button", {
      name: `Copy path — ${p.rootPath}`,
    });
    // Display text is tilde-abbreviated; title and clipboard keep the full path.
    expect(chip.textContent).toContain("~/dev/longclaw");
    expect(chip.textContent).not.toContain(home);
    expect(chip.getAttribute("title")).toBe(p.rootPath);

    fireEvent.click(chip);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(p.rootPath);
    await screen.findByText("Path copied");
  });

  it("does not abbreviate a path outside the actual home directory", async () => {
    vi.mocked(api.homeDir).mockResolvedValue("/Users/sachin");
    const p = await openBoard({ rootPath: "/Users/other/shared" });

    const chip = screen.getByRole("button", {
      name: `Copy path — ${p.rootPath}`,
    });
    expect(chip.textContent).toContain("/Users/other/shared");
    expect(chip.textContent).not.toContain("~");
  });

  it("copies the path to the clipboard and raises a toast on click", async () => {
    await openBoard();

    fireEvent.click(screen.getByRole("button", { name: /Copy path/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      project.rootPath,
    );
    await screen.findByText("Path copied");
  });
});

describe("the project settings gear (LC-70)", () => {
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

  // Named for what it asserts. It used to claim it "keeps starring in the
  // sidebar" and then never look at the sidebar (LC-158): the star's half of
  // LC-70 is that the row affordance already existed and was left alone, which
  // is covered where that row is — § the side panel against its spec.
  it("drops the header Star button and opens settings from a header gear", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });

    // Scoped by class, not `getByRole("banner")`: this `<header>` sits inside
    // `.main-panel`, so HTML-AAM maps it to `generic`, and only jsdom's
    // unconditional `header: "banner"` would make that query pass.
    const header = document.querySelector<HTMLElement>(".content-header")!;
    const settings = within(header).getByRole("button", {
      name: "Project settings",
    });
    expect(
      within(header).queryByRole("button", { name: /^Star(?:red)?$/ }),
    ).toBeNull();
    // What it opens is a menu since LC-208, so the expanded state is back: a
    // menu *is* a region that stays under its trigger, which is the thing
    // LC-125 removed `aria-expanded` for when the gear opened a dialog.
    expect(settings.getAttribute("aria-haspopup")).toBe("menu");
    expect(settings.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(settings);

    expect(settings.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: "Project settings" })).toBeTruthy();
    // The menu stands in front of the panel; nothing opens until a row is
    // picked.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: /All settings/ }));

    expect(
      screen.getByRole("region", { name: "Project settings" }),
    ).toBeTruthy();
  });

  /**
   * The gear's menu is a rung of the `Esc` ladder, so the global single-key
   * and chord shortcuts stand down under it (`keyboard-focus-map.md:19-21`).
   *
   * A menu row is a `<button>`, which is not a text input, so
   * `singleKeyShortcutAllowed` says yes to `C` — the same hole the adjacent
   * comment in `App.tsx` describes for palette rows and create-surface
   * buttons. Without the menu in the guard, `C` opened quick create
   * *underneath* the open menu.
   */
  it("stands the global shortcuts down while the gear's menu is open", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    const menu = screen.getByRole("menu", { name: "Project settings" });

    fireEvent.keyDown(document, { key: "c" });
    expect(screen.queryByRole("dialog", { name: /Create/i })).toBeNull();
    expect(document.querySelector(".quick-create-modal")).toBeNull();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.querySelector(".command-palette")).toBeNull();

    // The menu is still the thing on screen, and still the thing `Esc` takes.
    expect(menu).toBeTruthy();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  /** The board, with the gear on it and nothing else up. */
  async function boardWithGear() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  it("opens settings on `⌘,` from the board, and does not toggle", async () => {
    await boardWithGear();

    fireEvent.keyDown(document, { key: ",", metaKey: true });
    const panel = screen.getByRole("region", { name: "Project settings" });
    expect(within(panel).getByRole("tab", { name: "General" })).toBeTruthy();

    // Pressing it again is a no-op: the panel's way out is `Esc`, and a chord
    // that also closed would fight the section the human just picked.
    fireEvent.keyDown(document, { key: ",", metaKey: true });
    expect(
      screen.getByRole("region", { name: "Project settings" }),
    ).toBeTruthy();
  });

  /**
   * `⌘,` said "from anywhere", and the palette is the one place that cannot be.
   *
   * `CommandPalette` stops `⌘K`, `Tab` and `Esc` and lets everything else
   * through, so this handler still saw the press underneath it. `.settings-panel`
   * and `.modal-scrim` are both `--lc-z-modal` and the palette renders later in
   * `App`, so the panel opened *behind* the surface holding focus — a layer
   * nobody could see, reach, or `Esc` past in one press.
   */
  it("leaves `⌘,` alone while the palette is up", async () => {
    await boardWithGear();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.querySelector(".command-palette")).toBeTruthy();

    fireEvent.keyDown(document, { key: ",", metaKey: true });

    expect(
      screen.queryByRole("region", { name: "Project settings" }),
    ).toBeNull();
    // The palette is still the layer, and still the only one.
    expect(document.querySelector(".command-palette")).toBeTruthy();
  });

  it("leaves `⌘,` alone while quick create is up", async () => {
    await boardWithGear();

    fireEvent.keyDown(document, { key: "c" });
    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();

    fireEvent.keyDown(document, { key: ",", metaKey: true });

    expect(
      screen.queryByRole("region", { name: "Project settings" }),
    ).toBeNull();
    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();
  });
});

describe("project settings as a modal (LC-125 … LC-132)", () => {
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

  const ticket: TicketRow = {
    state: "indexed",
    key: "LC-1",
    id: "019c8c7e",
    title: "Prove the round trip",
    status: "todo",
    priority: "p3",
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

  /**
   * The real path since LC-208: the gear opens a menu, `All settings…` opens
   * the panel, and the nav chooses the pane. Tests name the section they are
   * about, because the panel shows exactly one of them at a time.
   */
  async function openSettings(
    tickets: TicketRow[] = [ticket],
    section = "General",
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
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /All settings/ }));
    const dialog = screen.getByRole("region", { name: "Project settings" });
    if (section !== "General")
      fireEvent.click(within(dialog).getByRole("tab", { name: section }));
    return dialog;
  }

  const confirmDialog = () =>
    screen.queryByRole("dialog", { name: /from LongClaw\?$/ });

  it("D-40: sits beside the board, which stays where it was", async () => {
    await openSettings();

    // The scrim is gone (LC-223): the panel is the shell's third grid column,
    // so the board compresses beside it and stays live instead of being
    // covered by a click-away sheet.
    expect(document.querySelector(".modal-scrim.settings-scrim")).toBeNull();
    // The inline section this replaces lived in the main panel and pushed
    // everything below it down the page.
    expect(document.querySelector(".main-panel .settings-panel")).toBeNull();
    expect(document.querySelector("[data-ticket-key]")).toBeTruthy();
  });

  it("closes the ticket panel when it opens — one record on the right edge", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [ticket],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.click(document.querySelector("[data-ticket-key]")!);
    expect(document.querySelector(".ticket-panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /All settings/ }));
    screen.getByRole("region", { name: "Project settings" });
    expect(document.querySelector(".ticket-panel")).toBeNull();
  });

  it("D-4K: says where every setting is written", async () => {
    const dialog = await openSettings();

    expect(
      within(dialog).getByRole("heading", { name: "Project settings" }),
    ).toBeTruthy();
    expect(dialog.textContent).toContain("longclaw.yaml");
  });

  it("D-41: shows the key, locked, with the reason beside it", async () => {
    const dialog = await openSettings();

    const key = within(dialog).getByLabelText<HTMLInputElement>("Key");
    expect(key.value).toBe("LC");
    expect(key.disabled).toBe(true);
    expect(dialog.textContent).toContain("locked after first ticket");
  });

  it("D-41: a project with no ticket yet is told why the key is fixed", async () => {
    const dialog = await openSettings([]);

    expect(
      within(dialog).getByLabelText<HTMLInputElement>("Key").disabled,
    ).toBe(true);
    expect(dialog.textContent).toContain("set when the project was created");
  });

  it("D-43: shows the folder and relocates from beside it", async () => {
    const dialog = await openSettings();

    expect(within(dialog).getByTitle(project.rootPath).textContent).toContain(
      project.rootPath,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Locate…" }));

    await waitFor(() =>
      expect(api.chooseAndRelocateProject).toHaveBeenCalledWith(project.id),
    );
  });

  it("D-42: the appearance segment sets the app preference", async () => {
    const dialog = await openSettings([ticket], "Theme");

    const segment = within(dialog).getByRole("group", { name: /^Appearance/ });
    // The exception the row states about itself, and the group's own name.
    expect(dialog.textContent).toContain("not stored in the project");
    expect(
      within(segment)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["System", "Light", "Dark"]);

    fireEvent.click(within(segment).getByRole("button", { name: "Dark" }));

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(useLongClawStore.getState().appearance).toBe("dark");
    // It is a device preference, so nothing about the project was written.
    expect(api.updateProjectTheme).not.toHaveBeenCalled();
    expect(api.updateProjectName).not.toHaveBeenCalled();
  });

  it("D-44: removing states its guarantee and asks first", async () => {
    const dialog = await openSettings([ticket], "Danger zone");

    expect(dialog.textContent).toContain(
      "Removing only forgets the project in LongClaw. Files on disk are never touched.",
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from app" }),
    );

    const confirm = confirmDialog()!;
    expect(confirm).toBeTruthy();
    // It names the path and repeats the guarantee.
    expect(confirm.textContent).toContain(project.rootPath);
    expect(confirm.textContent).toContain("stay on disk, untouched");
    expect(api.removeProject).not.toHaveBeenCalled();

    // `Esc` cancels the confirm and leaves the settings behind it open.
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(confirmDialog()).toBeNull();
    expect(
      screen.getByRole("region", { name: "Project settings" }),
    ).toBeTruthy();
    expect(api.removeProject).not.toHaveBeenCalled();
  });

  it("D-44: confirming forgets the project and closes the dialog", async () => {
    const dialog = await openSettings([ticket], "Danger zone");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from app" }),
    );
    fireEvent.click(
      within(confirmDialog()!).getByRole("button", { name: "Remove from app" }),
    );

    await waitFor(() =>
      expect(api.removeProject).toHaveBeenCalledWith(project.id),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Project settings" }),
      ).toBeNull(),
    );
  });

  it("the name commits on Enter rather than waiting for a button", async () => {
    vi.mocked(api.updateProjectName).mockResolvedValue({
      ...project,
      name: "Renamed",
    });
    const dialog = await openSettings();

    const field = within(dialog).getByLabelText("Name");
    // The `Rename` button beside this field was the only way to save it, and
    // `Done` with a typed name threw the name away without saying so.
    expect(within(dialog).queryByRole("button", { name: "Rename" })).toBeNull();

    fireEvent.change(field, { target: { value: "Renamed" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(api.updateProjectName).toHaveBeenCalledWith(project.id, "Renamed"),
    );
  });

  it("Tab is free to leave the panel, and `Esc` still closes it from the body", async () => {
    const dialog = await openSettings();

    // The trap went with the scrim (LC-223): the board beside the panel is
    // live, so Tab is free to walk out of the panel instead of wrapping. The
    // panel must not redirect the press — jsdom moves no focus on its own, so
    // any movement here would be a handler still trapping.
    const last = within(dialog).getByRole("button", { name: "Locate…" });
    last.focus();
    const free = fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(last);
    expect(free).toBe(true);

    // Clicking the panel's own heading leaves nothing focused, which used to
    // strand it: its `Esc` handler was on the element.
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Project settings" }),
      ).toBeNull(),
    );
  });

  /**
   * The `Done` button in the footer is gone with the footer (LC-208): a panel
   * pinned to an edge closes from the ✕ in its own header, the way the ticket
   * panel does, and a footer holding one button cost a row of the pane the
   * sections are read in.
   */
  it("D-4L: the close ✕ closes it and hands focus back to the gear", async () => {
    const dialog = await openSettings();
    const gear = screen.getByRole("button", { name: "Project settings" });
    expect(within(dialog).queryByRole("button", { name: "Done" })).toBeNull();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close settings" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Project settings" }),
      ).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(gear));
  });

  it("D-4L: `Esc` closes it too, and the filter behind it keeps its query", async () => {
    const dialog = await openSettings();
    fireEvent.change(screen.getByLabelText("Filter tickets"), {
      target: { value: "round" },
    });

    // One press closes one layer: settings is a rung of the `Esc` ladder above
    // the filter (`keyboard-focus-map.md:19-31`).
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Project settings" }),
      ).toBeNull(),
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Filter tickets").value,
    ).toBe("round");
  });

  /**
   * The colour is a dropdown since LC-208 — one dot and a chevron, opening the
   * eight — where it was eight swatches laid out inline. Still no OS `<select>`
   * (D-72), still one button per row (D-4J), and still every hue named for
   * anything that is not looking at it.
   */
  it("D-4J / D-72: a label's colour is a dropdown of the ramp", async () => {
    vi.mocked(api.updateProjectLabel).mockResolvedValue({
      ...project,
      labels: { backend: { name: "Backend", color: "purple" } },
    });
    const dialog = await openSettings([ticket], "Labels");

    expect(dialog.querySelector("select")).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: /^Save label/ }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Remove label backend" }),
    ).toBeTruthy();

    // At rest the row shows one colour: the one the label is.
    const trigger = within(dialog).getByRole("button", {
      name: "Color of label backend: blue",
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      within(dialog).queryByRole("menuitemradio", { name: "purple" }),
    ).toBeNull();

    fireEvent.click(trigger);

    const hues = screen.getByRole("menu", { name: "Color of label backend" });
    expect(
      within(hues)
        .getAllByRole("menuitemradio")
        .map((swatch) => swatch.getAttribute("aria-label")),
    ).toEqual([
      "blue",
      "cyan",
      "purple",
      "pink",
      "red",
      "orange",
      "amber",
      "gray",
    ]);

    // A picked hue applies at once, the way the theme picker does.
    fireEvent.click(
      within(hues).getByRole("menuitemradio", { name: "purple" }),
    );

    await waitFor(() =>
      expect(api.updateProjectLabel).toHaveBeenCalledWith({
        projectId: project.id,
        slug: "backend",
        name: "Backend",
        color: "purple",
      }),
    );
    // And the strip goes with the decision.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  /**
   * Every settings write is acknowledged (LC-208). They went out through bare
   * `await`s: the disk-state indicator never moved and no toast was raised, so
   * a rename that landed looked exactly like one that was dropped — the field
   * simply kept what you typed either way.
   */
  it("says what changed, and offers to take it back", async () => {
    vi.mocked(api.updateProjectName).mockResolvedValue({
      ...project,
      name: "Renamed",
    });
    const dialog = await openSettings();

    const field = within(dialog).getByLabelText("Name");
    fireEvent.change(field, { target: { value: "Renamed" } });
    fireEvent.keyDown(field, { key: "Enter" });

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("Renamed to Renamed");
    // The write is named for the file it lands in, not for a ticket — the
    // header's disk-state indicator said `ticket.md` for every settings write
    // that reached it, because that is what it says when nothing names a path.
    await waitFor(() =>
      expect(
        document.querySelector(".content-header .disk-path")?.textContent,
      ).toContain("longclaw.yaml"),
    );

    // And the previous name is one press away, as every other write's is.
    vi.mocked(api.updateProjectName).mockResolvedValue(project);
    fireEvent.click(within(toast).getByRole("button", { name: /^Undo/ }));
    await waitFor(() =>
      expect(api.updateProjectName).toHaveBeenLastCalledWith(
        project.id,
        project.name,
      ),
    );
  });

  it("acknowledges a label definition landing too", async () => {
    vi.mocked(api.removeProjectLabel).mockResolvedValue({
      ...project,
      labels: {},
    });
    const dialog = await openSettings([ticket], "Labels");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove label backend" }),
    );

    const toast = await screen.findByRole("status");
    // "Removed the definition", not "deleted the label": the slug stays on
    // every ticket carrying it, which is the whole guarantee of this section.
    expect(toast.textContent).toContain("Removed the backend label definition");
  });

  it("D-4J: `Esc` in a label name reverts the field and leaves the panel up", async () => {
    const dialog = await openSettings([ticket], "Labels");
    const field = within(dialog).getByLabelText<HTMLInputElement>(
      "Name of label backend",
    );

    fireEvent.change(field, { target: { value: "Platform" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(field.value).toBe("Backend");
    expect(api.updateProjectLabel).not.toHaveBeenCalled();
    // One press, one rung: the field answered it, so the dialog did not.
    expect(
      screen.getByRole("region", { name: "Project settings" }),
    ).toBeTruthy();
  });

  it("D-4J: removing a row writes once, even with a name typed into it", async () => {
    vi.mocked(api.removeProjectLabel).mockResolvedValue({
      ...project,
      labels: {},
    });
    const dialog = await openSettings([ticket], "Labels");
    const field = within(dialog).getByLabelText("Name of label backend");
    fireEvent.change(field, { target: { value: "Platform" } });

    // The press holds focus where it is, so the row does not commit a rename
    // on its way out and race the delete for the same slug.
    const remove = within(dialog).getByRole("button", {
      name: "Remove label backend",
    });
    expect(fireEvent.mouseDown(remove)).toBe(false);
    fireEvent.click(remove);

    await waitFor(() =>
      expect(api.removeProjectLabel).toHaveBeenCalledWith({
        projectId: project.id,
        slug: "backend",
      }),
    );
    expect(api.updateProjectLabel).not.toHaveBeenCalled();
  });

  it("D-4J: a renamed row commits on blur, and an unchanged one writes nothing", async () => {
    vi.mocked(api.updateProjectLabel).mockResolvedValue({
      ...project,
      labels: { backend: { name: "Platform", color: "blue" } },
    });
    const dialog = await openSettings([ticket], "Labels");
    const field = within(dialog).getByLabelText("Name of label backend");

    fireEvent.blur(field);
    expect(api.updateProjectLabel).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "Platform" } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(api.updateProjectLabel).toHaveBeenCalledWith({
        projectId: project.id,
        slug: "backend",
        name: "Platform",
        color: "blue",
      }),
    );
  });

  /**
   * `screen-specs.md:335-336`. The settings panel offers the same removal the
   * unreachable screen does, so it has to ask the same question first — an
   * action that confirms on one screen and fires on the next is not a confirm.
   */
  it("puts the settings panel's Remove behind the same confirm", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    vi.mocked(api.removeProject).mockResolvedValue(undefined);
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    const header = document.querySelector<HTMLElement>(".content-header")!;
    fireEvent.click(
      within(header).getByRole("button", { name: "Project settings" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /All settings/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Danger zone" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove from app" }));
    expect(api.removeProject).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", {
      name: `Remove \u201C${project.name}\u201D from LongClaw?`,
    });
    expect(dialog.textContent).toContain("stay on disk, untouched");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from app" }),
    );

    await waitFor(() =>
      expect(api.removeProject).toHaveBeenCalledWith(project.id),
    );
  });
});

describe("the header disk-state indicator (LC-69)", () => {
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
    await screen.findByRole("button", { name: "Board", pressed: true });
    return document.querySelector<HTMLElement>(".content-header")!;
  }

  it("is silent on a settled board, where the old chip said `watching`", async () => {
    const header = await openBoard();

    expect(header.textContent).not.toContain("watching");
  });

  it("names the file a write landed in, and nothing before the first write", async () => {
    const header = await openBoard();
    expect(header.textContent).not.toContain("✓");

    act(() => {
      useMutationStore.setState({
        settled: ".longclaw/tickets/LC-1/ticket.md",
      });
    });

    // With the key, because every ticket in the project is stored as
    // `ticket.md`: the mark has to say which one landed, not that one did.
    expect(header.textContent).toContain("✓ tickets/LC-1/ticket.md");
    expect(header.textContent).not.toContain(".longclaw/tickets");
  });

  it("speaks up while a read is in flight", async () => {
    const header = await openBoard();

    act(() => void useLongClawStore.setState({ loading: true }));
    expect(header.textContent).toContain("reading");

    act(() => void useLongClawStore.setState({ loading: false }));
    expect(header.textContent).not.toContain("reading");
  });
});

/**
 * First launch, against `screen-specs.md:88-110` and `states.md:22-27`
 * (LC-76 … LC-82).
 *
 * What it was: the app shell with a 240px sidebar reading `No starred
 * projects` / `No local projects`, and a main panel split into copy on the left
 * and a create form permanently open on the right — a form asking for a name
 * and a key while the folder that would hold them was still unchosen, because
 * the picker did not run until submit.
 */
describe("first launch (LC-76 … LC-82)", () => {
  const created = {
    id: "project-new",
    name: "My Project",
    rootPath: "/Users/dev/repo",
    key: "MP",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  /** The flow D-11 restores: welcome → folder picker → create form. */
  async function reachCreateForm(folder = "/Users/dev/repo") {
    vi.mocked(api.chooseProjectFolder).mockResolvedValue(folder);
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Create a project" }),
    );
    await screen.findByLabelText("Name");
  }

  it("takes the whole window, sidebar and all (D-10)", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Plan with your agents." });

    expect(document.querySelector(".app-shell")).toBeNull();
    expect(document.querySelector(".side-panel")).toBeNull();
    // The two placeholders that said, in the weakest available form, the thing
    // this screen exists to say.
    expect(screen.queryByText("No starred projects")).toBeNull();
    expect(screen.queryByText("No local projects")).toBeNull();
  });

  it("waits for the registry rather than flashing over an ordinary launch", async () => {
    // `projects` is empty for the first frame of *every* launch. Deciding on
    // the empty list alone would put this screen in front of a returning user
    // on the way to their board.
    let answer: (projects: ProjectReference[]) => void = () => {};
    vi.mocked(api.listProjects).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<App />);

    expect(document.querySelector(".welcome-shell")).toBeNull();
    expect(document.querySelector(".app-shell")).toBeTruthy();

    await act(async () => answer([]));
    expect(document.querySelector(".welcome-shell")).toBeTruthy();
  });

  it("offers create and open as peers, create primary (D-12)", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Plan with your agents." });

    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        ".welcome-actions button",
      ),
    ];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Create a project",
      "Open a folder",
    ]);
    expect(buttons[0].className).toContain("primary");
    expect(buttons[1].className).toContain("secondary");
  });

  it("asks for the folder before it asks what to put in it (D-11)", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Plan with your agents." });

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByLabelText("Key")).toBeNull();
  });

  it("states the value, and closes on the mono trust line (D-14, D-16)", async () => {
    render(<App />);
    const heading = await screen.findByRole("heading", {
      name: "Plan with your agents.",
    });
    const panel = heading.closest(".welcome-panel") as HTMLElement;

    // D-14 decided for value over mechanism: the next step names `.longclaw`
    // in the path the user just picked, so the subtitle no longer has to.
    expect(panel.querySelector(".welcome-subtitle")?.textContent).toContain(
      "Tickets live as plain files in a folder you choose",
    );
    // D-16: the trust line renders in mono, and the rule that makes it mono is
    // the one on `.trust-line`. It lost to `.welcome-copy p` — the subtitle's
    // selector, which matched this paragraph too — so every `<p>` in this
    // column carries a class of its own, and nothing selects them as `p`.
    expect([...panel.querySelectorAll("p")].map((p) => p.className)).toEqual([
      "welcome-subtitle",
      "trust-line",
    ]);
  });

  it("shows the folder the picker answered with (D-13)", async () => {
    await reachCreateForm("/Users/dev/my-app");

    expect(document.querySelector(".picked-path")?.textContent).toBe(
      "/Users/dev/my-app/.longclaw",
    );
    // And works from it, rather than only displaying it
    // (`screen-specs.md:103`) — this is the whole return on asking the folder
    // first, and the field focus lands in.
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "my-app",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Key").value).toBe("MA");
  });

  it("leaves the screen alone when the picker is cancelled", async () => {
    vi.mocked(api.chooseProjectFolder).mockResolvedValue(null);
    render(<App />);
    const create = await screen.findByRole("button", {
      name: "Create a project",
    });

    await act(async () => void fireEvent.click(create));

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create a project" }),
    ).toBeTruthy();
  });

  it("creates in the folder that was picked, and opens it", async () => {
    vi.mocked(api.createProjectInFolder).mockResolvedValue(created);
    vi.mocked(api.openProject).mockResolvedValue({
      project: created,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    await reachCreateForm("/Users/dev/repo");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "My Project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(api.createProjectInFolder).toHaveBeenCalledWith(
        "/Users/dev/repo",
        {
          name: "My Project",
          key: "MP",
          theme: "indigo",
        },
      ),
    );
    // Creation lands on the board (`screen-specs.md:109-110`).
    await screen.findByRole("button", { name: "Board", pressed: true });
  });

  it("goes back to the folder question without creating anything", async () => {
    await reachCreateForm();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(
      screen.getByRole("button", { name: "Create a project" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(api.createProjectInFolder).not.toHaveBeenCalled();
  });

  it("says a refused folder out loud rather than sitting on the form", async () => {
    // Since LC-170 the picker asks the folder first, so this form is only ever
    // reached for one that had no project in it — which leaves the race: a
    // folder initialised between the question and the submit, by an agent or by
    // the other window. Creation refuses it either way, and without the shell
    // there is no other surface to say so on.
    vi.mocked(api.createProjectInFolder).mockRejectedValue({
      code: "invalid_project",
      message: "This folder already holds a LongClaw project",
      recoverable: true,
      context: { path: "/Users/dev/repo/.longclaw/longclaw.yaml" },
    });
    await reachCreateForm("/Users/dev/repo");

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain(
      "This folder already holds a LongClaw project",
    );
  });

  /**
   * The picker's branch (`screen-specs.md:99-101`, LC-170). The folder decides
   * which screen comes next, not the button: each button used to own one half
   * of that sentence and neither fell through, so `Create a project` on an
   * initialised repo asked for a name, a key and a theme and *then* refused,
   * and `Open a folder` on a plain one refused outright. Nothing was ever
   * written either way — this is wasted work and a late no, not data loss.
   */
  describe("the folder decides the screen, not the button (LC-170)", () => {
    const existing = {
      id: "project-existing",
      name: "Orbit",
      rootPath: "/Users/dev/orbit",
      key: "ORB",
      theme: "slate",
      starred: false,
      reachable: true,
      labels: {},
    };

    /** A folder that already holds `existing`, on both sides of the picker. */
    function initialised() {
      vi.mocked(api.folderHoldsProject).mockResolvedValue(true);
      vi.mocked(api.registerProject).mockResolvedValue(existing);
      vi.mocked(api.openProject).mockResolvedValue({
        project: existing,
        tickets: [],
        generation: 1,
        rebuiltInMs: 1,
        sequence: 1,
      });
    }

    it("opens an initialised folder rather than asking three questions it will refuse", async () => {
      vi.mocked(api.chooseProjectFolder).mockResolvedValue("/Users/dev/orbit");
      initialised();
      render(<App />);

      fireEvent.click(
        await screen.findByRole("button", { name: "Create a project" }),
      );

      await screen.findByRole("button", { name: "Board", pressed: true });
      expect(api.registerProject).toHaveBeenCalledWith("/Users/dev/orbit");
      // The form is the thing that was skipped, and creation was never tried:
      // `initialize_project` would have refused it (`core/storage.rs`).
      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(api.createProjectInFolder).not.toHaveBeenCalled();
    });

    it("offers to create in a plain folder rather than refusing to open it", async () => {
      vi.mocked(api.chooseOpenFolder).mockResolvedValue("/Users/dev/my-app");
      render(<App />);

      fireEvent.click(
        await screen.findByRole("button", { name: "Open a folder" }),
      );

      // Step two of the create flow, on the folder that was picked to open —
      // the same screen `Create a project` would have reached (D-13).
      expect(await screen.findByLabelText("Name")).toBeTruthy();
      expect(document.querySelector(".picked-path")?.textContent).toBe(
        "/Users/dev/my-app/.longclaw",
      );
      expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
        "my-app",
      );
      expect(api.registerProject).not.toHaveBeenCalled();
    });

    it("still opens an initialised folder from Open a folder", async () => {
      vi.mocked(api.chooseOpenFolder).mockResolvedValue("/Users/dev/orbit");
      initialised();
      render(<App />);

      fireEvent.click(
        await screen.findByRole("button", { name: "Open a folder" }),
      );

      await screen.findByRole("button", { name: "Board", pressed: true });
      expect(api.registerProject).toHaveBeenCalledWith("/Users/dev/orbit");
    });

    it("leaves the screen alone when the open picker is cancelled", async () => {
      vi.mocked(api.chooseOpenFolder).mockResolvedValue(null);
      render(<App />);
      const open = await screen.findByRole("button", { name: "Open a folder" });

      await act(async () => void fireEvent.click(open));

      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(api.folderHoldsProject).not.toHaveBeenCalled();
      expect(api.registerProject).not.toHaveBeenCalled();
    });

    it("says a folder it could not read out loud, and shows no form for it", async () => {
      // The folder holds a project, and the project will not open: an invalid
      // `longclaw.yaml`, or one written by a newer LongClaw. The create form is
      // not the answer to that — creation would refuse the same folder — so the
      // screen stays where it was and the banner carries the reason.
      vi.mocked(api.chooseOpenFolder).mockResolvedValue("/Users/dev/orbit");
      vi.mocked(api.folderHoldsProject).mockResolvedValue(true);
      vi.mocked(api.registerProject).mockRejectedValue({
        code: "invalid_project",
        message: "longclaw.yaml is missing required key: key",
        recoverable: true,
      });
      render(<App />);

      fireEvent.click(
        await screen.findByRole("button", { name: "Open a folder" }),
      );

      const banner = await screen.findByRole("alert");
      expect(banner.textContent).toContain("longclaw.yaml is missing");
      expect(screen.queryByLabelText("Name")).toBeNull();
    });
  });

  it("derives a backend-valid key for digit-leading project names", async () => {
    await reachCreateForm();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Key").value).toBe("J4");
  });

  it("does not overwrite a key the user has edited", async () => {
    await reachCreateForm();

    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "AB" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Key").value).toBe("AB");
  });

  it("writes nothing into the folder while the key is invalid", async () => {
    await reachCreateForm();

    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "3J4" },
    });
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: "Create project",
    });
    fireEvent.click(submit);

    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText(/uppercase letters and digits, starting with a letter/i),
    ).toBeTruthy();
    expect(api.createProjectInFolder).not.toHaveBeenCalled();
  });
});

type MediaListener = (event: { matches: boolean }) => void;

/**
 * A stateful stand-in for `matchMedia("(prefers-color-scheme: dark)")`:
 * `flip()` is macOS switching appearance while the app is open.
 */
function mockSystem(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<MediaListener>();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, listener: MediaListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: MediaListener) => {
        listeners.delete(listener);
      },
    })),
  });
  return {
    flip(next: boolean) {
      dark = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

/**
 * The sidebar `<select>` these tests used to drive is gone (LC-72) — appearance
 * is an app preference and belongs in project settings as a 3-up segment
 * (LC-127), with the palette's `Toggle appearance` command reaching it until
 * that lands. Both surfaces call exactly this, so the store is the honest seam
 * for the multi-step clauses below: what they test is what an override *does*
 * — beats the system, survives a relaunch — not the control that sets it.
 *
 * That a user can produce one at all is a separate claim, and it needs a real
 * surface: `a user can set an override from the palette` drives the command.
 */
function overrideAppearance(next: "light" | "dark" | "system") {
  act(() => useLongClawStore.getState().setAppearance(next));
}

describe("system-matched appearance (V0-35)", () => {
  beforeEach(() => {
    useLongClawStore.setState({ appearance: "system" });
  });

  afterEach(() => {
    useLongClawStore.setState({ appearance: "system" });
    delete document.documentElement.dataset.theme;
  });

  it("resolves the system appearance when nothing is stored", async () => {
    mockSystem(true);
    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
  });

  it("follows a system change live while the preference is system", async () => {
    const system = mockSystem(false);
    render(<App />);
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );

    act(() => system.flip(true));

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("an explicit override wins over the system and ignores its changes", async () => {
    const system = mockSystem(true);
    render(<App />);
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );

    overrideAppearance("light");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );

    act(() => system.flip(false));
    act(() => system.flip(true));

    expect(document.documentElement.dataset.theme).toBe("light");
    await waitFor(() => expect(devicePreferences.appearance).toBe("light"));
  });

  /**
   * The P1 the clean-machine pass found: set Light, quit, relaunch, and the
   * control read `System` again (LC-150). It reproduced because the preference
   * was in webview storage, which the packaged build does not keep across the
   * process; it is a file Rust owns now, and the relaunch here is a cold read
   * of that file.
   */
  it("persists the preference and rehydrates it on the next launch", async () => {
    mockSystem(true);
    const first = render(<App />);
    overrideAppearance("light");
    await waitFor(() => expect(devicePreferences.appearance).toBe("light"));
    first.unmount();
    // A restart begins from the store default; only the document survives.
    useLongClawStore.setState({ appearance: "system" });
    await relaunch();

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    // Rehydration has to reach the preference itself, not just the stamp: the
    // palette row reads it back as `Toggle appearance (light)`.
    expect(useLongClawStore.getState().appearance).toBe("light");
  });

  it("changing appearance touches no project data", async () => {
    mockSystem(false);
    render(<App />);

    overrideAppearance("dark");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );

    expect(api.updateProjectTheme).not.toHaveBeenCalled();
    expect(api.editTicket).not.toHaveBeenCalled();
    expect(api.updateProjectName).not.toHaveBeenCalled();
  });

  it("a user can set an override from the palette", async () => {
    // The clauses above drive the store, so on their own they would all still
    // pass with no reachable control anywhere in the app. Since LC-72 took the
    // sidebar `<select>` out, the palette command is the only surface that sets
    // this, and it stays the only one until LC-127 builds the settings segment
    // — so one test drives it end to end rather than trusting the wiring.
    mockSystem(true);
    // The palette only mounts over an open project (`App.tsx:1403`), which is
    // also the only state this command is reachable from.
    const project = {
      id: "project-appearance",
      name: "Appearance Fixture",
      rootPath: "/tmp/LongClaw Appearance",
      key: "AF",
      theme: "indigo",
      starred: false,
      reachable: true,
      labels: {},
    };
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    // `system` → `light` is the first step of the cycle the command runs.
    fireEvent.click(
      await screen.findByRole("option", { name: /Toggle appearance/ }),
    );

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    expect(useLongClawStore.getState().appearance).toBe("light");
  });
});

describe("instant per-project theme selection (V0-36)", () => {
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

  beforeEach(() => {
    // The stamp from a previous test is not this launch's first stamp.
    delete document.documentElement.dataset.lcTheme;
    document.documentElement.classList.remove("theme-transition");
  });

  /** The gear → `All settings…` → `Theme` walk the picker now lives behind. */
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
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /All settings/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Theme" }));
  }

  it("must-pass: a preset applies instantly and writes only the project file", async () => {
    let resolveWrite!: (reference: typeof project) => void;
    vi.mocked(api.updateProjectTheme).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );
    await openSettings();
    expect(document.documentElement.dataset.lcTheme).toBe("indigo");

    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));

    // Optimistic: the accent flips before the write returns.
    expect(document.documentElement.dataset.lcTheme).toBe("plum");
    expect(api.updateProjectTheme).toHaveBeenCalledTimes(1);
    expect(api.updateProjectTheme).toHaveBeenCalledWith(project.id, "plum");

    await act(async () => {
      resolveWrite({ ...project, theme: "plum" });
    });

    expect(document.documentElement.dataset.lcTheme).toBe("plum");
    // No snapshot re-fetch and no ticket write: the theme is project metadata.
    expect(api.openProject).toHaveBeenCalledTimes(1);
    expect(api.editTicket).not.toHaveBeenCalled();
    expect(api.createTicket).not.toHaveBeenCalled();
  });

  it("crossfades on a change and never on the first stamp", async () => {
    vi.mocked(api.updateProjectTheme).mockResolvedValue({
      ...project,
      theme: "clay",
    });
    await openSettings();
    expect(
      document.documentElement.classList.contains("theme-transition"),
    ).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Clay" }));

    expect(
      document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);
    // The class is transient — the crossfade ends and the rule leaves with it.
    await waitFor(
      () =>
        expect(
          document.documentElement.classList.contains("theme-transition"),
        ).toBe(false),
      { timeout: 1_000 },
    );
  });

  it("a refused write flips the theme back and says so", async () => {
    vi.mocked(api.updateProjectTheme).mockRejectedValue({
      code: "permission_denied",
      message: "Project file is read-only",
      recoverable: true,
    });
    await openSettings();

    fireEvent.click(screen.getByRole("radio", { name: "Slate" }));
    expect(document.documentElement.dataset.lcTheme).toBe("slate");

    await waitFor(() =>
      expect(document.documentElement.dataset.lcTheme).toBe("indigo"),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/read-only/);
  });

  it("swatches follow a live system appearance change", async () => {
    // The swatch carries its own data-theme so it can show a theme that
    // is not in force; a live OS switch must restamp mounted swatches, not
    // just the root, or the picker shows yesterday's appearance.
    const system = mockSystem(false);
    await openSettings();
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>(".theme-option .theme-swatch")
          ?.dataset.theme,
      ).toBe("light"),
    );

    act(() => system.flip(true));

    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>(".theme-option .theme-swatch")
          ?.dataset.theme,
      ).toBe("dark"),
    );
  });

  it("offers exactly the fixed presets and no custom-color affordance", async () => {
    await openSettings();

    // Scoped to the picker: the label rows in the same dialog carry the eight
    // ramp hues as radios of their own since LC-130.
    const picker = document.querySelector<HTMLElement>(".theme-picker")!;
    const radios = within(picker).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual([
      "indigo",
      "clay",
      "slate",
      "plum",
      "graphite",
    ]);
    expect(document.querySelector('input[type="color"]')).toBeNull();
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
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    // The menu's own `Labels` row, which is the short path the gear exists to
    // offer: it opens the panel already standing on this section.
    fireEvent.click(screen.getByRole("menuitem", { name: /^Labels/ }));
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
    // The app's own dropdown, never an OS one (LC-130, LC-208): the trigger
    // shows the hue it is set to, and the strip names every hue it offers.
    fireEvent.click(
      screen.getByRole("button", { name: "New label color: blue" }),
    );
    fireEvent.click(
      within(screen.getByRole("menu", { name: "New label color" })).getByRole(
        "menuitemradio",
        { name: "amber" },
      ),
    );
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

    const field = screen.getByLabelText("Name of label backend");
    fireEvent.change(field, { target: { value: "Platform" } });
    // The row commits itself now (LC-130) — `Enter`, as the panel's title does
    // — so there is no per-row Save button left to press.
    expect(screen.queryByRole("button", { name: /^Save label/ })).toBeNull();
    fireEvent.keyDown(field, { key: "Enter" });

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

  function detail(key: string): TicketDetail {
    return {
      key,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      contentHash: `hash-${key}`,
      byteLength: 320,
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
        createdAt: "2026-07-30T09:00:00Z",
        updatedAt: "2026-07-30T09:00:00Z",
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
    ticket("LC-1", { status: "todo", priority: "p2" }),
    ticket("LC-2", { status: "in_progress" }),
    ticket("LC-3", { status: "canceled" }),
  ];

  function snapshot(tickets: TicketRow[], sequence = 1, generation = 1) {
    return { project, tickets, generation, rebuiltInMs: 1, sequence };
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
  async function open(
    tickets: TicketRow[] = SEED,
    generation = 1,
    expectedView: "Board" | "List" = "Board",
  ) {
    let deliver: (envelope: StreamEnvelope) => void = () => {};
    vi.mocked(api.listenForProjectEvents).mockImplementation(
      async (handler) => {
        deliver = handler;
        return () => {};
      },
    );
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue(
      snapshot(tickets, 1, generation),
    );
    render(<App />);
    await screen.findByRole("button", {
      name: expectedView,
      pressed: true,
    });
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

  it("V0-28: tells the open panel when its ticket was removed on disk", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    const { deliver } = await open();

    fireEvent.click(
      document.querySelector<HTMLElement>(
        '.ticket-row[data-ticket-key="LC-1"]',
      )!,
    );
    await screen.findByLabelText("Title");

    deliver({
      contractVersion: 1,
      sequence: 2,
      projectId: project.id,
      emittedAt: "2026-07-31T10:00:00Z",
      event: {
        type: "ticketRemoved",
        data: { ticketKey: "LC-1", source: "external" },
      },
    });

    await screen.findByText("Ticket file is no longer available");
    expect(screen.getByText(/deleted or renamed on disk/)).toBeTruthy();
    expect(shownKeys()).not.toContain("LC-1");
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
    // Its own set rather than `SEED`: two tickets share a status, so the order
    // inside a group is derived from the tickets rather than handed over by the
    // one-per-status layout.
    const files = () => [
      ticket("LC-1", { status: "todo", priority: "p2" }),
      ticket("LC-2", { status: "todo", priority: "urgent" }),
      ticket("LC-3", { status: "in_progress" }),
    ];
    await open(files());
    toggleTo("List");
    const before = shownKeys();
    expect(before).toEqual(["LC-2", "LC-1", "LC-3"]);
    cleanup();

    // A restart is a cold process, so nothing of the last run may be reachable:
    // the store starts empty, and `openProject` answers with the index built
    // from the files again. Deliberately not the same objects and deliberately
    // not in the same order — a directory scan has no reason to hand back what
    // the last session held, so anything the surfaces still agreed about would
    // have to have been re-derived here rather than carried across.
    useLongClawStore.setState({
      projects: [],
      activeProjectId: undefined,
      tickets: [],
      generation: 0,
      lastSequence: 0,
      externalMarks: {},
    });
    const reindexed = files().reverse();
    await open(reindexed, 2, "List");
    toggleTo("List");

    // The new index is the one on screen, not a survivor of the last mount.
    expect(useLongClawStore.getState().generation).toBe(2);
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

  function detail(
    key: string,
    archivedAt?: string,
    contentHash = `hash-${key}`,
  ): TicketDetail {
    return {
      key,
      relativePath: `.longclaw/tickets/${key}/ticket.md`,
      contentHash,
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
    await screen.findByRole("button", { name: "Board", pressed: true });
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

  // Plan 23. A board-raised mutation carries the hash it was built from, so a
  // conflict is the one failure re-sending cannot fix.
  it("offers no Retry on a conflict, and opens the ticket instead", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: {
        ticketKey: "LC-1",
        expectedHash: "hash-LC-1",
        actualHash: "hash-LC-1-newer",
        conflictingActorType: "agent",
        conflictingActorName: "Claude",
      },
    });
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    // The card comes back, as it does for any refused write.
    await waitFor(() => expect(card("LC-1")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    // It says what happened and who did it, not "reload or keep your version":
    // there is no banner out here to reload from.
    expect(screen.getByText(/LC-1 changed on disk/)).toBeTruthy();
    expect(screen.getByText(/Claude \(agent\)/)).toBeTruthy();
    // V0-29: and it says the change survived, because it now does. A toast that
    // reports a refusal without saying the edit is held reads as a dead end.
    expect(screen.getByText(/Your change is held/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open ticket" }));

    // The honest next action: the file as it now reads, so the human can decide.
    await screen.findByRole("complementary", { name: "Ticket LC-1" });
  });

  /**
   * V0-29, and the question plan 23 left open: may a mutation raised outside the
   * panel hold its edit and re-apply it over a newer file? Yes — but only inside
   * the panel, over content the human has been shown. Open ticket used to throw
   * the refused edit away in the revert, so the trip cost the human their change.
   */
  it("hands the refused edit to the panel, and keeps it against the file the panel read", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: {
        ticketKey: "LC-1",
        conflictingActorType: "agent",
        conflictingActorName: "Claude",
      },
    });
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(card("LC-1")).toBeTruthy());

    // What the panel finds when it goes and looks: somebody else's newer bytes.
    vi.mocked(api.readTicket).mockResolvedValue(
      detail("LC-1", undefined, "hash-LC-1-newer"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open ticket" }));

    // The banner, over the file as it now reads — not a dead end.
    await screen.findByText("⚠ Changed on disk while you were editing");
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-1", { archivedAt: "2026-07-31T10:00:00Z" }),
    );
    fireEvent.click(screen.getByText("Keep mine"));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenLastCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      // The hash the panel read and rendered, so this is a decision taken over
      // the newer file rather than a blind overwrite of an unseen one.
      expectedHash: "hash-LC-1-newer",
      // The archive the board raised, still intact after the trip.
      edit: { archived: true },
    });
  });

  /**
   * V0-29, review follow-up. The panel raises the handed-over banner as soon as
   * it has *a* file, and only then goes back for the current one — so between
   * those two reads Keep mine is on screen with an older hash behind it. The
   * panel-local case is pinned in `TicketPanel.test.tsx`; this is the same
   * window on the way in from the board, which is the longer of the two.
   */
  it("waits for the panel's own read before keeping a held conflict", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: { ticketKey: "LC-1" },
    });
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(card("LC-1")).toBeTruthy());

    // The panel opens on the file it had, and the read that fetches the current
    // one is held open.
    let arrive: () => void = () => {};
    vi.mocked(api.readTicket)
      .mockResolvedValueOnce(detail("LC-1"))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            arrive = () =>
              resolve(detail("LC-1", undefined, "hash-LC-1-newer"));
          }),
      );

    fireEvent.click(screen.getByRole("button", { name: "Open ticket" }));
    await screen.findByText("⚠ Changed on disk while you were editing");

    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-1", { archivedAt: "2026-07-31T10:00:00Z" }),
    );
    fireEvent.click(screen.getByText("Keep mine"));

    // Nothing goes out over a file nobody has seen.
    expect(api.editTicket).toHaveBeenCalledTimes(1);

    arrive();

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    expect(api.editTicket).toHaveBeenLastCalledWith({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1-newer",
      edit: { archived: true },
    });
  });

  it("does not carry a refused edit onto the next ticket, or back after a close", async () => {
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    vi.mocked(api.editTicket).mockRejectedValue({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: { ticketKey: "LC-1" },
    });
    await openPanel([row("LC-1"), row("LC-2")], "LC-1");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(card("LC-1")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open ticket" }));
    await screen.findByText("⚠ Changed on disk while you were editing");

    // A different ticket is a different file, and never inherits the choice.
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-2"));
    fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    fireEvent.click(card("LC-2") as HTMLElement);
    await screen.findByRole("complementary", { name: "Ticket LC-2" });
    expect(
      screen.queryByText("⚠ Changed on disk while you were editing"),
    ).toBeNull();

    // Nor does closing and coming back re-raise a choice already left behind.
    vi.mocked(api.readTicket).mockResolvedValue(detail("LC-1"));
    fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    fireEvent.click(card("LC-1") as HTMLElement);
    await screen.findByRole("complementary", { name: "Ticket LC-1" });
    expect(
      screen.queryByText("⚠ Changed on disk while you were editing"),
    ).toBeNull();
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

    // The panel stays: only archiving closes it (`screen-specs.md:221`).
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

  function written(key: string, landed?: Partial<IndexedTicket>): WriteResult {
    return {
      ticket: row(key, { contentHash: `hash-${key}-written`, ...landed }),
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
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  /** Switches the header control, which is a real menu with a real footnote. */
  function chooseOrdering(name: "Priority" | "Manual") {
    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name }));
  }

  /**
   * The cards of one column in the order they are drawn in. By `top` rather than
   * by document order: the column places its cards absolutely and mounts its
   * anchors out of sequence, so the DOM is not what a human sees.
   */
  function cardOrder(title = "Todo"): string[] {
    const column = screen
      .getByRole("heading", { name: new RegExp(`^${title}`) })
      .closest(".board-column")!;
    return [...column.querySelectorAll<HTMLElement>("[data-ticket-key]")]
      .sort(
        (left, right) =>
          Number.parseFloat(left.style.top) -
          Number.parseFloat(right.style.top),
      )
      .map((card) => card.dataset.ticketKey!);
  }

  /**
   * A drop in a named gap of a column, Todo unless said otherwise. Gap 0 is
   * above the first card, gap 1 between the first and the second, and so on —
   * the same numbering `gapAt` answers in (`boardGeometry.ts`).
   *
   * Stated as a gap rather than as a pixel, because the pixel was never the
   * fact these tests are about. They held one — 160 for "between the second and
   * third" — and LC-166 raised the card's height, at which point 160 became the
   * gap *above* and four of them failed a long way from anything that had
   * changed. `gap * CARD_STRIDE` is the top of that gap's own card, which
   * `gapAt` resolves to the same gap at any stride the stylesheet ever pins.
   */
  function dropAt(key: string, gap: number, title = "Todo") {
    const clientY = gap * CARD_STRIDE;
    const stack = screen
      .getByRole("heading", { name: new RegExp(`^${title}`) })
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

    await waitFor(() =>
      expect(devicePreferences.projectWorkspaces).toEqual({
        "project-fixture": { ordering: "manual" },
      }),
    );
  });

  it("must-pass: Priority mode writes no rank however the board is dragged", async () => {
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-2", { status: "in_progress" }),
    );
    await openBoard([row("LC-1", { rank: "a0" }), row("LC-2", { rank: "a1" })]);

    // Inside its own column, where a rank is the only thing a drop could write.
    dropAt("LC-2", 0);

    expect(api.editTicket).not.toHaveBeenCalled();

    // And into another column, which is a status change — and still no rank
    // (LC-60).
    dropAt("LC-2", 0, "In Progress");

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-2",
      expectedHash: "hash-LC-2",
      edit: { status: "in_progress" },
    });
  });

  it("must-pass: a manual drop writes a rank, and only a rank, and takes it back", async () => {
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-3", { rank: "a0V" }),
    );
    await openBoard([
      row("LC-1", { rank: "a0" }),
      row("LC-2", { rank: "a1" }),
      row("LC-3", { rank: "a2" }),
    ]);
    chooseOrdering("Manual");

    // Into the gap between LC-1 and LC-2.
    dropAt("LC-3", 1);

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
    expect(api.editTicket).toHaveBeenCalledWith({
      projectId: project.id,
      ticketKey: "LC-3",
      expectedHash: "hash-LC-3",
      edit: { rank: "a0V" },
    });
    await screen.findByText("LC-3 moved");

    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-3", { rank: "a2" }),
    );
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
    vi.mocked(api.editTicket).mockResolvedValue(
      written("LC-3", { rank: "a0" }),
    );
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

  it("must-pass: a drop into a column with no ranks lands where it was let go (LC-174)", async () => {
    // The ordinary case, not a corner. ADR 0003 allocates no rank until
    // something is dragged, so every column starts like this — and before
    // LC-174 a card let go two rows down took the first rank, sorted above the
    // cards with none, and did not move at all.
    vi.mocked(api.editTicket)
      .mockResolvedValueOnce(written("LC-2", { rank: "a0" }))
      .mockResolvedValueOnce(written("LC-1", { rank: "a1" }));
    await openBoard([row("LC-1"), row("LC-2"), row("LC-3")]);
    chooseOrdering("Manual");

    // Into the gap between LC-2 and LC-3.
    dropAt("LC-1", 2);

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    // The card above the gap is given a position first, so the dragged card has
    // something to sit under.
    expect(vi.mocked(api.editTicket).mock.calls[0][0]).toStrictEqual({
      projectId: project.id,
      ticketKey: "LC-2",
      expectedHash: "hash-LC-2",
      edit: { rank: "a0" },
    });
    expect(vi.mocked(api.editTicket).mock.calls[1][0]).toStrictEqual({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1",
      edit: { rank: "a1" },
    });
    // Nothing below the gap is written: LC-3 is already under the drop.
    expect(cardOrder("Todo")).toEqual(["LC-2", "LC-1", "LC-3"]);
  });

  it("takes the whole gesture back with one Undo (LC-174)", async () => {
    vi.mocked(api.editTicket)
      .mockResolvedValueOnce(written("LC-2", { rank: "a0" }))
      .mockResolvedValueOnce(written("LC-1", { rank: "a1" }));
    await openBoard([row("LC-1"), row("LC-2"), row("LC-3")]);
    chooseOrdering("Manual");

    dropAt("LC-1", 2);
    await screen.findByText("LC-1 moved");

    vi.mocked(api.editTicket)
      .mockReset()
      .mockResolvedValueOnce(written("LC-2"))
      .mockResolvedValueOnce(written("LC-1"));
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
    // Both keys are cleared rather than invented, and each against the hash its
    // own forward write left behind.
    expect(vi.mocked(api.editTicket).mock.calls[0][0]).toStrictEqual({
      projectId: project.id,
      ticketKey: "LC-2",
      expectedHash: "hash-LC-2-written",
      edit: { rank: null },
    });
    expect(vi.mocked(api.editTicket).mock.calls[1][0]).toStrictEqual({
      projectId: project.id,
      ticketKey: "LC-1",
      expectedHash: "hash-LC-1-written",
      edit: { rank: null },
    });
    expect(cardOrder("Todo")).toEqual(["LC-1", "LC-2", "LC-3"]);
  });

  it("puts back the half of the gesture that landed when the rest fails", async () => {
    // One drop is one thing the human did, so a companion written and a card
    // that never moved is a state nobody asked for. The rollback is best
    // effort, and the toast still names the failure.
    vi.mocked(api.editTicket)
      .mockResolvedValueOnce(written("LC-2", { rank: "a0" }))
      .mockRejectedValueOnce({
        code: "io",
        message: "Disk is full",
        recoverable: true,
      })
      .mockResolvedValueOnce(written("LC-2"));
    await openBoard([row("LC-1"), row("LC-2"), row("LC-3")]);
    chooseOrdering("Manual");

    dropAt("LC-1", 2);

    await screen.findByText(
      "LC-1 could not be moved. Disk is full. The file was left as it was.",
    );
    await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(3));
    expect(vi.mocked(api.editTicket).mock.calls[2][0]).toStrictEqual({
      projectId: project.id,
      ticketKey: "LC-2",
      expectedHash: "hash-LC-2-written",
      edit: { rank: null },
    });
    expect(cardOrder("Todo")).toEqual(["LC-1", "LC-2", "LC-3"]);
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

    dropAt("LC-3", 1);

    expect(useLongClawStore.getState().tickets[2].state === "indexed").toBe(
      true,
    );
    await screen.findByText(
      "LC-3 could not be moved. Disk is full. The file was left as it was.",
    );
    const back = useLongClawStore
      .getState()
      .tickets.find((ticket) => ticket.key === "LC-3");
    expect(back?.state === "indexed" && back.rank).toBe("a2");
  });

  describe("dragged into another column (LC-60)", () => {
    /** Where a card sits now, by the column heading above it. */
    function columnHolding(key: string): string {
      const column = document
        .querySelector(`[data-ticket-key="${key}"]`)
        ?.closest(".board-column");
      return column?.querySelector("h3")?.textContent ?? "";
    }

    it("writes the status of the column, and takes it back", async () => {
      vi.mocked(api.editTicket).mockResolvedValue(
        written("LC-2", { status: "in_progress" }),
      );
      await openBoard([row("LC-1"), row("LC-2")]);

      dropAt("LC-2", 0, "In Progress");

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
      expect(api.editTicket).toHaveBeenCalledWith({
        projectId: project.id,
        ticketKey: "LC-2",
        expectedHash: "hash-LC-2",
        edit: { status: "in_progress" },
      });
      await screen.findByText("LC-2 → In Progress");

      vi.mocked(api.editTicket).mockResolvedValue(written("LC-2"));
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
      expect(api.editTicket).toHaveBeenLastCalledWith({
        projectId: project.id,
        ticketKey: "LC-2",
        expectedHash: "hash-LC-2-written",
        edit: { status: "todo" },
      });
    });

    it("writes the column and the place in it as one edit, in Manual", async () => {
      vi.mocked(api.editTicket).mockResolvedValue(
        written("LC-1", { rank: "a5V", status: "in_progress" }),
      );
      await openBoard([
        row("LC-1", { rank: "a0" }),
        row("LC-2", { status: "in_progress", rank: "a5" }),
        row("LC-3", { status: "in_progress", rank: "a6" }),
      ]);
      chooseOrdering("Manual");

      // Into the gap between LC-2 and LC-3, in a column LC-1 is not in.
      dropAt("LC-1", 1, "In Progress");

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
      const sent = vi.mocked(api.editTicket).mock.calls[0][0];
      expect(sent.ticketKey).toBe("LC-1");
      expect(sent.edit.status).toBe("in_progress");
      expect(sent.edit.rank! > "a5" && sent.edit.rank! < "a6").toBe(true);
      expect(Object.keys(sent.edit).sort()).toEqual(["rank", "status"]);

      // Both halves come back, and the rank it never had is cleared rather
      // than invented.
      vi.mocked(api.editTicket).mockResolvedValue(
        written("LC-1", { rank: "a0" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(2));
      expect(api.editTicket).toHaveBeenLastCalledWith({
        projectId: project.id,
        ticketKey: "LC-1",
        expectedHash: "hash-LC-1-written",
        edit: { status: "todo", rank: "a0" },
      });
    });

    it("moves the card before the write leaves, and puts it back if it fails", async () => {
      vi.mocked(api.editTicket).mockRejectedValue({
        code: "io",
        message: "Disk is full",
        recoverable: true,
      });
      await openBoard([row("LC-1"), row("LC-2")]);

      dropAt("LC-2", 0, "In Progress");

      expect(columnHolding("LC-2")).toContain("In Progress");
      await screen.findByText(
        "LC-2 could not be moved. Disk is full. The file was left as it was.",
      );
      expect(columnHolding("LC-2")).toContain("Todo");
    });

    it("writes the same move when the drag happened on the list", async () => {
      // The two surfaces are one write path, and the list had no drag at all
      // until LC-60. Dropped into another group, it says exactly what the
      // board says for the same gesture.
      vi.mocked(api.editTicket).mockResolvedValue(
        written("LC-2", { status: "done" }),
      );
      await openBoard([row("LC-1"), row("LC-2", { status: "done" })]);
      fireEvent.click(screen.getByRole("button", { name: "List" }));

      const scroller = document.querySelector<HTMLElement>(".issue-list")!;
      scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
      fireEvent.dragStart(
        document.querySelector<HTMLElement>('[data-ticket-key="LC-1"]')!,
      );
      // Every status opens up while a drag is in flight, so the groups above
      // Done are Backlog (44), Todo's header and row (33 + 49), In Progress
      // (44) and In Review (44): the Done header band starts at 214.
      const onDoneHeader = 220;
      for (const type of ["dragOver", "drop"] as const) {
        const event = createEvent[type](scroller);
        Object.defineProperty(event, "clientY", { value: onDoneHeader });
        fireEvent(scroller, event);
      }

      await waitFor(() => expect(api.editTicket).toHaveBeenCalledTimes(1));
      expect(api.editTicket).toHaveBeenCalledWith({
        projectId: project.id,
        ticketKey: "LC-1",
        expectedHash: "hash-LC-1",
        edit: { status: "done" },
      });
      await screen.findByText("LC-1 → Done");
    });
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
    await screen.findByRole("button", { name: "Board", pressed: true });
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

  it("keeps the OS off the filter field (LC-90)", async () => {
    await openBoard();

    // A native autofill popover under a local-first app's filter is off-brand
    // and a small privacy surprise: WebKit offers saved values for a field it
    // recognizes, so the field says it is not one.
    expect(field().getAttribute("autocomplete")).toBe("off");
    expect(field().getAttribute("autocorrect")).toBe("off");
    expect(field().getAttribute("spellcheck")).toBe("false");
    // `name` is the half `autocomplete="off"` alone does not settle — WebKit
    // heuristics read it — so it is one no password manager or address book
    // has a value for.
    expect(field().getAttribute("name")).toBe("longclaw-filter");
  });

  it("centres the no-match state instead of framing it (LC-91)", async () => {
    await openBoard();

    type("nothing here");

    // The prototype's state panel is centred in the board region with no
    // container of its own (prototype.css § state-panel); the frame it wore
    // here spanned the content width and sat at the top. This is the half a
    // test can hold: the workspace becomes the column the panel is centred in,
    // and the panel is what stands in it. The declarations themselves are
    // `scripts/state-panel-guard.mjs` — jsdom loads no stylesheet, so a
    // returning frame is invisible from here.
    const workspace = document.querySelector(".workspace.workspace-state");
    expect(workspace).toBeTruthy();
    expect(workspace?.contains(noMatch())).toBe(true);
  });

  it("keeps the empty-project state out of the centred column (LC-91)", async () => {
    // A project with no tickets is the empty-project state whatever is in the
    // field, and that state stands inside the board rather than instead of it
    // (LC-86): the class that centres a state panel must not follow the query
    // into it, and neither must the scaffold's stand-down.
    await openBoard([]);

    type("nothing here");

    expect(document.querySelector(".workspace.workspace-state")).toBeNull();
    expect(screen.queryByRole("status", { name: "No matches" })).toBeNull();
    expect(document.querySelector(".guide-card")).toBeTruthy();
    expect(document.querySelectorAll(".board-column").length).toBeGreaterThan(
      1,
    );
  });

  it("quotes the echoed query so an empty-looking one is visible (LC-92)", async () => {
    await openBoard();

    type("  zzzz  ");

    // Unquoted, a query that is all spaces — or one wearing them — echoes back
    // as nothing at all.
    expect(noMatch().textContent).toContain("“  zzzz  ”");
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

  it("persists the query only as app preference state", async () => {
    await openBoard();

    type("recovery");

    await waitFor(() =>
      expect(devicePreferences.projectWorkspaces).toEqual({
        "project-fixture": { filterQuery: "recovery" },
      }),
    );
    expect(api.editTicket).not.toHaveBeenCalled();
    expect(api.createTicket).not.toHaveBeenCalled();
    expect(api.updateProjectName).not.toHaveBeenCalled();
    expect(api.updateProjectTheme).not.toHaveBeenCalled();
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

describe("project-scoped workspace restoration (LC-49)", () => {
  const projectA = {
    id: "project-a",
    name: "Project A",
    rootPath: "/tmp/LongClaw A",
    key: "LA",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };
  const projectB = {
    ...projectA,
    id: "project-b",
    name: "Project B",
    rootPath: "/tmp/LongClaw B",
    key: "LB",
    theme: "clay",
  };

  beforeEach(() => {
    vi.mocked(api.listProjects).mockResolvedValue([projectA, projectB]);
    vi.mocked(api.openProject).mockImplementation(async (projectId) => ({
      project: projectId === projectB.id ? projectB : projectA,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    }));
  });

  function resetSessionStore() {
    useLongClawStore.setState({
      projects: [],
      activeProjectId: undefined,
      tickets: [],
      generation: 0,
      lastSequence: 0,
      lastEvent: undefined,
      externalMarks: {},
      loading: false,
      reconciling: false,
      error: undefined,
    });
  }

  const filter = () =>
    screen.getByRole("textbox", { name: "Filter tickets" }) as HTMLInputElement;

  function chooseOrdering(name: "Priority" | "Manual") {
    fireEvent.click(screen.getByRole("button", { name: /^Order:/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name }));
  }

  it("reopens the project that was active before restart", async () => {
    const firstLaunch = render(<App />);
    await screen.findByRole("heading", { name: "Project A" });

    fireEvent.click(screen.getByRole("button", { name: "Project B" }));
    await screen.findByRole("heading", { name: "Project B" });

    firstLaunch.unmount();
    resetSessionStore();
    await relaunch();
    vi.mocked(api.openProject).mockClear();

    render(<App />);

    await screen.findByRole("heading", { name: "Project B" });
    expect(api.openProject).toHaveBeenCalledWith(projectB.id);
    expect(api.openProject).not.toHaveBeenCalledWith(projectA.id);
  });

  it("restores each project's workspace when switching between them", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Project A" });

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    chooseOrdering("Manual");
    fireEvent.change(filter(), { target: { value: "alpha" } });

    fireEvent.click(screen.getByRole("button", { name: "Project B" }));
    await screen.findByRole("heading", { name: "Project B" });
    expect(
      screen.getByRole("button", { name: "Board", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Order: Priority" }),
    ).toBeTruthy();
    expect(filter().value).toBe("");

    fireEvent.change(filter(), { target: { value: "beta" } });
    fireEvent.click(screen.getByRole("button", { name: "Project A" }));
    await screen.findByRole("heading", { name: "Project A" });

    expect(
      screen.getByRole("button", { name: "List", pressed: true }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Order: Manual" })).toBeTruthy();
    expect(filter().value).toBe("alpha");
  });

  it("restores both projects' complete workspaces after restart", async () => {
    const firstLaunch = render(<App />);
    await screen.findByRole("heading", { name: "Project A" });

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    chooseOrdering("Manual");
    fireEvent.change(filter(), { target: { value: "alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Project B" }));
    await screen.findByRole("heading", { name: "Project B" });
    fireEvent.change(filter(), { target: { value: "beta" } });
    fireEvent.click(screen.getByRole("button", { name: "Project A" }));
    await screen.findByRole("heading", { name: "Project A" });

    firstLaunch.unmount();
    resetSessionStore();
    await relaunch();

    render(<App />);
    await screen.findByRole("heading", { name: "Project A" });
    expect(
      screen.getByRole("button", { name: "List", pressed: true }),
    ).toBeTruthy();
    await screen.findByRole("button", { name: "Order: Manual" });
    expect(filter().value).toBe("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Project B" }));
    await screen.findByRole("heading", { name: "Project B" });
    expect(
      screen.getByRole("button", { name: "Board", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Order: Priority" }),
    ).toBeTruthy();
    expect(filter().value).toBe("beta");
  });

  it("falls back safely when saved project and workspace values are malformed or stale", async () => {
    // A document from another build, or from somebody's editor: the file is
    // Rust's to keep and nobody's to validate but this build (LC-150).
    devicePreferences = {
      activeProjectId: projectB.id,
      projectWorkspaces: {
        [projectA.id]: {
          view: "grid",
          ordering: "new-ordering-from-the-future",
          filterQuery: 42,
        },
      },
    };
    await relaunch();
    vi.mocked(api.listProjects).mockResolvedValue([
      projectA,
      { ...projectB, reachable: false },
    ]);

    render(<App />);

    await screen.findByRole("heading", { name: "Project A" });
    expect(api.openProject).toHaveBeenCalledWith(projectA.id);
    expect(api.openProject).not.toHaveBeenCalledWith(projectB.id);
    expect(
      screen.getByRole("button", { name: "Board", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Order: Priority" }),
    ).toBeTruthy();
    expect(filter().value).toBe("");
    expect(api.updateProjectName).not.toHaveBeenCalled();
    expect(api.updateProjectTheme).not.toHaveBeenCalled();
    expect(api.editTicket).not.toHaveBeenCalled();
  });

  it("falls back when the remembered project is no longer registered", async () => {
    devicePreferences = { activeProjectId: "project-that-was-removed" };
    await relaunch();

    render(<App />);

    await screen.findByRole("heading", { name: "Project A" });
    expect(api.openProject).toHaveBeenCalledWith(projectA.id);
    expect(api.openProject).not.toHaveBeenCalledWith(
      "project-that-was-removed",
    );
  });
});

describe("the side panel against its spec (Step 16a)", () => {
  const reachable = {
    id: "project-a",
    name: "Reachable Project",
    rootPath: "/tmp/LongClaw A",
    key: "LA",
    theme: "plum",
    starred: true,
    reachable: true,
    labels: {},
  };

  const unreachable = {
    id: "project-b",
    name: "Moved Project",
    rootPath: "/tmp/LongClaw B",
    key: "LB",
    theme: "clay",
    starred: false,
    reachable: false,
    labels: {},
  };

  /**
   * A starred project appears in both sections, so every assertion here is
   * scoped to Local — which lists every project exactly once.
   */
  function localSection() {
    return [...document.querySelectorAll<HTMLElement>(".project-section")].find(
      (section) => section.querySelector("h2")?.textContent === "Local",
    )!;
  }

  async function renderPanel() {
    vi.mocked(api.listProjects).mockResolvedValue([reachable, unreachable]);
    render(<App />);
    await screen.findAllByText("Reachable Project");
  }

  it("scopes each theme dot to that project's own preset", async () => {
    await renderPanel();

    // The accent blocks are compound — `[data-theme][data-lc-theme]`
    // (`design-tokens.css:294+`) — so a dot needs **both** axes or it matches no
    // block and silently inherits the active project's accent, which looks
    // exactly like working until two projects differ. Asserting `data-lc-theme`
    // alone would pass on the broken version, so this asserts the pair.
    const dots = [
      ...localSection().querySelectorAll<HTMLElement>(".theme-dot"),
    ];
    expect(dots.map((dot) => dot.dataset.lcTheme)).toEqual(["plum"]);
    for (const dot of dots) {
      expect(dot.dataset.theme).toBe(document.documentElement.dataset.theme);
      expect(dot.dataset.theme).toBeTruthy();
    }
  });

  it("marks an unreachable project without hiding or disabling it", async () => {
    await renderPanel();

    // The row keeps its place and stays clickable (`screen-specs.md:60-62`):
    // relocating a project starts by opening it.
    const link = [
      ...localSection().querySelectorAll<HTMLElement>(".project-link"),
    ].find((element) => element.textContent?.includes("Moved Project"))!;
    expect(link.className).toContain("unreachable");
    expect(link.hasAttribute("disabled")).toBe(false);

    // Marked in words as well as by the glyph, and it never wears a theme dot:
    // a folder that cannot be read cannot vouch for its own preset.
    expect(link.querySelector(".theme-dot")).toBeNull();
    // Real text rather than an `aria-label` on a bare span, which is not
    // reliably exposed: the row's accessible name has to say the word.
    expect(link.textContent).toContain("Unreachable");
    expect(
      link.querySelector(".project-warn")?.getAttribute("aria-hidden"),
    ).toBe("true");

    // Clicking it selects it and lands on the recovery panel, and it does try
    // the folder on the way: the flag is the last read's answer rather than a
    // property of the project, so opening it is how a folder that came back is
    // noticed (LC-141).
    vi.mocked(api.openProject).mockRejectedValue({
      code: "project_unavailable",
      message: "The selected project folder is no longer available",
      recoverable: true,
    });
    fireEvent.click(link);
    expect(await screen.findByText("Folder not found")).toBeDefined();
    expect(api.openProject).toHaveBeenCalledWith(unreachable.id);
  });

  /**
   * The star is a mark rather than a toggle since LC-208 — starring moved into
   * the row's own `⋮` menu, where it can be named for what it does — so what
   * the row owes is the same persistence in a different shape: a starred row
   * shows the mark whether or not the pointer is on it, and an unstarred one
   * shows nothing rather than a hollow `☆` waiting to be pressed.
   */
  it("keeps a starred project's star visible when the row is not hovered", async () => {
    await renderPanel();

    const link = (name: string) =>
      [...localSection().querySelectorAll<HTMLElement>(".project-link")].find(
        (element) => element.textContent?.includes(name),
      )!;

    expect(link("Reachable Project").querySelector(".star-mark")).toBeTruthy();
    // Said in words too: the mark is a glyph, and a glyph is never the only
    // channel.
    expect(link("Reachable Project").textContent).toContain("Starred");
    expect(link("Moved Project").querySelector(".star-mark")).toBeNull();
  });

  /**
   * The `⋮` the ticket asks for, on every row of both sections (LC-208). It is
   * a sibling of the row rather than a child, so the row's accessible name is
   * still the project's name and nothing else.
   */
  it("gives every project row a menu that does not rename it", async () => {
    await renderPanel();

    const menu = within(localSection()).getByRole("button", {
      name: "Reachable Project menu",
    });
    expect(menu.getAttribute("aria-haspopup")).toBe("menu");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    // The row still announces itself as the project and nothing else — no
    // trace of the button beside it, which is what nesting the `⋮` inside it
    // would have cost.
    const row = [
      ...localSection().querySelectorAll<HTMLElement>(".project-link"),
    ].find((element) => element.textContent?.includes("Reachable Project"))!;
    expect(row.textContent).not.toContain("menu");

    fireEvent.click(menu);

    expect(menu.getAttribute("aria-expanded")).toBe("true");
    const popover = screen.getByRole("menu", { name: "Project menu" });
    expect(
      within(popover).getByRole("menuitem", { name: /Unstar project/ }),
    ).toBeTruthy();
  });

  /**
   * The `⋮` is a toggle, as the gear is.
   *
   * Click-away runs on `mousedown` and excludes the anchor (`popover.ts`), so a
   * `⋮` whose handler only ever *opened* could not be closed by pressing it
   * again: the dismissal never fired, and the handler re-set the state it was
   * already in. `SettingsMenu.test.tsx` asserts the toggle against a harness
   * that implements one, so only the shell can see this.
   */
  it("closes the row's menu when its own ⋮ is pressed a second time", async () => {
    await renderPanel();

    const kebab = within(localSection()).getByRole("button", {
      name: "Reachable Project menu",
    });
    const press = () => {
      fireEvent.mouseDown(kebab);
      fireEvent.mouseUp(kebab);
      fireEvent.click(kebab);
    };

    press();
    expect(screen.getByRole("menu", { name: "Project menu" })).toBeTruthy();

    press();
    expect(screen.queryByRole("menu", { name: "Project menu" })).toBeNull();
    expect(kebab.getAttribute("aria-expanded")).toBe("false");
  });

  /**
   * The theme rows deliberately leave the menu up — trying presets against the
   * board behind it is the whole reason they are in a menu — so the menu has
   * to read the project as the store holds it *now*, not as it was when the
   * `⋮` was pressed. Against a snapshot the check stays on the preset you just
   * replaced, and the row that restyles a project without opening it is the
   * one surface with no other way to see that the write took.
   */
  it("keeps the open menu reading the project its own writes changed", async () => {
    await renderPanel();
    vi.mocked(api.updateProjectTheme).mockResolvedValue({
      ...reachable,
      theme: "clay",
    });

    fireEvent.click(
      within(localSection()).getByRole("button", {
        name: "Reachable Project menu",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("menu", { name: "Project menu" })).getByRole(
        "menuitem",
        { name: /Theme/ },
      ),
    );
    const preset = (name: string) =>
      within(screen.getByRole("menu", { name: "Theme" })).getByRole(
        "menuitemradio",
        { name },
      );
    // `reachable` is a plum project, so the check starts there.
    expect(preset("Plum").getAttribute("aria-checked")).toBe("true");

    fireEvent.click(preset("Clay"));

    await waitFor(() =>
      expect(api.updateProjectTheme).toHaveBeenCalledWith(reachable.id, "clay"),
    );
    // Still up, with the check where the write put it.
    await waitFor(() =>
      expect(preset("Clay").getAttribute("aria-checked")).toBe("true"),
    );
    expect(preset("Plum").getAttribute("aria-checked")).toBe("false");
  });

  /**
   * Removing a project that is **not** the open one is a change to the sidebar
   * and nothing else (LC-208). The removal path was written when settings was
   * the only place that offered it, so it closed settings and sent focus to
   * the welcome screen's first button — neither of which is on screen when the
   * board of a different project is still up, which left focus on `<body>`.
   */
  it("removing another project from its ⋮ leaves the open board alone", async () => {
    await renderPanel();
    vi.mocked(api.removeProject).mockResolvedValue(undefined);
    // `unreachable` ("Moved Project") is not the project the shell opened.
    fireEvent.click(
      within(localSection()).getByRole("button", {
        name: "Moved Project menu",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Remove from app/ }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: /Moved Project/ }),
      ).getByRole("button", { name: "Remove from app" }),
    );

    await waitFor(() =>
      expect(api.removeProject).toHaveBeenCalledWith(unreachable.id),
    );
    // The row is gone and the one that was open is still listed.
    await waitFor(() =>
      expect(within(localSection()).queryByText("Moved Project")).toBeNull(),
    );
    expect(within(localSection()).getByText("Reachable Project")).toBeTruthy();
    // No welcome screen: there is still a project open behind all this.
    expect(document.querySelector(".welcome-actions")).toBeNull();
    // And focus is somewhere a keyboard can carry on from.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  });
});

describe("the app shell against its spec (LC-71, LC-72, LC-73)", () => {
  const project = {
    id: "project-a",
    name: "Shell Project",
    rootPath: "/tmp/LongClaw A",
    key: "LA",
    theme: "plum",
    starred: false,
    reachable: true,
    labels: {},
  };

  function row(key: string, title: string): TicketRow {
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
    };
  }

  // One ticket, so the header's controls are the only ones on screen and every
  // assertion below names exactly one element.
  const SEED = [row("LA-1", "Atomic replace race")];

  async function openBoard() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: SEED,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  describe("keyboard chips (LC-71)", () => {
    it("puts a C chip on New ticket and a ⌘F chip on the filter field", async () => {
      await openBoard();

      const newTicket = screen.getByRole("button", { name: "New ticket" });
      expect(newTicket.querySelector("kbd")?.textContent).toBe("C");
      expect(
        document.querySelector(".filter-wrap .filter-kbd")?.textContent,
      ).toBe("⌘F");
    });

    it("keeps both accessible names free of the shortcut text", async () => {
      await openBoard();

      // `getByRole` matches on the accessible name, so an unhidden chip would
      // make these "New ticket C" and "Filter tickets ⌘F" — the shortcut read
      // aloud as part of the label. The chip is decorative; `aria-keyshortcuts`
      // is where the shortcut is announced.
      const newTicket = screen.getByRole("button", { name: "New ticket" });
      const filter = screen.getByRole("textbox", { name: "Filter tickets" });
      expect(newTicket.getAttribute("aria-keyshortcuts")).toBe("C");
      expect(filter.getAttribute("aria-keyshortcuts")).toBe("Meta+F");
    });

    it("still lets ⌘F reach the input through the new wrapper", async () => {
      // The chip needed a positioned wrapper around the input, and the `⌘F`
      // handler focuses through a ref. This asserts the wrapper did not come
      // between the two. It does not cover the chip's `pointer-events: none` —
      // jsdom has no hit testing, so a chip that swallowed pointer input would
      // still pass here and only show up under a real click.
      await openBoard();
      const filter = screen.getByRole("textbox", {
        name: "Filter tickets",
      }) as HTMLInputElement;

      fireEvent.keyDown(document, { key: "f", metaKey: true });

      expect(document.activeElement).toBe(filter);
    });
  });

  describe("sidebar footer (LC-72)", () => {
    it("has no appearance select — appearance is not project chrome", async () => {
      await openBoard();

      // The one piece of OS chrome left in the sidebar. It moves to project
      // settings as a 3-up segment (LC-127); the palette command reaches the
      // preference until then.
      expect(screen.queryByLabelText("Appearance")).toBeNull();
      expect(document.querySelector(".side-panel-footer select")).toBeNull();
    });

    it("is the trust line and nothing else", async () => {
      await openBoard();

      // `toBe`, not `toContain`. The spec draws a waitlist ghost button beneath
      // this line, and LC-75 closed that as **cut from v0** on 2026-08-06 — so
      // the footer's exact text is now a decision worth pinning rather than an
      // open question to leave room for. Re-opening it means unparking Step 15
      // and reviewing a submission endpoint (V0-38) first; this assertion is
      // meant to be in the way until then.
      const footer = document.querySelector(".side-panel-footer")!;
      expect(footer.textContent).toBe("v0 · local · no account");
    });

    it("offers no waitlist signup", async () => {
      await openBoard();

      // Not a network assertion — jsdom cannot make one, and `audit:network` is
      // a process-monitor pass over a real bundle that needs a human to drive
      // it. This only catches the control coming back, which is worth catching:
      // the comparison plan carried a live "Step 7: Implement The Required
      // Waitlist Flow" — endpoint client, `localStorage`, the lot — until LC-75
      // voided it; the document holding it was deleted 2026-08-07. This fails
      // fast if someone works from a stale copy of it.
      expect(
        screen.queryByRole("button", { name: /early access|waitlist/i }),
      ).toBeNull();
    });
  });

  /**
   * These pin the sidebar the spec now draws, not a fallback: the actions live
   * above the sections by founder decision of 2026-08-06, and `screen-specs.md`
   * § App shell was amended to match rather than the other way round (LC-73).
   *
   * What they guard is the *hierarchy*, which is the whole reason this position
   * is not the one D-0B flagged. Two controls of equal weight above the rows is
   * the regression; a `secondary` CTA over a quiet `ghost` is not.
   */
  describe("sidebar project actions", () => {
    it("puts them above the project sections, under the lockup", async () => {
      await openBoard();

      const panel = document.querySelector(".side-panel")!;
      const kinds = [...panel.children].map((child) =>
        child.classList.contains("project-actions")
          ? "actions"
          : child.classList.contains("brand-lockup")
            ? "lockup"
            : child.classList.contains("project-nav")
              ? "nav"
              : "other",
      );
      // Lockup, then the actions, then the list. `.project-nav` has no
      // `overflow-y`, so at the foot these leave the viewport once the project
      // list is long enough — that is what this ordering exists to prevent.
      expect(kinds.slice(0, 3)).toEqual(["lockup", "actions", "nav"]);
    });

    it("leads with a secondary create CTA over a quieter ghost, never two of equal weight", async () => {
      await openBoard();

      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".project-actions > button",
        ),
      ];
      expect(buttons.map((button) => button.textContent)).toEqual([
        "Create project",
        "Open folder",
      ]);
      const [create, open] = buttons;
      expect(create.className).toContain("secondary");
      expect(open.className).toContain("ghost");
      // The one filled accent on screen stays `New ticket` (`components.md:51`).
      for (const button of buttons) {
        expect(button.className).not.toContain("primary");
      }
    });

    it("still opens a folder and still opens the create form", async () => {
      // `Welcome` renders only with no project open (`App.tsx:1102`), so with
      // one open these are the only way to add a second. Restyling them must
      // not disarm them.
      vi.mocked(api.chooseOpenFolder).mockResolvedValue(null);
      await openBoard();

      fireEvent.click(screen.getByText("Open folder"));
      expect(api.chooseOpenFolder).toHaveBeenCalled();

      fireEvent.click(screen.getByText("Create project"));
      expect(await screen.findByText("Choose folder")).toBeTruthy();
    });

    it("falls through to its own create form when the folder is a plain one (LC-170)", async () => {
      // The sidebar runs the create flow the other way round — form first,
      // folder at submit — so `Open folder` cannot hand a plain folder to
      // `Welcome`'s second step. It hands it to this panel instead, which is
      // the same form, and the submit stops promising a picker that has
      // already run.
      vi.mocked(api.chooseOpenFolder).mockResolvedValue("/Users/dev/my-app");
      await openBoard();

      fireEvent.click(screen.getByText("Open folder"));

      const form = await waitFor(() => {
        const found =
          document.querySelector<HTMLFormElement>("form.quick-create");
        if (!found) throw new Error("quick create should be open");
        return found;
      });
      // The submit, not the sidebar button of the same name above it.
      const submit = within(form).getByRole("button", {
        name: "Create project",
      });
      expect(document.querySelector(".picked-path")?.textContent).toBe(
        "/Users/dev/my-app/.longclaw",
      );
      expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
        "my-app",
      );
      expect(screen.queryByText("Choose folder")).toBeNull();

      fireEvent.click(submit);
      await waitFor(() =>
        expect(api.createProjectInFolder).toHaveBeenCalledWith(
          "/Users/dev/my-app",
          { name: "my-app", key: "MA", theme: "indigo" },
        ),
      );
      // The folder was answered by the picker, so this flow must not open a
      // second one at submit.
      expect(api.chooseProjectFolder).not.toHaveBeenCalled();
    });

    it("opens an initialised folder picked at the end of quick create (LC-170)", async () => {
      // This surface asks the three questions *before* the folder, so the
      // refusal LC-170 was filed over lands here too — same wasted answers,
      // reached in the other order. The picker's branch is the folder's to
      // decide on this path as well: `screen-specs.md:99-101` puts it on the
      // picker, not on the screen that opened it.
      const existing = {
        id: "project-existing",
        name: "Orbit",
        rootPath: "/Users/dev/orbit",
        key: "ORB",
        theme: "slate",
        starred: false,
        reachable: true,
        labels: {},
      };
      vi.mocked(api.chooseProjectFolder).mockResolvedValue("/Users/dev/orbit");
      vi.mocked(api.folderHoldsProject).mockResolvedValue(true);
      vi.mocked(api.registerProject).mockResolvedValue(existing);
      vi.mocked(api.openProject).mockResolvedValue({
        project: existing,
        tickets: [],
        generation: 1,
        rebuiltInMs: 1,
        sequence: 1,
      });
      await openBoard();

      fireEvent.click(screen.getByText("Create project"));
      fireEvent.click(await screen.findByText("Choose folder"));

      await waitFor(() =>
        expect(api.registerProject).toHaveBeenCalledWith("/Users/dev/orbit"),
      );
      expect(api.createProjectInFolder).not.toHaveBeenCalled();
      // The panel closes on the way to the project it opened.
      await waitFor(() =>
        expect(document.querySelector("form.quick-create")).toBeNull(),
      );
    });
  });
});

/**
 * The folder-missing state, against `states.md:80-98` (LC-139 … LC-145).
 *
 * Every one of these was reproduced by renaming a project directory out from
 * under the running app. What the screen did then was: nothing at all, until an
 * index rebuild was forced — and once it did notice, it said the state twice,
 * named the registry rather than the folder, drew the recovery as the loud
 * button and the removal as a one-click danger, and let quick create open over
 * the top of it offering `LC-1`.
 */
describe("a project folder that cannot be reached (LC-139 … LC-145)", () => {
  const project = {
    id: "project-away",
    name: "Away Project",
    rootPath: "/Volumes/external/away",
    key: "AW",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };
  const unreachable = { ...project, reachable: false };

  function row(key: string, title: string): TicketRow {
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
    };
  }

  const SEED = [row("AW-1", "Cached row")];

  /** The app at launch, with the folder already gone. */
  async function openMissing() {
    vi.mocked(api.listProjects).mockResolvedValue([unreachable]);
    render(<App />);
    return screen.findByText("Folder not found");
  }

  /** The app on a live board, with a handle on the event stream. */
  async function openBoard() {
    let emit: ((event: StreamEnvelope) => void) | undefined;
    vi.mocked(api.listenForProjectEvents).mockImplementation((handler) => {
      emit = handler;
      return Promise.resolve(() => {});
    });
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: SEED,
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByText("Cached row");
    return (event: StreamEnvelope) => act(() => emit?.(event));
  }

  const WENT_AWAY: StreamEnvelope = {
    contractVersion: 1,
    sequence: 2,
    projectId: project.id,
    emittedAt: "2026-08-07T09:00:00Z",
    event: {
      type: "projectUnavailable",
      data: { rootPath: project.rootPath },
    },
  };

  /**
   * LC-139 / D-55. The watcher's signal alone has to raise the state:
   * `states.md:96` forbids showing cached tickets as if they were live, and this
   * is the only thing standing between a moved folder and a board that goes on
   * drawing rows nobody can save to.
   */
  it("stops showing cached rows the moment the watcher says the folder is gone", async () => {
    const emit = await openBoard();

    emit(WENT_AWAY);

    expect(await screen.findByText("Folder not found")).toBeTruthy();
    expect(screen.queryByText("Cached row")).toBeNull();
  });

  /** LC-139, the same trigger arriving as a failed read instead. */
  it("raises the state when a reconcile comes back unreadable", async () => {
    const emit = await openBoard();
    void emit;
    vi.mocked(api.reconcileProject).mockRejectedValue({
      code: "project_unavailable",
      message: "The selected project folder is no longer available",
      recoverable: true,
    });

    fireEvent(window, new Event("focus"));

    expect(await screen.findByText("Folder not found")).toBeTruthy();
    expect(screen.queryByText("Cached row")).toBeNull();
  });

  /**
   * LC-141. The flag is the last read's answer, not a property of the project,
   * so coming back to the window re-asks the registry — and a folder that has
   * been remounted opens.
   */
  it("recovers on its own when the folder comes back", async () => {
    await openMissing();
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: SEED,
      generation: 2,
      rebuiltInMs: 1,
      sequence: 3,
    });

    fireEvent(window, new Event("focus"));

    expect(await screen.findByText("Cached row")).toBeTruthy();
    expect(screen.queryByText("Folder not found")).toBeNull();
  });

  /** LC-142 / D-59. One centered panel, not a panel under a banner. */
  it("says it once", async () => {
    await openMissing();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("Folder not found")).toHaveLength(1);
  });

  /** LC-143 / D-5A and LC-145 / D-5C: what the panel says, and what it drops. */
  it("names the state and the guarantee rather than the registry", async () => {
    const panel = (await openMissing()).closest(".unreachable-panel");

    expect(panel?.querySelector(".state-icon svg")).toBeTruthy();
    expect(panel?.textContent).toContain(project.rootPath);
    expect(panel?.textContent).toContain(
      "The project folder moved, or its disk isn’t mounted.",
    );
    expect(panel?.textContent).toContain(
      "LongClaw never deletes or rewrites them",
    );
    expect(panel?.textContent).not.toContain("UNREACHABLE");
    expect(panel?.textContent).not.toContain("registry");
  });

  /** LC-144 / D-5B. The recovery is the quiet button; the removal asks first. */
  it("demotes Locate and puts Remove behind a confirm", async () => {
    await openMissing();

    const locate = screen.getByRole("button", { name: "Locate folder…" });
    expect(locate.className).toContain("secondary");
    expect(locate.className).not.toContain("primary");

    const remove = screen.getByRole("button", { name: "Remove from app" });
    expect(remove.className).toContain("ghost");

    fireEvent.click(remove);
    const dialog = await screen.findByRole("dialog", {
      name: `Remove “${project.name}” from LongClaw?`,
    });
    expect(dialog.textContent).toContain(project.rootPath);
    expect(dialog.textContent).toContain("stay on disk, untouched");
    expect(api.removeProject).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.removeProject).not.toHaveBeenCalled();
  });

  it("removes the reference only once the confirm is answered", async () => {
    vi.mocked(api.removeProject).mockResolvedValue(undefined);
    await openMissing();

    fireEvent.click(screen.getByRole("button", { name: "Remove from app" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from app" }),
    );

    await waitFor(() =>
      expect(api.removeProject).toHaveBeenCalledWith(project.id),
    );
  });

  /**
   * LC-140 / D-57. Quick create opened over the unreachable screen and offered
   * `LC-1` as the next key, because the key is guessed from the rows on screen
   * and there are none — a collision waiting for the folder to come back.
   */
  it("creates nothing while the folder is gone", async () => {
    await openMissing();

    fireEvent.keyDown(document, { key: "c" });

    expect(screen.queryByLabelText("Create a ticket")).toBeNull();
    expect(screen.queryByText(/AW-1/)).toBeNull();
  });

  it("takes a create surface down with the folder", async () => {
    const emit = await openBoard();
    fireEvent.keyDown(document, { key: "c" });
    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();

    emit(WENT_AWAY);

    expect(await screen.findByText("Folder not found")).toBeTruthy();
    expect(screen.queryByLabelText("Create a ticket")).toBeNull();
  });
});

/**
 * The empty project (LC-86 … LC-89), which the spec is more explicit about than
 * any other state: the app never hides the workspace. It used to — one
 * full-width dashed panel replaced the board, columns and all.
 */
describe("a project with no tickets (LC-86 … LC-89)", () => {
  const project: ProjectReference = {
    id: "project-new",
    name: "New Project",
    rootPath: "/Users/dev/code/new-project",
    key: "NP",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  async function openEmpty() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  const guide = () =>
    document.querySelector<HTMLElement>(".guide-card") ?? undefined;

  const toggleTo = (view: "Board" | "List") =>
    fireEvent.click(screen.getByRole("button", { name: view }));

  it("must-pass: keeps the board mounted and puts the guide in Todo (LC-86)", async () => {
    await openEmpty();

    // The scaffold is the state: every column of the fixed set (ADR 0002), and
    // the guide as Todo's only child rather than in place of the whole board.
    const columns = Array.from(
      document.querySelectorAll<HTMLElement>(".board-column h3"),
    ).map((heading) => heading.textContent);
    expect(columns).toEqual([
      "Backlog0",
      "Todo0",
      "In Progress0",
      "In Review0",
      "Done0",
      "Canceled0",
    ]);
    const todo = screen
      .getByRole("heading", { name: /^Todo/ })
      .closest(".board-column");
    expect(todo?.contains(guide() as Node)).toBe(true);
  });

  it("gives the guide a C chip instead of a button of its own (LC-87)", async () => {
    await openEmpty();

    expect(guide()?.querySelector("kbd")?.textContent).toBe("C");
    // The header's `New ticket` is the only one on screen — the guide used to
    // put a second filled accent two rows under it.
    expect(screen.getAllByRole("button", { name: "New ticket" })).toHaveLength(
      1,
    );
    expect(guide()?.querySelector(".primary")).toBeNull();
  });

  it("names no path, so nothing wraps and no period is stranded (LC-88)", async () => {
    await openEmpty();

    expect(guide()?.textContent).toBe(
      "Create your first ticketTitle it, give it a checklist, point an agent at the folder.C",
    );
    // The path is in the header chip two rows up; printing it here wrapped it
    // over two lines and left the sentence's period alone on a third.
    expect(guide()?.textContent).not.toContain(project.rootPath);
  });

  it("puts the list's guide inside the list's own card frame (LC-89)", async () => {
    await openEmpty();

    toggleTo("List");

    const frame = document.querySelector(".issue-list .list-guide");
    expect(frame).toBeTruthy();
    expect(frame?.contains(guide() as Node)).toBe(true);
    // The list is still the surface it stands on, not something it replaced.
    expect(document.querySelector(".issue-list")).toBeTruthy();
  });

  it("opens quick create when the card is pressed", async () => {
    await openEmpty();

    fireEvent.click(guide() as HTMLElement);

    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();
    // Todo, which is the column it was standing in.
    expect(
      screen.getByRole("button", { name: /^Status:/ }).textContent,
    ).toContain("Todo");
  });

  it("stands down once the project has a ticket", async () => {
    await openEmpty();
    fireEvent.click(guide() as HTMLElement);

    const created: WriteResult = {
      ticket: {
        state: "indexed",
        key: "NP-1",
        id: "id-NP-1",
        title: "First one",
        status: "todo",
        priority: "none",
        labels: [],
        createdAt: "2026-08-07T09:00:00Z",
        updatedAt: "2026-08-07T09:00:00Z",
        checkedCount: 0,
        checklistCount: 0,
        commentCount: 0,
        attachmentCount: 0,
        contentHash: "hash-NP-1",
        relativePath: ".longclaw/tickets/NP-1/ticket.md",
      },
      generation: 2,
      changes: [],
    };
    vi.mocked(api.createTicket).mockResolvedValue(created);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "First one" },
    });
    fireEvent.submit(screen.getByLabelText("Title"));

    expect(await screen.findByText("First one")).toBeTruthy();
    expect(guide()).toBeUndefined();
  });
});

/**
 * LC-171. The palette opened at root, where the query filtered command labels,
 * so `LC-2` — the fastest thing anyone knows how to type — matched nothing and
 * the ticket was unreachable without first stepping into `Search tickets…`.
 *
 * Driven end to end here because the palette is handed the project's rows by
 * `App` and nothing else pins that wiring: a component test can prove the root
 * finds a key in the rows it is given, and only this level can show that the
 * rows it is given are the project's rather than the filtered surface's.
 */
describe("a ticket key typed at the palette root (LC-171)", () => {
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

  const found: IndexedTicket = {
    state: "indexed",
    key: "LC-2",
    id: "id-LC-2",
    title: "Watcher recovery",
    status: "todo",
    priority: "none",
    labels: [],
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-01T09:00:00Z",
    checkedCount: 0,
    checklistCount: 0,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: "hash-LC-2",
    relativePath: ".longclaw/tickets/LC-2/ticket.md",
  };

  async function openPalette() {
    vi.mocked(api.listProjects).mockResolvedValue([project]);
    vi.mocked(api.openProject).mockResolvedValue({
      project,
      tickets: [found],
      generation: 1,
      rebuiltInMs: 1,
      sequence: 1,
    });
    vi.mocked(api.readTicket).mockResolvedValue({
      key: found.key,
      relativePath: found.relativePath,
      contentHash: found.contentHash,
      byteLength: 300,
      readOnly: false,
      raw: "",
      rawTruncated: false,
      missingAttachments: [],
      orphanAttachments: [],
      ticket: {
        id: found.id,
        key: found.key,
        title: found.title,
        status: found.status,
        priority: found.priority,
        labels: [],
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
        description: "",
        checklist: [],
        attachments: [],
        activity: [],
        historyIncomplete: false,
        unknownKeys: [],
        recordDiagnostics: [],
      },
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    return (await screen.findByRole("combobox")) as HTMLInputElement;
  }

  it("opens the ticket, without a stop at the search sub-mode", async () => {
    const input = await openPalette();

    fireEvent.change(input, { target: { value: "lc-2" } });
    // The row is the answer to the key, so it is the one `Enter` lands on.
    const row = screen.getByRole("option", { name: /Watcher recovery/ });
    expect(screen.getAllByRole("option")[0]).toBe(row);
    fireEvent.keyDown(input, { key: "Enter" });

    await screen.findByRole("complementary", { name: "Ticket LC-2" });
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).toBeNull();
    // The rows were already here: the root never asked Rust for them.
    expect(api.searchTickets).not.toHaveBeenCalled();
  });

  it("takes a bare number as this project's ticket", async () => {
    const input = await openPalette();

    fireEvent.change(input, { target: { value: "2" } });

    expect(
      screen.getByRole("option", { name: /Watcher recovery/ }),
    ).toBeTruthy();
  });

  it("leaves a key of another project to the commands", async () => {
    const input = await openPalette();

    fireEvent.change(input, { target: { value: "AB-2" } });

    // The card behind the palette is still on the board; what must not exist
    // is a palette row offering it for a key this project cannot hold.
    expect(
      screen.queryAllByRole("option", { name: /Watcher recovery/ }),
    ).toHaveLength(0);
  });

  it("finds a ticket the surface behind it has filtered away", async () => {
    // The header filter narrows the board; the palette is handed the project's
    // rows rather than that narrowing, which is the whole point of a key.
    await openPalette();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.change(screen.getByRole("textbox", { name: "Filter tickets" }), {
      target: { value: "nothing matches this" },
    });
    expect(screen.queryByText("Watcher recovery")).toBeNull();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.change(await screen.findByRole("combobox"), {
      target: { value: "LC-2" },
    });

    expect(
      screen.getByRole("option", { name: /Watcher recovery/ }),
    ).toBeTruthy();
  });
});

describe("a project switch under an open editor (LC-188)", () => {
  const alpha = {
    id: "project-alpha",
    name: "Alpha",
    rootPath: "/tmp/LongClaw Alpha",
    key: "AL",
    theme: "indigo",
    starred: false,
    reachable: true,
    labels: {},
  };

  const bravo = {
    id: "project-bravo",
    name: "Bravo",
    rootPath: "/tmp/LongClaw Bravo",
    key: "BR",
    theme: "clay",
    starred: false,
    reachable: true,
    labels: {},
  };

  /** A ticket Bravo already holds, so `BR-1` is a key that is taken. */
  function bravoTicket(): IndexedTicket {
    return {
      state: "indexed",
      key: "BR-1",
      id: "019c9000",
      title: "Bravo already has this one",
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-08-01T09:00:00Z",
      updatedAt: "2026-08-01T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: "hash-br-1",
      relativePath: ".longclaw/tickets/BR-1/ticket.md",
    };
  }

  /** What Rust hands back for a create Bravo allocated `BR-2` for. */
  function createdInBravo(): WriteResult {
    return {
      ticket: {
        ...bravoTicket(),
        key: "BR-2",
        id: "019c9001",
        title: "Filed while the sidebar moved",
        contentHash: "hash-br-2",
        relativePath: ".longclaw/tickets/BR-2/ticket.md",
      },
      generation: 2,
      changes: [],
    };
  }

  function boardOf(project: ProjectReference, tickets: IndexedTicket[]) {
    return { project, tickets, generation: 1, rebuiltInMs: 1, sequence: 1 };
  }

  /**
   * Bravo's board answers when a test says so. Every case here turns on the
   * window between clicking a project and its rows arriving, so opening Bravo
   * is two steps rather than one resolved promise.
   */
  let answerBravo: () => void = () => {};

  async function openAlpha(alphaTickets: IndexedTicket[] = []) {
    vi.mocked(api.listProjects).mockResolvedValue([alpha, bravo]);
    vi.mocked(api.openProject).mockImplementation(async (projectId: string) => {
      if (projectId === alpha.id) return boardOf(alpha, alphaTickets);
      return new Promise((resolve) => {
        answerBravo = () => resolve(boardOf(bravo, [bravoTicket()]));
      });
    });
    render(<App />);
    await screen.findByRole("button", { name: "Board", pressed: true });
  }

  function projectLink(name: string) {
    return [...document.querySelectorAll<HTMLElement>(".project-link")].find(
      (link) => link.textContent?.includes(name),
    )!;
  }

  /** Quick create with a title in it, over whatever board is up. */
  function startDraft(title: string) {
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: title },
    });
  }

  function createButton() {
    return screen.getByRole("button", { name: "Create" });
  }

  /** The context line quick create carries: project, then the key it expects. */
  function contextLine() {
    return document.querySelector(".quick-create-context")!.textContent;
  }

  /** Draft in Alpha, switch to Bravo, let Bravo answer, then press Create. */
  async function draftThenSwitch() {
    await openAlpha();
    startDraft("Filed while the sidebar moved");
    fireEvent.click(projectLink("Bravo"));
    answerBravo();
    await screen.findByText("Bravo already has this one");
    fireEvent.click(createButton());
  }

  it("asks rather than filing the draft in whichever project is active", async () => {
    await draftThenSwitch();

    // Nothing is written on the way to the question: the report was a ticket
    // that appeared in a project the human was no longer looking at.
    expect(api.createTicket).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "The active project changed",
    });
    // Both projects are named. "Create it in the current one?" is not a
    // question anybody can answer without being told which one that is — and
    // the destination's folder and key are what make the answer checkable.
    expect(dialog.textContent).toContain("Alpha");
    expect(dialog.textContent).toContain("Bravo");
    expect(dialog.textContent).toContain("/tmp/LongClaw Bravo");
    expect(dialog.textContent).toContain("BR-2");
    // It asks where a write goes; it destroys nothing, so it is not the
    // danger button **Remove from app** wears.
    expect(
      screen.getByRole("button", { name: "Create in Bravo" }).className,
    ).toBe("primary");
  });

  it("creates in the project on screen once it is confirmed", async () => {
    vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
    await draftThenSwitch();

    fireEvent.click(screen.getByRole("button", { name: "Create in Bravo" }));

    expect(api.createTicket).toHaveBeenCalledWith({
      projectId: bravo.id,
      title: "Filed while the sidebar moved",
      description: "",
      status: "todo",
      priority: "none",
      labels: [],
    });
    // The optimistic card takes the next key rather than one that is taken:
    // `addProvisionalTicket` keys by key, so a guess of `BR-1` would have put
    // the new card in the seat of a ticket that is really on disk.
    expect(screen.getByText("Bravo already has this one")).toBeTruthy();
    expect(screen.getByText("Filed while the sidebar moved")).toBeTruthy();
  });

  it("cancels back to the draft, with nothing written", async () => {
    await draftThenSwitch();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.createTicket).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The surface is still up and still holding what was typed, which is the
    // point of asking rather than closing the create when the project moved.
    expect(screen.getByLabelText("Create a ticket")).toBeTruthy();
    expect(screen.getByLabelText("Title")).toHaveProperty(
      "value",
      "Filed while the sidebar moved",
    );
  });

  it("asks the same question from full create, and ends in the panel", async () => {
    vi.mocked(api.createTicket).mockResolvedValue(createdInBravo());
    vi.mocked(api.readTicket).mockReturnValue(new Promise(() => {}));
    await openAlpha();
    fireEvent.click(screen.getAllByText("New ticket")[0]);
    fireEvent.click(screen.getByText("Open full editor →"));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Filed while the sidebar moved" },
    });
    fireEvent.click(projectLink("Bravo"));
    answerBravo();
    await screen.findByText("Bravo already has this one");

    fireEvent.click(screen.getByText("Create ticket"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Create in Bravo" }),
    );

    expect(api.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: bravo.id }),
    );
    // Full create's ending survives the question it was held behind
    // (`screen-specs.md:270-271`): the panel opens on the ticket Rust keyed.
    await screen.findByRole("complementary", { name: "Ticket BR-2" });
    expect(api.readTicket).toHaveBeenCalledWith(bravo.id, "BR-2");
  });

  it("offers no key, and no create, while the project it switched to is opening", async () => {
    await openAlpha();
    startDraft("Filed while the sidebar moved");
    expect(contextLine()).toContain("Alpha · AL-1");

    fireEvent.click(projectLink("Bravo"));

    // `BR-1` is the guess off a board with no rows, and Bravo already holds
    // it. The surface says it does not know rather than naming it (LC-140).
    expect(contextLine()).toContain("Bravo · opening…");
    expect(contextLine()).not.toContain("BR-1");
    expect(createButton().hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByLabelText("Create a ticket"));
    expect(api.createTicket).not.toHaveBeenCalled();

    answerBravo();
    await screen.findByText("Bravo already has this one");

    expect(contextLine()).toContain("Bravo · BR-2");
    expect(createButton().hasAttribute("disabled")).toBe(false);
  });

  it("holds the same line for a re-open of the project already on screen", async () => {
    // No switch, so no question is owed — but the board is zeroed all the
    // same, and a create against it would guess a key Alpha has spent.
    let answerAlphaAgain: () => void = () => {};
    const alphaTicket: IndexedTicket = {
      ...bravoTicket(),
      key: "AL-1",
      title: "Alpha's own ticket",
      relativePath: ".longclaw/tickets/AL-1/ticket.md",
    };
    vi.mocked(api.listProjects).mockResolvedValue([alpha]);
    let opens = 0;
    vi.mocked(api.openProject).mockImplementation(async () => {
      opens += 1;
      if (opens === 1) return boardOf(alpha, [alphaTicket]);
      return new Promise((resolve) => {
        answerAlphaAgain = () => resolve(boardOf(alpha, [alphaTicket]));
      });
    });
    render(<App />);
    await screen.findByText("Alpha's own ticket");
    startDraft("An ordinary create");

    fireEvent.click(projectLink("Alpha"));

    expect(contextLine()).toContain("Alpha · opening…");
    expect(createButton().hasAttribute("disabled")).toBe(true);

    answerAlphaAgain();
    await screen.findByText("Alpha's own ticket");

    // And no dialog on the way through: the project never changed.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(contextLine()).toContain("Alpha · AL-2");
    expect(createButton().hasAttribute("disabled")).toBe(false);
  });

  it("asks nothing when the project never moved", async () => {
    vi.mocked(api.createTicket).mockReturnValue(new Promise(() => {}));
    await openAlpha();
    startDraft("An ordinary create");

    fireEvent.click(createButton());

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.createTicket).toHaveBeenCalledWith({
      projectId: alpha.id,
      title: "An ordinary create",
      description: "",
      status: "todo",
      priority: "none",
      labels: [],
    });
  });

  it("closes a ticket panel left open on the project being left", async () => {
    const alphaTicket: IndexedTicket = {
      ...bravoTicket(),
      key: "AL-1",
      title: "Alpha's own ticket",
      relativePath: ".longclaw/tickets/AL-1/ticket.md",
    };
    vi.mocked(api.readTicket).mockReturnValue(new Promise(() => {}));
    await openAlpha([alphaTicket]);
    fireEvent.click(await screen.findByText("Alpha's own ticket"));
    await screen.findByRole("complementary", { name: /^Ticket AL-1/ });

    fireEvent.click(projectLink("Bravo"));
    answerBravo();

    // A panel is open on a key, and `AL-1` is not a key Bravo can answer for.
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: /^Ticket / }),
      ).toBeNull(),
    );
    await screen.findByText("Bravo already has this one");
  });
});
