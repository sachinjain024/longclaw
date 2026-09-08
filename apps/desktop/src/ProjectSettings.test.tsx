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
import type { ProjectReference, TicketProperty } from "./types";
import { NO_PROPERTIES } from "./properties";

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
  properties: NO_PROPERTIES,
};

/** None of the four carried by any ticket, which is the default project. */
const NO_COUNTS = { type: 0, due: 0, start: 0, estimate: 0 };

/** The panel's one write channel, spied on: what it was told it was doing. */
function writeSpy() {
  return vi.fn<
    (
      message: string,
      write: () => Promise<ProjectReference>,
    ) => Promise<boolean>
  >(() => Promise.resolve(true));
}

function Harness(props: {
  section?: SettingsSection;
  project?: ProjectReference;
  propertyCounts?: Record<TicketProperty, number>;
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
      project={props.project ?? PROJECT}
      hasTickets
      propertyCounts={props.propertyCounts ?? NO_COUNTS}
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

/** A project with all four on, and something configured under each. */
const CONFIGURED: ProjectReference = {
  ...PROJECT,
  properties: {
    type: {
      enabled: true,
      values: {
        bug: { name: "Bug", color: "red" },
        feature: { name: "Feature", color: "cyan" },
      },
    },
    due: { enabled: true, attentionDays: 7 },
    start: { enabled: true },
    estimate: {
      enabled: true,
      system: "duration",
      values: ["xs", "s", "m"],
      hoursPerDay: 8,
      daysPerWeek: 5,
    },
  },
};

function propertiesPane() {
  return screen.getByRole("tabpanel", { name: "Properties" });
}

function panel() {
  return screen.getByRole("region", { name: "Project settings" });
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
      "Properties",
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

/**
 * The Properties pane (LC-227): four blocks, one per opt-in property, each a
 * checkbox with whatever that property has to configure underneath it.
 *
 * Two things it is easy to get wrong and no other surface would catch. Turning a
 * property off is a write that says what it did rather than a dialog that asks
 * first, and the count it names has to go on being named while the property is
 * off — that count is then the only place on screen the fact is visible at all.
 * And a property that is off has nothing to configure, so its block is one row.
 */
describe("the Properties pane (LC-227)", () => {
  it("ships all four off, with nothing configured under them", () => {
    render(<Harness section="properties" />);
    const pane = propertiesPane();
    for (const name of ["Type", "Due date", "Start date", "Estimate"]) {
      const box = within(pane).getByRole("checkbox", {
        name: new RegExp(name),
      });
      expect((box as HTMLInputElement).checked).toBe(false);
    }
    // No editor, no segment, no window: a property that is off configures
    // nothing, which is what keeps a default project's pane four rows.
    expect(within(pane).queryByRole("textbox")).toBeNull();
    expect(within(pane).queryByRole("group", { name: "Estimate system" })).toBe(
      null,
    );
  });

  it("turns a property on with one write and no dialog", async () => {
    const onWrite = writeSpy();
    render(<Harness section="properties" onWrite={onWrite} />);
    fireEvent.click(
      within(propertiesPane()).getByRole("checkbox", { name: /Type/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite.mock.calls[0][0]).toBe("Type turned on");
  });

  /**
   * The reassurance and the count in one sentence, because the effect of
   * disabling is invisible: the dates come off every card, and a person could
   * reasonably conclude they had been deleted.
   */
  it("says what a property being turned off keeps", () => {
    const onWrite = writeSpy();
    render(
      <Harness
        section="properties"
        project={CONFIGURED}
        propertyCounts={{ type: 41, due: 17, start: 6, estimate: 23 }}
        onWrite={onWrite}
      />,
    );
    fireEvent.click(
      within(propertiesPane()).getByRole("checkbox", { name: /Due date/ }),
    );
    expect(onWrite.mock.calls[0][0]).toBe(
      "Due date turned off · 17 tickets keep their dates",
    );
  });

  /**
   * A count of one is a count a project reaches, and the sentence is built by
   * concatenation: "1 ticket keeps its dates", never "keeps its date**s**" and
   * never "keep their".
   */
  it("agrees with a count of one", () => {
    const onWrite = writeSpy();
    render(
      <Harness
        section="properties"
        project={CONFIGURED}
        propertyCounts={{ type: 1, due: 1, start: 0, estimate: 0 }}
        onWrite={onWrite}
      />,
    );
    fireEvent.click(
      within(propertiesPane()).getByRole("checkbox", { name: /Type/ }),
    );
    expect(onWrite.mock.calls[0][0]).toBe(
      "Type turned off · 1 ticket keeps its type",
    );
  });

  /**
   * The row goes on saying it once the property is off, which is then the only
   * place the fact is visible anywhere in the app.
   */
  it("keeps naming the count while the property is off", () => {
    render(
      <Harness
        section="properties"
        propertyCounts={{ type: 41, due: 17, start: 6, estimate: 23 }}
      />,
    );
    const pane = propertiesPane();
    expect(
      within(pane).getByText("· 17 tickets keep their dates"),
    ).toBeTruthy();
    expect(
      within(pane).getByText("· 41 tickets keep their types"),
    ).toBeTruthy();
    // A property nothing carries has nothing to reassure anyone about.
    cleanup();
    render(<Harness section="properties" />);
    expect(screen.queryByText(/tickets keep their/)).toBeNull();
  });

  it("is the labels editor for type values, down to the row", () => {
    render(<Harness section="properties" project={CONFIGURED} />);
    const pane = propertiesPane();
    expect(within(pane).getByText("bug")).toBeTruthy();
    const name = within(pane).getByLabelText("Name of type bug");
    expect((name as HTMLInputElement).value).toBe("Bug");
    expect(name.classList.contains("compact")).toBe(true);
    expect(
      within(pane).getByRole("button", { name: /Color of type bug/ }),
    ).toBeTruthy();
    expect(
      within(pane).getByRole("button", { name: "Remove type bug" }),
    ).toBeTruthy();
    expect(within(pane).getByRole("button", { name: "Add type" })).toBeTruthy();
  });

  it("writes a renamed type value on Enter, and never on no change", () => {
    const onWrite = writeSpy();
    render(
      <Harness section="properties" project={CONFIGURED} onWrite={onWrite} />,
    );
    const name = within(propertiesPane()).getByLabelText("Name of type bug");
    fireEvent.keyDown(name, { key: "Enter" });
    expect(onWrite).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "Defect" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite.mock.calls[0][0]).toBe("Type bug updated");
  });

  it("removes a type value without touching the tickets that carry it", () => {
    const onWrite = writeSpy();
    render(
      <Harness section="properties" project={CONFIGURED} onWrite={onWrite} />,
    );
    fireEvent.click(
      within(propertiesPane()).getByRole("button", { name: "Remove type bug" }),
    );
    expect(onWrite.mock.calls[0][0]).toBe("Removed the bug type definition");
    expect(
      within(propertiesPane()).getByText(/renders as itself/),
    ).toBeTruthy();
  });

  it("offers the three estimate systems and writes the one picked", () => {
    const onWrite = writeSpy();
    render(
      <Harness section="properties" project={CONFIGURED} onWrite={onWrite} />,
    );
    const segment = within(propertiesPane()).getByRole("group", {
      name: "Estimate system",
    });
    expect(
      within(segment)
        .getByRole("button", { name: "Duration" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(segment).getByRole("button", { name: "Fibonacci" }));
    expect(onWrite.mock.calls[0][0]).toBe(
      "Estimates are on the Fibonacci scale",
    );
  });

  /**
   * Each system configures a different thing, and only one of them at a time:
   * the conversion is meaningless outside duration, and the scale is meaningless
   * outside t-shirt.
   */
  it("shows only the configuration the chosen system has", () => {
    render(<Harness section="properties" project={CONFIGURED} />);
    expect(
      within(propertiesPane()).getByLabelText("Hours per day"),
    ).toBeTruthy();
    expect(within(propertiesPane()).queryByLabelText("New size")).toBeNull();

    cleanup();
    const tshirt = {
      ...CONFIGURED,
      properties: {
        ...CONFIGURED.properties,
        estimate: {
          ...CONFIGURED.properties.estimate,
          system: "tshirt" as const,
        },
      },
    };
    render(<Harness section="properties" project={tshirt} />);
    expect(within(propertiesPane()).getByLabelText("New size")).toBeTruthy();
    expect(within(propertiesPane()).getByText("m")).toBeTruthy();
    expect(
      within(propertiesPane()).queryByLabelText("Hours per day"),
    ).toBeNull();

    cleanup();
    const fibonacci = {
      ...CONFIGURED,
      properties: {
        ...CONFIGURED.properties,
        estimate: {
          ...CONFIGURED.properties.estimate,
          system: "fibonacci" as const,
        },
      },
    };
    render(<Harness section="properties" project={fibonacci} />);
    expect(
      within(propertiesPane()).queryByLabelText("Hours per day"),
    ).toBeNull();
    expect(within(propertiesPane()).queryByLabelText("New size")).toBeNull();
    // The scale itself, which is the whole of what Fibonacci has to say.
    expect(
      within(propertiesPane()).getByText("1 · 2 · 3 · 5 · 8 · 13"),
    ).toBeTruthy();
  });

  /**
   * The order is the scale, so an editor that could add and remove but not
   * reorder would edit everything about it except the part that makes it one.
   */
  it("moves a size up and down its own scale", () => {
    const onWrite = writeSpy();
    const tshirt = {
      ...CONFIGURED,
      properties: {
        ...CONFIGURED.properties,
        estimate: {
          ...CONFIGURED.properties.estimate,
          system: "tshirt" as const,
        },
      },
    };
    render(<Harness section="properties" project={tshirt} onWrite={onWrite} />);
    const pane = propertiesPane();
    // `xs` is first and `m` is last, so neither can go further that way.
    expect(
      (
        within(pane).getByRole("button", {
          name: "Make xs smaller",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        within(pane).getByRole("button", {
          name: "Make m bigger",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      within(pane).getByRole("button", { name: "Make m smaller" }),
    );
    expect(onWrite.mock.calls[0][0]).toBe("m is now smaller than s");
  });

  it("writes the conversion as one setting with two halves", () => {
    const onWrite = writeSpy();
    render(
      <Harness section="properties" project={CONFIGURED} onWrite={onWrite} />,
    );
    const hours = within(propertiesPane()).getByLabelText("Hours per day");
    fireEvent.change(hours, { target: { value: "7.5" } });
    fireEvent.blur(hours);
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite.mock.calls[0][0]).toBe(
      "One day is 7.5 hours, one week is 5 days",
    );
  });

  it("writes the approaching window, and takes a zero", () => {
    const onWrite = writeSpy();
    render(
      <Harness section="properties" project={CONFIGURED} onWrite={onWrite} />,
    );
    const days = within(propertiesPane()).getByLabelText("Attention days");
    fireEvent.change(days, { target: { value: "0" } });
    fireEvent.keyDown(days, { key: "Enter" });
    expect(onWrite.mock.calls[0][0]).toBe(
      "Due dates highlight from 0 days out",
    );
  });

  it("gives every control an explicit tab stop", () => {
    render(<Harness section="properties" project={CONFIGURED} />);
    const pane = propertiesPane();
    for (const control of [
      ...within(pane).getAllByRole("checkbox"),
      ...within(pane).getAllByRole("button"),
    ]) {
      // WebKit skips a button and a checkbox with no explicit `tabIndex` while
      // the macOS keyboard-navigation setting is off, which is its default.
      expect(control.getAttribute("tabindex")).not.toBeNull();
    }
  });
});
