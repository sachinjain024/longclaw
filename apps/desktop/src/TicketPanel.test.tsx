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
  key?: string;
  contentHash?: string;
  title?: string;
  description?: string;
  labels?: string[];
  checklist?: ChecklistItem[];
  activity?: ActivityEvent[];
}): TicketDetail {
  const key = options?.key ?? "LC-1";
  return {
    key,
    relativePath: `.longclaw/tickets/${key}/ticket.md`,
    contentHash: options?.contentHash ?? "hash-1",
    byteLength: 400,
    readOnly: false,
    raw: "",
    rawTruncated: false,
    missingAttachments: [],
    orphanAttachments: [],
    ticket: {
      id: "019c8c7e",
      key,
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

function degradedDetail(options?: {
  readOnly?: boolean;
  raw?: string;
  message?: string;
  line?: number;
}): TicketDetail {
  return {
    key: "LC-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
    contentHash: "hash-degraded",
    byteLength: options?.raw?.length ?? 120,
    readOnly: options?.readOnly ?? false,
    raw:
      options?.raw ??
      "---\nkey: LC-1\nschema_version: 99\n---\n# Future ticket\n",
    rawTruncated: false,
    missingAttachments: [],
    orphanAttachments: [],
    diagnostic: {
      code: options?.readOnly ? "unsupported_version" : "parse_failed",
      message:
        options?.message ??
        (options?.readOnly
          ? "Ticket schema version 99 is newer than this build supports"
          : "Frontmatter is missing a required title"),
      line: options?.line,
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
  ticketKey?: string;
  reloadSignal?: number;
  removedSignal?: number;
  onClose?: () => void;
  archived?: boolean;
  shortcutsActive?: boolean;
  onArchive?: (archived: boolean) => void;
  onWrite?: (result: WriteResult) => void;
}) {
  return (
    <TicketPanel
      projectId="project-1"
      ticketKey={props?.ticketKey ?? "LC-1"}
      labels={DEFINITIONS}
      reloadSignal={props?.reloadSignal ?? 0}
      removedSignal={props?.removedSignal ?? 0}
      now={NOW}
      archived={props?.archived ?? false}
      shortcutsActive={props?.shortcutsActive ?? true}
      onClose={props?.onClose ?? noop}
      onArchive={props?.onArchive ?? noop}
      onWrite={props?.onWrite ?? noop}
      onError={failOnError}
    />
  );
}

/** The panel plus the toast surface its destructive-adjacent writes raise. */
function surface(props?: {
  reloadSignal?: number;
  removedSignal?: number;
  onWrite?: (result: WriteResult) => void;
}) {
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

/**
 * D-3D. The cards have carried this meter since the board shipped; the panel —
 * the surface the checklist is actually worked in — had the fraction alone,
 * pushed to the far edge of a 560px row.
 */
describe("the checklist meter in the panel", () => {
  const meter = () =>
    document.querySelector<HTMLElement>(".panel-progress > i");

  it("fills to the fraction beside it, and moves as a box is ticked", async () => {
    readTicketMock.mockResolvedValue(
      detail({
        checklist: [
          { id: "ck_1", text: "One", checked: true },
          { id: "ck_2", text: "Two", checked: false },
          { id: "ck_3", text: "Three", checked: false },
          { id: "ck_4", text: "Four", checked: false },
        ],
      }),
    );
    editTicketMock.mockReturnValue(new Promise<WriteResult>(() => {}));
    render(panel());
    await screen.findByLabelText("Two");

    expect(screen.getByText("1/4")).toBeTruthy();
    expect(meter()?.style.width).toBe("25%");

    // Optimistic, like the tick itself: it reads the same value the fraction
    // does, so it cannot disagree with it while a write is out.
    fireEvent.click(screen.getByLabelText("Two"));

    expect(screen.getByText("2/4")).toBeTruthy();
    expect(meter()?.style.width).toBe("50%");
  });

  it("wears the agent's accent while a row is fresh, and is not read aloud", async () => {
    const ticked = [
      { id: "ck_1", text: "Let an agent read this ticket", checked: true },
      { id: "ck_2", text: "Review what it changed", checked: false },
    ];
    readTicketMock
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(
        detail({ contentHash: "hash-2", checklist: ticked }),
      );
    const view = render(panel());
    await screen.findByLabelText("Let an agent read this ticket");

    const bar = () => document.querySelector(".panel-progress");
    expect(bar()?.className).not.toContain("fresh");
    // The fraction beside it says the same thing in words.
    expect(bar()?.getAttribute("aria-hidden")).toBe("true");

    view.rerender(panel({ reloadSignal: 7 }));

    await waitFor(() => expect(bar()?.className).toContain("fresh"));
  });

  it("draws no meter for a ticket with no checklist", async () => {
    readTicketMock.mockResolvedValue(detail({ checklist: [] }));
    render(panel());
    await screen.findByLabelText("Add a checklist item");

    expect(document.querySelector(".panel-progress")).toBeNull();
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

  it("states the conflict in the same words any other surface would", async () => {
    await withDirtyTitleDraft();

    // V0-29: one composer for one typed error. The banner used to render Rust's
    // own copy while the board composed its own, so the same conflict read two
    // ways depending on where it surfaced.
    //
    // Written out rather than computed from `conflictMessage`: an expectation
    // built by calling the function it pins passes for any implementation of it.
    expect(
      screen.getByText(
        "LC-1 changed on disk while you were editing. Your unsaved edit is " +
          "preserved either way. Last edited by Claude Code (agent).",
      ),
    ).toBeTruthy();
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

describe("a ticket that disappears while the panel is open", () => {
  it("V0-28: preserves an unsaved draft and offers explicit next actions", async () => {
    readTicketMock.mockResolvedValue(detail());
    const onClose = vi.fn();
    const view = render(panel({ onClose }));
    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "My unsaved title" } });
    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "Do not lose this comment." },
    });
    fireEvent.change(screen.getByLabelText("Add a checklist item"), {
      target: { value: "Remember this checklist line" },
    });

    view.rerender(panel({ removedSignal: 4, onClose }));

    await screen.findByText("Ticket file is no longer available");
    expect(screen.getByText(/deleted or renamed on disk/)).toBeTruthy();
    expect(screen.getByText("Unsaved draft kept in this panel")).toBeTruthy();
    expect(screen.getByText("Title: My unsaved title")).toBeTruthy();
    expect(screen.getByText("Comment: Do not lose this comment.")).toBeTruthy();
    expect(
      screen.getByText("Checklist item: Remember this checklist line"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Try reading again" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(editTicketMock).not.toHaveBeenCalled();
  });

  it("V0-28: keeps an in-flight comment visible when the file disappears", async () => {
    readTicketMock.mockResolvedValue(detail());
    editTicketMock.mockReturnValue(new Promise<WriteResult>(() => {}));
    const view = render(panel());
    const field = await screen.findByLabelText("Comment");
    fireEvent.change(field, { target: { value: "Already submitted." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    view.rerender(panel({ removedSignal: 4 }));

    await screen.findByText("Ticket file is no longer available");
    expect(
      screen.getByText("Posting comment: Already submitted."),
    ).toBeTruthy();
    expect(editTicketMock).toHaveBeenCalledTimes(1);
  });

  it("V0-28: retrying adopts the file again if it reappears", async () => {
    readTicketMock.mockResolvedValueOnce(detail()).mockResolvedValueOnce(
      detail({
        contentHash: "hash-restored",
        title: "Restored on disk",
      }),
    );
    const view = render(panel());
    await screen.findByLabelText("Title");
    view.rerender(panel({ removedSignal: 5 }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Try reading again" }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Title")).toHaveProperty(
        "value",
        "Restored on disk",
      ),
    );
    expect(screen.queryByText("Ticket file is no longer available")).toBeNull();
  });

  it("V0-28: does not carry one ticket's removal signal into another ticket", async () => {
    readTicketMock.mockResolvedValueOnce(detail()).mockResolvedValueOnce(
      detail({
        key: "LC-2",
        contentHash: "hash-lc-2",
        title: "Second ticket",
      }),
    );
    const view = render(panel());
    await screen.findByLabelText("Title");
    view.rerender(panel({ removedSignal: 6 }));
    await screen.findByText("Ticket file is no longer available");

    view.rerender(panel({ ticketKey: "LC-2", removedSignal: 6 }));

    await waitFor(() =>
      expect(screen.getByLabelText("Title")).toHaveProperty(
        "value",
        "Second ticket",
      ),
    );
    expect(screen.queryByText("Ticket file is no longer available")).toBeNull();
  });
});

describe("the panel's honesty about the file", () => {
  it("V0-26: shows a newer-version ticket as read-only raw content with no mutation controls", async () => {
    readTicketMock.mockResolvedValue(
      degradedDetail({
        readOnly: true,
        line: 3,
        raw: "---\nkey: LC-1\nschema_version: 99\n---\n# Future ticket\n",
      }),
    );
    const onArchive = vi.fn();
    render(panel({ onArchive }));

    await screen.findByText("Newer format, shown read-only");

    expect(screen.getByText(/schema version 99/)).toBeTruthy();
    expect(screen.getByText(/will not rewrite it/i)).toBeTruthy();
    expect(screen.getByText(/schema_version: 99/)).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Status: / })).toBeNull();
    expect(editTicketMock).not.toHaveBeenCalled();
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("V0-26: keeps ordinary parse failures in the repairable degraded state", async () => {
    readTicketMock.mockResolvedValue(
      degradedDetail({
        raw: "---\nkey: LC-1\nstatus: blocked\n---\n# Broken ticket\n",
        message: "status must be one of the supported values",
        line: 3,
      }),
    );
    render(panel());

    await screen.findByText("Shown without repair");

    expect(screen.getByText(/Fix it in an editor/)).toBeTruthy();
    expect(screen.queryByText(/will not rewrite it/i)).toBeNull();
    expect(screen.getByText(/status: blocked/)).toBeTruthy();
    expect(editTicketMock).not.toHaveBeenCalled();
  });

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

    // The tick shows before the write lands, and the header says what is
    // happening — naming the file, as `states.md:180` writes it, with the key
    // that says which ticket's `ticket.md` it is.
    expect(box).toHaveProperty("checked", true);
    await screen.findByText(/writing tickets\/LC-1\/ticket\.md/);

    settle(writeResult());

    await screen.findByText("✓ tickets/LC-1/ticket.md");
  });

  it("D-39: names the file in a chip that holds still while the disk moves", async () => {
    let settle: (result: WriteResult) => void = () => {};
    readTicketMock.mockResolvedValue(detail());
    editTicketMock.mockReturnValue(
      new Promise<WriteResult>((resolve) => {
        settle = resolve;
      }),
    );
    render(panel());
    const box = await screen.findByLabelText("Review what it changed");

    // Quiet: the chip is the only thing naming the file, and it carries the
    // folder glyph the prototype pairs with a path.
    const chip = () => document.querySelector(".panel-header .path-chip");
    expect(chip()?.textContent).toBe("tickets/LC-1/ticket.md");
    expect(chip()?.querySelector(".folder-glyph")).toBeTruthy();
    expect(document.querySelector(".panel-header .disk-path")).toBeNull();

    fireEvent.click(box);

    // Writing: the indicator appears beside the chip rather than replacing it,
    // which is the whole of the split — the path never flickers.
    await screen.findByText(/writing tickets\/LC-1\/ticket\.md/);
    expect(chip()?.textContent).toBe("tickets/LC-1/ticket.md");

    settle(writeResult());

    await screen.findByText("✓ tickets/LC-1/ticket.md");
    expect(chip()?.textContent).toBe("tickets/LC-1/ticket.md");
  });

  it("D-38: copies the key from the header chip and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    readTicketMock.mockResolvedValue(detail());
    render(surface());
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Copy LC-1" }));

    expect(writeText).toHaveBeenCalledWith("LC-1");
    await screen.findByText("LC-1 copied");
  });

  it("D-38: says the copy failed rather than pretending it worked", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });
    readTicketMock.mockResolvedValue(detail());
    render(surface());
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Copy LC-1" }));

    await screen.findByText("Could not copy LC-1");
  });

  it("shows the actor of every record, and marks only the agent's", async () => {
    readTicketMock.mockResolvedValue(
      detail({ activity: [humanEvent(), agentEvent()] }),
    );
    render(panel());

    // The agent's record is an `update`, so it is a change entry: the rail and
    // the provenance, its status change as a sentence, and its note below.
    const agentEntry = (await screen.findByText("Claude Code")).closest(
      ".timeline-entry",
    );
    expect(agentEntry?.className).toContain("agent");
    expect(agentEntry?.textContent).toContain("via file edit");
    expect(agentEntry?.textContent).toContain("moved this to In Progress");
    expect(agentEntry?.textContent).toContain("Ticked the first task.");
    // The record's own heading is not repeated as prose.
    expect(agentEntry?.textContent).not.toContain("### Claude Code");

    const humanEntry = screen.getByText("You").closest(".timeline-entry");
    expect(humanEntry?.className).not.toContain("agent");
    expect(humanEntry?.textContent).not.toContain("AGENT");
    expect(humanEntry?.textContent).not.toContain("via file edit");
  });

  /**
   * ADR 0001's clause, pinned so a future change cannot quietly reintroduce an
   * assignee by way of the timeline. Agents are actors on entries and nothing
   * else; the human avatars in the stream and the composer are actor identity
   * and are the spec's own anatomy.
   */
  it("must-pass: an agent is an actor and never an assignee", async () => {
    readTicketMock.mockResolvedValue(
      detail({ activity: [humanEvent(), agentEvent()] }),
    );
    render(panel());
    await ready();

    // The panel offers no assignee anywhere: not as a meta row, not as a
    // control, not as a word.
    const aside = document.querySelector(".ticket-panel");
    expect(aside?.textContent).not.toMatch(/assign/i);
    expect(screen.queryByRole("button", { name: /assign/i })).toBeNull();

    // The meta grid is exactly the three rows v0 has, and the agent is in none
    // of them — it exists only inside the timeline.
    const meta = document.querySelector(".meta-grid");
    expect(
      [...(meta?.querySelectorAll(":scope > span") ?? [])].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Status", "Priority", "Labels"]);
    expect(meta?.textContent).not.toContain("Claude Code");
    expect(screen.getByText("Claude Code").closest(".timeline")).toBeTruthy();

    // And the avatars that are correct are still there.
    expect(document.querySelectorAll(".composer .actor-tile")).toHaveLength(1);
  });

  /**
   * D-3A. The panel is the surface a person reads most, and it carried the
   * frontmatter's `updated_at` verbatim. A raw UTC string there reads as debug
   * output, and it said in machine spelling what the timeline under it already
   * says in words.
   */
  it("D-3A: shows no raw ISO timestamp anywhere in the panel", async () => {
    readTicketMock.mockResolvedValue(detail());
    render(panel());
    await ready();

    const aside = document.querySelector(".ticket-panel");
    expect(aside?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(aside?.textContent).not.toContain("Updated");
  });

  it("posts a comment optimistically, and puts it back if the write fails", async () => {
    let reject: (error: unknown) => void = () => {};
    readTicketMock.mockResolvedValue(detail());
    editTicketMock.mockReturnValue(
      new Promise<WriteResult>((_resolve, settle) => {
        reject = settle;
      }),
    );
    render(surface());
    await ready();

    const field = screen.getByLabelText("Comment");
    fireEvent.change(field, { target: { value: "Looks right to me." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    // On screen before the write returns, and honest that it is not a record.
    const pending = document.querySelector(".timeline-entry.pending");
    expect(pending?.textContent).toContain("Looks right to me.");
    expect(pending?.textContent).toContain("posting");
    expect(field).toHaveProperty("value", "");

    reject({ code: "io", message: "Disk full", recoverable: true });

    // The entry goes, the text comes back, and the failure is said out loud.
    await waitFor(() =>
      expect(document.querySelector(".timeline-entry.pending")).toBeNull(),
    );
    expect(screen.getByLabelText("Comment")).toHaveProperty(
      "value",
      "Looks right to me.",
    );
    expect(
      screen.getByText("Disk full The file was left as it was."),
    ).toBeTruthy();
  });

  it("closes on Escape from anywhere in the window", async () => {
    readTicketMock.mockResolvedValue(detail());
    const onClose = vi.fn();
    render(panel({ onClose }));
    await screen.findByLabelText("Title");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // `keyboard-focus-map.md:66-69`: "`S`/`P` still work (they target the open
  // ticket)". Focus is in the panel, so neither surface's own binding sees them.
  it("opens the status and priority menus on S and P", async () => {
    render(panel());
    await ready();

    fireEvent.keyDown(document, { key: "s" });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(6);
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.keyDown(document, { key: "p" });
    expect(screen.getByRole("menu", { name: "Priority" })).toBeTruthy();
  });

  it("suspends S and P while a field has focus", async () => {
    render(panel());
    await ready();
    const title = screen.getByLabelText("Title");
    title.focus();

    fireEvent.keyDown(title, { key: "s" });

    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
  });

  it("stands S and P down while a modal is above the panel", async () => {
    render(panel({ shortcutsActive: false }));
    await ready();

    fireEvent.keyDown(document, { key: "s" });

    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
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

  /**
   * D-3B. Without the chevron these read as static chips until the pointer is
   * on them, which is no help to anyone who has not put it there. It is
   * decorative — `aria-haspopup` is what says the same thing to assistive
   * technology, and says it better.
   */
  it("D-3B: marks each meta value as a menu trigger, in both channels", async () => {
    render(surface());
    await ready();

    for (const field of ["Status", "Priority"] as const) {
      const trigger = metaTrigger(field);
      const chevron = trigger.querySelector(".menu-chevron");
      expect(chevron).toBeTruthy();
      expect(chevron?.getAttribute("aria-hidden")).toBe("true");
      expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    }
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
    const onWrite = vi.fn();
    render(surface({ onWrite }));
    await ready();

    pick("Status", "In Progress");

    await screen.findByText("⚠ Changed on disk while you were editing");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByText("Keep mine")).toBeTruthy();
    // Plan 23 gave a conflict raised outside the panel an Open ticket offer.
    // In here the banner is the offer, and nothing was reverted or toasted.
    expect(screen.queryByRole("button", { name: "Open ticket" })).toBeNull();
    expect(onWrite).not.toHaveBeenCalled();
  });

  /**
   * V0-29. A refused write left `detail` holding the hash Rust had just
   * rejected, so Keep mine re-sent it and was refused identically — unless the
   * watcher's own event happened to land first and reload the panel. The offer
   * worked by race.
   */
  it("keeps mine against the file it re-read, not the hash that was just refused", async () => {
    readTicketMock.mockResolvedValueOnce(detail());
    editTicketMock.mockRejectedValueOnce({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: {
        ticketKey: "LC-1",
        conflictingActorType: "agent",
        conflictingActorName: "Claude",
      },
    });
    render(surface());
    await ready();
    // What the panel finds when it goes back to the file the write was refused
    // for: somebody else's newer bytes.
    readTicketMock.mockResolvedValue(
      detail({ contentHash: "hash-agent", title: "Renamed by the agent" }),
    );

    pick("Status", "In Progress");
    await screen.findByText("⚠ Changed on disk while you were editing");
    await waitFor(() => expect(readTicketMock).toHaveBeenCalledTimes(2));

    editTicketMock.mockResolvedValue(writeResult());
    fireEvent.click(screen.getByText("Keep mine"));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    expect(editTicketMock.mock.calls[1][0]).toMatchObject({
      // The hash of the content the human was shown when they chose.
      expectedHash: "hash-agent",
      edit: { status: "in_progress" },
    });
  });

  /**
   * V0-29, review follow-up. Re-reading on refusal is not enough on its own:
   * the banner goes up while the read is still in flight, so a fast hand could
   * press Keep mine against the hash that was just refused.
   */
  it("waits for the re-read before keeping mine, rather than racing it", async () => {
    let arrive: () => void = () => {};
    readTicketMock.mockResolvedValueOnce(detail()).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          arrive = () => resolve(detail({ contentHash: "hash-agent" }));
        }),
    );
    editTicketMock.mockRejectedValueOnce({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: { ticketKey: "LC-1" },
    });
    render(surface());
    await ready();

    pick("Status", "In Progress");
    await screen.findByText("⚠ Changed on disk while you were editing");

    // The read has not come back yet, and the human is already clicking.
    editTicketMock.mockResolvedValue(writeResult());
    fireEvent.click(screen.getByText("Keep mine"));
    expect(editTicketMock).toHaveBeenCalledTimes(1);

    arrive();

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(2));
    expect(editTicketMock.mock.calls[1][0]).toMatchObject({
      expectedHash: "hash-agent",
    });
  });

  /**
   * V0-29. The inverse mutation carried no `handles`, so a conflict on Undo
   * fell through to the ordinary danger toast — a fact and a dismissal — while
   * the same conflict on the forward save got the banner and a choice.
   */
  it("takes a conflict on Undo to the banner, like any other refused write", async () => {
    readTicketMock
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(detail())
      .mockResolvedValue(detail({ contentHash: "hash-agent" }));
    editTicketMock.mockResolvedValueOnce(writeResult()).mockRejectedValueOnce({
      code: "conflict",
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: { ticketKey: "LC-1" },
    });
    render(surface());
    const box = await screen.findByLabelText("Review what it changed");

    fireEvent.click(box);
    await screen.findByText("LC-1 checked · Review what it changed");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));

    await screen.findByText("⚠ Changed on disk while you were editing");
    // The panel resolves its own conflicts, in both directions.
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open ticket" })).toBeNull();

    editTicketMock.mockResolvedValue(writeResult());
    fireEvent.click(screen.getByText("Keep mine"));

    await waitFor(() => expect(editTicketMock).toHaveBeenCalledTimes(3));
    expect(editTicketMock.mock.calls[2][0]).toMatchObject({
      expectedHash: "hash-agent",
      // The edit Undo was refused for, re-applied over the newer file.
      edit: { checklist: [{ itemId: "ck_2", checked: false }] },
    });
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
  /** The chips the ticket carries. The `+ add` chip beside them is the control. */
  const chips = () =>
    Array.from(
      document.querySelectorAll(".meta-labels .label-chip:not(.addable)"),
    ).map((chip) => chip.textContent);

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

  /**
   * D-3C. The row was one button with the chips inside it, so the empty state
   * said `None` — a word reporting an absence where the prototype puts an
   * invitation — and every chip was a click target for the same menu.
   */
  it("D-3C: offers + add whether or not the ticket carries labels", async () => {
    readTicketMock.mockResolvedValue(detail({ labels: [] }));
    const view = render(surface());
    await ready();

    const add = () => metaTrigger("Labels");
    expect(add().textContent).toBe("add");
    expect(add().classList.contains("addable")).toBe(true);
    expect(chips()).toEqual([]);
    // The absence is no longer narrated as a control.
    expect(document.querySelector(".meta-labels")?.textContent).not.toContain(
      "None",
    );

    view.unmount();
    readTicketMock.mockResolvedValue(detail({ labels: ["backend"] }));
    render(surface());
    await ready();

    expect(chips()).toEqual(["Backend"]);
    expect(add().textContent).toBe("add");
    // And it still opens the menu that both adds and takes off.
    fireEvent.click(add());
    expect(screen.getByRole("menu", { name: "Labels" })).toBeTruthy();
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

  it("hangs the Edit affordance off the section header, not the body (LC-99)", async () => {
    readTicketMock.mockResolvedValue(
      detail({ description: "The pairs that the panel already holds." }),
    );
    render(surface());
    await ready();

    // D-04: it was absolutely positioned over the rendered markdown, so it
    // painted itself across the first line of the body. The header row has
    // room, and nothing of the ticket's own text is under it there.
    const edit = screen.getByRole("button", { name: /Edit description/ });
    expect(edit.closest(".description-view")).toBeNull();
    expect(edit.closest("h3")?.textContent).toContain("Description");
    // And it is the only way in: the body is not a second click target.
    expect(
      screen.getAllByRole("button", { name: /description/i }),
    ).toHaveLength(1);
  });

  it("leaves an empty description its own invitation, and no second one (LC-99)", async () => {
    readTicketMock.mockResolvedValue(detail({ description: "" }));
    render(surface());
    await ready();

    // An empty description is its own invitation, so the header stays bare —
    // two affordances for one editor would be two Tab stops for one job.
    expect(
      screen.queryByRole("button", { name: /Edit description/ }),
    ).toBeNull();
    const add = screen.getByRole("button", { name: /Add a description/ });
    expect(
      screen.getAllByRole("button", { name: /description/i }),
    ).toHaveLength(1);
    fireEvent.click(add);
    expect(screen.getByLabelText("Description")).toHaveProperty("value", "");
  });
});
