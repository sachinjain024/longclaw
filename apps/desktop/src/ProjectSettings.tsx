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

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  addProjectLabel,
  addProjectTypeValue,
  removeProjectLabel,
  removeProjectTypeValue,
  setProjectDueWindow,
  setProjectEstimateConversion,
  setProjectEstimateScale,
  setProjectEstimateSystem,
  setProjectPropertyEnabled,
  updateProjectLabel,
  updateProjectTypeValue,
} from "./api";
import { RemoveProjectConfirm } from "./ConfirmDialog";
import { FolderGlyph } from "./FolderGlyph";
import { LabelColors } from "./LabelColorPicker";
import { DerivedKey, useLabelDefinition } from "./LabelDefine";
import { ESTIMATE_SYSTEMS, PROPERTY_LABELS } from "./properties";
import { GearGlyph } from "./SettingsGlyphs";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settingsSections";
import { APPEARANCES, type Appearance } from "./state";
import { StatusDot } from "./StatusDot";
import { tabStops } from "./tabStops";
import { ThemePicker, type ThemeOption } from "./ThemePicker";
import { STATUSES } from "./tickets";
import type {
  EstimateSystem,
  Label,
  ProjectReference,
  TicketProperty,
} from "./types";

export function ProjectSettings(props: {
  project: ProjectReference;
  /**
   * Whether any ticket exists yet. The key is immutable from the first one
   * (`data-requirements.md` § Project settings), which is what the note says.
   */
  hasTickets: boolean;
  /**
   * How many tickets carry a value for each of the four properties, off the
   * index. It is what the Properties pane says beside a property that is
   * *off* — the one place in the app that fact stays visible (LC-227).
   */
  propertyCounts: Record<TicketProperty, number>;
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
   * (`keyboard-focus-map.md:144-148`), which for this panel is the first
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
            {props.section === "properties" && (
              <ProjectProperties
                project={props.project}
                counts={props.propertyCounts}
                onWrite={props.onWrite}
              />
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
 * (`keyboard-focus-map.md:29-35`, `:40-45`) and there is no way for it not to
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
  { action: "Switch to the nth project in the sidebar", keys: ["⌘", "1–9"] },
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
 * (`file_format.md:241-258`). `screen-specs.md` § Project settings never
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
  /**
   * The same three things the popover's define row holds, from the same hook —
   * which is what stops the two definition surfaces disagreeing about the key a
   * typed name produces (LC-236e). Nobody authors a key here any more.
   */
  const definition = useLabelDefinition(props.project.labels);
  const definitions = Object.entries(props.project.labels);
  /** Where focus goes when the row holding it is taken away. */
  const addName = useRef<HTMLInputElement>(null);

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
          noun="label"
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
            // ticket carrying the slug keeps it (`file_format.md:241-258`).
            void run(`Removed the ${definedSlug} label definition`, () =>
              removeProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
              }),
            );
            // The row is going, and with it whatever held focus inside it. The
            // add-row is the one thing here that is always on screen.
            addName.current?.focus();
          }}
        />
      ))}
      <form
        className="label-row label-add"
        onSubmit={(event) => {
          event.preventDefault();
          const { state } = definition;
          if (state.kind !== "ok") return;
          void (async () => {
            const added = await run(`Added the ${state.slug} label`, () =>
              addProjectLabel({
                projectId: props.project.id,
                slug: state.slug,
                name: definition.name.trim(),
                color: definition.color,
              }),
            );
            if (!added) return;
            definition.reset();
          })();
        }}
      >
        {/* The key stacks under the field that produces it, as it does in the
            popover — not in the `code` column the rows above use. Those show a
            key that is already a fact; this one is still following what is
            being typed, and one column would have said they were the same kind
            of thing. */}
        <div className="label-add-name">
          <input
            ref={addName}
            className="input compact"
            value={definition.name}
            aria-label="New label name"
            placeholder="Display name"
            autoComplete="off"
            onChange={(event) => definition.setName(event.target.value)}
          />
          <DerivedKey state={definition.state} />
        </div>
        <LabelColors
          label="New label color"
          value={definition.color}
          onPick={definition.setColor}
        />
        <button
          tabIndex={0}
          className="secondary small"
          type="submit"
          disabled={definition.state.kind !== "ok"}
        >
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
 *
 * Both registries draw this row. A type value is a label in everything but the
 * key it is written under: same slug, same display name, same colour, stored on
 * the ticket the same way, and removed with the same guarantee. `noun` is the
 * only thing that differs, and it is what the row's controls are called.
 */
function LabelDefinition(props: {
  /** `label` or `type` — what this row's controls name themselves. */
  noun: string;
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
        aria-label={`Name of ${props.noun} ${props.slug}`}
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
        label={`Color of ${props.noun} ${props.slug}`}
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
        aria-label={`Remove ${props.noun} ${props.slug}`}
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
 * The Properties pane (LC-227): the four opt-in ticket properties, and the
 * configuration each of them owns.
 *
 * It sits after Labels because it is the project's *other* editable vocabulary,
 * and because a type value is a label in everything but name — same slug, same
 * display name, same colour, stored on the ticket the same way. The editor
 * below is literally the labels editor's row, which is the claim this pane
 * makes and the reason it is one pane rather than four.
 *
 * **All four ship off** (ADR 0013). Four more meta rows turned on by default
 * would change every project that exists and push the description below the
 * fold for people who never asked for a due date.
 *
 * **Turning one off writes immediately and asks nothing.** The precedent is one
 * section up and covers a stronger act: removing a label definition *deletes*
 * something and takes no confirmation either. Disabling is weaker in three ways
 * — no definition goes, no ticket value is touched, and the same toggle puts it
 * back, which is a better undo than an undo affordance. A dialog over a
 * reversible act that destroys nothing is ceremony, and ceremony over the safe
 * acts is what teaches people to click through the dangerous one.
 *
 * What it must not be is *silent*, because the effect is invisible: the dates
 * come off every card and a person could reasonably conclude they were deleted.
 * So the write feedback carries the count and the reassurance in one sentence,
 * and the row goes on carrying it while the property is off — which is then the
 * only place in the app that fact is visible at all.
 */
function ProjectProperties(props: {
  project: ProjectReference;
  counts: Record<TicketProperty, number>;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const { properties } = props.project;
  const projectId = props.project.id;
  const run = props.onWrite;

  function toggle(property: TicketProperty, enabled: boolean) {
    const { name, kept } = PROPERTY_LABELS[property];
    const count = props.counts[property];
    // On is one fact. Off is two, and the second one is the reassurance: the
    // values are still there, and this says how many.
    const message =
      enabled || count === 0
        ? `${name} turned ${enabled ? "on" : "off"}`
        : `${name} turned off · ${keptByTickets(count, kept)}`;
    void run(message, () =>
      setProjectPropertyEnabled({ projectId, property, enabled }),
    );
  }

  return (
    <section className="property-settings" aria-label="Properties">
      <p className="settings-subhead">
        Four optional properties. All four are off until you turn them on, and
        turning one off hides it without touching a single ticket.
      </p>

      <PropertyBlock
        property="type"
        enabled={properties.type.enabled}
        count={props.counts.type}
        onToggle={toggle}
      >
        <TypeValues project={props.project} onWrite={run} />
      </PropertyBlock>

      <PropertyBlock
        property="due"
        enabled={properties.due.enabled}
        count={props.counts.due}
        onToggle={toggle}
      >
        <DueWindow
          projectId={projectId}
          attentionDays={properties.due.attentionDays}
          onWrite={run}
        />
      </PropertyBlock>

      <PropertyBlock
        property="start"
        enabled={properties.start.enabled}
        count={props.counts.start}
        onToggle={toggle}
      >
        {/* Start has nothing to configure, and the note says why rather than
            leaving an empty block to read as unfinished: a start date in the
            past means work should have begun, which is a judgement about the
            work rather than a fact about the date. So there are no rungs to
            set a window on. */}
        <p className="property-note">
          Nothing to configure. A start date is not a deadline, so it has no
          escalation and never appears on a card — it shows in the ticket panel
          beside the due date.
        </p>
      </PropertyBlock>

      <PropertyBlock
        property="estimate"
        enabled={properties.estimate.enabled}
        count={props.counts.estimate}
        onToggle={toggle}
      >
        <EstimateSettings project={props.project} onWrite={run} />
      </PropertyBlock>

      <p className="settings-note">
        Turning a property off hides it and keeps every value. The count beside
        a switched-off property is what is still on disk.
      </p>
    </section>
  );
}

/**
 * One property: the switch, and whatever it has to configure under it.
 *
 * The configuration is inside the `enabled` branch rather than disabled beside
 * it, because a scale nobody can write a value on is not a setting — it is a
 * control that does nothing, which is the shape a person reads as broken.
 */
function PropertyBlock(props: {
  property: TicketProperty;
  enabled: boolean;
  count: number;
  onToggle: (property: TicketProperty, enabled: boolean) => void;
  children: React.ReactNode;
}) {
  const { name, kept } = PROPERTY_LABELS[props.property];
  return (
    <div className="property-block">
      {/* A wrapping label, so the name is the checkbox's own hit target and its
          accessible name in one element. */}
      <label className="property-head">
        <input
          type="checkbox"
          tabIndex={0}
          checked={props.enabled}
          onChange={(event) =>
            props.onToggle(props.property, event.target.checked)
          }
        />
        {name}
        {/* Beside the name rather than at the far edge: `margin-left: auto`
            sends a count a whole heading away from the word it counts, which is
            the defect D-3D already named one surface up. */}
        {!props.enabled && props.count > 0 && (
          <span className="property-state">
            · {keptByTickets(props.count, kept)}
          </span>
        )}
      </label>
      {props.enabled && <div className="property-config">{props.children}</div>}
    </div>
  );
}

/**
 * The reassurance, in one place, because the toast and the row say it twice and
 * two spellings of one sentence is how they come to disagree.
 */
function keptByTickets(count: number, kept: string): string {
  return count === 1
    ? `1 ticket keeps its ${kept}`
    : `${count} tickets keep their ${kept}`;
}

/**
 * The type registry, which is the label registry: slug, name, colour, remove,
 * and a row that adds one. Nothing here rewrites a ticket — a ticket stores the
 * slug, so a rename or a recolour is a change to how it reads and never to what
 * it says.
 */
function TypeValues(props: {
  project: ProjectReference;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const values = props.project.properties.type.values;
  /** The same hook the labels editor uses, so one typed name derives one key. */
  const definition = useLabelDefinition(values);
  const definitions = Object.entries(values);
  const addName = useRef<HTMLInputElement>(null);
  const projectId = props.project.id;
  const run = props.onWrite;

  return (
    <>
      <div className="type-values">
        {definitions.map(([slug, value]) => (
          <LabelDefinition
            key={slug}
            noun="type"
            slug={slug}
            label={value}
            onSave={(next) =>
              void run(`Type ${slug} updated`, () =>
                updateProjectTypeValue({ projectId, slug, ...next }),
              )
            }
            onRemove={() => {
              void run(`Removed the ${slug} type definition`, () =>
                removeProjectTypeValue({ projectId, slug }),
              );
              addName.current?.focus();
            }}
          />
        ))}
        <form
          className="label-row label-add"
          onSubmit={(event) => {
            event.preventDefault();
            const { state } = definition;
            if (state.kind !== "ok") return;
            void (async () => {
              const added = await run(`Added the ${state.slug} type`, () =>
                addProjectTypeValue({
                  projectId,
                  slug: state.slug,
                  name: definition.name.trim(),
                  color: definition.color,
                }),
              );
              if (!added) return;
              definition.reset();
            })();
          }}
        >
          <div className="label-add-name">
            <input
              ref={addName}
              className="input compact"
              value={definition.name}
              aria-label="New type name"
              placeholder="Display name"
              autoComplete="off"
              onChange={(event) => definition.setName(event.target.value)}
            />
            <DerivedKey state={definition.state} />
          </div>
          <LabelColors
            label="New type color"
            value={definition.color}
            onPick={definition.setColor}
          />
          <button
            tabIndex={0}
            className="secondary small"
            type="submit"
            disabled={definition.state.kind !== "ok"}
          >
            Add type
          </button>
        </form>
      </div>
      <p className="property-note">
        Removing a definition never rewrites a ticket — the slug renders as
        itself, in the fallback hue.
      </p>
    </>
  );
}

/**
 * How many days ahead count as approaching.
 *
 * The only boundary a project can move: overdue and today are absolute. `0` is
 * legal and empties that rung, which is why an empty field is not treated as
 * "unset" — it is reverted instead, so a half-typed number never writes a zero
 * nobody asked for.
 */
function DueWindow(props: {
  projectId: string;
  attentionDays: number;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const [days, setDays] = useState(String(props.attentionDays));
  const fieldId = useId();

  useEffect(() => {
    setDays(String(props.attentionDays));
  }, [props.attentionDays]);

  function commit() {
    const next = Number(days.trim());
    if (days.trim() === "" || !Number.isInteger(next) || next < 0) {
      setDays(String(props.attentionDays));
      return;
    }
    if (next === props.attentionDays) return;
    void props.onWrite(`Due dates highlight from ${next} days out`, () =>
      setProjectDueWindow({
        projectId: props.projectId,
        attentionDays: next,
      }),
    );
  }

  return (
    <>
      <div className="property-inline">
        <label htmlFor={fieldId}>Highlight tickets due within</label>
        <input
          id={fieldId}
          className="input compact mono"
          value={days}
          aria-label="Attention days"
          inputMode="numeric"
          onChange={(event) => setDays(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              return;
            }
            // The field's own revert, and only once it has been typed into, so
            // an untouched field still owes the panel its `Esc`.
            if (event.key !== "Escape" || days === String(props.attentionDays))
              return;
            event.stopPropagation();
            setDays(String(props.attentionDays));
          }}
          onBlur={commit}
        />
        <span>days</span>
      </div>
      <p className="property-note">
        Overdue and today are absolute; this is the only boundary that moves.{" "}
        <code>0</code> is legal and empties the approaching rung.
      </p>
    </>
  );
}

/**
 * The estimate system, and the one thing each system has to configure.
 *
 * A project is on exactly one, and switching **rewrites nothing**: a value
 * written under the old system stays exactly as it was and reads as unreadable
 * until the project switches back (`file_format.md` invariant 16). That is the
 * whole reason the switch is a segment rather than a migration.
 */
function EstimateSettings(props: {
  project: ProjectReference;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const estimate = props.project.properties.estimate;
  const projectId = props.project.id;

  function pick(system: EstimateSystem) {
    if (system === estimate.system) return;
    const label = ESTIMATE_SYSTEMS.find((option) => option.id === system);
    void props.onWrite(`Estimates are on the ${label?.label} scale`, () =>
      setProjectEstimateSystem({ projectId, system }),
    );
  }

  return (
    <>
      {/* The panel's own segment, not a second one: this is the same control as
          the appearance row above it — a short row of places to stand, one of
          them pressed. No visible label, unlike that row: the block it is the
          first thing inside is already headed `Estimate`, and a second heading
          over three words would be naming the same thing twice. */}
      <div
        className="appearance-segment"
        role="group"
        aria-label="Estimate system"
      >
        {ESTIMATE_SYSTEMS.map((option) => (
          <button
            tabIndex={0}
            key={option.id}
            type="button"
            className={estimate.system === option.id ? "selected" : ""}
            aria-pressed={estimate.system === option.id}
            onClick={() => pick(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {estimate.system === "tshirt" && (
        <TshirtScale
          projectId={projectId}
          values={estimate.values}
          onWrite={props.onWrite}
        />
      )}
      {estimate.system === "fibonacci" && (
        <p className="property-note">
          <code>1 · 2 · 3 · 5 · 8 · 13</code>, a fixed scale. Nothing to
          configure.
        </p>
      )}
      {estimate.system === "duration" && (
        <Conversion
          projectId={projectId}
          hoursPerDay={estimate.hoursPerDay}
          daysPerWeek={estimate.daysPerWeek}
          onWrite={props.onWrite}
        />
      )}

      <p className="property-note">
        Switching systems never rewrites a ticket: a value written under the old
        one stays as it was and reads as unreadable until you switch back.
      </p>
    </>
  );
}

/**
 * The t-shirt scale, top to bottom in the order it is written.
 *
 * A list rather than a set of chips, because the **order is the scale** — `xs`
 * above `s` above `m` is the only thing that says which of them is the bigger,
 * and a wrapping row of chips at two different widths says nothing at all. A
 * new size joins the bottom, which is where a bigger one belongs; a project
 * that wants another order edits `longclaw.yaml`.
 */
function TshirtScale(props: {
  projectId: string;
  values: string[];
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const [size, setSize] = useState("");
  const addSize = useRef<HTMLInputElement>(null);
  const typed = size.trim().toLowerCase();
  /**
   * Empty and already-there are the two refusals worth drawing, because the
   * first is nothing to write and the second names a size the person can see.
   * Rust owns the slug grammar and its refusal is the message, exactly as it is
   * one section up — nothing here guesses at a rule of its own.
   */
  const ready = typed !== "" && !props.values.includes(typed);

  return (
    <>
      <div className="scale-values">
        {props.values.map((value) => (
          <div className="scale-row" key={value}>
            <code>{value}</code>
            <button
              tabIndex={0}
              className="ghost row-remove"
              type="button"
              aria-label={`Remove size ${value}`}
              onClick={() => {
                void props.onWrite(`Removed the ${value} size`, () =>
                  setProjectEstimateScale({
                    projectId: props.projectId,
                    values: props.values.filter((size) => size !== value),
                  }),
                );
                addSize.current?.focus();
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <form
          className="scale-row scale-add"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            void (async () => {
              const added = await props.onWrite(`Added the ${typed} size`, () =>
                setProjectEstimateScale({
                  projectId: props.projectId,
                  values: [...props.values, typed],
                }),
              );
              if (added) setSize("");
            })();
          }}
        >
          <input
            ref={addSize}
            className="input compact mono"
            value={size}
            aria-label="New size"
            placeholder="size"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setSize(event.target.value)}
          />
          <button
            tabIndex={0}
            className="secondary small"
            type="submit"
            disabled={!ready}
          >
            Add size
          </button>
        </form>
      </div>
      <p className="property-note">
        Sizes are slugs a ticket stores, so removing one never rewrites a
        ticket. The order down this list is the order of the scale.
      </p>
    </>
  );
}

/**
 * How long a working day and a working week are.
 *
 * A project setting rather than a constant because an estimate has to be
 * comparable: `4h` against `1d` cannot be ordered without knowing how long a
 * working day is, and a project on a six-hour day would otherwise order them
 * wrongly. Changing it changes no stored value — only how they sort.
 *
 * Both halves commit together, because they are one setting: writing the hours
 * without the days would put a half-edited conversion on disk between two
 * keystrokes.
 */
function Conversion(props: {
  projectId: string;
  hoursPerDay: number;
  daysPerWeek: number;
  onWrite: (
    message: string,
    write: () => Promise<ProjectReference>,
  ) => Promise<boolean>;
}) {
  const [hours, setHours] = useState(String(props.hoursPerDay));
  const [days, setDays] = useState(String(props.daysPerWeek));

  useEffect(() => {
    setHours(String(props.hoursPerDay));
    setDays(String(props.daysPerWeek));
  }, [props.hoursPerDay, props.daysPerWeek]);

  function commit() {
    const nextHours = Number(hours.trim());
    const nextDays = Number(days.trim());
    const legible =
      hours.trim() !== "" &&
      days.trim() !== "" &&
      Number.isFinite(nextHours) &&
      Number.isFinite(nextDays);
    if (!legible) {
      setHours(String(props.hoursPerDay));
      setDays(String(props.daysPerWeek));
      return;
    }
    if (nextHours === props.hoursPerDay && nextDays === props.daysPerWeek) {
      return;
    }
    void props.onWrite(
      `One day is ${nextHours} hours, one week is ${nextDays} days`,
      () =>
        setProjectEstimateConversion({
          projectId: props.projectId,
          hoursPerDay: nextHours,
          daysPerWeek: nextDays,
        }),
    );
  }

  return (
    <>
      <div className="property-inline">
        <span>One day is</span>
        <input
          className="input compact mono"
          value={hours}
          aria-label="Hours per day"
          inputMode="decimal"
          onChange={(event) => setHours(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
          }}
        />
        <span>hours · one week is</span>
        <input
          className="input compact mono"
          value={days}
          aria-label="Days per week"
          inputMode="decimal"
          onChange={(event) => setDays(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
          }}
        />
        <span>days</span>
      </div>
      <p className="property-note">
        An estimate has to be comparable: <code>4h</code> against{" "}
        <code>1d</code> needs to know how long a working day is. Changing this
        changes no stored value.
      </p>
    </>
  );
}
