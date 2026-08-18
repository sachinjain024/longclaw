// @vitest-environment jsdom

/**
 * The settings panel (LC-208): one section at a time, chosen from a side nav.
 *
 * It used to be one scrolling column holding all six, which is why the gear was
 * the slowest way to change a theme in the app — six sections of project record
 * between the press and the swatches. The nav is the fix, and these are the
 * guarantees it makes: the section the caller asks for is the section on screen,
 * the nav says which one that is, and nothing outside the chosen section renders.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettings } from "./ProjectSettings";
import type { SettingsSection } from "./settingsSections";
import type { ProjectReference } from "./types";

afterEach(cleanup);

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "graphite", label: "Graphite" },
];

const PROJECT: ProjectReference = {
  id: "p1",
  name: "LongClaw",
  rootPath: "/Users/dev/longclaw",
  key: "LC",
  theme: "graphite",
  starred: false,
  reachable: true,
  labels: { design: { name: "Design", color: "orange" } },
};

function Harness(props: {
  section?: SettingsSection;
  onClose?: () => void;
  onRename?: (name: string) => void;
  onTheme?: (theme: string) => void;
  onAppearance?: (appearance: "light" | "dark" | "system") => void;
  onRemove?: () => void;
  onWrite?: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const [section, setSection] = useState<SettingsSection>(
    props.section ?? "general",
  );
  return (
    <ProjectSettings
      project={PROJECT}
      hasTickets
      appearance="system"
      themes={THEMES}
      section={section}
      onSection={setSection}
      onAppearance={props.onAppearance ?? (() => {})}
      onRename={props.onRename ?? (() => {})}
      onTheme={props.onTheme ?? (() => {})}
      onLocate={() => {}}
      onRemove={props.onRemove ?? (() => {})}
      onWrite={props.onWrite ?? (() => Promise.resolve(true))}
      onClose={props.onClose ?? (() => {})}
    />
  );
}

function panel() {
  return screen.getByRole("dialog", { name: "Project settings" });
}

function nav() {
  return screen.getByRole("tablist", { name: "Settings sections" });
}

describe("the settings panel's side nav (LC-208)", () => {
  it("lists every section the menu can open", () => {
    render(<Harness />);
    const labels = within(nav())
      .getAllByRole("tab")
      .map((tab) => tab.textContent);
    expect(labels).toEqual([
      "General",
      "Theme",
      "Labels",
      "Status fields",
      "Shortcuts",
      "Danger zone",
    ]);
  });

  it("opens on the section the caller asked for", () => {
    render(<Harness section="labels" />);
    expect(
      within(nav())
        .getByRole("tab", { name: "Labels" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Labels" })).toBeTruthy();
    // The whole point: the five sections that were not asked for are not here.
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("switches sections when a nav row is picked", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Name")).toBeTruthy();
    fireEvent.click(within(nav()).getByRole("tab", { name: "Theme" }));
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByRole("group", { name: /Appearance/ })).toBeTruthy();
  });

  it("moves between sections with the arrow keys, wrapping", () => {
    render(<Harness />);
    const general = within(nav()).getByRole("tab", { name: "General" });
    general.focus();
    fireEvent.keyDown(general, { key: "ArrowDown" });
    expect(
      within(nav())
        .getByRole("tab", { name: "Theme" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(within(nav()).getByRole("tab", { name: "Theme" }), {
      key: "ArrowUp",
    });
    fireEvent.keyDown(within(nav()).getByRole("tab", { name: "General" }), {
      key: "ArrowUp",
    });
    expect(
      within(nav())
        .getByRole("tab", { name: "Danger zone" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("keeps one tab stop across the nav", () => {
    render(<Harness section="theme" />);
    const stops = within(nav())
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0].textContent).toBe("Theme");
  });
});

describe("the settings panel as a right-hand panel (LC-208)", () => {
  it("says where its fields are written, in the header", () => {
    render(<Harness />);
    expect(within(panel()).getByText("longclaw.yaml")).toBeTruthy();
  });

  it("closes from the inside and on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("the field foundation reaches every settings input (LC-223)", () => {
  // The audit's headline bug: the app's field styling bound to `label input`,
  // and every input here uses a sibling label or a bare aria-label, so the
  // Name field, Key field and the labels editor all rendered browser-default
  // boxes at 16px. The `input` class is the contract that styles them.
  it("General's fields wear the input class", () => {
    render(<Harness section="general" />);
    for (const box of screen.getAllByRole("textbox", { hidden: true })) {
      expect(box.classList.contains("input")).toBe(true);
    }
    expect(screen.getByLabelText("Key").classList.contains("input")).toBe(true);
  });

  it("the labels editor's fields wear the compact input class", () => {
    render(<Harness section="labels" />);
    for (const box of screen.getAllByRole("textbox")) {
      expect(box.classList.contains("input")).toBe(true);
      expect(box.classList.contains("compact")).toBe(true);
    }
  });
});

describe("the sections (LC-208)", () => {
  it("General holds the name, the locked key, and the folder", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Name")).toBeTruthy();
    const key = screen.getByLabelText("Key") as HTMLInputElement;
    expect(key.disabled).toBe(true);
    expect(screen.getByText("locked after first ticket")).toBeTruthy();
    expect(screen.getByText(PROJECT.rootPath)).toBeTruthy();
  });

  it("Theme holds both axes and says which is which", () => {
    render(<Harness section="theme" />);
    const appearance = screen.getByRole("group", { name: /Appearance/ });
    expect(
      within(appearance).getByRole("button", { name: "System" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /Graphite/ }).getAttribute("checked"),
    ).not.toBe("false");
    // The device/project split, stated rather than left to be discovered.
    expect(screen.getByText(/not stored in the project/)).toBeTruthy();
  });

  it("Status fields is read-only, and says why (ADR 0002)", () => {
    render(<Harness section="status" />);
    const section = screen.getByRole("tabpanel", { name: "Status fields" });
    for (const status of [
      "Backlog",
      "Todo",
      "In Progress",
      "In Review",
      "Done",
      "Canceled",
    ]) {
      expect(within(section).getByText(status)).toBeTruthy();
    }
    // No field, no add, no remove: v0 ships the fixed set (ADR 0002), and a
    // section that offered to rename one would be offering a write that has
    // nowhere to land.
    expect(within(section).queryByRole("textbox")).toBeNull();
    expect(within(section).queryByRole("button")).toBeNull();
    expect(within(section).getByText(/fixed in v0/i)).toBeTruthy();
  });

  it("Shortcuts lists the app's keys against what they do", () => {
    render(<Harness section="shortcuts" />);
    const section = screen.getByRole("tabpanel", { name: "Shortcuts" });
    expect(within(section).getByText("Open command palette")).toBeTruthy();
    expect(within(section).getByText("Project settings")).toBeTruthy();
    expect(within(section).getAllByText("⌘").length).toBeGreaterThan(0);
  });

  it("Danger zone keeps the guarantee beside the button", () => {
    const onRemove = vi.fn();
    render(<Harness section="danger" onRemove={onRemove} />);
    expect(screen.getByText(/never touched/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove from app" }));
    // The confirm, not the removal (`screen-specs.md:335-336`).
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /Remove/ })).toBeTruthy();
  });
});
