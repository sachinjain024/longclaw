/**
 * The project key as a create form has to treat it: derived from a name,
 * editable, and checked before the folder picker opens.
 *
 * The rule itself belongs to the backend (`core::project::is_project_key`) and
 * to `docs/file_format.md`. It is restated here because a form cannot wait for
 * an IPC round trip to tell a user their key is invalid, and the two copies are
 * pinned to one another by `fixtures/project-key-grammar.json`.
 */

/** Uppercase ASCII letters and digits, starting with a letter. */
const PROJECT_KEY = /^[A-Z][A-Z0-9]*$/;

/** What a new key is capped at in a create form, for readability. */
export const PROJECT_KEY_MAX_LENGTH = 5;

/**
 * What the project file accepts as a name, so the field stops there rather than
 * letting the backend refuse a name the form invited (`core::project`).
 */
export const PROJECT_NAME_MAX_LENGTH = 120;

/** How many initials a derived key takes before it is capped. */
const DERIVATION_MAX_LENGTH = 4;

/** Used when a name yields no usable initials at all. */
const FALLBACK_KEY = "LC";

/**
 * The rule in the words the form shows. Deliberately not the backend's own
 * wording, which is written for someone reading the file format.
 */
export const PROJECT_KEY_RULE =
  "Uppercase letters and digits, starting with a letter, such as LC.";

export function isProjectKey(key: string) {
  return PROJECT_KEY.test(key);
}

/**
 * Initials of each word, minus any leading characters that are not letters. The
 * leading digit is what made this a bug: `30 July 4PM` derived `3J4`, which the
 * backend then refused after the folder picker had already been answered.
 */
export function defaultProjectKey(name: string) {
  const initials = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .replace(/^[^A-Z]+/, "")
    .slice(0, DERIVATION_MAX_LENGTH);
  return initials || FALLBACK_KEY;
}

/**
 * What the key field does to a keystroke: uppercase it and stop at the cap.
 * Characters outside the grammar are kept rather than swallowed, so the field
 * can explain the refusal instead of silently eating what was typed.
 */
export function normalizeProjectKey(typed: string) {
  return typed.toUpperCase().slice(0, PROJECT_KEY_MAX_LENGTH);
}

/** The form-facing complaint about a key, or null when it is fine. */
export function projectKeyProblem(key: string) {
  if (key.trim().length === 0) return "A project key is required.";
  if (!isProjectKey(key)) return PROJECT_KEY_RULE;
  return null;
}
