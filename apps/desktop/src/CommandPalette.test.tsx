// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { ORDERINGS } from "./ordering";
import type { IndexedTicket, ProjectReference } from "./types";
import { NO_PROPERTIES } from "./properties";

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
  properties: NO_PROPERTIES,
};

/**
 * A fixed Wednesday, so the four days a date mode offers and the day a typed
 * one resolves to are the same in every run.
 *
 * A Wednesday rather than any day, because on a Monday `Next Monday` and
 * `In a week` are the same day — the next Monday is never today — and a
 * fixture where two rows hold one value cannot tell them apart.
 */
const TODAY = new Date("2026-09-09T00:00:00").getTime();

/**
 * The same project with all four properties on, and a `Label` vocabulary for
 * type. The default fixture keeps `NO_PROPERTIES`, so every test that counts
 * the root's rows is counting the palette a project written before this build
 * still draws.
 */
const allProperties: ProjectReference = {
  ...project,
  properties: {
    type: {
      enabled: true,
      values: {
        bug: { name: "Bug", color: "red" },
        feature: { name: "Feature", color: "blue" },
      },
    },
    due: { enabled: true, attentionDays: 7 },
    start: { enabled: true },
    estimate: {
      enabled: true,
      system: "tshirt",
      values: ["s", "m", "l"],
      hoursPerDay: 8,
      daysPerWeek: 5,
    },
  },
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
      tickets={[ticket]}
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
      today={TODAY}
      onChangeProperty={vi.fn()}
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
    // The footnote is the reason the mode is safe (`screen-specs.md:324-325`).
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
    const nearby = { ...ticket, key: "LC-601", title: "Nearby" };

    function typeAtRoot(value: string, overrides = {}) {
      const view = renderPalette({
        tickets: [ticket, found, nearby],
        ...overrides,
      });
      fireEvent.change(screen.getByRole("combobox"), { target: { value } });
      return view;
    }

    it("offers the ticket as the first row, keyed and glyphed like a search row", () => {
      typeAtRoot("lc-60");
      const rows = screen.getAllByRole("option");
      expect(rows[0]?.textContent).toContain("LC-60");
      expect(rows[0]?.textContent).toContain("The sixtieth ticket");
      expect(rows[0]?.querySelector(".search-key")?.textContent).toBe("LC-60");
    });

    it("answers from the rows it already holds, asking Rust nothing", () => {
      // Synchronous on the keystroke: no debounce to wait out, and no window
      // in which the palette says the ticket does not exist while it waits.
      const onSearch = vi.fn();
      typeAtRoot("LC-60", { onSearch });
      expect(onSearch).not.toHaveBeenCalled();
      expect(screen.getAllByRole("option")[0]?.textContent).toContain("LC-60");
    });

    it("opens it by the same path a search-mode row uses", () => {
      const onOpenTicket = vi.fn();
      const view = typeAtRoot("60", { onOpenTicket });
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

    it("names one ticket, not everything the key is a prefix of", () => {
      typeAtRoot("LC-60");
      const rows = screen.getAllByRole("option");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain("The sixtieth ticket");
    });

    it("leaves a foreign prefix to the commands", () => {
      typeAtRoot("AB-1");
      expect(screen.queryByText("The sixtieth ticket")).toBeNull();
      expect(screen.getByText("No matches")).toBeTruthy();
    });

    it("reaches a ticket the surface behind the palette is not showing", () => {
      // An archived ticket is off the board by design (ADR 0004), which is
      // exactly the case where a key is the only way to name it.
      typeAtRoot("LC-60", {
        tickets: [{ ...found, archivedAt: "2026-08-01T00:00:00Z" }],
      });
      const row = screen.getAllByRole("option")[0];
      expect(row?.textContent).toContain("The sixtieth ticket");
      expect(row?.textContent).toContain("archived");
    });

    it("admits when this project has no such ticket", () => {
      typeAtRoot("LC-999");
      expect(screen.getByText("No matches")).toBeTruthy();
    });

    it("keeps the sub-modes out of it", () => {
      // The rule is the root's. In `status`, `2` is a query over status labels
      // and nothing else, and it must not offer a ticket.
      renderPalette({ initialMode: "status", tickets: [found] });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "2" },
      });
      expect(screen.queryByText("The sixtieth ticket")).toBeNull();
    });
  });

  describe("the four opt-in properties", () => {
    it("offers no row for a project that has turned none on", () => {
      renderPalette();
      expect(screen.getAllByRole("option")).toHaveLength(12);
      for (const name of [
        /Set type/,
        /Set due date/,
        /Set start date/,
        /Set estimate/,
      ])
        expect(screen.queryByRole("option", { name })).toBeNull();
    });

    it("offers one row per enabled property, in the order every other surface draws them", () => {
      renderPalette({ project: allProperties });
      const labels = screen
        .getAllByRole("option")
        .map((row) => row.querySelector(".palette-label")?.textContent);
      expect(labels.filter((label) => label?.startsWith("Set "))).toEqual([
        "Set priority…",
        "Set type…",
        "Set estimate…",
        "Set start date…",
        "Set due date…",
      ]);
    });

    it("draws a row only for the properties the project turned on", () => {
      renderPalette({
        project: {
          ...allProperties,
          properties: {
            ...allProperties.properties,
            type: { enabled: false, values: {} },
            estimate: { ...allProperties.properties.estimate, enabled: false },
          },
        },
      });
      expect(screen.getAllByRole("option")).toHaveLength(14);
      expect(screen.queryByRole("option", { name: /Set type/ })).toBeNull();
      expect(screen.getByRole("option", { name: /Set due date/ })).toBeTruthy();
    });

    it("says what the ticket holds before you change it", () => {
      renderPalette({
        project: allProperties,
        ticket: { ...ticket, due: "2026-09-12", type: "bug", estimate: "m" },
      });
      expect(
        screen.getByRole("option", { name: /Set due date/ }).textContent,
        // The reader a card uses, which is the one the context menu's row uses
        // too — the palette is not a field, so it needs none of `fieldDate`'s
        // year rule.
      ).toContain("12 Sep");
      expect(
        screen.getByRole("option", { name: /Set type/ }).textContent,
      ).toContain("Bug");
      expect(
        screen.getByRole("option", { name: /Set estimate/ }).textContent,
      ).toContain("M");
      // Nothing held, and no dash standing in for it.
      expect(
        screen.getByRole("option", { name: /Set start date/ }).textContent,
      ).toBe("Set start date…");
    });

    it("needs a ticket, and says so rather than failing", () => {
      renderPalette({ project: allProperties, ticket: undefined });
      const row = screen.getByRole("option", { name: /Set due date/ });
      expect(row.hasAttribute("disabled")).toBe(true);
      expect(row.textContent).toContain("Open or focus a ticket");
    });

    it("takes a date mode's four days from the one list the context menu reads", () => {
      renderPalette({ project: allProperties, initialMode: "due" });
      const rows = screen.getAllByRole("option").map((row) => row.textContent);
      // The day each pick resolves to, shown before the press.
      expect(rows).toEqual([
        "Today· 9 Sep",
        "Tomorrow· 10 Sep",
        "Next Monday· 14 Sep",
        "In a week· 16 Sep",
      ]);
    });

    it("writes the day the picked row says, and closes", () => {
      const onChangeProperty = vi.fn();
      const onClose = vi.fn();
      renderPalette({
        project: allProperties,
        initialMode: "due",
        onChangeProperty,
        onClose,
      });
      fireEvent.click(screen.getByRole("option", { name: /Next Monday/ }));
      expect(onChangeProperty).toHaveBeenCalledWith("due", "2026-09-14");
      expect(onClose).toHaveBeenCalled();
    });

    it("ticks the day the ticket already holds, compared as the format spells it", () => {
      renderPalette({
        project: allProperties,
        ticket: { ...ticket, due: "2026-09-14" },
        initialMode: "due",
      });
      const ticked = screen
        .getAllByRole("option")
        .filter((row) => row.querySelector(".palette-check"))
        .map((row) => row.querySelector(".palette-label")?.textContent);
      expect(ticked).toEqual(["Next Monday"]);
    });

    it("offers the project's own type vocabulary, without a None row", () => {
      renderPalette({ project: allProperties, initialMode: "type" });
      expect(
        screen.getAllByRole("option").map((row) => row.textContent),
      ).toEqual(["Bug", "Feature"]);
    });

    it("reads an estimate the way a card reads it", () => {
      renderPalette({ project: allProperties, initialMode: "estimate" });
      expect(
        screen.getAllByRole("option").map((row) => row.textContent),
      ).toEqual(["S", "M", "L"]);
    });

    it("offers Clear only where there is something to clear", () => {
      renderPalette({ project: allProperties, initialMode: "due" });
      expect(screen.queryByRole("option", { name: "Clear" })).toBeNull();

      cleanup();
      const onChangeProperty = vi.fn();
      renderPalette({
        project: allProperties,
        ticket: { ...ticket, due: "2026-09-20" },
        initialMode: "due",
        onChangeProperty,
      });
      fireEvent.click(screen.getByRole("option", { name: "Clear" }));
      // `undefined`, not an empty string: the wire distinguishes an edit that
      // empties a field from one that omits it.
      expect(onChangeProperty).toHaveBeenCalledWith("due", undefined);
    });

    it("names the property in the crumb, and Esc steps back to the root", () => {
      renderPalette({ project: allProperties, initialMode: "due" });
      expect(screen.getByText("due date")).toBeTruthy();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(screen.getByRole("option", { name: /Set due date/ })).toBeTruthy();
    });
  });

  describe("a date typed into a date mode", () => {
    function typeInto(mode: "due" | "start", text: string, over = {}) {
      const view = renderPalette({
        project: allProperties,
        initialMode: mode,
        ...over,
      });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: text },
      });
      return view;
    }

    it("is offered first, as the day in full, and is not filtered away", () => {
      typeInto("due", "28 Sep");
      const rows = screen.getAllByRole("option").map((row) => row.textContent);
      // The four picks match none of it, so the answer is the only row — and
      // the label is the day it resolved to rather than the text typed.
      expect(rows).toEqual(["Mon 28 Sep 2026"]);
    });

    it("writes the canonical form of what was typed", () => {
      const onChangeProperty = vi.fn();
      typeInto("start", "sep 28, 2027", { onChangeProperty });
      fireEvent.click(screen.getByRole("option", { name: /28 Sep 2027/ }));
      expect(onChangeProperty).toHaveBeenCalledWith("start", "2027-09-28");
    });

    it("reads the whole grammar through the one parser, not a second of its own", () => {
      typeInto("due", "tomorrow");
      // `Tomorrow` narrows to itself and the typed answer is the same day, so
      // the mode says it twice — once as the shortcut and once as the answer.
      expect(
        screen.getAllByRole("option").map((row) => row.textContent),
      ).toEqual(["Thu 10 Sep 2026", "Tomorrow· 10 Sep"]);
    });

    it("wears the refusal that names a next move, rather than No matches", () => {
      typeInto("due", "28/09/2026");
      const row = screen.getByRole("option", { name: /28\/09\/2026/ });
      expect(row.hasAttribute("disabled")).toBe(true);
      expect(row.textContent).toContain("Numeric dates are read as");
      expect(screen.queryByText("No matches")).toBeNull();
    });

    it("keeps a refusal out of the way of a row that answers the query", () => {
      typeInto("due", "tom");
      // `tom` is not a month this reads, and it is also three letters of
      // `Tomorrow`. The row that answers wins; the refusal is not drawn.
      expect(
        screen.getAllByRole("option").map((row) => row.textContent),
      ).toEqual(["Tomorrow· 10 Sep"]);
    });

    it("is not offered by the two modes whose values are not days", () => {
      typeInto("due", "today");
      expect(screen.getAllByRole("option")[0]?.textContent).toBe(
        "Wed 9 Sep 2026",
      );
      cleanup();
      renderPalette({ project: allProperties, initialMode: "estimate" });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "today" },
      });
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(screen.getByText("No matches")).toBeTruthy();
    });
  });

  it("carries a pair swatch on every theme row", () => {
    const { container } = renderPalette({ initialMode: "theme" });
    expect(container.querySelectorAll(".theme-swatch")).toHaveLength(1);
    expect(
      container.querySelector<HTMLElement>(".theme-swatch")?.dataset.lcTheme,
    ).toBe("indigo");
  });
});
