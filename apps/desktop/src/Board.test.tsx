// @vitest-environment jsdom

/**
 * The board's acknowledgement of a change that came from disk, which is the
 * moment the whole slice exists to prove.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "./Board";
import type * as BoardCard from "./boardCard";
import { ASSUMED_VIEWPORT, CARD_STRIDE } from "./boardGeometry";
import { FRESH_WINDOW_MS } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import type { TicketRow } from "./types";

/**
 * Every card render presents itself exactly once, so this is the render count
 * the board's memoization is judged on.
 */
const { presented } = vi.hoisted(() => ({ presented: [] as string[] }));

vi.mock("./boardCard", async (importOriginal) => {
  const actual = await importOriginal<typeof BoardCard>();
  return {
    presentCard: (ticket: TicketRow) => {
      presented.push(ticket.key);
      return actual.presentCard(ticket);
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

function board(props?: { tickets?: TicketRow[]; marks?: ExternalMarks }) {
  return (
    <Board
      tickets={props?.tickets ?? [row()]}
      marks={props?.marks ?? {}}
      now={NOW}
      onSelect={noop}
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

/** A lane long enough that the window cannot hold all of it. */
function lane(count: number, status: "todo" | "in_progress" = "todo") {
  return Array.from({ length: count }, (_, index) =>
    row({ key: `LC-${index + 1}`, title: `Ticket ${index + 1}`, status }),
  );
}

/** The scroll container of one named lane; every other lane has one too. */
function stack(title = "Todo"): HTMLElement {
  const heading = screen.getByRole("heading", {
    name: new RegExp(`^${title}`),
  });
  const element = heading
    .closest(".board-column")
    ?.querySelector<HTMLElement>(".board-stack");
  if (!element) throw new Error(`no lane for ${title}`);
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
      <Board tickets={[row()]} marks={{}} now={NOW} onSelect={onSelect} />,
    );

    fireEvent.click(card("LC-1"));

    expect(onSelect).toHaveBeenCalledWith("LC-1");
  });
});

describe("a lane holding more cards than it can show", () => {
  it("renders the cards the viewport touches and not the rest", () => {
    render(board({ tickets: lane(400) }));

    const rendered = document.querySelectorAll(".ticket-row");
    // A card and its gap is CARD_STRIDE tall, so an unmeasured lane holds about
    // ASSUMED_VIEWPORT / CARD_STRIDE of them, plus the overscan.
    expect(rendered.length).toBeGreaterThan(ASSUMED_VIEWPORT / CARD_STRIDE);
    expect(rendered.length).toBeLessThan(400);
    // It still says how many tickets are in the lane, not how many it drew.
    expect(screen.getByRole("heading", { name: /Todo/ }).textContent).toBe(
      "Todo400",
    );
  });

  it("reserves the whole lane's height, so the scrollbar tells the truth", () => {
    render(board({ tickets: lane(400) }));

    expect(sizer().style.height).toBe(`${400 * CARD_STRIDE}px`);
  });

  it("swaps in the cards a scroll brings into view", () => {
    render(board({ tickets: lane(400) }));
    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeNull();

    scrollTo(stack(), 299 * CARD_STRIDE);

    expect(document.querySelector('[data-ticket-key="LC-300"]')).toBeTruthy();
    expect(document.querySelector('[data-ticket-key="LC-2"]')).toBeNull();
  });
});

describe("focus on a lane that is being scrolled", () => {
  it("keeps the focused card mounted and focused after it scrolls away", () => {
    render(board({ tickets: lane(400) }));

    card("LC-1").focus();
    expect(document.activeElement).toBe(card("LC-1"));

    scrollTo(stack(), 299 * CARD_STRIDE);

    // The card the human is standing on stays, wherever the lane has scrolled
    // to. Unmounting it would move focus to the body without saying so.
    expect(card("LC-1")).toBeTruthy();
    expect(document.activeElement).toBe(card("LC-1"));
    // Its neighbours, which nobody is standing on, are gone.
    expect(document.querySelector('[data-ticket-key="LC-3"]')).toBeNull();
  });

  it("keeps the open ticket's card mounted, so closing the panel can return to it", () => {
    render(
      <Board
        tickets={lane(400)}
        selectedKey="LC-200"
        marks={{}}
        now={NOW}
        onSelect={() => {}}
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

  it("moves down the lane in visual order", () => {
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

  it("stays put at the end of a lane", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "ArrowUp" });

    expect(document.activeElement).toBe(card("LC-1"));
  });

  it("crosses to the next lane that has cards", () => {
    render(board({ tickets: across }));
    card("LC-2").focus();

    // Backlog is empty and In Progress is two lanes over; the move skips the
    // empty lane and clamps to the last card of the one it lands in.
    fireEvent.keyDown(card("LC-2"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(card("LC-3"));
  });

  it("leaves a modified arrow to the window", () => {
    render(board({ tickets: across }));
    card("LC-1").focus();

    fireEvent.keyDown(card("LC-1"), { key: "ArrowDown", metaKey: true });

    expect(document.activeElement).toBe(card("LC-1"));
  });

  it("reaches a card the lane is not currently rendering", () => {
    render(board({ tickets: lane(400) }));
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
    const marks = mark({ at: NOW - 12_000 });
    const props = { tickets: three, marks };
    render(<Board {...props} now={NOW} onSelect={() => {}} />);
    presented.length = 0;

    // The clock behind the acknowledgement's age moves every second. Only the
    // card wearing one reads it.
    cleanup();
    render(<Board {...props} now={NOW + 1_000} onSelect={() => {}} />);
    presented.length = 0;
    render(<Board {...props} now={NOW + 2_000} onSelect={() => {}} />);

    expect(new Set(presented)).toEqual(new Set(["LC-1", "LC-2", "LC-3"]));
  });
});
