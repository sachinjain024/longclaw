// @vitest-environment jsdom

/**
 * The settings dropdown and the project menu (LC-208).
 *
 * The gear used to open the settings dialog directly, which put six unrelated
 * sections in front of a human who wanted one of them — usually the theme. It
 * opens a menu now, and the menu is the fast path: theme changes land from the
 * submenu without a dialog at all, and every other row opens the panel already
 * standing on the section it names.
 *
 * These are the guarantees `App` relies on, tested here once rather than
 * through the shell.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectMenu, SettingsMenu } from "./SettingsMenu";
import type { ProjectReference } from "./types";

afterEach(cleanup);

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "clay", label: "Clay" },
  { id: "graphite", label: "Graphite" },
];

const PROJECT: ProjectReference = {
  id: "p1",
  name: "LongClaw",
  rootPath: "/Users/dev/longclaw",
  key: "LC",
  theme: "graphite",
  starred: true,
  reachable: true,
  labels: { design: { name: "Design", color: "orange" } },
};

/** Both menus hang off a trigger and hand focus back to it. */
function Harness(props: {
  which?: "settings" | "project";
  onOpenSection?: (section: string) => void;
  onTheme?: (id: string) => void;
  onAppearance?: (id: string) => void;
  onReload?: () => void;
  onRemove?: () => void;
  onStar?: () => void;
  appearance?: "light" | "dark" | "system";
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const shared = {
    project: PROJECT,
    themes: THEMES,
    appearance: props.appearance ?? ("system" as const),
    onAppearance: props.onAppearance ?? (() => {}),
    onTheme: props.onTheme ?? (() => {}),
    onOpenSection: props.onOpenSection ?? (() => {}),
    anchor: anchor.current,
    onClose: () => setOpen(false),
  };
  return (
    <>
      {/* A toggle, as both real triggers are (`App.tsx`): a harness that only
          ever opened could not see a menu that refuses to close. */}
      <button ref={anchor} onClick={() => setOpen(!open)}>
        Project settings
      </button>
      <p>outside</p>
      {open &&
        (props.which === "project" ? (
          <ProjectMenu
            {...shared}
            onStar={props.onStar ?? (() => {})}
            onRemove={props.onRemove ?? (() => {})}
          />
        ) : (
          <SettingsMenu {...shared} onReload={props.onReload ?? (() => {})} />
        ))}
    </>
  );
}

function openMenu(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
  return screen.getByRole("menu", { name: /settings|Project menu/i });
}

describe("the settings dropdown (LC-208)", () => {
  it("opens a menu rather than the dialog the gear used to open", () => {
    const menu = openMenu();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The sections the ticket names, each as its own row.
    for (const row of ["General", "Theme", "Labels", "Status fields"]) {
      expect(
        within(menu).getByRole("menuitem", { name: new RegExp(row) }),
      ).toBeTruthy();
    }
  });

  it("opens the panel on the section the row names", () => {
    const onOpenSection = vi.fn();
    const menu = openMenu({ onOpenSection });
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Labels/ }));
    expect(onOpenSection).toHaveBeenCalledWith("labels");
    // Picking a row takes the menu down with it.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("advertises ⌘, on the row that opens everything", () => {
    const onOpenSection = vi.fn();
    const menu = openMenu({ onOpenSection });
    const all = within(menu).getByRole("menuitem", { name: /All settings/ });
    expect(all.textContent).toContain("⌘,");
    fireEvent.click(all);
    expect(onOpenSection).toHaveBeenCalledWith("general");
  });

  it("takes focus on open and returns it to the trigger on Escape", () => {
    const menu = openMenu();
    const rows = within(menu).getAllByRole("menuitem");
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Project settings" }),
    );
  });

  it("cycles rows with the arrow keys and wraps", () => {
    const menu = openMenu();
    const rows = within(menu).getAllByRole("menuitem");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[rows.length - 1]);
  });

  it("closes on a click outside it", () => {
    openMenu();
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  /**
   * The trigger's own press is a toggle, not a dismissal.
   *
   * A real pointer sends `mousedown` before `click`, and click-away listens on
   * the first: dismissing there and then letting the trigger's `click` run
   * against the freshly-closed state reopens the menu, so it can only ever be
   * shut with `Esc` or by clicking somewhere else. `fireEvent.click` alone
   * cannot see this — it sends no `mousedown` — which is why this drives the
   * whole sequence.
   */
  it("closes when its own trigger is pressed a second time", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Project settings" });
    const press = () => {
      fireEvent.mouseDown(trigger);
      fireEvent.mouseUp(trigger);
      fireEvent.click(trigger);
    };

    press();
    expect(screen.getByRole("menu", { name: "Project settings" })).toBeTruthy();

    press();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("the theme submenu (LC-208)", () => {
  /** Opens the gear menu and steps into Theme. */
  function openTheme(props: Parameters<typeof Harness>[0] = {}) {
    const menu = openMenu(props);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Theme/ }));
    return screen.getByRole("menu", { name: "Theme" });
  }

  it("carries both axes: appearance for this device, preset for the project", () => {
    const submenu = openTheme();
    for (const option of ["System", "Light", "Dark"]) {
      expect(
        within(submenu).getByRole("menuitemradio", { name: option }),
      ).toBeTruthy();
    }
    for (const preset of THEMES) {
      expect(
        within(submenu).getByRole("menuitemradio", { name: preset.label }),
      ).toBeTruthy();
    }
  });

  it("checks the appearance and the preset that are set", () => {
    const submenu = openTheme({ appearance: "dark" });
    expect(
      within(submenu)
        .getByRole("menuitemradio", { name: "Dark" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(submenu)
        .getByRole("menuitemradio", { name: "Graphite" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("changes appearance without opening the dialog", () => {
    const onAppearance = vi.fn();
    const submenu = openTheme({ onAppearance });
    fireEvent.click(
      within(submenu).getByRole("menuitemradio", { name: "Dark" }),
    );
    expect(onAppearance).toHaveBeenCalledWith("dark");
    // A pick that stays: the whole point of the submenu is trying presets
    // against the board behind it without a dialog in the way.
    expect(screen.getByRole("menu", { name: "Theme" })).toBeTruthy();
  });

  it("changes the project theme without opening the dialog", () => {
    const onTheme = vi.fn();
    const submenu = openTheme({ onTheme });
    fireEvent.click(
      within(submenu).getByRole("menuitemradio", { name: "Clay" }),
    );
    expect(onTheme).toHaveBeenCalledWith("clay");
    expect(screen.getByRole("menu", { name: "Theme" })).toBeTruthy();
  });

  it("opens with ArrowRight and steps back with ArrowLeft", () => {
    const menu = openMenu();
    const parent = within(menu).getByRole("menuitem", { name: /Theme/ });
    parent.focus();
    fireEvent.keyDown(menu, { key: "ArrowRight" });
    const submenu = screen.getByRole("menu", { name: "Theme" });
    expect(submenu.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(submenu, { key: "ArrowLeft" });
    expect(screen.queryByRole("menu", { name: "Theme" })).toBeNull();
    expect(document.activeElement).toBe(parent);
  });

  it("Escape inside the submenu closes only the submenu", () => {
    const submenu = openTheme();
    fireEvent.keyDown(submenu, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Theme" })).toBeNull();
    // The menu it stepped out of is still up (`keyboard-focus-map.md:23-31`:
    // one press, one rung).
    expect(screen.getByRole("menu", { name: /settings/i })).toBeTruthy();
  });
});

describe("the project menu the sidebar's ⋮ opens (LC-208)", () => {
  it("offers rename, theme, star and remove beside All settings", () => {
    const menu = openMenu({ which: "project" });
    expect(within(menu).getByRole("menuitem", { name: /Rename/ })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: /Theme/ })).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: /Unstar project/ }),
    ).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: /Remove from app/ }),
    ).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: /All settings/ }),
    ).toBeTruthy();
  });

  it("sends Rename to the section that holds the name field", () => {
    const onOpenSection = vi.fn();
    const menu = openMenu({ which: "project", onOpenSection });
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Rename/ }));
    expect(onOpenSection).toHaveBeenCalledWith("general");
  });

  it("sends Remove to the confirm rather than removing on the spot", () => {
    const onRemove = vi.fn();
    const menu = openMenu({ which: "project", onRemove });
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Remove from app/ }),
    );
    expect(onRemove).toHaveBeenCalled();
  });

  it("names the star row for what pressing it does", () => {
    const onStar = vi.fn();
    const menu = openMenu({ which: "project", onStar });
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Unstar project/ }),
    );
    expect(onStar).toHaveBeenCalled();
  });
});
