import { useId, useState } from "react";
import { ThemePicker, type ThemeOption } from "./ThemePicker";
import {
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_KEY_RULE,
  PROJECT_NAME_MAX_LENGTH,
  defaultProjectKey,
  normalizeProjectKey,
  projectKeyProblem,
} from "./projectKey";

export const DEFAULT_PROJECT_NAME = "Untitled Project";

export type ProjectDraft = {
  name: string;
  key: string;
  theme: string;
};

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
  onSubmit: (draft: ProjectDraft) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState(() => defaultProjectKey(""));
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
      <label>
        <span>Name</span>
        <input
          value={name}
          placeholder={DEFAULT_PROJECT_NAME}
          maxLength={PROJECT_NAME_MAX_LENGTH}
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
            {PROJECT_KEY_RULE} Locks after the first ticket.
          </small>
        )}
      </div>
      <ThemePicker themes={props.themes} value={theme} onPick={setTheme} />
      <button className="primary" type="submit" disabled={Boolean(problem)}>
        {props.submitLabel}
      </button>
    </form>
  );
}
