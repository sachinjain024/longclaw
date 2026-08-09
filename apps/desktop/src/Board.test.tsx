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
import type { TicketMove } from "./ticketMove";
import { ACKNOWLEDGEMENT_WINDOW_MS } from "./acknowledgement";
import type { ExternalMark, ExternalMarks } from "./acknowledgement";
import type {
  IndexedTicket,
  Label,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

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
  selectedKey?: string;
  marks?: ExternalMarks;
  labels?: Record<string, Label>;
  ordering?: OrderingMode;
  onChangePriority?: (ticket: IndexedTicket, next: TicketPriority) => void;
  onChangeStatus?: (ticket: IndexedTicket, next: TicketStatus) => void;
  onMoveTicket?: (ticket: IndexedTicket, move: TicketMove) => void;
  onCreateInStatus?: (status: TicketStatus) => void;
  onCreateFirst?: () => void;
}) {
  return (
    <Board
      tickets={props?.tickets ?? [row()]}
      selectedKey={props?.selectedKey}
      marks={props?.marks ?? {}}
      labels={props?.labels ?? DEFINITIONS}
      ordering={props?.ordering ?? "priority"}
      now={NOW}
      onSelect={noop}
      onChangePriority={props?.onChangePriority ?? noop}
      onChangeStatus={props?.onChangeStatus ?? noop}
      onMoveTicket={props?.onMoveTicket ?? noop}
      onCreateInStatus={props?.onCreateInStatus ?? noop}
      onCreateFirst={props?.onCreateFirst}
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

/** The keys one column has on screen, top to bottom. */
function columnKeys(title = "Todo"): string[] {
  return Array.from(
    stack(title).querySelectorAll<HTMLElement>(".ticket-row"),
  ).map((element) => element.dataset.ticketKey ?? "");
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
    expect(element.className).toContain("acknowledged");
    expect(element.className).toContain("acknowledged-agent");
    expect(element.className).not.toContain("acknowledged-human");
    expect(element.querySelector(".pulse-dot")).toBeTruthy();
    expect(element.textContent).toContain(
      "❯ updated by Claude Code · 12s · via file edit",
    );
  });

  // The dot leads the ID (`states.md:149`, LC-146): it is the thing that says
  // *look here*, and behind the key it was the second thing read.
  it("leads with the pulse dot rather than trailing the ID", () => {
    render(board({ marks: mark() }));

    const key = card("LC-1").querySelector(".ticket-key");
    expect(key?.firstElementChild?.className).toContain("pulse-dot");
    expect(key?.textContent).toBe("LC-1");
  });

  it("says so plainly when the change named no actor", () => {
    render(
      board({
        marks: mark({ actorType: "unknown", actorLabel: "actor unknown" }),
      }),
    );

    // Warn, not green: one row never speaks both vocabularies (LC-148).
    const element = card("LC-1");
    expect(element.className).toContain("acknowledged-unknown");
    expect(element.className).not.toContain("acknowledged-agent");
    expect(element.textContent).toContain("⚠ file changed · 12s");
  });

  it("keeps a person's file edit out of the agent accent", () => {
    render(
      board({ marks: mark({ actorType: "human", actorLabel: "a person" }) }),
    );

    const element = card("LC-1");
    expect(element.className).toContain("acknowledged-human");
    expect(element.className).not.toContain("acknowledged-agent");
    expect(element.textContent).toContain(
      "• changed on disk · 12s · via file edit",
    );
  });

  it("drops the treatment once the change has decayed", () => {
    render(board({ marks: mark({ at: NOW - ACKNOWLEDGEMENT_WINDOW_MS }) }));

    const element = card("LC-1");
    expect(element.className).not.toContain("acknowledged");
    expect(element.querySelector(".pulse-dot")).toBeNull();
    expect(element.textContent).not.toContain("via file edit");
  });

  it("says nothing about a card the app itself wrote", () => {
    render(board());

    expect(card("LC-1").className).not.toContain("acknowledged");
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
    expect(element.className).toContain("acknowledged");
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
        onChangeStatus={noop}
        onMoveTicket={noop}
        onCreateInStatus={noop}
      />,
    );
    scrollTo(stack(), 49 * CARD_STRIDE);
    expect(card("LC-50").className).toContain("acknowledged");

    scrollTo(stack(), 299 * CARD_STRIDE);
    expect(document.querySelector('[data-ticket-key="LC-50"]')).toBeNull();
    scrollTo(stack(), 49 * CARD_STRIDE);

    const element = card("LC-50");
    expect(element.className).toContain("acknowledged");
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
    // At the end, after the fixed set. The board's scaffold starts at Backlog
    // whatever else is on it (ADR 0002), so the synthetic column takes the only
    // seat left — unlike the list, whose one scroller would bury it.
    const titles = Array.from(
      document.querySelectorAll<HTMLElement>(".board-column h3"),
    ).map((heading) => heading.textContent);
    expect(titles.at(-1)).toBe("Unreadable1");
  });

  /**
   * D-50 / LC-133: the fallback column is for a file this session has never seen
   * parse. A ticket that broke under a running app keeps the column it was in,
   * because the index remembers where its directory last read — and a card that
   * moved to the end of the board would be a change the human never made, on a
   * board that says nothing about why.
   */
  it("keeps a file that broke in the column it last read in", () => {
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
            lastKnownStatus: "in_progress",
            diagnostic: {
              code: "parse_failed",
              message: "status must be one of backlog, todo; found blocked",
              line: 6,
            },
          },
        ],
      }),
    );

    // In Progress holds both, and no synthetic column is drawn at all.
    expect(
      screen.getByRole("heading", { name: /In Progress/ }).textContent,
    ).toBe("In Progress2");
    expect(screen.queryByRole("heading", { name: /Unreadable/ })).toBeNull();
    // Still a degraded card wherever it sits: the seat is borrowed, the anatomy
    // is the file's own.
    const degraded = card("LC-98");
    expect(degraded.className).toContain("degraded");
    expect(degraded.textContent).toContain("needs repair");
  });

  it("labels a newer-version file as newer format, not repair work", () => {
    render(
      board({
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

    const degraded = card("LC-99");
    expect(degraded.className).toContain("degraded");
    expect(degraded.textContent).toContain(".longclaw/tickets/LC-99/ticket.md");
    expect(degraded.textContent).toContain("newer format");
    expect(degraded.textContent).not.toContain("needs repair");
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
        onChangeStatus={noop}
        onMoveTicket={noop}
        onCreateInStatus={noop}
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
        onChangeStatus={noop}
        onMoveTicket={noop}
        onCreateInStatus={noop}
      />,
    );

    scrollTo(stack(), 0);

    expect(card("LC-200").className).toContain("selected");
  });
});

/**
 * The filter narrows the array `App` hands both surfaces (`filtering.ts`), so a
 * column here simply receives fewer tickets. What LC-178 found is that a card
 * the query had removed stayed on screen anyway — stranded below the matches at
 * the offset it last had, and holding a scroll range for cards the column no
 * longer had.
 *
 * One cause, both symptoms. A column draws its window plus its anchors, and
 * clicking a card makes it both the roving card and the open one; drawn twice,
 * it went to React as two children under one key, and React left the second node
 * mounted for good. The sizer was never wrong — `.ticket-row` is placed
 * absolutely inside `.board-sizer` (`styles.css`), so the leftover card holds
 * the scroll range open from outside the height the column reserved.
 */
describe("a column the filter has narrowed (LC-178)", () => {
  /** The four cards the recording's `Full Create` left in Todo. */
  const matches = columnOf(400).slice(115, 119);
  const matchedKeys = ["LC-116", "LC-117", "LC-118", "LC-119"];

  /**
   * A long column with a card deep in it both open and roving — what clicking
   * one does — and the window nowhere near it: the shape the board was in when
   * the query was typed. `LC-200` sits at 19,502px, so a card left behind here
   * is many viewports below the matches, which is where the recording found it.
   */
  function narrow() {
    const { rerender } = render(
      board({ tickets: columnOf(400), selectedKey: "LC-200" }),
    );
    fireEvent.focus(card("LC-200"));

    rerender(board({ tickets: matches, selectedKey: "LC-200" }));
  }

  it("draws one card when the roving card and the open card are the same", () => {
    render(board({ tickets: columnOf(400), selectedKey: "LC-1" }));
    fireEvent.focus(card("LC-1"));

    scrollTo(stack(), 299 * CARD_STRIDE);

    expect(document.querySelectorAll('[data-ticket-key="LC-1"]').length).toBe(
      1,
    );
  });

  it("draws the matches and nothing else", () => {
    narrow();

    expect(columnKeys()).toStrictEqual(matchedKeys);
  });

  it("keeps every card it draws inside the height it reserves", () => {
    narrow();

    // The empty region is this, rather than an oversized sizer: the height is
    // built from the filtered array and was always right, so what a scrollbar
    // measures past the last match is a card placed outside the box.
    const reserved = Number.parseInt(sizer().style.height, 10);
    expect(reserved).toBe(4 * CARD_STRIDE);
    for (const element of stack().querySelectorAll<HTMLElement>(
      ".ticket-row",
    )) {
      expect(Number.parseInt(element.style.top, 10)).toBeLessThan(reserved);
    }
  });

  it("has no card beyond the four its header counts", () => {
    narrow();

    // Swept rather than read at one scroll position, because the card this
    // found was parked far below the window: what the header claims has to be
    // everything the whole scroll range can reach.
    const reached = new Set<string>();
    for (let top = 0; top <= 400 * CARD_STRIDE; top += 10 * CARD_STRIDE) {
      scrollTo(stack(), top);
      for (const key of columnKeys()) reached.add(key);
    }

    expect(screen.getByRole("heading", { name: /Todo/ }).textContent).toBe(
      "Todo4",
    );
    expect([...reached].sort()).toStrictEqual(matchedKeys);
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
        onChangeStatus={noop}
        onMoveTicket={noop}
        onCreateInStatus={noop}
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
        onChangeStatus={noop}
        onMoveTicket={noop}
        onCreateInStatus={noop}
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

  // LC-85: the dash used to sit bare in the slot P1–P4 fill with a chip, which
  // on a card read as a stray hyphen rather than as a level.
  it("gives None the same chip frame the numbered levels wear", () => {
    render(
      board({
        tickets: [
          row({ key: "LC-1", status: "todo", priority: "none" }),
          row({ key: "LC-2", status: "todo", priority: "p3" }),
        ],
      }),
    );

    const none = card("LC-1").querySelector('[aria-label="Priority: None"]');
    expect(none?.className).toContain("priority-chip");
    expect(none?.querySelector(".priority-dash")).toBeTruthy();
    expect(none?.textContent).toBe("");
    expect(
      card("LC-2").querySelector('[aria-label="Priority: P3"]')?.className,
    ).toContain("priority-chip");
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
    clientX = 0,
  ) {
    const event = createEvent[type](element);
    Object.defineProperty(event, "clientY", { value: clientY });
    Object.defineProperty(event, "clientX", { value: clientX });
    fireEvent(element, event);
  }

  /** The board's own scroller, which is what carries a drag across columns. */
  function boardGrid(): HTMLElement {
    const element = document.querySelector<HTMLElement>(".board-grid");
    if (!element) throw new Error("no board grid");
    element.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        width: 1200,
      }) as DOMRect;
    return element;
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

  it("picks a card up in either order, because a column is a status (LC-60)", () => {
    // Reordering *inside* a column is Manual's alone (ADR 0003). Moving a card
    // to another column is a status change, which both orders have.
    const { rerender } = render(
      board({ tickets: ranked, ordering: "priority" }),
    );
    expect(card("LC-1").draggable).toBe(true);

    rerender(board({ tickets: ranked, ordering: "manual" }));
    expect(card("LC-1").draggable).toBe(true);
  });

  it("must-pass: Priority mode writes no rank, however hard it is dragged", () => {
    const onMoveTicket = vi.fn();
    render(board({ tickets: ranked, ordering: "priority", onMoveTicket }));

    // Inside its own column, where the only thing a drop could mean is a rank.
    dragTo("LC-3", 4);

    expect(onMoveTicket).not.toHaveBeenCalled();
    expect(document.querySelector(".drop-line")).toBeNull();

    // And into another column, where it means a status and nothing else.
    dragTo("LC-3", 4, "In Progress");

    expect(onMoveTicket).toHaveBeenCalledTimes(1);
    expect(onMoveTicket.mock.calls[0][1]).toStrictEqual({
      status: "in_progress",
    });
  });

  it("writes a rank between the two cards the drop landed between", () => {
    const onMoveTicket = vi.fn();
    render(board({ tickets: ranked, ordering: "manual", onMoveTicket }));

    // Past the middle of the first card and short of the middle of the second:
    // the gap between LC-1 and LC-2.
    dragTo("LC-3", CARD_STRIDE);

    expect(onMoveTicket).toHaveBeenCalledTimes(1);
    const [ticket, move] = onMoveTicket.mock.calls[0];
    expect(ticket.key).toBe("LC-3");
    expect(move.status).toBeUndefined();
    expect(move.rank > "a0" && move.rank < "a1").toBe(true);
  });

  it("takes a drop at a position the column is not rendering", () => {
    // The virtualized case, which is the whole difficulty: the card at the drop
    // position is not in the document, so the gap is arithmetic and not a node.
    const onMoveTicket = vi.fn();
    const long = Array.from({ length: 400 }, (_, index) =>
      row({
        key: `LC-${index + 1}`,
        title: `Ticket ${index + 1}`,
        status: "todo",
        rank: `a0${index.toString().padStart(3, "0")}1`,
      }),
    );
    render(board({ tickets: long, ordering: "manual", onMoveTicket }));

    expect(columnKeys().length).toBeLessThan(60);
    dragTo("LC-1", 300 * CARD_STRIDE);

    expect(onMoveTicket).toHaveBeenCalledTimes(1);
    const [ticket, move] = onMoveTicket.mock.calls[0];
    expect(ticket.key).toBe("LC-1");
    expect(move.rank > "a02991" && move.rank < "a03001").toBe(true);
  });

  it("writes nothing when the card is dropped back where it was", () => {
    const onMoveTicket = vi.fn();
    render(board({ tickets: ranked, ordering: "manual", onMoveTicket }));

    dragTo("LC-2", CARD_STRIDE + 4);

    expect(onMoveTicket).not.toHaveBeenCalled();
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

  describe("dropped into another column (LC-60)", () => {
    /** Todo carries the three ranked cards; In Progress carries two of its own. */
    const twoColumns = [
      ...ranked,
      row({ key: "LC-4", status: "in_progress", rank: "a5" }),
      row({ key: "LC-5", status: "in_progress", rank: "a6" }),
    ];

    /** The column element around one named stack, which wears the drop state. */
    function column(title: string): HTMLElement {
      const element = stack(title).closest<HTMLElement>(".board-column");
      if (!element) throw new Error(`no column for ${title}`);
      return element;
    }

    it("moves the ticket to the status of the column it was let go in", () => {
      const onMoveTicket = vi.fn();
      render(
        board({ tickets: twoColumns, ordering: "priority", onMoveTicket }),
      );

      dragTo("LC-1", 0, "In Progress");

      expect(onMoveTicket).toHaveBeenCalledTimes(1);
      const [ticket, move] = onMoveTicket.mock.calls[0];
      expect(ticket.key).toBe("LC-1");
      expect(move).toStrictEqual({ status: "in_progress" });
    });

    it("gives the arriving card a place in the column, in Manual", () => {
      const onMoveTicket = vi.fn();
      render(board({ tickets: twoColumns, ordering: "manual", onMoveTicket }));

      // The gap between LC-4 and LC-5, in a column the card is not in.
      dragTo("LC-1", CARD_STRIDE, "In Progress");

      expect(onMoveTicket).toHaveBeenCalledTimes(1);
      const [ticket, move] = onMoveTicket.mock.calls[0];
      expect(ticket.key).toBe("LC-1");
      expect(move.status).toBe("in_progress");
      expect(move.rank > "a5" && move.rank < "a6").toBe(true);
    });

    it("lands at the end of an empty column", () => {
      const onMoveTicket = vi.fn();
      render(board({ tickets: ranked, ordering: "manual", onMoveTicket }));

      dragTo("LC-1", 0, "Done");

      expect(onMoveTicket.mock.calls[0][1]).toStrictEqual({
        status: "done",
        rank: "a0",
      });
    });

    it("opens every column that could take the card as soon as it is lifted", () => {
      // An empty column is three pixels of padding at rest, so without this it is
      // the one column a card cannot be dragged to.
      render(board({ tickets: twoColumns, ordering: "priority" }));

      fireEvent.dragStart(card("LC-1"));

      expect(column("Done").className).toContain("drop-open");
      expect(column("In Progress").className).toContain("drop-open");
      // Not its own, in Priority: a drop there would write nothing.
      expect(column("Todo").className).not.toContain("drop-open");

      fireEvent.dragEnd(card("LC-1"));
      expect(document.querySelector(".board-column.drop-open")).toBeNull();
    });

    it("carries the drag across a board wider than the window", () => {
      // Six columns of 264px do not fit, so a column off the side of the board
      // is as unreachable as a card below the fold without this.
      render(board({ tickets: twoColumns, ordering: "priority" }));
      const grid = boardGrid();
      let scrolled = 0;
      Object.defineProperty(grid, "scrollLeft", {
        get: () => scrolled,
        set: (value: number) => {
          scrolled = value;
        },
        configurable: true,
      });

      fireEvent.dragStart(card("LC-1"));
      dragAt(grid, "dragOver", 400, 1190);

      expect(scrolled).toBeGreaterThan(0);
    });

    it("lights no column while the pointer is over none of them", () => {
      render(board({ tickets: twoColumns, ordering: "priority" }));
      layOut("In Progress");
      fireEvent.dragStart(card("LC-1"));
      dragAt(stack("In Progress"), "dragOver", 0);
      expect(column("In Progress").className).toContain("drop-target");

      // The gaps between the columns: the board hears the drag, no column
      // takes it, and nothing is left lit up behind the pointer.
      dragAt(boardGrid(), "dragOver", 400, 600);

      expect(document.querySelector(".board-column.drop-target")).toBeNull();
    });

    it("says which column would take the card, and stops when it is let go", () => {
      render(board({ tickets: twoColumns, ordering: "priority" }));
      layOut("In Progress");

      fireEvent.dragStart(card("LC-1"));
      dragAt(stack("In Progress"), "dragOver", 0);

      expect(column("In Progress").className).toContain("drop-target");
      // Its own column is not a target in Priority: there is nothing a drop
      // there could write.
      expect(column("Todo").className).not.toContain("drop-target");
      // And no line, because no position is being chosen.
      expect(document.querySelector(".drop-line")).toBeNull();

      fireEvent.dragEnd(card("LC-1"));
      expect(document.querySelector(".board-column.drop-target")).toBeNull();
    });

    it("shows where in the column it would land, in Manual", () => {
      render(board({ tickets: twoColumns, ordering: "manual" }));
      layOut("In Progress");

      fireEvent.dragStart(card("LC-1"));
      dragAt(stack("In Progress"), "dragOver", CARD_STRIDE);

      expect(column("In Progress").className).toContain("drop-target");
      expect(stack("In Progress").querySelector(".drop-line")).toBeTruthy();
    });

    it("refuses the column for files it cannot read, having no status", () => {
      const onMoveTicket = vi.fn();
      render(
        board({
          ordering: "manual",
          onMoveTicket,
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
        }),
      );

      dragTo("LC-1", 0, "Unreadable");

      expect(onMoveTicket).not.toHaveBeenCalled();
      expect(column("Unreadable").className).not.toContain("drop-target");
    });
  });
});

describe("the column header's + (LC-83)", () => {
  /** The `+` in one named column's header, if the header carries one. */
  function add(title: string): HTMLElement | null {
    const heading = screen.getByRole("heading", {
      name: new RegExp(`^${title}`),
    });
    return (
      heading
        .closest(".board-column")
        ?.querySelector<HTMLElement>(".column-add") ?? null
    );
  }

  it("opens a create already standing in the column it was pressed in", () => {
    const onCreateInStatus = vi.fn();
    render(board({ onCreateInStatus }));

    fireEvent.click(
      screen.getByRole("button", { name: "New ticket in In Progress" }),
    );

    expect(onCreateInStatus).toHaveBeenCalledWith("in_progress");
  });

  it("names its column, because six of them sit on one board", () => {
    render(board({ onCreateInStatus: noop }));

    expect(add("Todo")?.getAttribute("aria-label")).toBe("New ticket in Todo");
    expect(add("Done")?.getAttribute("aria-label")).toBe("New ticket in Done");
  });

  it("is absent on the column no status names", () => {
    render(
      board({
        onCreateInStatus: noop,
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

    expect(add("Unreadable")).toBeNull();
    expect(add("Todo")).toBeTruthy();
  });

  // The button sits beside the `<h3>`, not inside it: a heading is named by its
  // own text, and six columns each announcing "New ticket in …" would bury the
  // one word someone moving by heading is listening for.
  it("stays out of the column heading's name", () => {
    render(board({ onCreateInStatus: noop }));

    const heading = screen.getByRole("heading", { name: /^Todo/ });
    expect(heading.textContent).toBe("Todo0");
    expect(heading.querySelector(".column-add")).toBeNull();
  });

  it("does not read a key pressed on it as a move on the roving card", () => {
    const onChangeStatus = vi.fn();
    render(
      board({ tickets: columnOf(3), onChangeStatus, onCreateInStatus: noop }),
    );
    card("LC-1").focus();
    const plus = add("Todo");
    if (!plus) throw new Error("no + in the Todo header");
    plus.focus();

    fireEvent.keyDown(plus, { key: "j" });
    fireEvent.keyDown(plus, { key: "s" });

    expect(document.activeElement).toBe(plus);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onChangeStatus).not.toHaveBeenCalled();
  });
});

/**
 * The empty-project state (D-20/LC-86): the board is the one thing the spec
 * says the app never hides, so the scaffold stands and the Todo column hosts
 * the invitation.
 */
describe("the empty-project guide", () => {
  const guide = () =>
    document.querySelector<HTMLElement>(".guide-card") ?? undefined;

  it("keeps every column and puts the card in Todo", () => {
    render(board({ tickets: [], onCreateFirst: noop }));

    // The scaffold first: the state this replaced drew no columns at all.
    expect(document.querySelectorAll(".board-column").length).toBeGreaterThan(
      1,
    );
    const card = guide();
    expect(card).toBeTruthy();
    expect(stack("Todo").contains(card as Node)).toBe(true);
    // One column hosts it, and it is not every column's empty state.
    expect(document.querySelectorAll(".guide-card")).toHaveLength(1);
  });

  it("carries the C chip and no button of its own (D-24)", () => {
    render(board({ tickets: [], onCreateFirst: noop }));

    const card = guide();
    expect(card?.querySelector("kbd")?.textContent).toBe("C");
    // The chip is decorative — `aria-keyshortcuts` announces the key — so the
    // card's name is what pressing it does and nothing else.
    expect(card?.getAttribute("aria-label")).toBe("Create your first ticket");
    expect(card?.getAttribute("aria-keyshortcuts")).toBe("C");
    expect(screen.queryByRole("button", { name: "New ticket" })).toBeNull();
  });

  it("names no path, so nothing wraps and no period is stranded (D-25)", () => {
    render(board({ tickets: [], onCreateFirst: noop }));

    expect(guide()?.textContent).toContain(
      "Title it, give it a checklist, point an agent at the folder.",
    );
    expect(guide()?.textContent).not.toContain(".longclaw/tickets");
  });

  // An empty board has no card for the roving group to hold, so the guide is an
  // ordinary Tab stop — and on WebKit with macOS *Keyboard navigation* off, a
  // button without an explicit `tabIndex` is skipped entirely (AGENTS.md).
  it("is an ordinary tab stop, not a member of the roving group", () => {
    render(board({ tickets: [], onCreateFirst: noop }));

    expect(guide()?.tabIndex).toBe(0);
    expect(guide()?.className).not.toContain("ticket-row");
  });

  it("raises the create the whole card is", () => {
    const onCreateFirst = vi.fn();
    render(board({ tickets: [], onCreateFirst }));

    fireEvent.click(guide() as HTMLElement);

    expect(onCreateFirst).toHaveBeenCalledTimes(1);
  });

  it("is absent from a board that has tickets", () => {
    render(board({ tickets: columnOf(2) }));

    expect(guide()).toBeUndefined();
  });
});
