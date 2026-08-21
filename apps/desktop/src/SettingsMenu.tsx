/**
 * The two menus settings is reached through (LC-208).
 *
 * The gear used to open the settings dialog outright, which answered every
 * question with the same six-section modal — including the one people actually
 * ask, which is *make this darker*. So the gear opens a menu instead: the theme
 * is changed from a submenu with no dialog in the way at all, and every other
 * row opens the settings panel already standing on the section it names.
 *
 * Two menus rather than one, because the ticket puts settings in two places and
 * they are asked from different positions. The **settings menu** hangs off the
 * gear on the board and is about the project you are looking at: its sections,
 * its theme, its files. The **project menu** hangs off the `⋮` on a side-panel
 * row and is about a project you may not have open: rename it, restyle it, star
 * it, forget it. `Theme` and `All settings` are on both, which is deliberate —
 * they are the two things worth reaching from either place.
 *
 * Everything here is presentation over callbacks. Nothing in this file writes,
 * reads the disk, or knows what a section contains; `App` owns all of that, and
 * `ProjectSettings` owns the sections themselves. The popover the rows are drawn
 * in is `MenuList`, which lived here until a ticket's context menu wanted the
 * same rows-of-mixed-kinds shape (LC-222) and moved to a file of its own.
 */

import type { ReactNode } from "react";
import { MenuList, type MenuItem } from "./MenuList";
import { PencilGlyph } from "./PencilGlyph";
import { useFocusReturn, usePopoverPlacement } from "./popover";
import {
  ColumnsGlyph,
  GearGlyph,
  KeyboardGlyph,
  ReloadGlyph,
  TagGlyph,
} from "./SettingsGlyphs";
import {
  LANDING_SECTION,
  settingsSection,
  type SettingsSection,
} from "./settingsSections";
import { APPEARANCES, type Appearance } from "./state";
import type { ThemeOption } from "./ThemePicker";
import { ThemeSwatch } from "./ThemeSwatch";
import { STATUSES } from "./tickets";
import type { ProjectReference } from "./types";

/** What both menus are handed: a project, the two theme axes, and a way out. */
interface MenuContext {
  project: ProjectReference;
  themes: ThemeOption[];
  appearance: Appearance;
  /** What the popover hangs off and hands focus back to. */
  anchor: HTMLElement | null;
  onAppearance: (appearance: Appearance) => void;
  onTheme: (theme: string) => void;
  onOpenSection: (section: SettingsSection) => void;
  onClose: () => void;
}

/**
 * The `Theme ▸` row, shared by both menus.
 *
 * It carries **both** axes, which is what the ticket asks for and what makes it
 * worth being a submenu rather than two rows: appearance is a device preference
 * and the preset is project data written to `longclaw.yaml`, and the captions
 * say which is which rather than leaving a person to find out by switching
 * machines. The trailing hint on the parent row is the pair as it stands now,
 * so the answer is legible without opening anything.
 */
function themeSubmenu(context: MenuContext): MenuItem {
  const preset = context.themes.find(
    (option) => option.id === context.project.theme,
  );
  const appearance = APPEARANCES.find(
    (option) => option.id === context.appearance,
  );
  return {
    kind: "submenu",
    id: "theme",
    label: "Theme",
    glyph: <ThemeSwatch theme={context.project.theme} />,
    hint: `${preset?.label ?? context.project.theme} · ${appearance?.label ?? ""}`,
    items: [
      {
        kind: "group",
        id: "appearance-caption",
        label: "appearance · this device",
      },
      ...APPEARANCES.map((option): MenuItem => ({
        kind: "choice",
        id: `appearance-${option.id}`,
        label: option.label,
        checked: option.id === context.appearance,
        run: () => context.onAppearance(option.id),
      })),
      { kind: "rule", id: "theme-rule" },
      {
        kind: "group",
        id: "preset-caption",
        label: "color theme · longclaw.yaml",
      },
      ...context.themes.map((option): MenuItem => ({
        kind: "choice",
        id: `theme-${option.id}`,
        label: option.label,
        glyph: <ThemeSwatch theme={option.id} />,
        checked: option.id === context.project.theme,
        run: () => context.onTheme(option.id),
      })),
    ],
  };
}

/**
 * The row every menu ends on, and the shortcut that reaches it directly.
 *
 * It wears the gear, which is the ticket's "Settings Icon" in the second of the
 * two places it asks for it: the `⋮` menu's own settings row. Every other row
 * in both menus carries a mark, so the one that opens settings outright was the
 * only unmarked row in either.
 */
function allSettings(context: MenuContext): MenuItem {
  return {
    kind: "action",
    id: "all",
    glyph: <GearGlyph />,
    label: "All settings",
    hint: <kbd>⌘,</kbd>,
    run: () => context.onOpenSection(LANDING_SECTION),
  };
}

/** A row that opens one pane, named as `settingsSections.ts` names it. */
function sectionRow(
  context: MenuContext,
  id: SettingsSection,
  extras: { glyph?: ReactNode; hint?: ReactNode } = {},
): MenuItem {
  return {
    kind: "action",
    id,
    label: settingsSection(id).menuLabel,
    ...extras,
    run: () => context.onOpenSection(id),
  };
}

/**
 * The gear's menu on the board (`screen-specs.md` § Project settings).
 *
 * The sections are listed in the panel's own order so the menu and the panel's
 * side nav read as the same list — because they are. Each row's hint is the
 * thing you would open the section to find out: how many labels there are, what
 * the theme is set to, which fields the key and folder rows hold.
 */
export function SettingsMenu(
  props: MenuContext & {
    /** Re-reads the folder. The one row here that is not a settings section. */
    onReload: () => void;
  },
) {
  useFocusReturn(props.anchor);
  const position = usePopoverPlacement(props.anchor, 236);
  const labelCount = Object.keys(props.project.labels).length;
  const items: MenuItem[] = [
    themeSubmenu(props),
    { kind: "rule", id: "sections-rule" },
    // Every pane except `danger`, whose one control removes a project: that
    // belongs behind the panel's own nav rather than one press from the gear.
    // The labels come from `settingsSections.ts`, so a pane cannot be renamed
    // here and not there.
    sectionRow(props, "general", {
      glyph: <GearGlyph />,
      hint: "name · key · folder",
    }),
    sectionRow(props, "labels", {
      glyph: <TagGlyph />,
      hint: <code>{labelCount}</code>,
    }),
    sectionRow(props, "status", {
      glyph: <ColumnsGlyph />,
      // The count its neighbour has, from the one list the board is built
      // from — the six are fixed in v0 (ADR 0002), so this is a constant, but
      // reading it off `STATUSES` is what keeps it true when they stop being.
      hint: <code>{STATUSES.length}</code>,
    }),
    sectionRow(props, "shortcuts", { glyph: <KeyboardGlyph /> }),
    { kind: "rule", id: "disk-rule" },
    {
      kind: "action",
      id: "reload",
      glyph: <ReloadGlyph />,
      label: "Reload from disk",
      run: props.onReload,
    },
    { kind: "rule", id: "all-rule" },
    allSettings(props),
  ];
  return (
    <MenuList
      label="Project settings"
      items={items}
      position={position}
      anchor={props.anchor}
      onDismiss={props.onClose}
    />
  );
}

/**
 * The `⋮` menu on a side-panel row (LC-208: "the Menu which gets opened through
 * 3 vertical dots in front of Project Name").
 *
 * It is about the row rather than about the board, so it holds the two things
 * that were previously only reachable by opening the project first — its theme
 * and its removal — plus the star, which was a bare `★` glyph beside the name
 * that said nothing about what pressing it would do.
 */
export function ProjectMenu(
  props: MenuContext & {
    onStar: () => void;
    onRemove: () => void;
  },
) {
  useFocusReturn(props.anchor);
  const position = usePopoverPlacement(props.anchor);
  const items: MenuItem[] = [
    {
      kind: "action",
      id: "rename",
      // The pencil the panel's editable title wears, from the one file that
      // draws it — this row had its own, subtly different, path.
      glyph: <PencilGlyph />,
      label: "Rename",
      // The name field lives in General and commits on `Enter` or blur; a
      // second inline editor on the row would be a second way to write the
      // same line of `longclaw.yaml`.
      run: () => props.onOpenSection(LANDING_SECTION),
    },
    themeSubmenu(props),
    { kind: "rule", id: "star-rule" },
    {
      kind: "action",
      id: "star",
      glyph: (
        <span className="menu-star" aria-hidden="true">
          {props.project.starred ? "★" : "☆"}
        </span>
      ),
      // Named for what pressing it does, not for what is true now.
      label: props.project.starred ? "Unstar project" : "Star project",
      run: props.onStar,
    },
    { kind: "rule", id: "danger-rule" },
    {
      kind: "action",
      id: "remove",
      danger: true,
      glyph: (
        <span className="menu-cross" aria-hidden="true">
          ✕
        </span>
      ),
      // The ellipsis is the promise: this raises the confirm that names the
      // path and repeats the guarantee (`screen-specs.md:335-336`).
      label: "Remove from app",
      run: props.onRemove,
    },
    { kind: "rule", id: "all-rule" },
    allSettings(props),
  ];
  return (
    <MenuList
      label="Project menu"
      items={items}
      position={position}
      anchor={props.anchor}
      onDismiss={props.onClose}
    />
  );
}
