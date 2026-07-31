// @vitest-environment jsdom

/**
 * The panel's behaviour against a stubbed storage layer.
 *
 * These cover what the manual acceptance scenario can only assert with prose:
 * that the human's own tick is never dressed as an agent's, that a change landing
 * on an open draft raises the conflict instead of quietly winning, and that the
 * header says which bytes are on screen.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMutations } from "./mutations";
import { TicketPanel } from "./TicketPanel";
import { ToastStack } from "./WriteFeedback";
import type {
  ActivityEvent,
  ChecklistItem,
  Label,
  TicketDetail,
  WriteResult,
} from "./types";

vi.mock("./api", () => ({
  readTicket: vi.fn(),
  editTicket: vi.fn(),
}));

const { editTicket, readTicket } = await import("./api");
const readTicketMock = vi.mocked(readTicket);
const editTicketMock = vi.mocked(editTicket);

const NOW = Date.parse("2026-07-30T12:00:00Z");

function agentEvent(): ActivityEvent {
  return {
    id: "evt_agent",
    kind: "update",
    occurredAt: "2026-07-30T11:59:00Z",
    actor: { type: "agent", id: "claude-code", name: "Claude Code" },
    changes: [{ field: "status", from: "todo", to: "in_progress" }],
    body: "### Claude Code updated this ticket\n\nTicked the first task.",
  };
}

function humanEvent(): ActivityEvent {
  return {
    id: "evt_human",
    kind: "comment",
    occurredAt: "2026-07-30T11:58:00Z",
    actor: { type: "human", id: "local" },
    changes: [],
    body: "### You commented\n\nStarting on this.",
  };
}

function detail(options?: {
  contentHash?: string;
  title?: string;
  description?: string;
  labels?: string[];
  checklist?: ChecklistItem[];
  activity?: ActivityEvent[];
}): TicketDetail {
  return {
    key: "LC-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
    contentHash: options?.contentHash ?? "hash-1",
    byteLength: 400,
    readOnly: false,
    raw: "",
    rawTruncated: false,
    missingAttachments: [],
    orphanAttachments: [],
    ticket: {
      id: "019c8c7e",
      key: "LC-1",
      title: options?.title ?? "Prove the agent round trip",
      status: "todo",
      priority: "p2",
      labels: options?.labels ?? [],
      createdAt: "2026-07-30T11:00:00Z",
      updatedAt: "2026-07-30T11:59:00Z",
      description:
        options?.description ?? "Check whether the round trip holds.",
      checklist: options?.checklist ?? [
        { id: "ck_1", text: "Let an agent read this ticket", checked: false },
        { id: "ck_2", text: "Review what it changed", checked: false },
      ],
      attachments: [],
      activity: options?.activity ?? [humanEvent()],
      historyIncomplete: false,
      unknownKeys: [],
      recordDiagnostics: [],
    },
  };
}

function writeResult(): WriteResult {
  return {
    ticket: {
      state: "indexed",
      key: "LC-1",
      id: "019c8c7e",
      title: "Prove the agent round trip",
      status: "todo",
      priority: "p2",
      labels: [],
      createdAt: "2026-07-30T11:00:00Z",
      updatedAt: "2026-07-30T12:00:00Z",
      checkedCount: 1,
      checklistCount: 2,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: "hash-2",
      relativePath: ".longclaw/tickets/LC-1/ticket.md",
    },
    generation: 2,
    changes: [],
  };
}

const noop = () => {};
const failOnError = (error: { message: string }) => {
  throw new Error(`unexpected error: ${error.message}`);
};

/** What `longclaw.yaml` defines in these tests. Tickets carry only the slugs. */
const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
};

function panel(props?: {
  reloadSignal?: number;
  onClose?: () => void;
  archived?: boolean;
  onArchive?: (archived: boolean) => void;
}) {
  return (
    <TicketPanel
      projectId="project-1"
      ticketKey="LC-1"
      labels={DEFINITIONS}
      reloadSignal={props?.reloadSignal ?? 0}
      now={NOW}
      archived={props?.archived ?? false}
      onClose={props?.onClose ?? noop}
      onArchive={props?.onArchive ?? noop}
      onWrite={noop}
      onError={failOnError}
    />
  );
}

/** The panel plus the toast surface its destructive-adjacent writes raise. */
function surface(props?: { reloadSignal?: number }) {
  return (
    <>
      {panel(props)}
      <ToastStack />
    </>
  );
}

/** The panel's meta rows are menus now, so a change is opened and picked. */
function metaTrigger(field: "Status" | "Priority" | "Labels"): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${field}: `) });
}

/** The panel, once the file it is reading has arrived. */
function ready() {
  return screen.findByRole("button", { name: /^Status: / });
}

/**
 * Opens a meta menu and picks a row, with nothing awaited in between: an
 * optimistic value is only observable before the write's promise settles.
 */
function pick(field: "Status" | "Priority", option: string) {
  fireEvent.click(metaTrigger(field));
  fireEvent.click(screen.getByRole("menuitemradio", { name: option }));
}

/** The labels menu ticks rather than picks, so it stays open between rows. */
function tick(option: string) {
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: option }));
}

function checklistRow(text: string): HTMLElement {
  const row = screen.getByText(text).closest("li");
  if (!row) throw new Error(`no checklist row for ${text}`);
  return row;
}

beforeEach(() => {
  resetMutations();
  readTicketMock.mockReset();
  editTicketMock.mockReset();
  readTicketMock.mockResolvedValue(detail());
});

afterEach(cleanup);

describe("who a checklist tick belongs to", () => {
  it("shows the human's own tick as an ordinary checked box", async () => {
    const ticked = [
      { id: "ck_1", text: "Let an agent read this ticket", checked: true },
      { id: "ck_2", text: "Review what it changed", checked: false },
    ];
    readTicketMock
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(
        detail({ contentHash: "hash-2", checklist: ticked }),
      );
    editTicketMock.mockResolvedValue(writeResult());
    render(panel());

    const box = await screen.findByLabelText("Let an agent read this ticket");
    fireEvent.click(box);

    await waitFor(() => expect(readTicketMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        checklistRow("Let an agent read this ticket").className,
      ).not.toContain("fresh"),
    );
    expect(screen.queryByText("❯ just now")).toBeNull();
  });

  it("shows a tick that arrived from disk as the agent's", async () => {
    const ticked = [
      { id: "ck_1", text: "Let an agent read this ticket", checked: true },
      { id: "ck_2", text: "Review what it changed", checked: false },
    ];
    readTicketMock.mockResolvedValueOnce(detail()).mockResolvedValueOnce(
      detail({
        contentHash: "hash-2",
        checklist: ticked,
        activity: [humanEvent(), agentEvent()],
      }),
    );
    const view = render(panel());
    await screen.findByLabelText("Let an agent read this ticket");

    // The watcher reported a change to this ticket.
    view.rerender(panel({ reloadSignal: 7 }));

    await waitFor(() =>
      expect(checklistRow("Let an agent read this ticket").className).toContain(
        "fresh",
      ),
    );
    expect(screen.getByText("❯ just now")).toBeTruthy();
    // Nothing was written to reach that state.
    expect(editTicketMock).not.toHaveBeenCalled();
  });
});

describe("a change that lands while a draft is open", () => {
  async function withDirtyTitleDraft() {
    readTicketMock.mockResolvedValueOnce(detail()).mockResolvedValueOnce(
      detail({
        contentHash: "hash-agent",
        title: "Renamed by the agent",
        activity: [humanEvent(), agentEvent()],
      }),
    );
    const view = render(panel());
    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "My unsaved title" } });

    view.rerender(panel({ reloadSignal: 3 }));
    await screen.findByText("⚠ Changed on disk while you were editing");
    return view;
  }

  it("raises the conflict as the change lands, and keeps the draft", async () => {
    await withDirtyTitleDraft();

    expect(screen.getByLabelText("Title")).toHaveProperty(
      "value",
      "My unsaved title",
    );
    expect(screen.getByText("Reload file")).toBeTruthy();
    expect(screen.getByText("Keep mine")).toBeTruthy();
    // The banner names who changed the file, from the file's own record.
    expect(screen.getByText(/Claude Code \(agent\)/)).toBeTruthy();
    expect(editTicketMock).not.toHaveBeenCalled();
  });

  it("refuses other saves until the human chooses", async () => {
    await withDirtyTitleDraft();

    fireEvent.click(screen.getByLabelText("Review what it changed"));

    await waitFor(() => expect(editTicketMock).not.toHaveBeenCalled());
    expect(
      screen.getByText("⚠ Changed on disk while you were editing"),
    ).toBeTruthy();
  });

  it("keeps mine by writing the draft over the newer file", async () => {
    await withDirtyTitleDraft();
    editTicketMock.mockResolvedValue(writeResult());
    readTicketMock.mockResolvedValue(
      detail({ contentHash: "hash-mine", title: "My unsaved title" }),
    );

    fireEvent.click(screen.getByText("Keep mine"));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0]).toMatchObject({
      ticketKey: "LC-1",
      // The hash of the file as it is now, so the write is not refused again.
      expectedHash: "hash-agent",
      edit: { title: "My unsaved title" },
    });
  });

  it("reloads by taking the file and dropping the draft", async () => {
    const view = await withDirtyTitleDraft();
    readTicketMock.mockResolvedValue(
      detail({ contentHash: "hash-agent", title: "Renamed by the agent" }),
    );

    fireEvent.click(screen.getByText("Reload file"));

    await waitFor(() =>
      expect(screen.getByLabelText("Title")).toHaveProperty(
        "value",
        "Renamed by the agent",
      ),
    );
    expect(
      screen.queryByText("⚠ Changed on disk while you were editing"),
    ).toBeNull();
    expect(editTicketMock).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe("the panel's honesty about the file", () => {
  it("must-pass 1: a tick appears before the write returns, and the indicator says so", async () => {
    let settle: (result: WriteResult) => void = () => {};
    readTicketMock.mockResolvedValue(detail({ contentHash: "hash-1" }));
    editTicketMock.mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    render(panel());
    const box = await screen.findByLabelText("Review what it changed");

    fireEvent.click(box);

    // The tick shows before the write lands, and the header says what is happening.
    expect(box).toHaveProperty("checked", true);
    await screen.findByText(/writing .longclaw\/tickets\/LC-1\/ticket.md/);

    settle(writeResult());

    await screen.findByText("✓ .longclaw/tickets/LC-1/ticket.md");
  });

  it("shows the actor of every record, and marks only the agent's", async () => {
    readTicketMock.mockResolvedValue(
      detail({ activity: [humanEvent(), agentEvent()] }),
    );
    render(panel());

    const agentEntry = (await screen.findByText("Claude Code")).closest("li");
    expect(agentEntry?.className).toContain("agent");
    expect(agentEntry?.textContent).toContain("AGENT");
    expect(agentEntry?.textContent).toContain("via file edit");
    expect(agentEntry?.textContent).toContain("Ticked the first task.");
    // The record's own heading is not repeated as prose.
    expect(agentEntry?.textContent).not.toContain("### Claude Code");

    const humanEntry = screen.getByText("You").closest("li");
    expect(humanEntry?.className).not.toContain("agent");
    expect(humanEntry?.textContent).not.toContain("AGENT");
    expect(humanEntry?.textContent).not.toContain("via file edit");
  });

  it("closes on Escape from anywhere in the window", async () => {
    readTicketMock.mockResolvedValue(detail());
    const onClose = vi.fn();
    render(panel({ onClose }));
    await screen.findByLabelText("Title");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the status menu (V0-14 closed V0-08's open edge)", () => {
  it("gives every row the status dot the status wears everywhere", async () => {
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Status"));

    // `screen-specs.md:240` — every menu row carries the option's own glyph, and
    // the status menu's glyph is the coloured dot. V0-08 shipped without one
    // because the app had no status dot at all.
    const rows = screen.getAllByRole("menuitemradio");
    expect(rows).toHaveLength(6);
    expect(
      rows.map((row) =>
        row.querySelector(".status-dot")?.getAttribute("class"),
      ),
    ).toEqual([
      "status-dot status-backlog",
      "status-dot status-todo",
      "status-dot status-in-progress",
      "status-dot status-in-review",
      "status-dot status-done",
      "status-dot status-canceled",
    ]);
  });

  it("shows the dot on the trigger, beside the value it names", async () => {
    render(surface());
    await ready();

    expect(
      metaTrigger("Status").querySelector(".status-dot.status-todo"),
    ).toBeTruthy();
  });
});

describe("a destructive-adjacent change and taking it back", () => {
  it("shows the new status and raises a toast with Undo before the write lands", async () => {
    let settle: (result: WriteResult) => void = () => {};
    editTicketMock.mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    render(surface());
    await ready();

    pick("Status", "In Progress");

    expect(metaTrigger("Status").getAttribute("aria-label")).toBe(
      "Status: In Progress",
    );
    settle(writeResult());
    await screen.findByText("LC-1 → In Progress");
    expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();
  });

  it("must-pass 3: undo restores the previous file content through the ordinary write path", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    pick("Status", "In Progress");
    await screen.findByText("LC-1 → In Progress");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    // An ordinary edit_ticket against the hash the first write returned — there
    // is no undo IPC command and there must not be one.
    expect(editTicketMock.mock.calls[1][0]).toEqual({
      projectId: "project-1",
      ticketKey: "LC-1",
      expectedHash: "hash-2",
      edit: { status: "todo" },
    });
    await screen.findByText("LC-1 back to Todo");
  });

  it("runs undo from ⌘Z as well as the toast button", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    pick("Status", "In Progress");
    await screen.findByText("LC-1 → In Progress");
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    expect(editTicketMock.mock.calls[1][0]).toMatchObject({
      edit: { status: "todo" },
    });
  });

  it("must-pass 2: a failed write reverts the optimistic state and says so", async () => {
    editTicketMock.mockRejectedValue({
      code: "io",
      message: "No space left on device",
      recoverable: true,
    });
    render(surface());
    await ready();

    pick("Status", "In Progress");

    expect(metaTrigger("Status").getAttribute("aria-label")).toBe(
      "Status: In Progress",
    );
    await waitFor(() =>
      expect(metaTrigger("Status").getAttribute("aria-label")).toBe(
        "Status: Todo",
      ),
    );
    expect(screen.getByText(/No space left on device/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    // A reverted write offers no Undo: there is nothing on disk to take back.
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
  });

  it("keeps a conflict on the conflict banner rather than the failure toast", async () => {
    editTicketMock.mockRejectedValue({
      code: "conflict",
      message: "The file changed on disk",
      recoverable: true,
      context: {
        conflictingActorType: "agent",
        conflictingActorName: "Claude",
      },
    });
    render(surface());
    await ready();

    pick("Status", "In Progress");

    await screen.findByText("⚠ Changed on disk while you were editing");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByText("Keep mine")).toBeTruthy();
  });

  it("offers undo for a checklist tick", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    const box = await screen.findByLabelText("Review what it changed");

    fireEvent.click(box);

    await screen.findByText("LC-1 checked · Review what it changed");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    expect(editTicketMock.mock.calls[1][0]).toMatchObject({
      edit: { checklist: [{ itemId: "ck_2", checked: false }] },
    });
  });
});

describe("priority in the panel (V0-08)", () => {
  it("shows the priority the file carries, as a named glyph", async () => {
    render(surface());

    expect(
      (await screen.findByRole("button", { name: /^Priority: / })).getAttribute(
        "aria-label",
      ),
    ).toBe("Priority: P2");
    // The panel tab order is status → priority → labels
    // (`keyboard-focus-map.md:61`), so priority follows status in the document.
    const triggers = screen.getAllByRole("button", {
      name: /^(Status|Priority): /,
    });
    expect(
      triggers.map((trigger) => trigger.getAttribute("aria-label")),
    ).toEqual(["Status: Todo", "Priority: P2"]);
  });

  it("must-pass 1: writes the picked priority and offers to take it back", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    pick("Priority", "Urgent");

    expect(metaTrigger("Priority").getAttribute("aria-label")).toBe(
      "Priority: Urgent",
    );
    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0]).toEqual({
      projectId: "project-1",
      ticketKey: "LC-1",
      expectedHash: "hash-1",
      edit: { priority: "urgent" },
    });

    await screen.findByText("LC-1 → Urgent");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    expect(editTicketMock.mock.calls[1][0]).toEqual({
      projectId: "project-1",
      ticketKey: "LC-1",
      expectedHash: "hash-2",
      edit: { priority: "p2" },
    });
    await screen.findByText("LC-1 back to P2");
  });

  it("puts the priority back when the write fails", async () => {
    editTicketMock.mockRejectedValue({
      code: "io",
      message: "No space left on device",
      recoverable: true,
    });
    render(surface());
    await ready();

    pick("Priority", "Urgent");

    expect(metaTrigger("Priority").getAttribute("aria-label")).toBe(
      "Priority: Urgent",
    );
    await waitFor(() =>
      expect(metaTrigger("Priority").getAttribute("aria-label")).toBe(
        "Priority: P2",
      ),
    );
  });

  it("writes nothing when the priority already set is picked again", async () => {
    render(surface());
    await ready();

    pick("Priority", "P2");

    expect(editTicketMock).not.toHaveBeenCalled();
  });
});

describe("labels in the panel (V0-10)", () => {
  const chips = () =>
    Array.from(metaTrigger("Labels").querySelectorAll(".label-chip")).map(
      (chip) => chip.textContent,
    );

  it("shows a chip per slug, and follows priority in the tab order", async () => {
    readTicketMock.mockResolvedValue(detail({ labels: ["backend"] }));
    render(surface());
    await ready();

    expect(chips()).toEqual(["Backend"]);
    // status → priority → labels (`keyboard-focus-map.md:61`).
    const triggers = screen.getAllByRole("button", {
      name: /^(Status|Priority|Labels): /,
    });
    expect(
      triggers.map((trigger) => trigger.getAttribute("aria-label")),
    ).toEqual(["Status: Todo", "Priority: P2", "Labels: Backend"]);
  });

  it("must-pass 3: renders a slug this project does not define, as itself", async () => {
    readTicketMock.mockResolvedValue(detail({ labels: ["legacy-thing"] }));
    render(surface());
    await ready();

    expect(chips()).toEqual(["legacy-thing"]);
    // And it is on the menu, so it can be taken off again.
    fireEvent.click(metaTrigger("Labels"));
    expect(
      screen
        .getAllByRole("menuitemcheckbox")
        .map((row) => [
          row.querySelector(".menu-label")?.textContent,
          row.getAttribute("aria-checked"),
        ]),
    ).toEqual([
      ["Backend", "false"],
      ["Reliability", "false"],
      ["legacy-thing", "true"],
    ]);
  });

  it("must-pass 1: writes the whole list and offers to take it back", async () => {
    readTicketMock.mockResolvedValue(detail({ labels: ["backend"] }));
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Labels"));
    tick("Reliability");

    expect(chips()).toEqual(["Backend", "Reliability"]);
    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0]).toEqual({
      projectId: "project-1",
      ticketKey: "LC-1",
      expectedHash: "hash-1",
      edit: { labels: ["backend", "reliability"] },
    });

    await screen.findByText("LC-1 labeled Reliability");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    // The inverse of a whole-list replace is the whole previous list.
    expect(editTicketMock.mock.calls[1][0]).toEqual({
      projectId: "project-1",
      ticketKey: "LC-1",
      expectedHash: "hash-2",
      edit: { labels: ["backend"] },
    });
    await screen.findByText("LC-1 unlabeled Reliability");
  });

  it("must-pass 3: carries an undefined slug through a write untouched", async () => {
    readTicketMock.mockResolvedValue(detail({ labels: ["legacy-thing"] }));
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Labels"));
    tick("Backend");

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0]).toMatchObject({
      edit: { labels: ["legacy-thing", "backend"] },
    });
  });

  it("takes a label off, and stays open while it does", async () => {
    readTicketMock.mockResolvedValue(
      detail({ labels: ["backend", "reliability"] }),
    );
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Labels"));
    tick("Backend");

    // Multi-select ticks and stays open (`screen-specs.md:239-247`).
    expect(screen.getByRole("menu", { name: "Labels" })).toBeTruthy();
    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0]).toMatchObject({
      edit: { labels: ["reliability"] },
    });
    await screen.findByText("LC-1 unlabeled Backend");
  });

  it("puts the chips back when the write fails", async () => {
    editTicketMock.mockRejectedValue({
      code: "io",
      message: "No space left on device",
      recoverable: true,
    });
    readTicketMock.mockResolvedValue(detail({ labels: ["backend"] }));
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Labels"));
    tick("Reliability");

    expect(chips()).toEqual(["Backend", "Reliability"]);
    await waitFor(() => expect(chips()).toEqual(["Backend"]));
  });
});

describe("the labels menu while it stays open (V0-10)", () => {
  it("keeps an unticked undefined slug on the menu, so it can go back", async () => {
    // The rows are the project's definitions plus whatever this ticket carries.
    // Unticking an undefined slug would otherwise delete the row out from under
    // the pointer, and take the only way of putting it back with it.
    readTicketMock.mockResolvedValue(detail({ labels: ["legacy-thing"] }));
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    await ready();

    fireEvent.click(metaTrigger("Labels"));
    tick("legacy-thing");

    expect(
      screen.getByRole("menuitemcheckbox", { name: "legacy-thing" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("menuitemcheckbox", { name: "legacy-thing" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
});

describe("the archive button in the header (V0-11)", () => {
  it("names the action it would take and asks for the flip", async () => {
    // The panel never writes this one: archiving closes the panel, so the
    // mutation is raised by whatever outlives it.
    const onArchive = vi.fn();
    render(panel({ onArchive }));
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(onArchive).toHaveBeenCalledWith(true);
    expect(editTicketMock).not.toHaveBeenCalled();
  });

  it("says Unarchive, and wears the chip, on a ticket that is archived", async () => {
    const onArchive = vi.fn();
    render(panel({ archived: true, onArchive }));
    await ready();

    expect(screen.getByText("archived")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));

    expect(onArchive).toHaveBeenCalledWith(false);
  });

  it("offers nothing on a file this build could not read", async () => {
    readTicketMock.mockResolvedValue({
      ...detail(),
      ticket: undefined,
      diagnostic: {
        code: "parse_failed",
        message: "mapping values are not allowed here",
        line: 4,
      },
      raw: "title: [",
    });
    render(panel());

    await screen.findByText(/Shown without repair/);
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });
});

/**
 * Markdown a careless editor would tidy: a setext heading, three bullet markers
 * in one list, a four-space indent, a trailing-space hard break, constructs the
 * subset does not render, and a fence whose interior spacing is load-bearing.
 *
 * Nothing here is a reserved heading, so it is a legal description
 * (`ticket.rs:738-750`).
 */
const NON_CANONICAL = [
  "Setext heading",
  "===",
  "",
  "*   a star bullet with loose spacing",
  "-  a dash bullet",
  "    - a four-space indent",
  "+ and a plus",
  "",
  "Trailing spaces here  ",
  "make the line above a hard break.",
  "",
  "> a block quote the subset does not render",
  "",
  "1. an ordered item the subset does not render",
  "",
  "```js",
  "const spacing = '  load   bearing  ';",
  "```",
  "",
  "\tA tab-indented line.",
].join("\n");

async function openTheEditor(description: string) {
  readTicketMock.mockResolvedValue(detail({ description }));
  render(surface());
  await ready();
  fireEvent.click(screen.getByRole("button", { name: /Edit description/ }));
  return screen.getByLabelText("Description") as HTMLTextAreaElement;
}

describe("the description editor (V0-12)", () => {
  it("shows Write and Preview tabs and exactly six formatting buttons", async () => {
    const textarea = await openTheEditor("Check whether the round trip holds.");

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Write",
      "Preview",
    ]);
    expect(screen.getByRole("tab", { name: "Write" })).toHaveProperty(
      "ariaSelected",
      "true",
    );
    // Six, no more and no fewer (`screen-specs.md:179-180`).
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    expect(
      Array.from(toolbar.querySelectorAll("button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["Bold", "Italic", "Code", "Bulleted list", "Task list", "Link"]);
    expect(textarea.value).toBe("Check whether the round trip holds.");
  });

  it("previews the markdown as elements, and never as markup", async () => {
    await openTheEditor(
      "A **bold** claim\n\n- one\n- two\n\n<img src=x onerror=alert(1)>",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = screen.getByRole("tabpanel", { name: "Preview" });
    expect(preview.querySelector("strong")?.textContent).toBe("bold");
    expect(preview.querySelectorAll("li")).toHaveLength(2);
    // The one rule that matters: injected HTML is text, not DOM.
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("must-pass 2: hands the bytes the human typed to the write, untouched", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    const textarea = await openTheEditor(NON_CANONICAL);
    expect(textarea.value).toBe(NON_CANONICAL);

    // One word changes. Everything else must survive the round trip through the
    // editor, including a pass through the preview and back.
    const edited = NON_CANONICAL.replace("Trailing", "Trailingg");
    fireEvent.change(textarea, { target: { value: edited } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0].edit.description).toBe(edited);
  });

  it("saves on ⌘↵ and cancels on Esc without closing the panel", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    const onClose = vi.fn();
    readTicketMock.mockResolvedValue(detail({ description: "Before." }));
    render(
      <>
        {panel({ onClose })}
        <ToastStack />
      </>,
    );
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Edit description/ }));

    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "Cancelled." } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    // Esc is the editor's, not the panel's (`keyboard-focus-map.md:82`).
    expect(onClose).not.toHaveBeenCalled();
    expect(editTicketMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Description")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Edit description/ }));
    const reopened = screen.getByLabelText("Description");
    // The cancelled draft is gone, not kept.
    expect(reopened).toHaveProperty("value", "Before.");
    fireEvent.change(reopened, { target: { value: "Saved by ⌘↵." } });
    fireEvent.keyDown(reopened, { key: "Enter", metaKey: true });

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(1));
    expect(editTicketMock.mock.calls[0][0].edit).toEqual({
      description: "Saved by ⌘↵.",
    });
  });

  it("refuses to send a description the file already has", async () => {
    await openTheEditor("Check whether the round trip holds.");

    // `TicketDocument::apply` refuses an edit that changes nothing, so the
    // editor must not offer to send one.
    expect(screen.getByRole("button", { name: /^Save/ })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("wraps the selection a toolbar button is pressed on, and nothing else", async () => {
    const textarea = await openTheEditor("alpha beta gamma");
    textarea.setSelectionRange(6, 10);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(textarea.value).toBe("alpha **beta** gamma");
  });

  it("renders the description as markdown before it is opened", async () => {
    readTicketMock.mockResolvedValue(
      detail({ description: "## Approach\n\n- first\n- second" }),
    );
    render(surface());
    await ready();

    const view = document.querySelector(".description-view");
    expect(view?.querySelectorAll("li")).toHaveLength(2);
    // A `##` under the panel's own `<h3>Description</h3>` is an h5, not a
    // second-level heading in the panel's outline.
    expect(view?.querySelector("h5")?.textContent).toBe("Approach");
  });
});
