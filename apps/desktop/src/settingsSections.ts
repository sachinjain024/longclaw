/**
 * The panes of the settings panel (LC-208), and what each is called in the two
 * places it is offered from.
 *
 * The panel's side nav and the gear's menu name the same set, and one list is
 * what keeps that true. They had drifted the first time they were written apart
 * — `Shortcuts` in the nav against `Keyboard shortcuts` in the menu — which is
 * two names for one pane in two surfaces a person moves between in one gesture.
 *
 * Both labels are held here rather than one being derived from the other,
 * because the difference is real: a nav row is read down a 150px column with
 * its neighbours for context, and a menu row has to say what it opens with no
 * context at all. What must not drift is the **set**, and taking both labels
 * off one row is what makes adding a pane to one and not the other impossible.
 */
export type SettingsSection =
  "general" | "theme" | "labels" | "status" | "shortcuts" | "danger";

export interface SettingsSectionSpec {
  id: SettingsSection;
  /** In the panel's side nav, read top to bottom with its neighbours. */
  navLabel: string;
  /** In the gear's menu, where the row names its pane out of context. */
  menuLabel: string;
}

/**
 * In the order the **panel** reads: what the project *is*, then how it looks,
 * then its vocabularies, then the reference pane, then the way out.
 *
 * The menu offers a subset in a different order, and deliberately: a nav is
 * read top to bottom and so leads with identity, while a menu is aimed at and
 * so leads with `Theme`, which is what the gear is most often opened for.
 * `SettingsMenu` names the rows it wants by id and reads their labels from
 * here.
 */
export const SETTINGS_SECTIONS: SettingsSectionSpec[] = [
  { id: "general", navLabel: "General", menuLabel: "General" },
  { id: "theme", navLabel: "Theme", menuLabel: "Theme" },
  { id: "labels", navLabel: "Labels", menuLabel: "Labels" },
  { id: "status", navLabel: "Status fields", menuLabel: "Status fields" },
  { id: "shortcuts", navLabel: "Shortcuts", menuLabel: "Keyboard shortcuts" },
  { id: "danger", navLabel: "Danger zone", menuLabel: "Danger zone" },
];

/** The pane a row that does not name one opens: `All settings…`, `Rename…`. */
export const LANDING_SECTION: SettingsSection = "general";

/** One pane by id, for a menu that offers some of them rather than all. */
export function settingsSection(id: SettingsSection): SettingsSectionSpec {
  const found = SETTINGS_SECTIONS.find((section) => section.id === id);
  // Unreachable while `id` is the union — the lookup is total over it. Thrown
  // rather than fallen back on, because a silently-missing row is a menu that
  // quietly stops offering a pane.
  if (!found) throw new Error(`No settings section named ${id}`);
  return found;
}
