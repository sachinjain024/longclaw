import { useId, useState } from "react";
import { FolderGlyph } from "./FolderGlyph";
import { ThemePicker, type ThemeOption } from "./ThemePicker";
import {
  PROJECT_KEY_HINT,
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  defaultProjectKey,
  normalizeProjectKey,
  projectKeyProblem,
} from "./projectKey";

export const DEFAULT_PROJECT_NAME = "Untitled Project";

/** What creation puts inside the chosen folder, and nothing else. */
const PROJECT_DIRECTORY = "/.longclaw";

export type ProjectDraft = {
  name: string;
  key: string;
  theme: string;
};

/** The folder's own name, which is the project's until someone says otherwise. */
function folderName(folder: string | undefined) {
  return folder?.split("/").filter(Boolean).pop() ?? "";
}

/**
 * The one create-project form. First launch and the side panel render the same
 * component, because when they were written twice they validated differently:
 * one of them let an invalid key through to the folder picker.
 *
 * Everything the backend would refuse is refused here, before the native picker
 * opens. Nothing is created in the user's folder by a form they can still fix.
 */
export function CreateProjectForm(props: {
  themes: ThemeOption[];
  submitLabel: string;
  className?: string;
  /**
   * The folder the picker already answered with, when this form is step two of
   * first launch (D-13). Absent in the sidebar's quick create, where the picker
   * has not run yet and there is no path to show.
   */
  folder?: string;
  /** Step one is still behind this form, and `Back` is how you reach it. */
  onBack?: () => void;
  onSubmit: (draft: ProjectDraft) => void;
}) {
  // Prefilled from the folder, and from nothing else (`screen-specs.md:103`):
  // by the time this form exists the picker has answered, and the folder's own
  // name is the best guess anyone has. The sidebar's quick create runs before
  // the picker, so it starts empty and offers `Untitled Project`.
  const [name, setName] = useState(() => folderName(props.folder));
  const [key, setKey] = useState(() =>
    defaultProjectKey(folderName(props.folder)),
  );
  const [keyEdited, setKeyEdited] = useState(false);
  const [theme, setTheme] = useState(props.themes[0]?.id ?? "indigo");
  // First launch renders this form while the side panel renders another one, so
  // the id that ties the key field to its explanation cannot be a constant.
  const keyRuleId = useId();

  const problem = projectKeyProblem(key);

  function submit() {
    if (problem) return;
    props.onSubmit({
      name: name.trim() || DEFAULT_PROJECT_NAME,
      key,
      theme,
    });
  }

  return (
    <form
      className={props.className}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {/* The screen's whole trust argument (D-13): the folder you picked, and
          the one directory creation will add inside it. Read-only text rather
          than a field — it is not editable here, and the way to change it is to
          go `Back` and pick again — so it is deliberately not a tab stop
          (`keyboard-focus-map.md:146-148` puts the form's order at name → key →
          theme → Create → Back). */}
      {props.folder !== undefined && (
        <div className="field">
          <span className="field-label">Folder</span>
          <span
            className="picked-path"
            title={`${props.folder}${PROJECT_DIRECTORY}`}
          >
            <FolderGlyph />
            {/* Two spans, because they are two different claims: `head` is the
                folder you chose, `suffix` is the only thing LongClaw adds to
                it. The suffix never truncates — it is the half of the row that
                is news. */}
            <span className="folder-path">
              <span className="head">{props.folder}</span>
              <span className="suffix">{PROJECT_DIRECTORY}</span>
            </span>
          </span>
          <small className="field-hint">
            Everything lives here as plain files — readable without LongClaw,
            forever.
          </small>
        </div>
      )}
      <label>
        <span>Name</span>
        <input
          value={name}
          placeholder={DEFAULT_PROJECT_NAME}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          // Where the folder picker hands focus on the create path
          // (`keyboard-focus-map.md:160`). Only on that path: the sidebar's
          // quick create opens beside a board someone is already working in,
          // and a form that grabs the caret there steals it from the app.
          autoFocus={props.folder !== undefined}
          onChange={(event) => {
            setName(event.target.value);
            // A key the human typed is theirs. Only a suggested one is replaced.
            if (!keyEdited) setKey(defaultProjectKey(event.target.value));
          }}
        />
      </label>
      <div className="field">
        <label>
          <span>Key</span>
          <input
            value={key}
            maxLength={PROJECT_KEY_MAX_LENGTH}
            aria-invalid={problem ? "true" : undefined}
            aria-describedby={keyRuleId}
            onChange={(event) => {
              setKeyEdited(true);
              setKey(normalizeProjectKey(event.target.value));
            }}
          />
        </label>
        {problem ? (
          <small className="field-problem" role="alert" id={keyRuleId}>
            {problem}
          </small>
        ) : (
          <small className="field-hint" id={keyRuleId}>
            {PROJECT_KEY_HINT}
          </small>
        )}
      </div>
      <ThemePicker themes={props.themes} value={theme} onPick={setTheme} />
      {/* Create first, `Back` after it — the order the focus map gives this
          form, and the order that puts the way forward under the thumb. */}
      <div className="form-actions">
        <button
          tabIndex={0}
          className="primary"
          type="submit"
          disabled={Boolean(problem)}
        >
          {props.submitLabel}
        </button>
        {props.onBack && (
          <button
            tabIndex={0}
            className="ghost"
            type="button"
            onClick={props.onBack}
          >
            Back
          </button>
        )}
      </div>
    </form>
  );
}
