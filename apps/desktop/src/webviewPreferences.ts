/**
 * What the last build left in webview storage — read once, and never written.
 *
 * Until LC-150 these preferences *were* this: `localStorage`, under three keys,
 * as ADR 0006 allowed. They are a file Rust owns now (`devicePreferences.ts`,
 * ADR 0012), because on the packaged build the webview's storage did not
 * survive the process and neither the appearance override nor the open project
 * came back.
 *
 * This module is the bridge across that change and nothing else. It reads the
 * old keys into the shape `devicePreferences` validates, so somebody upgrading
 * from a build where storage did work — a dev window, where the app is served
 * over http and it does — keeps their choices instead of starting over. It
 * validates nothing itself: one validator for a document from disk and a
 * document from storage is one place to state the vocabulary.
 *
 * Nothing writes here any more, so once no installed build predates LC-150 this
 * file and its call in `hydrateDevicePreferences` can go.
 */

const APPEARANCE_KEY = "longclaw.appearance";
const ACTIVE_PROJECT_KEY = "longclaw.activeProject";
const PROJECT_WORKSPACES_KEY = "longclaw.projectWorkspaces";
const LEGACY_ORDERING_KEY = "longclaw.boardOrdering";

/**
 * The store these preferences lived in, or `undefined` where the host has none.
 *
 * A host without web storage and a store that refuses a read are different
 * failures, and the `catch` below is for the second: an origin that is blocked,
 * a quota that is full. Reaching for an absent global threw a `TypeError` into
 * those same catches, so a persistence layer that could never work looked
 * exactly like one that had merely been refused once — which is how a whole
 * environment's silent no-op went unnoticed (LC-161).
 */
function store(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Reading the global is itself blocked on some hosts.
    return undefined;
  }
}

function readString(key: string): string | undefined {
  const storage = store();
  if (!storage) return undefined;
  try {
    return storage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function readRecord(key: string): Record<string, unknown> {
  const storage = store();
  if (!storage) return {};
  try {
    const saved: unknown = JSON.parse(storage.getItem(key) ?? "");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return saved as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * The three old keys as one unvalidated document, in the shape the file on disk
 * has. Empty when the host has no storage, or when nothing was ever kept in it.
 */
export function webviewPreferences(): Record<string, unknown> {
  const document: Record<string, unknown> = {};
  const appearance = readString(APPEARANCE_KEY);
  if (appearance) document.appearance = appearance;
  const activeProjectId = readString(ACTIVE_PROJECT_KEY);
  if (activeProjectId) document.activeProjectId = activeProjectId;

  // Before LC-49, ordering was the only persisted per-project workspace field.
  // That migration never reached a file, so it is still read here: a Manual
  // board from two schemas ago is carried across both in one step.
  const workspaces: Record<string, unknown> = {
    ...readRecord(PROJECT_WORKSPACES_KEY),
  };
  for (const [projectId, ordering] of Object.entries(
    readRecord(LEGACY_ORDERING_KEY),
  )) {
    const saved = workspaces[projectId];
    const known = saved && typeof saved === "object" && !Array.isArray(saved);
    if (known && "ordering" in (saved as Record<string, unknown>)) continue;
    workspaces[projectId] = { ...(known ? saved : {}), ordering };
  }
  if (Object.keys(workspaces).length > 0) {
    document.projectWorkspaces = workspaces;
  }
  return document;
}

/**
 * Takes the old keys away, once what they held has been written somewhere that
 * survives.
 *
 * This is what makes the migration a migration rather than a fallback. An empty
 * document is not only "never written" — it is also "emptied", which is the
 * supported way to start over (`user-guide.md`), and a read that ran every time
 * would hand the old choices back on the next launch. Consuming the keys is
 * also what the abandonment means: nothing writes here any more, so a value
 * left behind is one no later choice will ever correct.
 *
 * The cost is a downgrade: a build older than LC-150 installed over this one
 * would find its storage empty and come up on the defaults. That is the trade
 * ADR 0012 takes — the alternative is stale values that outlive every later
 * change to them.
 */
export function forgetWebviewPreferences() {
  const storage = store();
  if (!storage) return;
  for (const key of [
    APPEARANCE_KEY,
    ACTIVE_PROJECT_KEY,
    PROJECT_WORKSPACES_KEY,
    LEGACY_ORDERING_KEY,
  ]) {
    try {
      storage.removeItem(key);
    } catch {
      // Refused. The document is already written; a key left behind is read
      // once more on the next launch and written over the same values.
    }
  }
}
