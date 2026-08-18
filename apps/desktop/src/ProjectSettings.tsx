/**
 * Project settings (`screen-specs.md:327-336`), as a right-hand panel with a
 * side nav (LC-208).
 *
 * Two shapes preceded it. It was a section that expanded *inside* the main
 * panel, which pushed the board about 430px down the page and left it there
 * behind the controls that were changing it (D-40); LC-125 made it a centered
 * modal, which fixed that and introduced the next problem — one scrolling
 * column holding every section the project has, so the gear was the slowest
 * control in the app for the thing it is most often opened to do.
 *
 * So the sections are a nav now, and the gear opens a menu in front of this
 * (`SettingsMenu.tsx`) that lands on the one you asked for. The panel keeps the
 * anatomy the ticket panel established — right edge, header row, `Esc` — which
 * is the shape this app already means by *a record you are editing*.
 *
 * It is a panel beside the board, not a modal over it (LC-223, the
 * prototype's arrangement): no scrim, no Tab trap, the board stays live so a
 * theme can be tried against it. The right edge holds one record at a time —
 * opening settings closes the ticket panel (`App.tsx`) — and `Esc` still
 * closes with focus returning to the gear.
 *
 * What is *not* here is as deliberate as what is. Statuses are listed and not
 * editable, because v0 ships the fixed set (ADR 0002) and a rename field would
 * be a write with nowhere to land.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { addProjectLabel, removeProjectLabel, updateProjectLabel } from "./api";
import { RemoveProjectConfirm } from "./ConfirmDialog";
import { FolderGlyph } from "./FolderGlyph";
import { GearGlyph } from "./SettingsGlyphs";
import { FALLBACK_LABEL_COLOR, isRampColor, LABEL_COLORS } from "./labels";
import { useDismissOnPressOutside, useFocusReturn } from "./popover";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settingsSections";
import { APPEARANCES, type Appearance } from "./state";
import { StatusDot } from "./StatusDot";
import { tabStops } from "./tabStops";
import { ThemePicker, type ThemeOption } from "./ThemePicker";
import { STATUSES } from "./tickets";
import type { Label, ProjectReference } from "./types";

export function ProjectSettings(props: {
  project: ProjectReference;
  /**
   * Whether any ticket exists yet. The key is immutable from the first one
   * (`data-requirements.md` § Project settings), which is what the note says.
   */
  hasTickets: boolean;
  appearance: Appearance;
  themes: ThemeOption[];
  /**
   * Which section is open. Controlled by `App`, because the menu that opens
   * this panel picks the section — a row that named a section and then landed
   * on `General` would be naming something else's row.
   */
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  onAppearance: (next: Appearance) => void;
  onRename: (name: string) => void;
  onTheme: (theme: string) => void;
  onLocate: () => void;
  onRemove: () => void;
  /**
   * A write to the project file, acknowledged the way every other write in the
   * app is: `App` marks the disk busy, adopts what landed, raises the toast and
   * owns the refusal. Returns whether it landed, which the add-a-label row
   * reads to decide if it may clear what was typed.
   */
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  /** Where focus returns when the confirm dialog is dismissed without removing. */
  const removeButton = useRef<HTMLButtonElement>(null);
  const cancelConfirm = useCallback(() => {
    setConfirmingRemove(false);
    removeButton.current?.focus();
  }, []);
  const panelId = useId();
  const sectionPane = useRef<HTMLDivElement>(null);

  /**
   * "Focus enters the first meaningful control"
   * (`keyboard-focus-map.md:143-147`), which for this panel is the first
   * control **of the section that was asked for** rather than a fixed field.
   * The Name input carried `autoFocus` while every section was on screen at
   * once; with a nav in front of them that would land a human who picked
   * `Labels` in a field belonging to a pane they cannot see.
   *
   * Two sections have no control at all — statuses and shortcuts are both
   * read-only — and the pane itself is the answer there. It is a scroll
   * container with its own tab stop, so focus lands somewhere that can be read
   * with the page keys rather than on `<body>`.
   *
   * On mount only. An arrow press in the nav both selects a section and moves
   * focus onto its row, so a version of this that re-ran per section would take
   * that focus straight back out of the nav again.
   */
  useEffect(() => {
    const pane = sectionPane.current;
    if (!pane) return;
    (tabStops(pane)[0] ?? pane).focus();
  }, []);

  /**
   * The `Esc` rung this layer owns, on the document rather than on the panel.
   *
   * A handler on the element only fires while focus is inside it, and a click
   * on the panel's own heading puts focus on `body` — after which `Esc` closed
   * nothing, because `App`'s listener sees a layer open and stands down. One
   * press still closes one rung: a field mid-edit stops the event itself, and
   * the confirm is answered here rather than in a second listener, since two
   * listeners on the same document would both fire and take two layers down.
   */
  const { onClose } = props;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (confirmingRemove) {
        cancelConfirm();
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cancelConfirm, confirmingRemove, onClose]);

  return (
    <>
      <section className="settings-panel" aria-label="Project settings">
        {/* The header the ticket panel established: what this is, where it is
            written, and the way out — one row, on the right. */}
        <header className="settings-head">
          <GearGlyph />
          <h2>Project settings</h2>
          {/* The sentence that made the old dialog trustworthy (D-4K), as a
              chip rather than a paragraph: every section below is a section of
              one file inside the project folder, and saying so once at the top
              beats repeating it under each. */}
          <code className="settings-file">longclaw.yaml</code>
          <button
            tabIndex={0}
            className="ghost small settings-close"
            aria-label="Close settings"
            title="Close · Esc"
            onClick={props.onClose}
          >
            ✕
          </button>
        </header>

        <div className="settings-split">
          <SectionNav
            section={props.section}
            panelId={panelId}
            onPick={props.onSection}
          />
          <div
            className="settings-section"
            role="tabpanel"
            ref={sectionPane}
            id={`${panelId}-panel`}
            aria-labelledby={`${panelId}-${props.section}`}
            // The pane scrolls, so it is a scrollable region and owes the
            // keyboard a way to reach it (`keyboard-focus-map.md` rule 1).
            tabIndex={0}
          >
            {props.section === "general" && (
              /* Keyed by project, so the name draft belongs to the project it
                 was typed against. The `⋮` menu can open this panel on a
                 project that is not the one on screen yet — it starts a load
                 and opens the section in the same act (LC-208) — so without
                 the key the field would keep the previous project's name and
                 the next `Enter` or blur would rename the new one to it. */
              <GeneralSection
                key={props.project.id}
                project={props.project}
                hasTickets={props.hasTickets}
                onRename={props.onRename}
                onLocate={props.onLocate}
              />
            )}
            {props.section === "theme" && (
              <ThemeSection
                project={props.project}
                themes={props.themes}
                appearance={props.appearance}
                onAppearance={props.onAppearance}
                onTheme={props.onTheme}
              />
            )}
            {props.section === "labels" && (
              <ProjectLabels project={props.project} onWrite={props.onWrite} />
            )}
            {props.section === "status" && <StatusSection />}
            {props.section === "shortcuts" && <ShortcutsSection />}
            {props.section === "danger" && (
              <DangerSection
                removeButton={removeButton}
                onConfirm={() => setConfirmingRemove(true)}
              />
            )}
          </div>
        </div>
      </section>

      {/* The app's own remove-confirm (LC-144), which the unreachable screen
          raises too: one guarantee in one set of words, from both places that
          offer the action. A sibling rather than a child, so its scrim — the
          same `--lc-z-modal` layer — is above this one by source order. */}
      {confirmingRemove && (
        <RemoveProjectConfirm
          project={props.project}
          onCancel={cancelConfirm}
          onConfirm={props.onRemove}
        />
      )}
    </>
  );
}

/**
 * The side nav the ticket asks for: "a SideNavbar which shows all the Options
 * and when user clicks on any option … user can edit that particular setting".
 *
 * A tablist, which is what it is — the panes are already built and cost nothing
 * to show, so selection follows focus, exactly as the ticket panel's own tabs
 * do. One tab stop for the set; the arrows own the rest.
 *
 * The rows are `settingsSections.ts`'s, so the nav and the gear's menu cannot
 * come to name the same pane two different things.
 */
function SectionNav(props: {
  section: SettingsSection;
  panelId: string;
  onPick: (section: SettingsSection) => void;
}) {
  const buttons = useRef(new Map<SettingsSection, HTMLButtonElement>());
  return (
    <nav
      className="settings-nav"
      role="tablist"
      aria-label="Settings sections"
      aria-orientation="vertical"
    >
      {SETTINGS_SECTIONS.map((section, index) => (
        <button
          key={section.id}
          type="button"
          role="tab"
          id={`${props.panelId}-${section.id}`}
          ref={(node) => {
            if (node) buttons.current.set(section.id, node);
            else buttons.current.delete(section.id);
          }}
          className={
            section.id === "danger"
              ? "settings-nav-row danger"
              : "settings-nav-row"
          }
          aria-selected={section.id === props.section}
          aria-controls={`${props.panelId}-panel`}
          tabIndex={section.id === props.section ? 0 : -1}
          onClick={() => props.onPick(section.id)}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            if (step === 0) return;
            event.preventDefault();
            // Wraps at both ends, and counts the sections rather than
            // assuming how many there are.
            const next =
              SETTINGS_SECTIONS[
                (index + step + SETTINGS_SECTIONS.length) %
                  SETTINGS_SECTIONS.length
              ];
            props.onPick(next.id);
            // Focus has to be moved by hand: the button keeping it is the one
            // this press just unselected, and it is about to lose its stop.
            buttons.current.get(next.id)?.focus();
          }}
        >
          {section.navLabel}
        </button>
      ))}
      {/* Pinned to the foot of the nav, the way the side panel's trust line is
          pinned to the foot of the shell — and saying the same kind of thing.
          The header's chip names the file; this says the panes above it are
          *that file*, which is the claim D-4K asks the panel to keep making
          while a person is editing rather than only when it opens. */}
      <p className="settings-nav-note">
        stored in
        <br />
        longclaw.yaml
      </p>
    </nav>
  );
}

/** Name, key, folder: what the project *is*, and the only writable identity. */
function GeneralSection(props: {
  project: ProjectReference;
  hasTickets: boolean;
  onRename: (name: string) => void;
  onLocate: () => void;
}) {
  const [name, setName] = useState(props.project.name);
  const nameId = useId();
  const keyId = useId();
  const folderId = useId();

  /** Renaming to nothing, or to the name it already has, writes nothing. */
  function commitName() {
    const next = name.trim();
    if (!next || next === props.project.name) {
      setName(props.project.name);
      return;
    }
    props.onRename(next);
  }

  return (
    <>
      {/* The claim the panel rests on (D-4K): these are lines in a file inside
          the folder, not rows in an app database somewhere else. The header
          chip names the file, so this says the part a filename cannot — that
          the settings travel with the project rather than with the app. */}
      <p className="settings-subhead">
        The project&apos;s own record, written into the project folder and
        portable with the files.
      </p>

      <div className="settings-row settings-identity">
        <div className="settings-field">
          <label htmlFor={nameId}>Name</label>
          <div className="field-row">
            {/* `Enter` or blur commits, as the panel's title does
                (`screen-specs.md:225`). The `Rename` button beside this was the
                only way to save it, and pressing `Done` with a typed name threw
                the name away without saying so. */}
            <input
              id={nameId}
              className="input"
              value={name}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitName();
                  return;
                }
                // `Esc` reverts a field that has been typed into, and only
                // then, so an untouched field does not swallow the press the
                // panel owes its own close.
                if (event.key !== "Escape" || name === props.project.name)
                  return;
                event.stopPropagation();
                setName(props.project.name);
              }}
              onBlur={commitName}
            />
          </div>
        </div>
        <div className="settings-field">
          <label htmlFor={keyId}>Key</label>
          <div className="field-row">
            {/* Shown rather than hidden (D-41). It is the one setting a user
                can never change — every ticket directory and every key in every
                file already carries it — so the honest thing is a locked field
                with the reason beside it, not a field that isn't there. */}
            <input
              id={keyId}
              className="input mono key-field"
              value={props.project.key}
              disabled
              readOnly
            />
            <span className="lock-note">
              {props.hasTickets
                ? "locked after first ticket"
                : "set when the project was created"}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-row">
        {/* Not a `<label>`: the row's control is a button, and the path beside
            it is text rather than a field. */}
        <span className="settings-label" id={folderId}>
          Folder
        </span>
        <div className="path-row">
          {/* The path itself, which the panel never showed — a `Locate folder`
              button alone asks you to re-point a folder without saying which
              one it is now (D-43). Full and selectable here, unlike the header
              chip, because this is the row that answers "where is this
              project?". */}
          <span className="picked-path" title={props.project.rootPath}>
            <FolderGlyph />
            <span className="txt">{props.project.rootPath}</span>
          </span>
          <button
            tabIndex={0}
            className="secondary"
            aria-describedby={folderId}
            onClick={props.onLocate}
          >
            Locate…
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Both theme axes, and the sentence that says they are different things.
 *
 * The preset is project data and rides in `longclaw.yaml` with the files; the
 * appearance is this device's (D-42). The menu's submenu says the same thing in
 * two captions — this is where there is room to say it in words.
 */
function ThemeSection(props: {
  project: ProjectReference;
  themes: ThemeOption[];
  appearance: Appearance;
  onAppearance: (next: Appearance) => void;
  onTheme: (theme: string) => void;
}) {
  const appearanceId = useId();
  return (
    <>
      <div className="settings-row">
        <span className="settings-label" id={appearanceId}>
          Appearance{" "}
          <span className="settings-label-note">
            — app preference, not stored in the project
          </span>
        </span>
        {/* The 3-up segment the spec puts here (D-42). It replaced a native
            `<select>` in the sidebar footer, which was the last piece of OS
            chrome in the shell (D-0A, D-72) and put a device preference where
            the project list lives. */}
        <div
          className="appearance-segment"
          role="group"
          aria-labelledby={appearanceId}
        >
          {APPEARANCES.map((option) => (
            <button
              tabIndex={0}
              key={option.id}
              className={props.appearance === option.id ? "selected" : ""}
              aria-pressed={props.appearance === option.id}
              onClick={() => props.onAppearance(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <ThemePicker
          themes={props.themes}
          value={props.project.theme}
          onPick={props.onTheme}
        />
      </div>

      {/* The one thing a person cannot discover by trying every preset: the
          agent accent does not move. It is how agent presence reads the same in
          a project you have never opened before. */}
      <p className="settings-note">
        The agent accent stays green in every preset, so agent activity reads
        the same in every project.
      </p>
    </>
  );
}

/**
 * The board's columns, listed and not editable.
 *
 * v0 ships exactly the built-in set and nothing can create, rename or recolor
 * one (ADR 0002), so this section exists to *answer* the question rather than
 * to take an edit — the prototype's inline rename and `Add status` would be
 * fields writing to a registry the file format does not have
 * (`docs/file_format.md:128`).
 */
function StatusSection() {
  return (
    <>
      <p className="settings-subhead">
        The board&apos;s columns, in order. Agents read the same names from
        disk.
      </p>
      <ul className="status-list">
        {STATUSES.map((status) => (
          <li key={status.id}>
            <StatusDot status={status.id} decorative />
            <span className="status-name">{status.label}</span>
            <code>{status.id}</code>
          </li>
        ))}
      </ul>
      <p className="settings-note">
        Fixed in v0 — a ticket&apos;s <code>status</code> is one of these six
        (ADR 0002). Per-project statuses arrive with a later format version.
      </p>
    </>
  );
}

/**
 * The keyboard surface, as the reference `keyboard-focus-map.md` is for us.
 *
 * It is here because the menu offers it and because there is nowhere else: the
 * palette lists commands, not their keys, and a shortcut nobody can look up is
 * a shortcut only its author uses.
 *
 * It is a hand-copy of the map's § Global and § Board tables
 * (`keyboard-focus-map.md:29-34`, `:39-44`) and there is no way for it not to
 * be — the map is prose for people, not a module. So it is written to be
 * *checkable* instead: one row per row of those two tables, in their order,
 * and it shipped missing `⌘↵` and the `J K H L` half of board movement.
 * Re-read them together when either changes.
 */
const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Open command palette", keys: ["⌘", "K"] },
  { action: "Undo the last write", keys: ["⌘", "Z"] },
  { action: "Focus the filter field", keys: ["⌘", "F"] },
  { action: "Quick create a ticket", keys: ["C"] },
  { action: "Project settings", keys: ["⌘", ","] },
  { action: "Close one layer", keys: ["Esc"] },
  { action: "Move between tickets", keys: ["↑", "↓", "←", "→"] },
  { action: "…or without leaving the home row", keys: ["K", "J", "H", "L"] },
  { action: "Open the focused ticket", keys: ["↵"] },
  {
    action: "Create from the quick-create form, from any field",
    keys: ["⌘", "↵"],
  },
  { action: "Status menu on the focused ticket", keys: ["S"] },
  { action: "Priority menu on the focused ticket", keys: ["P"] },
];

function ShortcutsSection() {
  return (
    <>
      <p className="settings-subhead">
        Single-key shortcuts stand down while a field has focus; the chords stay
        live.
      </p>
      <dl className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action}>
            <dt>{shortcut.action}</dt>
            <dd>
              {shortcut.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="settings-note">Fixed in v0 — not remappable.</p>
    </>
  );
}

/** The guarantee, stated where the action is rather than only in the confirm. */
function DangerSection(props: {
  removeButton: React.RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
}) {
  return (
    <>
      <p className="settings-subhead">
        Removing only forgets the project in LongClaw. Files on disk are never
        touched.
      </p>
      <button
        tabIndex={0}
        ref={props.removeButton}
        className="danger"
        onClick={props.onConfirm}
      >
        Remove from app
      </button>
    </>
  );
}

/**
 * Label definitions, which are project data rather than ticket data
 * (`file_format.md:214-231`). `screen-specs.md` § Project settings never
 * mentions them, so they sit in the panel that already owns the project file's
 * other fields: the name, the theme, and the folder.
 *
 * Nothing here writes a ticket. A slug is not editable — it is what every ticket
 * carrying the label stores — and removing a definition leaves the slug where it
 * is, to be rendered as itself.
 */
function ProjectLabels(props: {
  project: ProjectReference;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const definitions = Object.entries(props.project.labels);
  /** Where focus goes when the row holding it is taken away. */
  const addSlug = useRef<HTMLInputElement>(null);

  /**
   * Every write here returns the project as the file now reads, and every one
   * of them says so: a definition added, renamed, recoloured or removed used to
   * land in silence, which on the remove is the difference between "gone" and
   * "did that work?". Rust owns the slug grammar and the name and colour rules,
   * so its refusal is the message — nothing here guesses at one of its own.
   */
  const run = props.onWrite;

  return (
    <section className="label-settings" aria-label="Labels">
      <p className="settings-subhead">
        Slugs are what tickets store; display names and colors are how they
        read.
      </p>
      {definitions.length === 0 && (
        <p>No labels are defined in this project&apos;s longclaw.yaml yet.</p>
      )}
      {definitions.map(([definedSlug, label]) => (
        <LabelDefinition
          key={definedSlug}
          slug={definedSlug}
          label={label}
          onSave={(next) =>
            void run(`Label ${definedSlug} updated`, () =>
              updateProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
                ...next,
              }),
            )
          }
          onRemove={() => {
            // "Removed" and not "deleted": the definition goes, and every
            // ticket carrying the slug keeps it (`file_format.md:214-231`).
            void run(`Removed the ${definedSlug} label definition`, () =>
              removeProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
              }),
            );
            // The row is going, and with it whatever held focus inside it. The
            // add-row is the one thing here that is always on screen.
            addSlug.current?.focus();
          }}
        />
      ))}
      <form
        className="label-row label-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!slug.trim() || !name.trim()) return;
          void (async () => {
            const added = await run(`Added the ${slug.trim()} label`, () =>
              addProjectLabel({
                projectId: props.project.id,
                slug: slug.trim(),
                name: name.trim(),
                color,
              }),
            );
            if (!added) return;
            setSlug("");
            setName("");
          })();
        }}
      >
        <input
          ref={addSlug}
          className="input compact mono"
          value={slug}
          aria-label="New label slug"
          placeholder="slug"
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          className="input compact"
          value={name}
          aria-label="New label name"
          placeholder="Display name"
          onChange={(event) => setName(event.target.value)}
        />
        <LabelColors label="New label color" value={color} onPick={setColor} />
        <button tabIndex={0} className="secondary small" type="submit">
          Add label
        </button>
      </form>
      <p className="settings-note">
        Removing a definition never rewrites a ticket — the slug renders as
        itself.
      </p>
    </section>
  );
}

/**
 * One definition. The slug is shown as what it is: a key, not a field.
 *
 * The row used to carry a `Save label X` and a `Remove label X` button, which
 * was two buttons per row saying the row's name twice (D-4J). It commits the
 * way the panel's title does instead (`screen-specs.md:225`) — `Enter` or blur
 * — and a colour applies the moment it is picked, the way the theme picker
 * does, so the only button left is the one that takes the row away.
 */
function LabelDefinition(props: {
  slug: string;
  label: Label;
  onSave: (next: { name: string; color: string }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(props.label.name);
  const [color, setColor] = useState(props.label.color);

  /**
   * What landed on disk wins over an untouched draft. This used to be a `key`
   * of the row's own values, which remounted it — and a remount on a colour
   * pick would drop focus off the swatch that had just been chosen.
   */
  useEffect(() => {
    setName(props.label.name);
    setColor(props.label.color);
  }, [props.label.name, props.label.color]);

  /** Nothing is written for a rename to the same name, or to nothing at all. */
  function commitName() {
    const next = name.trim();
    if (!next || next === props.label.name) {
      setName(props.label.name);
      return;
    }
    props.onSave({ name: next, color });
  }

  return (
    <div className="label-row">
      <code>{props.slug}</code>
      <input
        className="input compact"
        value={name}
        aria-label={`Name of label ${props.slug}`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitName();
            return;
          }
          // The row's own revert, and only for a field that has been typed
          // into: `Esc` puts the saved value back rather than closing the
          // panel around it, but an untouched field owes the panel the press.
          if (event.key !== "Escape" || name === props.label.name) return;
          event.stopPropagation();
          setName(props.label.name);
        }}
        onBlur={commitName}
      />
      <LabelColors
        label={`Color of label ${props.slug}`}
        value={color}
        onPick={(next) => {
          setColor(next);
          if (next !== props.label.color) {
            props.onSave({
              name: name.trim() || props.label.name,
              color: next,
            });
          }
        }}
      />
      <button
        tabIndex={0}
        className="ghost row-remove"
        type="button"
        aria-label={`Remove label ${props.slug}`}
        // The press takes focus off the name field, and a typed name would
        // commit on the way out — a rename written to a definition that is
        // about to be deleted, racing the delete for the same slug. Holding
        // focus where it is until the click lands is what keeps it to one
        // write; the keyboard path never gets here with an uncommitted draft,
        // because Tab committed it on the way to this button.
        onMouseDown={(event) => event.preventDefault()}
        onClick={props.onRemove}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * The colour a label reads as, behind a dropdown (D12, `labels.ts:22-31`).
 *
 * It was eight swatches laid out inline, which is what LC-208 inherited from
 * V0-10 and carried into the new panel unchanged — and a row of eight dots per
 * label is 48 dots down a six-label list, none of which is the answer to
 * "what colour is `design`?". The prototype draws one dot and a chevron, and
 * that is the right trade: the resting state says the colour, and the eight
 * are a decision you have opened rather than a decision on permanent display.
 *
 * What the swatch row *did* get right and this keeps: the OS `<select>` it
 * replaced was one of the two places the app rendered native chrome (D-72),
 * and it named its colours in words while every other surface draws them as
 * dots. Every dot here carries its name for anything that is not looking.
 */
function LabelColors(props: {
  label: string;
  value: string;
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // A colour the ramp does not hold is still shown and still selected, or
  // renaming a label would silently recolour it. It wears the fallback dot,
  // which is what every other surface draws it as (`labels.ts:40`).
  const hues: readonly string[] = isRampColor(props.value)
    ? LABEL_COLORS
    : [props.value, ...LABEL_COLORS];
  const dot = (hue: string) =>
    `label-dot label-${isRampColor(hue) ? hue : FALLBACK_LABEL_COLOR}`;
  return (
    <span className="label-color-field">
      <button
        tabIndex={0}
        type="button"
        ref={trigger}
        className="label-color-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        // The name carries the value, because the trigger's whole content is a
        // colour: `Color of label design: orange`.
        aria-label={`${props.label}: ${props.value}`}
        onClick={() => setOpen(!open)}
      >
        <span className={dot(props.value)} aria-hidden="true" />
        <ChevronGlyph />
      </button>
      {open && (
        <LabelColorMenu
          label={props.label}
          hues={hues}
          value={props.value}
          anchor={trigger.current}
          dot={dot}
          onPick={(hue) => {
            props.onPick(hue);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * The eight, in one row, as the prototype draws them.
 *
 * A strip rather than a list of named rows: the thing being chosen *is* a
 * colour, so the swatch is the label and a column of colour words would be a
 * worse version of the `<select>` D-72 removed. The names are still there for
 * anything not looking at it — on each dot, not beside it.
 *
 * Roving focus, one tab stop, arrows along the strip, `Esc` back to the
 * trigger: the contract `keyboard-focus-map.md:139-141` gives every menu, on
 * the horizontal axis this one is drawn along.
 */
function LabelColorMenu(props: {
  label: string;
  hues: readonly string[];
  value: string;
  anchor: HTMLElement | null;
  dot: (hue: string) => string;
  onPick: (hue: string) => void;
  onClose: () => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const swatches = useRef<(HTMLButtonElement | null)[]>([]);
  const at = props.hues.indexOf(props.value);
  const [active, setActive] = useState(at === -1 ? 0 : at);
  useFocusReturn(props.anchor);
  useDismissOnPressOutside({
    popover,
    anchor: props.anchor,
    onDismiss: props.onClose,
  });
  useLayoutEffect(() => {
    swatches.current[active]?.focus();
  }, [active]);

  return (
    <div
      className="label-color-menu"
      role="menu"
      aria-label={props.label}
      ref={popover}
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (step !== 0) {
          event.preventDefault();
          event.stopPropagation();
          // Wraps at both ends, as every other menu in the app does.
          setActive(
            (index) => (index + step + props.hues.length) % props.hues.length,
          );
          return;
        }
        if (event.key !== "Escape") return;
        event.preventDefault();
        // Spent here: the panel behind this must not also close.
        event.stopPropagation();
        props.onClose();
      }}
    >
      {props.hues.map((hue, index) => (
        <button
          key={hue}
          type="button"
          role="menuitemradio"
          aria-checked={hue === props.value}
          aria-label={hue}
          tabIndex={index === active ? 0 : -1}
          ref={(element) => {
            swatches.current[index] = element;
          }}
          className={
            hue === props.value
              ? "label-color-swatch selected"
              : "label-color-swatch"
          }
          onFocus={() => setActive(index)}
          onClick={() => props.onPick(hue)}
        >
          <span className={props.dot(hue)} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** The mark that says a control opens something (`components.md` § Menus). */
function ChevronGlyph() {
  return (
    <svg
      className="label-color-chevron"
      width="9"
      height="9"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M3 5 L7 9.5 L11 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
