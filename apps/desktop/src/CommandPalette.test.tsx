// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const { container } = renderPalette();
    expect(screen.getAllByRole("option")).toHaveLength(12);
    for (const glyph of ["+", "→", "⌕", "★", "☾", "◆", "☷", "☰", "›_"]) {
      expect(container.textContent).toContain(glyph);
    }
    expect(
      screen.getByRole("option", { name: /Set priority/ }).textContent,
    ).toContain("P2");

    fireEvent.click(screen.getByRole("option", { name: /Change status/ }));
    expect(screen.getByRole("option", { name: "Todo" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Todo" }).querySelector("svg, span"),
    ).toBeTruthy();
  });

  it("opens the input row with a search glyph", () => {
    const { container } = renderPalette();
    expect(container.textContent?.match(/⌕/g)).toHaveLength(2);
  });

  it("uses the prototype crumb treatment in sub-modes", () => {
    renderPalette({ initialMode: "theme" });
    const crumb = screen.getByRole("button", { name: /Back to commands/ });
    expect(crumb.textContent).toBe("theme");
  });

  it("names escape by what it does in the current mode", () => {
    renderPalette();
    expect(screen.getByText("↑↓ navigate · ↵ run · esc close")).toBeTruthy();

    cleanup();
    renderPalette({ initialMode: "theme" });
    expect(screen.getByText("↑↓ navigate · ↵ run · esc back")).toBeTruthy();
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

  /**
   * LC-140. `⌘K → Create ticket` reached quick create over the unreachable
   * screen, where the key is guessed from a board with no rows — so it offered
   * `LC-1`, a collision waiting for the folder to come back.
   */
  it("cannot create in a folder it cannot reach", () => {
    const onCreate = vi.fn();
    renderPalette({ project: { ...project, reachable: false }, onCreate });

    const create = screen.getByRole("option", { name: /Create ticket/ });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    expect(create.textContent).toContain(
      "The project folder cannot be reached",
    );

    fireEvent.click(create);
    expect(onCreate).not.toHaveBeenCalled();
  });

  /**
   * LC-171. Typing a key is the fastest thing anyone knows how to do, and at
   * the root it used to filter command labels — where `LC-60` matches nothing.
   */
  describe("a ticket key typed at the root", () => {
    const found = { ...ticket, key: "LC-60", title: "The sixtieth ticket" };
    /** Comfortably past the debounce, without keeping a second copy of it. */
    const PAST_THE_DEBOUNCE_MS = 1000;

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function typeAtRoot(value: string, onSearch = vi.fn()) {
      const view = renderPalette({ onSearch, searchResults: [found] });
      fireEvent.change(screen.getByRole("combobox"), { target: { value } });
      return { ...view, onSearch };
    }

    it("looks the key up rather than filtering commands", () => {
      const { onSearch } = typeAtRoot("LC-60");
      vi.advanceTimersByTime(PAST_THE_DEBOUNCE_MS);
      expect(onSearch).toHaveBeenCalledWith("LC-60");
    });

    it("offers the ticket as the first row, keyed and glyphed like a search row", () => {
      typeAtRoot("lc-60");
      const rows = screen.getAllByRole("option");
      expect(rows[0]?.textContent).toContain("LC-60");
      expect(rows[0]?.textContent).toContain("The sixtieth ticket");
      expect(rows[0]?.querySelector(".search-key")?.textContent).toBe("LC-60");
    });

    it("opens it by the same path a search-mode row uses", () => {
      const onOpenTicket = vi.fn();
      const view = renderPalette({ onOpenTicket, searchResults: [found] });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "60" },
      });
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
      expect(onOpenTicket).toHaveBeenCalledWith("LC-60");
      view.unmount();

      renderPalette({
        onOpenTicket,
        initialMode: "search",
        searchResults: [found],
      });
      fireEvent.click(screen.getByRole("option", { name: /sixtieth/ }));
      expect(onOpenTicket).toHaveBeenNthCalledWith(2, "LC-60");
    });

    it("shows only the ticket the query asked for, not the rest of the answer", () => {
      // Rust answers `lc-60` with every substring match. The root asked about
      // one key, so a near miss on that key is not a row here.
      renderPalette({
        searchResults: [found, { ...ticket, key: "LC-601", title: "Nearby" }],
        onSearch: vi.fn(),
      });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "LC-60" },
      });
      const rows = screen.getAllByRole("option");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain("LC-60");
    });

    it("leaves a foreign prefix to the commands, and asks Rust nothing", () => {
      const { onSearch } = typeAtRoot("AB-1");
      vi.advanceTimersByTime(PAST_THE_DEBOUNCE_MS);
      expect(onSearch).not.toHaveBeenCalled();
      expect(screen.queryByText("The sixtieth ticket")).toBeNull();
    });

    it("says it is searching rather than that there is nothing", () => {
      renderPalette({ searchResults: undefined, onSearch: vi.fn() });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "LC-60" },
      });
      expect(screen.getByText("Searching…")).toBeTruthy();
    });

    it("admits when this project has no such ticket", () => {
      renderPalette({ searchResults: [], onSearch: vi.fn() });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "LC-999" },
      });
      expect(screen.getByText("No matches")).toBeTruthy();
    });
  });

  it("carries a pair swatch on every theme row", () => {
    const { container } = renderPalette({ initialMode: "theme" });
    expect(container.querySelectorAll(".theme-swatch")).toHaveLength(1);
    expect(
      container.querySelector<HTMLElement>(".theme-swatch")?.dataset.theme,
    ).toBe("indigo");
  });
});
