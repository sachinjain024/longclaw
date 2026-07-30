// @vitest-environment jsdom

/**
 * The board's acknowledgement of a change that came from disk, which is the
 * moment the whole slice exists to prove.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Board } from "./Board";
import { FRESH_WINDOW_MS } from "./freshness";
import type { ExternalMark, ExternalMarks } from "./freshness";
import type { TicketRow } from "./types";

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

function board(props?: { tickets?: TicketRow[]; marks?: ExternalMarks }) {
  return (
    <Board
      tickets={props?.tickets ?? [row()]}
      marks={props?.marks ?? {}}
      now={NOW}
      onSelect={() => {}}
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
