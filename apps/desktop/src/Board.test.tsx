// @vitest-environment jsdom

/**
 * The board's acknowledgement of a change that came from disk, which is the
 * moment the whole slice exists to prove.
 */

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "./Board";
import type * as BoardCard from "./boardCard";
import { ASSUMED_VIEWPORT, CARD_STRIDE } from "./boardGeometry";
import type { OrderingMode } from "./ordering";
import { FRESH_WINDOW_MS } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import type { IndexedTicket, Label, TicketPriority, TicketRow } from "./types";

/**
 * Every card render presents itself exactly once, so this is the render count
 * the board's memoization is judged on.
 */
const { presented } = vi.hoisted(() => ({ presented: [] as string[] }));

vi.mock("./boardCard", async (importOriginal) => {
  const actual = await importOriginal<typeof BoardCard>();
  return {
    presentCard: (...args: Parameters<typeof actual.presentCard>) => {
      presented.push(args[0].key);
      return actual.presentCard(...args);
    },
  };
});

const NOW = 1_800_000_000_000;

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
    updatedAt: "2026-07-30T11:59:00Z",
    checkedCount: 1,
    checklistCount: 2,
    commentCount: 0,
    attachmentCount: 0,
    contentHash: "hash-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
    ...overrides,
  };
}

function mark(overrides?: Partial<ExternalMark>): ExternalMarks {
  return {
    "LC-1": {
      actorType: "agent",
      actorLabel: "Claude Code",
      at: NOW - 12_000,
      ...overrides,
    },
  };
}

/**
 * Stable, the way `App` passes it: a card holds its render only while the
 * callbacks it was handed hold too.
 */
const noop = () => {};

const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
  docs: { name: "Docs", color: "cyan" },
};

function board(props?: {
  tickets?: TicketRow[];
  marks?: ExternalMarks;
  labels?: Record<string, Label>;
  ordering?: OrderingMode;
  onChangePriority?: (ticket: IndexedTicket, next: TicketPriority) => void;
  onReorder?: (ticket: IndexedTicket, rank: string) => void;
}) {
  return (
    <Board
      tickets={props?.tickets ?? [row()]}
      marks={props?.marks ?? {}}
      labels={props?.labels ?? DEFINITIONS}
      ordering={props?.ordering ?? "priority"}
      now={NOW}
      onSelect={noop}
      onChangePriority={props?.onChangePriority ?? noop}
      onReorder={props?.onReorder ?? noop}
    />
  );
}

function card(key: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `.ticket-row[data-ticket-key="${key}"]`,
  );
  if (!element) throw new Error(`no card for ${key}`);
  return element;
}

/** A column long enough that the window cannot hold all of it. */
function columnOf(count: number, status: "todo" | "in_progress" = "todo") {
  return Array.from({ length: count }, (_, index) =>
    row({ key: `LC-${index + 1}`, title: `Ticket ${index + 1}`, status }),
  );
}

/** The scroll container of one named column; every column has one. */
function stack(title = "Todo"): HTMLElement {
  const heading = screen.getByRole("heading", {
    name: new RegExp(`^${title}`),
  });
  const element = heading
    .closest(".board-column")
    ?.querySelector<HTMLElement>(".board-stack");
  if (!element) throw new Error(`no column for ${title}`);
  return element;
}

function sizer(title = "Todo"): HTMLElement {
  const element = stack(title).querySelector<HTMLElement>(".board-sizer");
  if (!element) throw new Error(`no sizer for ${title}`);
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

beforeEach(() => {
  presented.length = 0;
});

afterEach(cleanup);

describe("a card carrying an unreviewed agent change", () => {
  it("wears the ring, the pulse, and the actor the file named", () => {
    render(board({ marks: mark() }));

    const element = card("LC-1");
    expect(element.className).toContain("fresh");
    expect(element.className).not.toContain("human-fresh");
    expect(element.querySelector(".pulse-dot")).toBeTruthy();
    expect(element.textContent).toContain(
      "❯ updated by Claude Code · 12s · via file edit",
    );
  });

  it("says so plainly when the change named no actor", () => {
    render(
      board({
        marks: mark({ actorType: "unknown", actorLabel: "actor unknown" }),
      }),
    );

    expect(card("LC-1").textContent).toContain(
      "⚠ file changed on disk — actor unknown",
    );
  });

  it("keeps a person's file edit out of the agent accent", () => {
    render(
      board({ marks: mark({ actorType: "human", actorLabel: "a person" }) }),
    );

    const element = card("LC-1");
    expect(element.className).toContain("human-fresh");
    expect(element.textContent).toContain(
      "• changed on disk · 12s · via file edit",
    );
  });

  it("drops the treatment once the change has decayed", () => {
    render(board({ marks: mark({ at: NOW - FRESH_WINDOW_MS }) }));

    const element = card("LC-1");
    expect(element.className).not.toContain("fresh");
    expect(element.querySelector(".pulse-dot")).toBeNull();
    expect(element.textContent).not.toContain("via file edit");
  });

  it("says nothing about a card the app itself wrote", () => {
    render(board());

    expect(card("LC-1").className).not.toContain("fresh");
    expect(card("LC-1").textContent).not.toContain("via file edit");
  });
});

describe("the pulse, which says a change just landed", () => {
  it("beats on a change that has only just arrived", () => {
    render(board({ marks: mark({ at: NOW - 200 }) }));

    expect(card("LC-1").querySelector(".pulse-dot")?.className).toContain(
      "pulsing",
    );
  });

  it("does not beat again for a change the human has already seen", () => {
    render(board({ marks: mark({ at: NOW - 30_000 }) }));

    // Still acknowledged — the ring and the footer are still true — but the
    // two-beat pulse is the part that means "just now", and it already played.
    const element = card("LC-1");
    expect(element.className).toContain("fresh");
    expect(element.textContent).toContain("via file edit");
    expect(element.querySelector(".pulse-dot")?.className).not.toContain(
      "pulsing",
    );
  });

  // A column renders only what it can show, so a card that scrolls away and
  // comes back is a fresh mount, and a CSS animation restarts whenever its
  // element mounts.
  it("does not beat again for a card a scroll brings back", () => {
    // LC-50 rather than LC-1: the first card holds the tab stop, so it is an
    // anchor and never unmounts.
    const marks: ExternalMarks = {
      "LC-50": {
        actorType: "agent",
        actorLabel: "Claude Code",
        at: NOW - 30_000,
      },
    };
    render(
      <Board
        tickets={columnOf(400)}
        marks={marks}
        labels={DEFINITIONS}
        now={NOW}
        onSelect={noop}
        ordering="priority"
        onChangePriority={noop}
        onReorder={noop}
      />,
    );
    scrollTo(stack(), 49 * CARD_STRIDE);
    expect(card("LC-50").className).toContain("fresh");

    scrollTo(stack(), 299 * CARD_STRIDE);
    expect(document.querySelector('[data-ticket-key="LC-50"]')).toBeNull();
    scrollTo(stack(), 49 * CARD_STRIDE);

    const element = card("LC-50");
    expect(element.className).toContain("fresh");
    expect(element.querySelector(".pulse-dot")?.className).not.toContain(
      "pulsing",
    );
  });
});

describe("the board's own shape", () => {
  it("groups tickets under their status and counts them", () => {
    render(
      board({
        tickets: [
          row(),
          row({ key: "LC-2", title: "Second", status: "todo" }),
          row({ key: "LC-3", title: "Third", status: "todo" }),
        ],
      }),
    );

    const todo = screen.getByRole("heading", { name: /Todo/ });
    expect(todo.textContent).toBe("Todo2");
    expect(
      screen.getByRole("heading", { name: /In Progress/ }).textContent,
    ).toBe("In Progress1");
    // Every fixed status keeps its column, empty or not (ADR 0002).
    expect(screen.getByRole("heading", { name: /Canceled/ }).textContent).toBe(
      "Canceled0",
    );
  });

  it("keeps a file it cannot read on the board, in its own column", () => {
    render(
      board({
        tickets: [
          row(),
          {
            state: "degraded",
            key: "LC-98",
            contentHash: "hash-98",
            relativePath: ".longclaw/tickets/LC-98/ticket.md",
            byteLength: 220,
            readOnly: false,
            diagnostic: {
              code: "parse_failed",
              message: "status must be one of backlog, todo; found blocked",
              line: 6,
            },
          },
        ],
      }),
    );

    const degraded = card("LC-98");
    expect(degraded.className).toContain("degraded");
    expect(degraded.textContent).toContain(".longclaw/tickets/LC-98/ticket.md");
    expect(degraded.textContent).toContain("needs repair");
    expect(screen.getByRole("heading", { name: /Unreadable/ })).toBeTruthy();
  });

  it("opens the ticket a card belongs to", () => {
    const onSelect = vi.fn();
    render(
      <Board
        tickets={[row()]}
        marks={{}}
        labels={DEFINITIONS}
        now={NOW}
        onSelect={onSelect}
        ordering="priority"
        onChangePriority={noop}
        onReorder={noop}
      />,
    );

    fireEvent.click(card("LC-1"));

    expect(onSelect).toHaveBeenCalledWith("LC-1");
  });
});

describe("a column holding more cards than it can show", () => {
  it("renders the cards the viewport touches and not the rest", () => {
    render(board({ tickets: columnOf(400) }));

    const rendered = document.querySelectorAll(".ticket-row");
    // A card and its gap is CARD_STRIDE tall, so an unmeasured column holds
    // about ASSUMED_VIEWPORT / CARD_STRIDE of them, plus the overscan.
    expect(rendered.length).toBeGreaterThan(ASSUMED_VIEWPORT / CARD_STRIDE);
    expect(rendered.length).toBeLessThan(400);
    // It still says how many tickets are in the column, not how many it drew.
    expect(screen.getByRole("heading", { name: /Todo/ }).textContent).toBe(
      "Todo400",
    );
  });

  it("reserves the whole column's height, so the scrollbar tells the truth", () => {
    render(board({ tickets: columnOf(400) }));

    expect(sizer().style.height).toBe(`${400 * CARD_STRIDE}px`);
  });

  it("swaps in the cards a scroll brings into view", () => {
    render(board({ tickets: columnOf(400) }));
    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeNull();

    scrollTo(stack(), 299 * CARD_STRIDE);

    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeTruthy();
    expect(document.querySelector('[data-ticket-key="LC-2"]')).toBeNull();
  });
});

describe("focus on a column that is being scrolled", () => {
  it("keeps the focused card mounted and focused after it scrolls away", () => {
    render(board({ tickets: columnOf(400) }));

    card("LC-1").focus();
    expect(document.activeElement).toBe(card("LC-1"));

    scrollTo(stack(), 299 * CARD_STRIDE);

    // The card the human is standing on stays, wherever the column has scrolled
    // to. Unmounting it would move focus to the body without saying so.
    expect(card("LC-1")).toBeTruthy();
    expect(document.activeElement).toBe(card("LC-1"));
    // Its neighbours, which nobody is standing on, are gone.
    expect(document.querySelector('[data-ticket-key="LC-3"]')).toBeNull();
  });

  it("keeps the open ticket's card mounted, so closing the panel can return to it", () => {
    render(
      <Board
        tickets={columnOf(400)}
        selectedKey="LC-200"
        marks={{}}
        labels={DEFINITIONS}
        now={NOW}
        onSelect={() => {}}
        ordering="priority"
        onChangePriority={noop}
        onReorder={noop}
      />,
    );

    scrollTo(stack(), 0);

    expect(card("LC-200").className).toContain("selected");
  });
});

describe("moving through the board with the keyboard", () => {
  const across = [
    row({ key: "LC-1", title: "First", status: "todo" }),
    row({ key: "LC-2", title: "Second", status: "todo" }),
    row({ key: "LC-3", title: "Third", status: "in_progress" }),
  ];

  it("gives the board a single tab stop", () => {
    render(board({ tickets: across }));

    const stops = Array.from(
      document.querySelectorAll<HTMLElement>(".ticket-row"),
    ).filter((element) => element.tabIndex === 0);

    expect(stops.map((element) => element.dataset.ticketKey)).toEqual(["LC-1"]);
  });

  it("moves down the column in visual order", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(card("LC-2"));
    expect(card("LC-2").tabIndex).toBe(0);
    expect(card("LC-1").tabIndex).toBe(-1);
  });

  it("takes j and k as the same move", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "j" });
    expect(document.activeElement).toBe(card("LC-2"));

    fireEvent.keyDown(card("LC-2"), { key: "k" });
    expect(document.activeElement).toBe(card("LC-1"));
  });

  it("stays put at the end of a column", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "ArrowUp" });

    expect(document.activeElement).toBe(card("LC-1"));
  });

  it("crosses to the next column that has cards", () => {
    render(board({ tickets: across }));
    card("LC-2").focus();

    // Backlog is empty and In Progress is two columns over; the move skips the
    // empty column and clamps to the last card of the one it lands in.
    fireEvent.keyDown(card("LC-2"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(card("LC-3"));
  });

  it("leaves a modified arrow to the window", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "ArrowDown", metaKey: true });

    expect(document.activeElement).toBe(card("LC-1"));
  });

  it("reaches a card the column is not currently rendering", () => {
    render(board({ tickets: columnOf(400) }));
    scrollTo(stack(), 299 * CARD_STRIDE);
    card("LC-300").focus();

    fireEvent.keyDown(card("LC-300"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(card("LC-301"));
  });
});

describe("what a change to one ticket costs", () => {
  const three = [
    row({ key: "LC-1", title: "First", status: "todo" }),
    row({ key: "LC-2", title: "Second", status: "in_progress" }),
    row({ key: "LC-3", title: "Third", status: "in_review" }),
  ];

  it("re-renders the card that changed and no other", () => {
    const { rerender } = render(board({ tickets: three }));
    presented.length = 0;

    // The store replaces the row that changed and keeps the rest, which is what
    // lets the other cards hold (state.ts `applyEvent`).
    rerender(
      board({
        tickets: three.map((ticket) =>
          ticket.key === "LC-2" ? { ...ticket, title: "Changed" } : ticket,
        ),
      }),
    );

    expect(presented).toEqual(["LC-2"]);
  });

  it("re-renders only the acknowledged card as its age ticks over", () => {
    // LC-1 wears an acknowledgement; LC-2 and LC-3 do not.
    const marks = mark({ at: NOW - 12_000 });
    const { rerender } = render(
      <Board
        tickets={three}
        marks={marks}
        labels={DEFINITIONS}
        now={NOW}
        onSelect={noop}
        ordering="priority"
        onChangePriority={noop}
        onReorder={noop}
      />,
    );
    presented.length = 0;

    // The clock behind the acknowledgement's age moves every second, and it
    // moves for the whole board. Only the card with an age to show reads it.
    rerender(
      <Board
        tickets={three}
        marks={marks}
        labels={DEFINITIONS}
        now={NOW + 1_000}
        onSelect={noop}
        ordering="priority"
        onChangePriority={noop}
        onReorder={noop}
      />,
    );

    expect(presented).toEqual(["LC-1"]);
  });
});

describe("priority on the board", () => {
  // Handed in deliberately out of key order: "stable within a level" is about
  // the order the tickets arrived in, and LC-4 arrives before LC-2.
  const column = [
    row({ key: "LC-1", title: "None", status: "todo", priority: "none" }),
    row({ key: "LC-4", title: "First p2", status: "todo", priority: "p2" }),
    row({ key: "LC-3", title: "Urgent", status: "todo", priority: "urgent" }),
    row({ key: "LC-2", title: "Second p2", status: "todo", priority: "p2" }),
    row({ key: "LC-5", title: "P4", status: "todo", priority: "p4" }),
  ];

  /** The keys of one column, in the order the column renders them. */
  function columnKeys(title = "Todo"): string[] {
    return Array.from(
      stack(title).querySelectorAll<HTMLElement>(".ticket-row"),
    ).map((element) => element.dataset.ticketKey ?? "");
  }

  it("orders a column by priority, stable within a level (ADR 0003)", () => {
    render(board({ tickets: column }));

    expect(columnKeys()).toEqual(["LC-3", "LC-4", "LC-2", "LC-5", "LC-1"]);
  });

  it("moves down the column in the order it is looking at", () => {
    // `screen-specs.md:115`: keyboard navigation follows the visual order, so
    // the second card down is the second card drawn, not the next key.
    render(board({ tickets: column }));
    card("LC-3").focus();

    fireEvent.keyDown(card("LC-3"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(card("LC-4"));
  });

  it("draws the priority with a name rather than printing the slug", () => {
    render(board({ tickets: [row({ priority: "urgent" })] }));

    const element = card("LC-1");
    expect(element.textContent).not.toContain("urgent");
    expect(
      element.querySelector('[aria-label="Priority: Urgent"]'),
    ).toBeTruthy();
  });

  it("opens the priority menu on the focused card when P is pressed", () => {
    const onChangePriority = vi.fn();
    render(board({ tickets: column, onChangePriority }));
    card("LC-2").focus();

    fireEvent.keyDown(card("LC-2"), { key: "p" });

    expect(screen.getByRole("menu", { name: "Priority" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Urgent/ }));

    expect(onChangePriority).toHaveBeenCalledWith(
      expect.objectContaining({ key: "LC-2" }),
      "urgent",
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves the card holding the tab stop after the menu closes", () => {
    render(board({ tickets: column }));
    card("LC-2").focus();

    fireEvent.keyDown(card("LC-2"), { key: "p" });
    fireEvent.keyDown(screen.getAllByRole("menuitemradio")[0], {
      key: "Escape",
    });

    expect(document.activeElement).toBe(card("LC-2"));
  });

  it("is inert on a file it could not read", () => {
    // keyboard-focus-map.md:48 — a degraded card takes focus, but S and P have
    // nothing to write to.
    render(
      board({
        tickets: [
          {
            state: "degraded",
            key: "LC-98",
            contentHash: "hash-98",
            relativePath: ".longclaw/tickets/LC-98/ticket.md",
            byteLength: 220,
            readOnly: false,
            diagnostic: { code: "parse_failed", message: "no frontmatter" },
          },
        ],
      }),
    );
    card("LC-98").focus();

    fireEvent.keyDown(card("LC-98"), { key: "p" });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves a modified P to the window", () => {
    render(board({ tickets: column }));
    card("LC-2").focus();

    fireEvent.keyDown(card("LC-2"), { key: "p", metaKey: true });

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("label chips on a card (V0-10)", () => {
  const chips = (key: string) =>
    Array.from(card(key).querySelectorAll(".label-chip")).map(
      (chip) => chip.textContent,
    );

  it("draws one chip per slug, under the definition's display name", () => {
    render(
      board({
        tickets: [
          row({ labels: ["backend", "reliability"], checklistCount: 0 }),
        ],
      }),
    );

    expect(chips("LC-1")).toEqual(["Backend", "Reliability"]);
  });

  it("must-pass 3: draws an undefined slug as itself", () => {
    render(
      board({
        tickets: [row({ labels: ["legacy-thing"], checklistCount: 0 })],
      }),
    );

    expect(chips("LC-1")).toEqual(["legacy-thing"]);
  });

  it("stops at two chips, and at one beside a checklist fraction", () => {
    // The footer never wraps (`screen-specs.md:121-122`).
    const carrying = ["backend", "reliability", "docs"];
    render(
      board({
        tickets: [
          row({ key: "LC-1", labels: carrying, checklistCount: 0 }),
          row({
            key: "LC-2",
            labels: carrying,
            checkedCount: 1,
            checklistCount: 3,
          }),
        ],
      }),
    );

    expect(chips("LC-1")).toEqual(["Backend", "Reliability"]);
    expect(chips("LC-2")).toEqual(["Backend"]);
  });
});

describe("archived tickets never reach the board (V0-11)", () => {
  const ARCHIVED = "2026-07-20T09:00:00Z";

  it("draws no card, and does not count one, for an archived ticket", () => {
    render(
      board({
        tickets: [
          row({ key: "LC-1", status: "todo" }),
          row({ key: "LC-2", status: "todo", archivedAt: ARCHIVED }),
        ],
      }),
    );

    expect(card("LC-1")).toBeTruthy();
    expect(document.querySelector('[data-ticket-key="LC-2"]')).toBeNull();
    expect(screen.getByRole("heading", { name: /^Todo/ }).textContent).toBe(
      "Todo1",
    );
  });

  it("leaves the arrows nothing to land on there", () => {
    // The seats are built from what was drawn, so a hidden card must not be one.
    render(
      board({
        tickets: [
          row({ key: "LC-1", status: "todo" }),
          row({ key: "LC-2", status: "todo", archivedAt: ARCHIVED }),
          row({ key: "LC-3", status: "todo" }),
        ],
      }),
    );

    card("LC-1").focus();
    fireEvent.keyDown(card("LC-1"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(card("LC-3"));
  });

  it("keeps a canceled ticket, which is an outcome and not tidying", () => {
    // `file_format.md:345-347`: Canceled stays visible; only `archived_at` hides.
    render(
      board({
        tickets: [
          row({ key: "LC-4", status: "canceled" }),
          row({ key: "LC-5", status: "canceled", archivedAt: ARCHIVED }),
        ],
      }),
    );

    expect(card("LC-4")).toBeTruthy();
    expect(document.querySelector('[data-ticket-key="LC-5"]')).toBeNull();
  });
});

describe("board ordering and drag-and-drop (V0-09)", () => {
  /** A column already carrying a manual order. */
  const ranked = [
    row({ key: "LC-1", status: "todo", priority: "none", rank: "a0" }),
    row({ key: "LC-2", status: "todo", priority: "urgent", rank: "a1" }),
    row({ key: "LC-3", status: "todo", priority: "p1", rank: "a2" }),
  ];

  function columnKeys(title = "Todo"): string[] {
    return Array.from(
      stack(title).querySelectorAll<HTMLElement>(".ticket-row"),
    ).map((element) => element.dataset.ticketKey ?? "");
  }

  /** jsdom lays nothing out, so the sizer's box has to be stated. */
  function layOut(title = "Todo") {
    const element = sizer(title);
    element.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 240,
        height: 0,
      }) as DOMRect;
    return element;
  }

  /**
   * A drag event at a stated pointer position. `fireEvent`'s own init does not
   * reach a drag event in jsdom, which has no `DragEvent`, so the coordinate is
   * put on the event itself.
   */
  function dragAt(
    element: HTMLElement,
    type: "dragOver" | "drop",
    clientY: number,
  ) {
    const event = createEvent[type](element);
    Object.defineProperty(event, "clientY", { value: clientY });
    fireEvent(element, event);
  }

  /** Drags a card and lets go `clientY` pixels down the column's own box. */
  function dragTo(key: string, clientY: number, title = "Todo") {
    layOut(title);
    fireEvent.dragStart(card(key));
    dragAt(stack(title), "dragOver", clientY);
    dragAt(stack(title), "drop", clientY);
  }

  it("orders a column by rank in Manual, and by priority in Priority", () => {
    const { rerender } = render(board({ tickets: ranked, ordering: "manual" }));
    expect(columnKeys()).toEqual(["LC-1", "LC-2", "LC-3"]);

    rerender(board({ tickets: ranked, ordering: "priority" }));
    expect(columnKeys()).toEqual(["LC-2", "LC-3", "LC-1"]);
  });

  it("must-pass: a card is draggable only in Manual", () => {
    const { rerender } = render(
      board({ tickets: ranked, ordering: "priority" }),
    );
    expect(card("LC-1").draggable).toBe(false);

    rerender(board({ tickets: ranked, ordering: "manual" }));
    expect(card("LC-1").draggable).toBe(true);
  });

  it("must-pass: Priority mode writes no rank, however hard it is dragged", () => {
    const onReorder = vi.fn();
    render(board({ tickets: ranked, ordering: "priority", onReorder }));

    dragTo("LC-3", 4);

    expect(onReorder).not.toHaveBeenCalled();
    expect(document.querySelector(".drop-line")).toBeNull();
  });

  it("writes a rank between the two cards the drop landed between", () => {
    const onReorder = vi.fn();
    render(board({ tickets: ranked, ordering: "manual", onReorder }));

    // Past the middle of the first card and short of the middle of the second:
    // the gap between LC-1 and LC-2.
    dragTo("LC-3", CARD_STRIDE);

    expect(onReorder).toHaveBeenCalledTimes(1);
    const [ticket, rank] = onReorder.mock.calls[0];
    expect(ticket.key).toBe("LC-3");
    expect(rank > "a0" && rank < "a1").toBe(true);
  });

  it("takes a drop at a position the column is not rendering", () => {
    // The virtualized case, which is the whole difficulty: the card at the drop
    // position is not in the document, so the gap is arithmetic and not a node.
    const onReorder = vi.fn();
    const long = Array.from({ length: 400 }, (_, index) =>
      row({
        key: `LC-${index + 1}`,
        title: `Ticket ${index + 1}`,
        status: "todo",
        rank: `a0${index.toString().padStart(3, "0")}1`,
      }),
    );
    render(board({ tickets: long, ordering: "manual", onReorder }));

    expect(columnKeys().length).toBeLessThan(60);
    dragTo("LC-1", 300 * CARD_STRIDE);

    expect(onReorder).toHaveBeenCalledTimes(1);
    const [ticket, rank] = onReorder.mock.calls[0];
    expect(ticket.key).toBe("LC-1");
    expect(rank > "a02991" && rank < "a03001").toBe(true);
  });

  it("writes nothing when the card is dropped back where it was", () => {
    const onReorder = vi.fn();
    render(board({ tickets: ranked, ordering: "manual", onReorder }));

    dragTo("LC-2", CARD_STRIDE + 4);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("shows where the card would land, and stops showing it on the way out", () => {
    render(board({ tickets: ranked, ordering: "manual" }));
    layOut();

    fireEvent.dragStart(card("LC-3"));
    dragAt(stack(), "dragOver", CARD_STRIDE);
    expect(document.querySelector(".drop-line")).toBeTruthy();

    fireEvent.dragEnd(card("LC-3"));
    expect(document.querySelector(".drop-line")).toBeNull();
  });

  it("leaves a file it cannot read undraggable, having nothing to write to", () => {
    render(
      board({
        tickets: [
          ...ranked,
          {
            state: "degraded",
            key: "LC-99",
            contentHash: "hash-99",
            relativePath: ".longclaw/tickets/LC-99/ticket.md",
            byteLength: 220,
            readOnly: false,
            diagnostic: { code: "parse_failed", message: "no frontmatter" },
          },
        ],
        ordering: "manual",
      }),
    );

    expect(card("LC-99").draggable).toBe(false);
  });

  it("scrolls the column when the drag hangs at its bottom edge", () => {
    const long = Array.from({ length: 400 }, (_, index) =>
      row({ key: `LC-${index + 1}`, status: "todo", rank: `a0${index}1` }),
    );
    render(board({ tickets: long, ordering: "manual" }));
    const element = stack();
    element.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 600,
        height: 600,
        left: 0,
        right: 240,
        width: 240,
      }) as DOMRect;
    let scrolled = 0;
    Object.defineProperty(element, "scrollTop", {
      get: () => scrolled,
      set: (value: number) => {
        scrolled = value;
      },
      configurable: true,
    });
    layOut();

    fireEvent.dragStart(card("LC-1"));
    dragAt(element, "dragOver", 596);

    expect(scrolled).toBeGreaterThan(0);
  });
});
