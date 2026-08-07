/**
 * Device-local preferences: the choices that belong to this machine rather than
 * to any project — the appearance in force, which project was open, and the
 * view, ordering and filter each project was last looked at with.
 *
 * They live in a file Rust owns (`src-tauri/src/preferences.rs`, ADR 0012).
 * They used to live in `localStorage`, which ADR 0006 allowed: set the
 * appearance to Light, quit, relaunch, and the control read `System` again
 * (LC-150), while startup fell back to the first registry entry however long
 * you had spent on the second (LC-151). Why the value did not come back was
 * never established — the ADR sets out what is and is not known — and the point
 * of moving is that it no longer has to be. A store the app cannot test is one
 * where every such question costs a manual relaunch to ask.
 *
 * **The document is read once, before the first render, and read synchronously
 * after that.** The appearance is stamped on the root and the workspace record
 * is the initial state of a `useState`, so a document that arrives a tick later
 * is a flash of the wrong theme and a frame of the wrong project — and every
 * reader here would have to be a promise for a value that has not changed since
 * launch. `main.tsx` awaits `restoreDevicePreferences`; anything else that
 * mounts `App` (`perf/main.tsx`, the suite) does the same.
 *
 * **Validation is here rather than in Rust.** The vocabulary is the frontend's:
 * view modes, ordering, a filter string. Rust keeps the file — where it is,
 * that a write lands or does not, that one nobody can parse is not thrown away
 * — and hands the object over whole. So the document is untrusted the way a
 * hand-edited file is untrusted: every field is checked against the vocabulary
 * this build knows, and one it does not is dropped rather than carried into the
 * store.
 */

import { readPreferences, writePreferences } from "./api";
import { isOrderingMode, type OrderingMode } from "./ordering";
import { useLongClawStore, type Appearance } from "./state";
import { webviewPreferences } from "./webviewPreferences";

export type ViewMode = "board" | "list";
export type ProjectWorkspace = {
  view?: ViewMode;
  ordering?: OrderingMode;
  filterQuery?: string;
};
export type ProjectWorkspacePatch = Partial<ProjectWorkspace>;

type DevicePreferences = {
  appearance?: Appearance;
  /**
   * An opaque selection hint and not a second project reference (ADR 0006):
   * startup revalidates it against Rust's registry before opening anything, so
   * no path and no reachability claim is stored here.
   */
  activeProjectId?: string;
  projectWorkspaces: Record<string, ProjectWorkspace>;
};

/**
 * A launch that has restored nothing. A factory rather than a shared constant:
 * the workspace record is handed out by reference, and one caller writing into
 * a shared empty would leave it in every later "nothing was restored".
 */
const nothing = (): DevicePreferences => ({ projectWorkspaces: {} });

let held: DevicePreferences = nothing();

function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "system";
}

/** Every field this build knows, taken from a document it must not trust. */
function adopt(stored: unknown): DevicePreferences {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return nothing();
  }
  const value = stored as Record<string, unknown>;
  const adopted: DevicePreferences = { projectWorkspaces: {} };
  if (isAppearance(value.appearance)) adopted.appearance = value.appearance;
  if (typeof value.activeProjectId === "string" && value.activeProjectId) {
    adopted.activeProjectId = value.activeProjectId;
  }
  const saved = value.projectWorkspaces;
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [projectId, candidate] of Object.entries(
      saved as Record<string, unknown>,
    )) {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        continue;
      }
      const fields = candidate as Record<string, unknown>;
      const workspace: ProjectWorkspace = {};
      if (fields.view === "board" || fields.view === "list") {
        workspace.view = fields.view;
      }
      if (isOrderingMode(fields.ordering)) workspace.ordering = fields.ordering;
      if (typeof fields.filterQuery === "string") {
        workspace.filterQuery = fields.filterQuery;
      }
      if (Object.keys(workspace).length > 0) {
        adopted.projectWorkspaces[projectId] = workspace;
      }
    }
  }
  return adopted;
}

function isEmpty(preferences: DevicePreferences) {
  return (
    preferences.appearance === undefined &&
    preferences.activeProjectId === undefined &&
    Object.keys(preferences.projectWorkspaces).length === 0
  );
}

/** What is written to the file. Named for the noun rather than `document`,
 *  which is the global this module would otherwise shadow for its whole body. */
function serialized(): Record<string, unknown> {
  const written: Record<string, unknown> = {
    projectWorkspaces: held.projectWorkspaces,
  };
  if (held.appearance) written.appearance = held.appearance;
  if (held.activeProjectId) written.activeProjectId = held.activeProjectId;
  return written;
}

/**
 * Whether a write is out and whether another is owed.
 *
 * No debounce: a write leaves the moment a preference changes, because the last
 * thing a human does before quitting is often the thing they changed, and a
 * timer we introduced would be a way to lose exactly that. Bursts are coalesced
 * instead — the filter changes on every keystroke, and `App` already holds
 * those for 150ms before they reach here — so a change made while a write is in
 * flight sends one more write when it settles rather than queueing a write per
 * change.
 */
let writing = false;
let owed = false;

function flush() {
  if (writing) {
    owed = true;
    return;
  }
  writing = true;
  void writePreferences(serialized())
    .catch(() => {
      // The choice still works for this session. A failure to persist is not a
      // failure to apply, and there is no surface here to report it on.
    })
    .finally(() => {
      writing = false;
      if (!owed) return;
      owed = false;
      flush();
    });
}

/**
 * Reads the document, once, before the first render, and puts the appearance
 * back where the store expects to find it.
 *
 * The appearance is pushed rather than pulled by an effect because an effect is
 * a paint late and, worse, a *write* late: `App`'s stamp effect would run its
 * first pass with the launch default still in the store and record `system`
 * over the `light` this just read, which is the very preference LC-150 is about
 * losing. Everything else here is read from the render that follows, so this is
 * the only value that needs pushing.
 *
 * A host with no backend — a browser tab, a harness that answers no commands —
 * degrades to a session that cannot restore and can still record: every reader
 * below answers with the launch defaults and every write is dropped where it is
 * refused. That is what webview storage did on a host without it, and it is the
 * one behaviour worth keeping from it.
 */
export async function restoreDevicePreferences(): Promise<void> {
  let stored: unknown;
  try {
    stored = await readPreferences();
  } catch {
    stored = undefined;
  }
  const adopted = adopt(stored);
  if (isEmpty(adopted)) {
    // Nothing on disk yet. Whatever the last build left in webview storage is
    // the only copy of these choices there is, so it is adopted once and
    // written where it will survive (`webviewPreferences.ts`).
    const carried = adopt(webviewPreferences());
    held = carried;
    if (!isEmpty(carried)) flush();
  } else {
    held = adopted;
  }
  if (held.appearance) {
    useLongClawStore.getState().setAppearance(held.appearance);
  }
}

export function readAppearance(): Appearance | undefined {
  return held.appearance;
}

export function readActiveProjectId(): string | undefined {
  return held.activeProjectId;
}

export function readProjectWorkspaces(): Record<string, ProjectWorkspace> {
  return held.projectWorkspaces;
}

export function rememberAppearance(appearance: Appearance) {
  if (held.appearance === appearance) return;
  // An absent value already means "follow the system", so a first launch that
  // has chosen nothing writes nothing: `App` records the appearance on every
  // mount, and without this every launch would file the default as a decision.
  if (held.appearance === undefined && appearance === "system") return;
  held = { ...held, appearance };
  flush();
}

export function rememberActiveProject(projectId: string) {
  if (held.activeProjectId === projectId) return;
  held = { ...held, activeProjectId: projectId };
  flush();
}

export function rememberProjectWorkspaces(
  workspaces: Record<string, ProjectWorkspace>,
) {
  if (held.projectWorkspaces === workspaces) return;
  held = { ...held, projectWorkspaces: workspaces };
  flush();
}

/**
 * Drops what this process is holding, for the suite. Module state that outlives
 * a test is state one test hands to another — the same reason `testSetup.ts`
 * installs a fresh storage stub per test rather than one per run.
 */
export function resetDevicePreferences() {
  held = nothing();
  writing = false;
  owed = false;
}
