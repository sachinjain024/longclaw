import { useState } from "react";
import {
  KEY_MAX_LENGTH,
  PROJECT_KEY_RULE,
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
  themes: { id: string; label: string }[];
  submitLabel: string;
  className?: string;
  onSubmit: (draft: ProjectDraft) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState(() => defaultProjectKey(""));
  const [keyEdited, setKeyEdited] = useState(false);
  const [theme, setTheme] = useState(props.themes[0]?.id ?? "indigo");

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
            maxLength={KEY_MAX_LENGTH}
            aria-invalid={problem ? "true" : undefined}
            aria-describedby="create-project-key-rule"
            onChange={(event) => {
              setKeyEdited(true);
              setKey(normalizeProjectKey(event.target.value));
            }}
          />
        </label>
        {problem ? (
          <small
            className="field-problem"
            role="alert"
            id="create-project-key-rule"
          >
            {problem}
          </small>
        ) : (
          <small className="field-hint" id="create-project-key-rule">
            {PROJECT_KEY_RULE} Locks after the first ticket.
          </small>
        )}
      </div>
      <label>
        <span>Theme</span>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
        >
          {props.themes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" type="submit" disabled={Boolean(problem)}>
        {props.submitLabel}
      </button>
    </form>
  );
}
