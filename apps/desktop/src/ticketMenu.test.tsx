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
import { NO_PROPERTIES } from "./properties";
import { PRIORITIES, STATUSES } from "./tickets";
import {
  ticketMenuItems,
  type TicketMenuActions,
  type TicketMenuContext,
} from "./ticketMenu";
import type {
  DegradedTicket,
  IndexedTicket,
  PropertiesConfig,
  TicketRow,
} from "./types";

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
    onChangeProperty: vi.fn(),
    onPickDate: vi.fn(),
    onArchive: vi.fn(),
    onCopyKey: vi.fn(),
    onCopyPath: vi.fn(),
  };
}

/**
 * A Wednesday, so `Next Monday` is five days out rather than one — a fixture
 * whose weekday the quick picks can be read against.
 */
const TODAY = new Date(2026, 8, 9).getTime();

/**
 * What the project has turned on. The default is every property off, which is
 * every project written before this build: the menu those get is the menu the
 * rest of this file asserts, unchanged.
 */
function context(properties: PropertiesConfig = NO_PROPERTIES): TicketMenuContext {
  return { properties, today: TODAY };
}

function ids(
  ticket: TicketRow,
  run = actions(),
  where = context(),
): string[] {
  return ticketMenuItems(ticket, run, where)
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
    const move = itemFor(ticketMenuItems(INDEXED, actions(), context()), "status");
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
    const priority = itemFor(ticketMenuItems(INDEXED, actions(), context()), "priority");
    if (priority.kind !== "submenu") throw new Error("not a submenu");

    expect(priority.items.map(labelOf)).toEqual(
      PRIORITIES.map((option) => option.label),
    );
    expect(priority.hint).toBe("P2");
  });

  it("raises the pick rather than writing it", () => {
    const run = actions();
    const move = itemFor(ticketMenuItems(INDEXED, run, context()), "status");
    if (move.kind !== "submenu") throw new Error("not a submenu");
    const done = move.items.find((item) => labelOf(item) === "Done");

    if (done?.kind !== "choice") throw new Error("no Done row");
    done.run();

    expect(run.onChangeStatus).toHaveBeenCalledWith("done");
  });

  it("names the archive row for what pressing it does", () => {
    expect(
      labelOf(itemFor(ticketMenuItems(INDEXED, actions(), context()), "archive")),
    ).toBe("Archive ticket");
    const archived = { ...INDEXED, archivedAt: "2026-08-01T10:00:00Z" };
    expect(
      labelOf(itemFor(ticketMenuItems(archived, actions(), context()), "archive")),
    ).toBe("Unarchive ticket");
  });

  it("gives every row a mark, so no label stands out of the column", () => {
    // `.menu-glyph` is a fixed 14px box: a row without one starts 22px left of
    // its neighbours, which on a six-row menu reads as a mistake. The degraded
    // menu is the one that had it — two rows, one marked (LC-222's review).
    for (const ticket of [INDEXED, DEGRADED]) {
      for (const item of ticketMenuItems(ticket, actions(), context())) {
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
    expect(labelOf(itemFor(ticketMenuItems(DEGRADED, actions(), context()), "open"))).toBe(
      "Open file",
    );
  });

  it("runs the action every leaf row was built with", () => {
    const run = actions();
    const items = ticketMenuItems(INDEXED, run, context());
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
    const open = itemFor(ticketMenuItems(DEGRADED, run, context()), "open");
    if (open.kind !== "action") throw new Error("open is not an action");
    open.run();

    expect(run.onOpen).toHaveBeenCalledTimes(1);
  });
});

/**
 * The four opt-in properties, as rows off the same menu (LC-227).
 *
 * The rule that makes four more rows affordable is that none of them exist for
 * a project that has not turned them on — so the first thing asserted here is
 * that the menu above is still the whole menu, and every project written before
 * this build gets exactly it.
 */
describe("the four properties on a ticket's context menu", () => {
  const withType: PropertiesConfig = {
    ...NO_PROPERTIES,
    type: {
      enabled: true,
      values: {
        bug: { name: "Bug", color: "red" },
        chore: { name: "Chore", color: "gray" },
      },
    },
  };
  const withAll: PropertiesConfig = {
    ...withType,
    due: { enabled: true, attentionDays: 7 },
    start: { enabled: true },
    estimate: {
      ...NO_PROPERTIES.estimate,
      enabled: true,
      values: ["s", "m", "l"],
    },
  };
  const held: IndexedTicket = {
    ...INDEXED,
    type: "bug",
    start: "2026-09-01",
    due: "2026-09-20",
    estimate: "m",
  };

  function submenu(items: MenuItem[], id: string) {
    const row = itemFor(items, id);
    if (row.kind !== "submenu") throw new Error(`${id} is not a submenu`);
    return row;
  }

  /** A row's own hint, which is what it says before it is opened. */
  function hintOf(items: MenuItem[], id: string) {
    const row = itemFor(items, id);
    if (row.kind === "rule" || row.kind === "group" || row.kind === "choice") {
      throw new Error(`${id} carries no hint`);
    }
    return row.hint;
  }

  it("leaves a project that has turned none of them on exactly as it was", () => {
    // The reason the other rows are affordable at all. Properties ship off, so
    // this is every project that predates the feature and every one since that
    // has not opted in.
    expect(ids(INDEXED)).toEqual([
      "status",
      "priority",
      "archive",
      "copy-key",
      "copy-path",
    ]);
  });

  it("puts a row in for each property the project enabled, and no others", () => {
    expect(ids(INDEXED, actions(), context(withType))).toEqual([
      "status",
      "priority",
      "type",
      "archive",
      "copy-key",
      "copy-path",
    ]);
    // `enabledPropertyFields`' order, which is the rail's and both create
    // surfaces': what the ticket is, then how much work it is, then when.
    expect(ids(INDEXED, actions(), context(withAll))).toEqual([
      "status",
      "priority",
      "type",
      "estimate",
      "start",
      "due",
      "archive",
      "copy-key",
      "copy-path",
    ]);
  });

  it("says what the ticket holds on the row, so the answer needs no press", () => {
    const items = ticketMenuItems(held, actions(), context(withAll));

    expect(hintOf(items, "type")).toBe("Bug");
    expect(hintOf(items, "start")).toBe("1 Sep");
    expect(hintOf(items, "due")).toBe("20 Sep");
    // Uppercased the way `readEstimate` renders a t-shirt size everywhere else.
    expect(hintOf(items, "estimate")).toBe("M");
  });

  it("shows a value this project cannot read as the file writes it", () => {
    // Invariant 16: a value written under another configuration is preserved,
    // not corrected — so the row shows the bytes rather than an empty slot that
    // would say the ticket holds nothing.
    const foreign: IndexedTicket = {
      ...INDEXED,
      type: "epic",
      due: "soon",
      estimate: "13",
    };
    const items = ticketMenuItems(foreign, actions(), context(withAll));

    expect(hintOf(items, "type")).toBe("epic");
    expect(hintOf(items, "due")).toBe("soon");
    expect(hintOf(items, "estimate")).toBe("13");
  });

  it("offers the project's own type values, and never one it does not define", () => {
    const type = submenu(ticketMenuItems(held, actions(), context(withType)), "type");

    expect(type.items.filter((item) => item.kind === "choice").map(labelOf)).toEqual([
      "Bug",
      "Chore",
    ]);
    expect(
      type.items.filter((item) => item.kind === "choice" && item.checked).map(labelOf),
    ).toEqual(["Bug"]);
  });

  it("offers a date four quick picks, each saying the day it resolves to", () => {
    const due = submenu(ticketMenuItems(held, actions(), context(withAll)), "due");
    const picks = due.items.filter((item) => item.kind === "choice");

    // Nothing is computed silently, which is the whole of the objection the
    // typed grammar raises against `next week`: a row a person points at shows
    // its answer before the press.
    expect(picks.map((item) => [labelOf(item), item.kind === "choice" && item.hint])).toEqual([
      ["Today", "9 Sep"],
      ["Tomorrow", "10 Sep"],
      ["Next Monday", "14 Sep"],
      ["In a week", "16 Sep"],
    ]);
  });

  it("offers start the same rows as due", () => {
    const items = ticketMenuItems(held, actions(), context(withAll));
    const labels = (id: string) => submenu(items, id).items.map((item) => item.id.replace(/^\w+-/, ""));

    // Two adjacent controls whose vocabulary differs is what the grammar
    // section refused for the typed forms; the argument is unchanged here.
    expect(labels("start")).toEqual(labels("due"));
  });

  it("never grows a calendar, and hands what the picks cannot reach to the panel", () => {
    const run = actions();
    const due = submenu(ticketMenuItems(held, run, context(withAll)), "due");
    const out = itemFor(due.items, "due-pick");

    if (out.kind !== "action") throw new Error("Pick a date… is not an action");
    expect(out.label).toBe("Pick a date…");
    out.run();

    expect(run.onPickDate).toHaveBeenCalledWith("due");
  });

  it("writes the day a pick resolves to, in the only spelling the format takes", () => {
    const run = actions();
    const due = submenu(ticketMenuItems(held, run, context(withAll)), "due");
    const monday = itemFor(due.items, "due-monday");

    if (monday.kind !== "choice") throw new Error("no Next Monday row");
    monday.run();

    expect(run.onChangeProperty).toHaveBeenCalledWith("due", "2026-09-14");
  });

  it("ticks a pick the ticket already sits on", () => {
    const on = { ...held, due: "2026-09-14" };
    const due = submenu(ticketMenuItems(on, actions(), context(withAll)), "due");

    expect(
      due.items.filter((item) => item.kind === "choice" && item.checked).map(labelOf),
    ).toEqual(["Next Monday"]);
  });

  it("offers estimate the project's own scale, whichever system it is on", () => {
    const scale = (properties: PropertiesConfig) =>
      submenu(ticketMenuItems(held, actions(), context(properties)), "estimate")
        .items.filter((item) => item.kind === "choice")
        .map(labelOf);

    expect(scale(withAll)).toEqual(["S", "M", "L"]);
    expect(
      scale({
        ...withAll,
        estimate: { ...withAll.estimate, system: "fibonacci" },
      }),
    ).toEqual(["1", "2", "3", "5", "8", "13"]);
    expect(
      scale({
        ...withAll,
        estimate: { ...withAll.estimate, system: "duration" },
      }),
    ).toEqual(["30m", "1h", "2h", "4h", "1d", "2d", "1w"]);
  });

  it("carries Clear on every property submenu, so a set is never a one-way door", () => {
    const items = ticketMenuItems(held, actions(), context(withAll));

    for (const property of ["type", "estimate", "start", "due"]) {
      const clear = itemFor(submenu(items, property).items, `${property}-clear`);
      if (clear.kind !== "action") throw new Error(`${property} Clear is not an action`);
      expect(clear.label).toBe("Clear");
    }
  });

  it("clears by asking for nothing, which is what an absent value is", () => {
    const run = actions();
    const due = submenu(ticketMenuItems(held, run, context(withAll)), "due");
    const clear = itemFor(due.items, "due-clear");

    if (clear.kind !== "action") throw new Error("Clear is not an action");
    clear.run();

    expect(run.onChangeProperty).toHaveBeenCalledWith("due", undefined);
  });

  it("leaves Clear out of a submenu with nothing to clear", () => {
    // A row that cannot do anything is worse than no row: it says the ticket
    // holds a value.
    const items = ticketMenuItems(INDEXED, actions(), context(withAll));

    for (const property of ["type", "estimate", "start", "due"]) {
      expect(
        submenu(items, property).items.map((item) => item.id),
      ).not.toContain(`${property}-clear`);
    }
  });

  it("keeps every row on the mark column, including the rows with no mark", () => {
    // The 14px `.menu-glyph` box is what aligns them, and a row that skips it
    // starts 22px left of its neighbours. Estimate is the one row in the menu
    // with nothing to draw — the ticket says so — so its slot is empty rather
    // than absent, and the quick picks and every Clear are the same.
    const items = ticketMenuItems(held, actions(), context(withAll));
    for (const item of items) {
      if (item.kind === "rule" || item.kind === "group") continue;
      expect([item.id, item.glyph !== undefined]).toEqual([item.id, true]);
      if (item.kind !== "submenu") continue;
      for (const row of item.items) {
        if (row.kind === "rule" || row.kind === "group") continue;
        expect([row.id, row.glyph !== undefined]).toEqual([row.id, true]);
      }
    }
  });
});
