// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { ORDERINGS } from "./ordering";
import type { IndexedTicket, ProjectReference } from "./types";

afterEach(cleanup);

const project: ProjectReference = {
  id: "project-1",
  name: "LongClaw",
  rootPath: "/tmp/longclaw",
  key: "LC",
  theme: "indigo",
  starred: false,
  reachable: true,
  labels: {},
};

const ticket: IndexedTicket = {
  state: "indexed",
  key: "LC-1",
  id: "ticket-1",
  title: "Searchable ticket",
  status: "todo",
  priority: "p2",
  labels: [],
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  checkedCount: 0,
  checklistCount: 0,
  commentCount: 0,
  attachmentCount: 0,
  contentHash: "hash",
  relativePath: ".longclaw/tickets/LC-1/ticket.md",
};

function renderPalette(
  overrides: Partial<React.ComponentProps<typeof CommandPalette>> = {},
) {
  return render(
    <CommandPalette
      project={project}
      projects={[project]}
      ticket={ticket}
      appearance="system"
      ordering="priority"
      themes={[{ id: "indigo", label: "Indigo" }]}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      onOpenTicket={vi.fn()}
      onProject={vi.fn()}
      onChangeStatus={vi.fn()}
      onChangePriority={vi.fn()}
      onToggleStar={vi.fn()}
      onToggleAppearance={vi.fn()}
      onTheme={vi.fn()}
      onView={vi.fn()}
      onArchive={vi.fn()}
      onOrdering={vi.fn()}
      view="board"
      onSearch={vi.fn()}
      {...overrides}
    />,
  );
}

describe("command palette", () => {
  it("renders the twelve root commands and status glyphs", () => {
    renderPalette();
    expect(screen.getAllByRole("option")).toHaveLength(12);

    fireEvent.click(screen.getByRole("option", { name: /Change status/ }));
    expect(screen.getByRole("option", { name: "Todo" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Todo" }).querySelector("svg, span"),
    ).toBeTruthy();
  });

  it("keeps j and k typeable in the palette input", () => {
    renderPalette();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "jk" } });
    expect((input as HTMLInputElement).value).toBe("jk");
  });

  it("renders indexed results without re-filtering their searchable fields", () => {
    renderPalette({
      initialMode: "search",
      searchResults: [{ ...ticket, title: "Description-only match" }],
    });
    expect(
      screen.getByRole("option", { name: /Description-only match/ }),
    ).toBeTruthy();
  });

  it("draws no rows before the first search result comes back", () => {
    // The whole project is not the answer to a query nobody has answered yet.
    renderPalette({ initialMode: "search", searchResults: undefined });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Searching…")).toBeTruthy();
  });

  it("publishes the active row rather than moving focus to it", () => {
    renderPalette();
    const input = screen.getByRole("combobox");
    const first = input.getAttribute("aria-activedescendant");
    expect(first).toBeTruthy();
    expect(screen.getByRole("option", { name: /Create ticket/ }).id).toBe(
      first,
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).not.toBe(first);
    expect(document.activeElement).toBe(input);
  });

  it("takes its ordering rows from the one ordering list", () => {
    renderPalette({ initialMode: "ordering" });
    // Not a third copy of the list (`ordering.ts` is the first, the header
    // control the second).
    for (const option of ORDERINGS) {
      expect(screen.getByRole("option", { name: option.label })).toBeTruthy();
    }
    // The footnote is the reason the mode is safe (`screen-specs.md:246-247`).
    expect(screen.getByText(/never rewrites files/)).toBeTruthy();
  });

  it("says what search reads that the header filter does not", () => {
    renderPalette({ initialMode: "search", searchResults: [] });
    expect(screen.getByText(/more than the header filter/)).toBeTruthy();
  });

  it("admits the silent 100-result cap", () => {
    renderPalette({
      initialMode: "search",
      searchResults: Array.from({ length: 100 }, (_, index) => ({
        ...ticket,
        key: `LC-${index + 1}`,
      })),
    });
    expect(screen.getByText(/Showing the first 100 matches/)).toBeTruthy();
  });

  it("keeps a disabled row visible with its reason", () => {
    renderPalette({ ticket: undefined });
    const status = screen.getByRole("option", { name: /Change status/ });
    expect((status as HTMLButtonElement).disabled).toBe(true);
    expect(status.textContent).toContain("Open or focus a ticket");

    const terminal = screen.getByRole("option", { name: /New terminal/ });
    expect((terminal as HTMLButtonElement).disabled).toBe(true);
    expect(terminal.textContent).toContain("Phase 2");
  });

  it("carries a pair swatch on every theme row", () => {
    const { container } = renderPalette({ initialMode: "theme" });
    expect(container.querySelectorAll(".theme-swatch")).toHaveLength(1);
    expect(
      container.querySelector<HTMLElement>(".theme-swatch")?.dataset.theme,
    ).toBe("indigo");
  });
});
