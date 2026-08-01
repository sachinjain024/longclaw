// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
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
      tickets={[ticket]}
      appearance="system"
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
});
