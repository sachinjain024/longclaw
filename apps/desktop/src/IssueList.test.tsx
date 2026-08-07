// @vitest-environment jsdom

/**
 * The list surface: what exists, grouped by status, including the archive and
 * the Canceled tickets the board only conditionally shows.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalMarks } from "./freshness";
import { IssueList } from "./IssueList";
import {
  GROUP_HEADER_HEIGHT,
  ROW_HEIGHT,
  groupBodyHeight,
} from "./listGeometry";
import type * as ListRow from "./listRow";
import type { OrderingMode } from "./ordering";
import type {
  IndexedTicket,
  Label,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

/** Every row presents itself once, so this is what the memoization is judged on. */
const { presented } = vi.hoisted(() => ({ presented: [] as string[] }));

vi.mock("./listRow", async (importOriginal) => {
  const actual = await importOriginal<typeof ListRow>();
  return {
    presentRow: (...args: Parameters<typeof actual.presentRow>) => {
      presented.push(args[0].key);
      return actual.presentRow(...args);
    },
  };
});

const NOW = Date.parse("2026-07-31T12:00:00Z");

const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
  docs: { name: "Docs", color: "cyan" },
};

function row(
  overrides?: Partial<Extract<TicketRow, { state: "indexed" }>>,
): TicketRow {
  return {
    state: "indexed",
    key: "LC-1",
    id: "019c8c7e",
    title: "Prove the agent round trip",
    status: "in_progress",
    priority: "p2",
    labels: [],
    createdAt: "2026-07-30T11:00:00Z",
    updatedAt: "2026-07-31T11:58:00Z",
    checkedCount: 1,
    checklistCount: 2,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: "hash-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
    ...overrides,
  };
}

const noop = () => {};

function list(props?: {
  tickets?: TicketRow[];
  selectedKey?: string;
  marks?: ExternalMarks;
  ordering?: OrderingMode;
  onSelect?: (key: string) => void;
  onChangePriority?: (ticket: IndexedTicket, next: TicketPriority) => void;
  onChangeStatus?: (ticket: IndexedTicket, next: TicketStatus) => void;
}) {
  return (
    <IssueList
      tickets={props?.tickets ?? [row()]}
      selectedKey={props?.selectedKey}
      marks={props?.marks ?? {}}
      labels={DEFINITIONS}
      ordering={props?.ordering ?? "priority"}
      now={NOW}
      onSelect={props?.onSelect ?? noop}
      onChangePriority={props?.onChangePriority ?? noop}
      onChangeStatus={props?.onChangeStatus ?? noop}
    />
  );
}

/** The keys of every drawn row, in the order the list drew them. */
function rowKeys(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".list-row")).map(
    (element) => element.dataset.ticketKey ?? "",
  );
}

function listRow(key: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `.list-row[data-ticket-key="${key}"]`,
  );
  if (!element) throw new Error(`no row for ${key}`);
  return element;
}

/** The group titles the list drew, in the order it drew them. */
function groupTitles(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".list-group-header"),
  ).map((header) => header.textContent ?? "");
}

function scroller(): HTMLElement {
  const element = document.querySelector<HTMLElement>(".issue-list");
  if (!element) throw new Error("no list scroller");
  return element;
}

/** jsdom lays nothing out, so a scroll has to be stated rather than performed. */
function scrollTo(element: HTMLElement, top: number) {
  Object.defineProperty(element, "scrollTop", {
    value: top,
    configurable: true,
  });
  fireEvent.scroll(element);
}

function many(count: number, status: "todo" | "done" = "todo"): TicketRow[] {
  return Array.from({ length: count }, (_, index) =>
    row({
      key: `LC-${index + 1}`,
      title: `Ticket ${index + 1}`,
      status,
      priority: "none",
    }),
  );
}

beforeEach(() => {
  presented.length = 0;
});

afterEach(cleanup);

describe("the groups the list draws", () => {
  it("draws only the statuses that hold tickets", () => {
    render(
      list({
        tickets: [
          row({ key: "LC-1", status: "todo" }),
          row({ key: "LC-2", status: "canceled" }),
        ],
      }),
    );

    // Unlike the board, which keeps every column of the fixed set (ADR 0002).
    expect(groupTitles()).toEqual(["Todo1", "Canceled1"]);
  });

  it("keeps the status order the rest of the app uses", () => {
    render(
      list({
        tickets: [
          row({ key: "LC-1", status: "done" }),
          row({ key: "LC-2", status: "backlog" }),
          row({ key: "LC-3", status: "in_review" }),
        ],
      }),
    );

    expect(groupTitles()).toEqual(["Backlog1", "In Review1", "Done1"]);
  });

  it("gives each group its status dot", () => {
    render(list({ tickets: [row({ status: "in_progress" })] }));

    const header = document.querySelector(".list-group-header");
    expect(
      header?.querySelector(".status-dot.status-in-progress"),
    ).toBeTruthy();
  });

  it("orders a group by priority, stable within a level (ADR 0003)", () => {
    render(
      list({
        tickets: [
          row({ key: "LC-1", status: "todo", priority: "none" }),
          row({ key: "LC-4", status: "todo", priority: "p2" }),
          row({ key: "LC-3", status: "todo", priority: "urgent" }),
          row({ key: "LC-2", status: "todo", priority: "p2" }),
        ],
      }),
    );

    expect(
      Array.from(document.querySelectorAll<HTMLElement>(".list-row")).map(
        (element) => element.dataset.ticketKey,
      ),
    ).toEqual(["LC-3", "LC-4", "LC-2", "LC-1"]);
  });
});

describe("what one row says", () => {
  it("carries the anatomy the spec sets, in that order", () => {
    render(
      list({
        tickets: [
          row({
            status: "in_review",
            priority: "urgent",
            labels: ["backend", "reliability"],
            checkedCount: 1,
            checklistCount: 3,
            updatedAt: "2026-07-31T09:00:00Z",
          }),
        ],
      }),
    );

    const element = listRow("LC-1");
    expect(element.querySelector(".status-dot.status-in-review")).toBeTruthy();
    expect(element.querySelector(".list-row-key")?.textContent).toBe("LC-1");
    expect(
      element.querySelector('[aria-label="Priority: Urgent"]'),
    ).toBeTruthy();
    expect(element.querySelector("strong")?.textContent).toBe(
      "Prove the agent round trip",
    );
    expect(element.querySelector(".list-row-checklist")?.textContent).toBe(
      "1/3",
    );
    expect(
      Array.from(element.querySelectorAll(".label-chip")).map(
        (chip) => chip.textContent,
      ),
    ).toEqual(["Backend", "Reliability"]);
    expect(element.querySelector(".list-row-updated")?.textContent).toBe("3h");
    // No assignee slot in v0 (ADR 0001).
    expect(element.querySelector(".avatar")).toBeNull();
  });

  // `just now` wrapped onto a second line inside the 46px column and made the
  // row taller than its neighbours (D-35); the slot's vocabulary is one word.
  it("says now for a ticket that changed a moment ago, not just now", () => {
    render(
      list({
        tickets: [row({ updatedAt: new Date(NOW - 400).toISOString() })],
      }),
    );

    expect(
      listRow("LC-1").querySelector(".list-row-updated")?.textContent,
    ).toBe("now");
  });

  it("names the status for anyone who cannot see the dot's colour", () => {
    render(list({ tickets: [row({ status: "done" })] }));

    expect(
      listRow("LC-1").querySelector('[aria-label="Status: Done"]'),
    ).toBeTruthy();
  });

  it("says nothing about a checklist a ticket does not have", () => {
    render(list({ tickets: [row({ checkedCount: 0, checklistCount: 0 })] }));

    expect(listRow("LC-1").querySelector(".list-row-checklist")).toBeNull();
  });

  it("stops at two label chips", () => {
    render(
      list({
        tickets: [row({ labels: ["backend", "reliability", "docs"] })],
      }),
    );

    expect(listRow("LC-1").querySelectorAll(".label-chip")).toHaveLength(2);
  });

  it("wears the fresh dot while an external change is unreviewed", () => {
    const marks: ExternalMarks = {
      "LC-1": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - 5_000,
      },
    };
    render(list({ marks }));

    const element = listRow("LC-1");
    expect(element.className).toContain("fresh");
    expect(element.querySelector(".pulse-dot")).toBeTruthy();
    // The row is 36px whatever it is wearing; nothing here grows a footer.
    expect(element.className).not.toContain("human-fresh");
  });

  it("opens the ticket the row belongs to", () => {
    const onSelect = vi.fn();
    render(list({ onSelect }));

    fireEvent.click(listRow("LC-1"));

    expect(onSelect).toHaveBeenCalledWith("LC-1");
  });
});

describe("a file the build cannot read", () => {
  const unreadable: TicketRow = {
    state: "degraded",
    key: "LC-98",
    contentHash: "hash-98",
    relativePath: ".longclaw/tickets/LC-98/ticket.md",
    byteLength: 220,
    readOnly: false,
    diagnostic: { code: "parse_failed", message: "no frontmatter" },
  };

  // Above the statuses rather than under them; `grouping.ts` argues why.
  it("keeps its place in the list, in its own group above the statuses", () => {
    render(list({ tickets: [row({ status: "todo" }), unreadable] }));

    expect(groupTitles()).toEqual(["Unreadable1", "Todo1"]);
  });

  // The other half of D-50 / LC-133, and the same rule on both surfaces: the
  // synthetic group is where a row with no remembered status goes, not where
  // every unreadable file goes.
  it("keeps a file that broke in the group it last read in", () => {
    render(
      list({
        tickets: [
          row({ status: "todo" }),
          { ...unreadable, lastKnownStatus: "todo" },
        ],
      }),
    );

    expect(groupTitles()).toEqual(["Todo2"]);
    expect(listRow("LC-98").className).toContain("degraded");
  });

  it("shows no freshness dot: nothing in it parsed to be fresh about", () => {
    const marks: ExternalMarks = {
      "LC-98": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - 1_000,
      },
    };
    render(list({ tickets: [unreadable], marks }));

    const element = listRow("LC-98");
    expect(element.querySelector(".pulse-dot")).toBeNull();
    expect(element.className).not.toContain("fresh");
    // The danger treatment is the whole of what the row wears.
    expect(element.className).toContain("degraded");
  });

  it("shows the warning, the file name, and where the raw file is", () => {
    render(list({ tickets: [unreadable] }));

    const element = listRow("LC-98");
    expect(element.className).toContain("degraded");
    expect(element.querySelector(".row-warn")).toBeTruthy();
    expect(element.querySelector("strong")?.textContent).toBe(
      ".longclaw/tickets/LC-98/ticket.md",
    );
    expect(element.textContent).toContain("View raw file");
    // Nothing claims a status the file never stated.
    expect(element.querySelector(".status-dot")).toBeNull();
  });

  it("labels a newer-version row as newer format instead of repair work", () => {
    render(
      list({
        tickets: [
          {
            state: "degraded",
            key: "LC-99",
            contentHash: "hash-99",
            relativePath: ".longclaw/tickets/LC-99/ticket.md",
            byteLength: 260,
            readOnly: true,
            diagnostic: {
              code: "unsupported_version",
              message: "schema version 99 is newer than this build supports",
            },
          },
        ],
      }),
    );

    const element = listRow("LC-99");
    expect(element.className).toContain("degraded");
    expect(element.textContent).toContain(".longclaw/tickets/LC-99/ticket.md");
    expect(element.textContent).toContain("Newer format");
    expect(element.textContent).not.toContain("needs repair");
  });
});

describe("the archived group (ADR 0004)", () => {
  const tickets = [
    row({ key: "LC-1", status: "todo" }),
    row({
      key: "LC-2",
      status: "done",
      title: "Old thing",
      archivedAt: "2026-07-20T09:00:00Z",
    }),
    row({
      key: "LC-3",
      status: "canceled",
      title: "Older thing",
      archivedAt: "2026-07-10T09:00:00Z",
    }),
  ];

  const toggle = () => screen.getByRole("button", { name: /Archived/ });

  it("sits below the last status group, collapsed, with its count", () => {
    render(list({ tickets }));

    expect(groupTitles()).toEqual(["Todo1", "▤Archived2Show"]);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-ticket-key="LC-2"]')).toBeNull();
  });

  it("keeps archived tickets out of their status groups", () => {
    render(list({ tickets }));

    // LC-2 is done and LC-3 is canceled, and neither group exists: the only
    // tickets those statuses had are archived.
    expect(groupTitles()).toEqual(["Todo1", "▤Archived2Show"]);
  });

  it("shows the rows when the header button is pressed", () => {
    render(list({ tickets }));

    fireEvent.click(toggle());

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(listRow("LC-2")).toBeTruthy();
    expect(listRow("LC-3")).toBeTruthy();
    // Same anatomy as any other row, and it opens the panel normally.
    expect(
      listRow("LC-2").querySelector(".status-dot.status-done"),
    ).toBeTruthy();
  });

  it("stays away entirely when the project has archived nothing", () => {
    render(list({ tickets: [row()] }));

    expect(screen.queryByRole("button", { name: /Archived/ })).toBeNull();
  });
});

describe("a list holding more rows than it can show", () => {
  it("renders the rows the viewport touches and not the rest", () => {
    render(list({ tickets: many(400) }));

    const rendered = document.querySelectorAll(".list-row");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(400);
    // It still says how many tickets the group holds, not how many it drew.
    expect(groupTitles()).toEqual(["Todo400"]);
  });

  it("reserves the whole group's height, so the scrollbar tells the truth", () => {
    render(list({ tickets: many(400) }));

    const body = document.querySelector<HTMLElement>(".list-group-body");
    expect(body?.style.height).toBe(`${groupBodyHeight(400)}px`);
  });

  it("swaps in the rows a scroll brings into view", () => {
    render(list({ tickets: many(400) }));
    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeNull();

    scrollTo(scroller(), GROUP_HEADER_HEIGHT + 299 * ROW_HEIGHT);

    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeTruthy();
    expect(document.querySelector('[data-ticket-key="LC-2"]')).toBeNull();
  });

  it("keeps the focused row mounted and focused after it scrolls away", () => {
    render(list({ tickets: many(400) }));

    listRow("LC-1").focus();
    scrollTo(scroller(), GROUP_HEADER_HEIGHT + 299 * ROW_HEIGHT);

    expect(document.activeElement).toBe(listRow("LC-1"));
    expect(document.querySelector('[data-ticket-key="LC-3"]')).toBeNull();
  });

  it("keeps the open ticket's row mounted, so closing the panel can return to it", () => {
    render(list({ tickets: many(400), selectedKey: "LC-200" }));

    expect(listRow("LC-200").className).toContain("selected");
  });
});

describe("moving through the list with the keyboard", () => {
  const across = [
    row({ key: "LC-1", title: "First", status: "todo", priority: "none" }),
    row({ key: "LC-2", title: "Second", status: "todo", priority: "none" }),
    row({ key: "LC-3", title: "Third", status: "done", priority: "none" }),
  ];

  it("gives the list a single tab stop", () => {
    render(list({ tickets: across }));

    const stops = Array.from(
      document.querySelectorAll<HTMLElement>(".list-row"),
    ).filter((element) => element.tabIndex === 0);

    expect(stops.map((element) => element.dataset.ticketKey)).toEqual(["LC-1"]);
  });

  it("moves down the list in visual order", () => {
    render(list({ tickets: across }));
    listRow("LC-1").focus();

    fireEvent.keyDown(listRow("LC-1"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(listRow("LC-2"));
    expect(listRow("LC-2").tabIndex).toBe(0);
    expect(listRow("LC-1").tabIndex).toBe(-1);
  });

  it("takes j and k as the same move", () => {
    render(list({ tickets: across }));
    listRow("LC-1").focus();

    fireEvent.keyDown(listRow("LC-1"), { key: "j" });
    expect(document.activeElement).toBe(listRow("LC-2"));

    fireEvent.keyDown(listRow("LC-2"), { key: "k" });
    expect(document.activeElement).toBe(listRow("LC-1"));
  });

  it("crosses a group header rather than stopping at it", () => {
    render(list({ tickets: across }));
    listRow("LC-2").focus();

    fireEvent.keyDown(listRow("LC-2"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(listRow("LC-3"));
  });

  it("stays put at the top of the list", () => {
    render(list({ tickets: across }));
    listRow("LC-1").focus();

    fireEvent.keyDown(listRow("LC-1"), { key: "ArrowUp" });

    expect(document.activeElement).toBe(listRow("LC-1"));
  });

  it("leaves a modified arrow to the window", () => {
    render(list({ tickets: across }));
    listRow("LC-1").focus();

    fireEvent.keyDown(listRow("LC-1"), { key: "ArrowDown", metaKey: true });

    expect(document.activeElement).toBe(listRow("LC-1"));
  });

  it("reaches a row the list is not currently rendering", () => {
    render(list({ tickets: many(400) }));
    scrollTo(scroller(), GROUP_HEADER_HEIGHT + 299 * ROW_HEIGHT);
    listRow("LC-300").focus();

    fireEvent.keyDown(listRow("LC-300"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(listRow("LC-301"));
  });

  it("leaves the archived toggle its own tab stop", () => {
    // The header button is the keyboard path to the archive
    // (`keyboard-focus-map.md:110`), so it is reachable rather than roved over.
    render(
      list({
        tickets: [
          row({ key: "LC-1", status: "todo" }),
          row({
            key: "LC-2",
            status: "done",
            archivedAt: "2026-07-20T09:00:00Z",
          }),
        ],
      }),
    );

    expect(screen.getByRole("button", { name: /Archived/ }).tabIndex).not.toBe(
      -1,
    );
  });
});

describe("what a change to one ticket costs", () => {
  const three = [
    row({ key: "LC-1", title: "First", status: "todo", priority: "none" }),
    row({ key: "LC-2", title: "Second", status: "todo", priority: "none" }),
    row({ key: "LC-3", title: "Third", status: "done", priority: "none" }),
  ];

  it("re-renders the row that changed and no other", () => {
    const { rerender } = render(list({ tickets: three }));
    presented.length = 0;

    rerender(
      list({
        tickets: three.map((ticket) =>
          ticket.key === "LC-2" ? { ...ticket, title: "Changed" } : ticket,
        ),
      }),
    );

    expect(presented).toEqual(["LC-2"]);
  });
});

describe("the list follows the board's ordering preference (V0-09)", () => {
  it("orders the rows inside a group by rank in Manual", () => {
    // `screen-specs.md:146`. One preference, two surfaces; the drag affordance
    // is the board's alone.
    const tickets = [
      row({ key: "LC-1", status: "todo", priority: "urgent", rank: "a2" }),
      row({ key: "LC-2", status: "todo", priority: "p4", rank: "a0" }),
      row({ key: "LC-3", status: "todo", priority: "p2", rank: "a1" }),
    ];

    const { rerender } = render(list({ tickets, ordering: "priority" }));
    expect(rowKeys()).toEqual(["LC-1", "LC-3", "LC-2"]);

    rerender(list({ tickets, ordering: "manual" }));
    expect(rowKeys()).toEqual(["LC-2", "LC-3", "LC-1"]);
  });

  it("gives no row a drag handle", () => {
    render(list({ ordering: "manual" }));

    expect(document.querySelector(".list-row[draggable=true]")).toBeNull();
  });
});
