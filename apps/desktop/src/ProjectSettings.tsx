/**
 * Project settings (`screen-specs.md:269-278`), as the modal the spec draws.
 *
 * It used to be a section that expanded *inside* the main panel, which pushed
 * the board about 430px down the page and left it there behind the controls
 * that were changing it (D-40). Everything here is one project's record, so it
 * belongs on a layer over the board rather than in the middle of it — and a
 * layer comes with the two things the inline section never had: a way out from
 * the inside (D-4L) and an `Esc` (`keyboard-focus-map.md:136-141`).
 *
 * The rows are the spec's, in its order: Name + Key, Folder, Theme, Appearance,
 * Labels, danger zone. Two of them are not project data and say so — appearance
 * is a device preference (D-42), and the key cannot be changed at all once a
 * ticket carries it (D-41).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { addProjectLabel, removeProjectLabel, updateProjectLabel } from "./api";
import { normalizeError } from "./errors";
import { FolderGlyph } from "./FolderGlyph";
import { FALLBACK_LABEL_COLOR, isRampColor, LABEL_COLORS } from "./labels";
import type { Appearance } from "./state";
import { ThemePicker, type ThemeOption } from "./ThemePicker";
import type { AppError, Label, ProjectReference } from "./types";

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** Everything inside `container` that Tab can land on, in document order. */
function tabStops(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
    ),
  );
}

/**
 * "Modals hold focus until dismissed" (`keyboard-focus-map.md:23-24`), which a
 * dialog only does if Tab wraps inside it — the palette does the same walk.
 * Without this, Tab off the last control lands on the board behind the scrim,
 * where every stop is hidden under it.
 */
function trapTab(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const stops = tabStops(event.currentTarget);
  if (stops.length === 0) return;
  event.preventDefault();
  const at = stops.indexOf(document.activeElement as HTMLElement);
  const step = event.shiftKey ? -1 : 1;
  stops[(at + step + stops.length) % stops.length]?.focus();
}

export function ProjectSettings(props: {
  project: ProjectReference;
  /**
   * Whether any ticket exists yet. The key is immutable from the first one
   * (`data-requirements.md` § Project settings), which is what the note says.
   */
  hasTickets: boolean;
  appearance: Appearance;
  themes: ThemeOption[];
  onAppearance: (next: Appearance) => void;
  onRename: (name: string) => void;
  onTheme: (theme: string) => void;
  onLocate: () => void;
  onRemove: () => void;
  onUpdated: (project: ProjectReference) => void;
  onError: (error: AppError) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(props.project.name);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const nameId = useId();
  const keyId = useId();
  const folderId = useId();
  const appearanceId = useId();
  /** Where focus returns when the confirm dialog is dismissed without removing. */
  const removeButton = useRef<HTMLButtonElement>(null);
  const cancelConfirm = useCallback(() => {
    setConfirmingRemove(false);
    removeButton.current?.focus();
  }, []);

  /** Renaming to nothing, or to the name it already has, writes nothing. */
  function commitName() {
    const next = name.trim();
    if (!next || next === props.project.name) {
      setName(props.project.name);
      return;
    }
    props.onRename(next);
  }

  /**
   * The `Esc` rung this layer owns, on the document rather than on the dialog.
   *
   * A handler on the element only fires while focus is inside it, and a click
   * on the dialog's own heading puts focus on `body` — after which `Esc` closed
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
      <div className="modal-scrim centered" role="presentation">
        <section
          className="settings-panel"
          role="dialog"
          aria-label="Project settings"
          onKeyDown={trapTab}
        >
          <h2>Project settings</h2>
          {/* The sentence that makes the dialog trustworthy (D-4K): every field
              below is a line in a file inside the folder, not a row in an app
              database somewhere else. Appearance is the exception and carries
              its own note. */}
          <p className="settings-subhead">
            Everything here is stored in <code>longclaw.yaml</code> inside the
            project folder — portable with the files.
          </p>

          <div className="settings-row settings-identity">
            <div className="settings-field">
              <label htmlFor={nameId}>Name</label>
              <div className="field-row">
                {/* `Enter` or blur commits, as the panel's title does
                    (`screen-specs.md:190`). The `Rename` button beside this
                    was the only way to save it, and pressing `Done` with a
                    typed name threw the name away without saying so. */}
                <input
                  id={nameId}
                  autoFocus
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
                    // then: focus lands here when the dialog opens, so an
                    // untouched field that swallowed the press would leave the
                    // first `Esc` of every visit doing nothing.
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
                {/* Shown rather than hidden (D-41). It is the one setting a
                    user can never change — every ticket directory and every
                    key in every file already carries it — so the honest thing
                    is a locked field with the reason beside it, not a field
                    that isn't there. */}
                <input
                  id={keyId}
                  className="key-field"
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
            {/* Not a `<label>`: the row's control is a button, and the path
                beside it is text rather than a field. */}
            <span className="settings-label" id={folderId}>
              Folder
            </span>
            <div className="path-row">
              {/* The path itself, which the panel never showed — a `Locate
                  folder` button alone asks you to re-point a folder without
                  saying which one it is now (D-43). Full and selectable here,
                  unlike the header chip, because this is the row that answers
                  "where is this project?". */}
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

          <div className="settings-row">
            <ThemePicker
              themes={props.themes}
              value={props.project.theme}
              onPick={props.onTheme}
            />
          </div>

          <div className="settings-row">
            <span className="settings-label" id={appearanceId}>
              Appearance{" "}
              <span className="settings-label-note">
                — app preference, not stored in the project
              </span>
            </span>
            {/* The 3-up segment the spec puts here (D-42). It replaced a native
                `<select>` in the sidebar footer, which was the last piece of OS
                chrome in the shell (D-0A, D-72) and put a device preference
                where the project list lives. */}
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

          <ProjectLabels
            project={props.project}
            onUpdated={props.onUpdated}
            onError={props.onError}
          />

          {/* The guarantee, stated where the action is rather than only in the
              confirm (D-44). This is the app's most destructive-looking button
              and the least destructive thing it does. */}
          <div className="danger-zone">
            <p className="micro">
              Removing only forgets the project in LongClaw. Files on disk are
              never touched.
            </p>
            <button
              tabIndex={0}
              ref={removeButton}
              className="danger"
              onClick={() => setConfirmingRemove(true)}
            >
              Remove from app
            </button>
          </div>

          <div className="settings-foot">
            <button tabIndex={0} className="secondary" onClick={props.onClose}>
              Done
            </button>
          </div>
        </section>
      </div>

      {/* A sibling rather than a child: both scrims sit on `--lc-z-modal`, so
          the confirm is above this one by source order, and the `Esc` listener
          above answers it first — one press, one layer. */}
      {confirmingRemove && (
        <ConfirmRemove
          project={props.project}
          onCancel={cancelConfirm}
          onConfirm={props.onRemove}
        />
      )}
    </>
  );
}

/**
 * The confirm D-44 asks for: it names the path and repeats the guarantee, and
 * the confirming button is the danger variant.
 *
 * Focus enters on **Cancel** — the first control in the footer, which is what
 * `keyboard-focus-map.md:136-141` asks of a modal, and the one of the two that
 * cannot cost anything if `Enter` arrives from muscle memory.
 */
function ConfirmRemove(props: {
  project: ProjectReference;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const heading = useId();
  return (
    <div className="modal-scrim centered" role="presentation">
      {/* `Esc` is the settings dialog's document listener, which answers this
          layer first while it is up. Tab stays inside these two buttons. */}
      <section
        className="confirm-dialog"
        role="dialog"
        aria-labelledby={heading}
        onKeyDown={trapTab}
      >
        <h2 id={heading}>Remove “{props.project.name}” from LongClaw?</h2>
        <p>
          The folder <code>{props.project.rootPath}</code> and every ticket file
          in it <strong>stay on disk, untouched</strong>. You can open it again
          anytime.
        </p>
        <div className="settings-foot">
          <button
            tabIndex={0}
            autoFocus
            className="ghost"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button tabIndex={0} className="danger" onClick={props.onConfirm}>
            Remove from app
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Label definitions, which are project data rather than ticket data
 * (`file_format.md:213-231`). `screen-specs.md` § Project settings never
 * mentions them, so they sit in the dialog that already owns the project file's
 * other fields: the name, the theme, and the folder.
 *
 * Nothing here writes a ticket. A slug is not editable — it is what every ticket
 * carrying the label stores — and removing a definition leaves the slug where it
 * is, to be rendered as itself.
 */
function ProjectLabels(props: {
  project: ProjectReference;
  onUpdated: (project: ProjectReference) => void;
  onError: (error: AppError) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const definitions = Object.entries(props.project.labels);
  /** Where focus goes when the row holding it is taken away. */
  const addSlug = useRef<HTMLInputElement>(null);

  /** Every write here returns the project as the file now reads. */
  async function run(write: () => Promise<ProjectReference>) {
    try {
      props.onUpdated(await write());
      return true;
    } catch (error) {
      // Rust owns the slug grammar and the name and colour rules, so its
      // refusal is the message — this never guesses at one of its own.
      props.onError(normalizeError(error));
      return false;
    }
  }

  return (
    <section className="label-settings" aria-label="Labels">
      <h3>Labels</h3>
      {definitions.length === 0 && (
        <p>No labels are defined in this project&apos;s longclaw.yaml yet.</p>
      )}
      {definitions.map(([definedSlug, label]) => (
        <LabelDefinition
          key={definedSlug}
          slug={definedSlug}
          label={label}
          onSave={(next) =>
            void run(() =>
              updateProjectLabel({
                projectId: props.project.id,
                slug: definedSlug,
                ...next,
              }),
            )
          }
          onRemove={() => {
            void run(() =>
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
            const added = await run(() =>
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
          value={slug}
          aria-label="New label slug"
          placeholder="slug"
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          value={name}
          aria-label="New label name"
          placeholder="Display name"
          onChange={(event) => setName(event.target.value)}
        />
        <LabelColors label="New label color" value={color} onPick={setColor} />
        <button tabIndex={0} className="secondary" type="submit">
          Add label
        </button>
      </form>
    </section>
  );
}

/**
 * One definition. The slug is shown as what it is: a key, not a field.
 *
 * The row used to carry a `Save label X` and a `Remove label X` button, which
 * was two buttons per row saying the row's name twice (D-4J). It commits the
 * way the panel's title does instead (`screen-specs.md:190`) — `Enter` or blur
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
          // dialog around it, but an untouched field owes the dialog the press.
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
 * The eight ramp hues as swatches (D12, `labels.ts:22-31`) — the OS `<select>`
 * this replaces was one of the two places the app rendered native chrome
 * (D-72), and it named its colours in words while every other surface draws
 * them as dots.
 *
 * Native radios in a fieldset, like the theme picker: the group label, the
 * arrow keys, and the single tab stop are the platform's.
 */
function LabelColors(props: {
  label: string;
  value: string;
  onPick: (color: string) => void;
}) {
  const name = useId();
  // A colour the ramp does not hold is still shown and still selected, or
  // renaming a label would silently recolour it. It wears the fallback dot,
  // which is what every other surface draws it as (`labels.ts:40`).
  const hues: readonly string[] = isRampColor(props.value)
    ? LABEL_COLORS
    : [props.value, ...LABEL_COLORS];
  return (
    <fieldset className="label-colors">
      <legend className="visually-hidden">{props.label}</legend>
      {hues.map((hue) => (
        <label
          key={hue}
          className={
            hue === props.value ? "label-color selected" : "label-color"
          }
          title={hue}
        >
          <input
            type="radio"
            name={name}
            value={hue}
            checked={hue === props.value}
            onChange={() => props.onPick(hue)}
          />
          <span
            className={`label-dot label-${isRampColor(hue) ? hue : FALLBACK_LABEL_COLOR}`}
            aria-hidden="true"
          />
          {/* The dot is the channel a sighted user reads; this is the one that
              reaches everyone else. */}
          <span className="visually-hidden">{hue}</span>
        </label>
      ))}
    </fieldset>
  );
}
