const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]*$/;

export const PROJECT_KEY_HELP =
  "Start with a letter; use only uppercase letters and digits.";

export const PROJECT_KEY_ERROR =
  "Project key must start with a letter and use only uppercase letters and digits.";

export function defaultProjectKey(name: string) {
  const key = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .replace(/^[^A-Z]+/, "")
    .slice(0, 4);
  return key || "LC";
}

export function normalizeProjectKey(key: string) {
  return key.trim().toUpperCase();
}

export function validProjectKey(key: string) {
  return PROJECT_KEY_PATTERN.test(key);
}
