/**
 * What a ticket's context menu offers (LC-222).
 *
 * The rows are a pure function of the ticket, which is the whole reason this
 * file exists: the board and the list must not be able to disagree about what
 * right-clicking a ticket does, and a degraded file must not be offered a field
 * it has not got.
 */

import { describe, expect, it, vi } from "vitest";
import type { MenuItem } from "./MenuList";
import { PRIORITIES, STATUSES } from "./tickets";
import { ticketMenuItems, type TicketMenuActions } from "./ticketMenu";
import type { DegradedTicket, IndexedTicket, TicketRow } from "./types";

const INDEXED: IndexedTicket = {
  state: "indexed",
  key: "LC-1",
  id: "019c8c7e",
  title: "Prove the agent round trip",
  status: "in_progress",
  priority: "p2",
  labels: [],
  createdAt: "2026-07-30T11:00:00Z",
  updatedAt: "2026-07-30T11:59:00Z",
  checkedCount: 1,
  checklistCount: 2,
  commentCount: 0,
  attachmentCount: 0,
  contentHash: "hash-1",
  relativePath: ".longclaw/tickets/LC-1/ticket.md",
};

const DEGRADED: DegradedTicket = {
  state: "degraded",
  key: "LC-98",
  contentHash: "hash-98",
  relativePath: ".longclaw/tickets/LC-98/ticket.md",
  byteLength: 220,
  readOnly: false,
  diagnostic: { code: "parse_failed", message: "no frontmatter" },
};

function actions(): TicketMenuActions {
  return {
    onOpen: vi.fn(),
    onChangeStatus: vi.fn(),
    onChangePriority: vi.fn(),
    onArchive: vi.fn(),
    onCopyKey: vi.fn(),
    onCopyPath: vi.fn(),
  };
}

function ids(ticket: TicketRow, run = actions()): string[] {
  return ticketMenuItems(ticket, run)
    .filter((item) => item.kind !== "rule")
    .map((item) => item.id);
}

function itemFor(items: MenuItem[], id: string): MenuItem {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return found;
}

/** A rule has no label, and asking one for its label is a broken expectation. */
function labelOf(item: MenuItem): string {
  if (item.kind === "rule") throw new Error(`${item.id} is a rule`);
  return item.label;
}

describe("a ticket's context menu", () => {
  it("offers the three the ticket asks for, plus archiving and the key", () => {
    expect(ids(INDEXED)).toEqual([
      "status",
      "priority",
      "archive",
      "copy-key",
      "copy-path",
    ]);
  });

  it("does not offer to open a ticket the card's own click opens", () => {
    // The `Open ticket` row came off: a left-click on the card already opens
    // the panel, so the row spent the menu's first keyboard stop on the action
    // a person who right-clicked has not chosen.
    expect(ids(INDEXED)).not.toContain("open");
  });

  it("lists every status under Move to, with the ticket's own ticked", () => {
    const move = itemFor(ticketMenuItems(INDEXED, actions()), "status");
    if (move.kind !== "submenu") throw new Error("Move to is not a submenu");

    expect(move.items.map(labelOf)).toEqual(
      STATUSES.map((status) => status.label),
    );
    expect(
      move.items.filter((item) => item.kind === "choice" && item.checked),
    ).toHaveLength(1);
    // The row says where the ticket is now, so the answer is legible without
    // opening the submenu at all.
    expect(move.hint).toBe("In Progress");
  });

  it("lists every priority under Priority, with the ticket's own ticked", () => {
    const priority = itemFor(ticketMenuItems(INDEXED, actions()), "priority");
    if (priority.kind !== "submenu") throw new Error("not a submenu");

    expect(priority.items.map(labelOf)).toEqual(
      PRIORITIES.map((option) => option.label),
    );
    expect(priority.hint).toBe("P2");
  });

  it("raises the pick rather than writing it", () => {
    const run = actions();
    const move = itemFor(ticketMenuItems(INDEXED, run), "status");
    if (move.kind !== "submenu") throw new Error("not a submenu");
    const done = move.items.find((item) => labelOf(item) === "Done");

    if (done?.kind !== "choice") throw new Error("no Done row");
    done.run();

    expect(run.onChangeStatus).toHaveBeenCalledWith("done");
  });

  it("names the archive row for what pressing it does", () => {
    expect(
      labelOf(itemFor(ticketMenuItems(INDEXED, actions()), "archive")),
    ).toBe("Archive ticket");
    const archived = { ...INDEXED, archivedAt: "2026-08-01T10:00:00Z" };
    expect(
      labelOf(itemFor(ticketMenuItems(archived, actions()), "archive")),
    ).toBe("Unarchive ticket");
  });

  it("gives every row a mark, so no label stands out of the column", () => {
    // `.menu-glyph` is a fixed 14px box: a row without one starts 22px left of
    // its neighbours, which on a six-row menu reads as a mistake. The degraded
    // menu is the one that had it — two rows, one marked (LC-222's review).
    for (const ticket of [INDEXED, DEGRADED]) {
      for (const item of ticketMenuItems(ticket, actions())) {
        if (item.kind === "rule" || item.kind === "group") continue;
        expect([item.id, item.glyph !== undefined]).toEqual([item.id, true]);
      }
    }
  });

  it("offers a file it could not read only what a file has", () => {
    // `keyboard-focus-map.md:49`: a degraded row takes focus, and there is no
    // status, priority or archive flag in it to write. The path is the one
    // thing it does have — and the one a person right-clicking it wants.
    expect(ids(DEGRADED)).toEqual(["open", "copy-path"]);
  });

  it("opens a degraded file under the name of what will happen", () => {
    // The panel shows the raw file rather than the ticket, so the row does not
    // promise a ticket.
    expect(labelOf(itemFor(ticketMenuItems(DEGRADED, actions()), "open"))).toBe(
      "Open file",
    );
  });

  it("runs the action every leaf row was built with", () => {
    const run = actions();
    const items = ticketMenuItems(INDEXED, run);
    for (const id of ["archive", "copy-key", "copy-path"]) {
      const item = itemFor(items, id);
      if (item.kind !== "action") throw new Error(`${id} is not an action`);
      item.run();
    }

    expect(run.onArchive).toHaveBeenCalledTimes(1);
    expect(run.onCopyKey).toHaveBeenCalledTimes(1);
    expect(run.onCopyPath).toHaveBeenCalledTimes(1);

    // The degraded menu is where `onOpen` still lives, and it is the whole
    // reason the callback survives the row's removal.
    const open = itemFor(ticketMenuItems(DEGRADED, run), "open");
    if (open.kind !== "action") throw new Error("open is not an action");
    open.run();

    expect(run.onOpen).toHaveBeenCalledTimes(1);
  });
});
