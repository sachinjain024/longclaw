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
      labels: [],
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

function panel(props?: { reloadSignal?: number; onClose?: () => void }) {
  return (
    <TicketPanel
      projectId="project-1"
      ticketKey="LC-1"
      reloadSignal={props?.reloadSignal ?? 0}
      now={NOW}
      onClose={props?.onClose ?? noop}
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

describe("a destructive-adjacent change and taking it back", () => {
  it("shows the new status and raises a toast with Undo before the write lands", async () => {
    let settle: (result: WriteResult) => void = () => {};
    editTicketMock.mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    render(surface());
    const status = await screen.findByLabelText("Status");

    fireEvent.change(status, { target: { value: "in_progress" } });

    expect(status).toHaveProperty("value", "in_progress");
    settle(writeResult());
    await screen.findByText("LC-1 → In Progress");
    expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();
  });

  it("must-pass 3: undo restores the previous file content through the ordinary write path", async () => {
    editTicketMock.mockResolvedValue(writeResult());
    render(surface());
    const status = await screen.findByLabelText("Status");

    fireEvent.change(status, { target: { value: "in_progress" } });
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
    const status = await screen.findByLabelText("Status");

    fireEvent.change(status, { target: { value: "in_progress" } });
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
    const status = await screen.findByLabelText("Status");

    fireEvent.change(status, { target: { value: "in_progress" } });

    expect(status).toHaveProperty("value", "in_progress");
    await waitFor(() => expect(status).toHaveProperty("value", "todo"));
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
    const status = await screen.findByLabelText("Status");

    fireEvent.change(status, { target: { value: "in_progress" } });

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
