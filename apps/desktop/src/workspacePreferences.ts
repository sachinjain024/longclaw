/**
 * Device-local workspace preferences from LC-49.
 *
 * This is deliberately not persisted Zustand state (ADR 0006): snapshots and
 * project references remain owned by Rust. The active-project value is only an
 * opaque selection hint, revalidated against Rust's registry before it is used;
 * no project path or reachability claim crosses into webview storage.
 */

import { isOrderingMode, type OrderingMode } from "./ordering";

const ACTIVE_PROJECT_KEY = "longclaw.activeProject";
const PROJECT_WORKSPACES_KEY = "longclaw.projectWorkspaces";
const LEGACY_ORDERING_KEY = "longclaw.boardOrdering";

export type ViewMode = "board" | "list";
export type ProjectWorkspace = {
  view?: ViewMode;
  ordering?: OrderingMode;
  filterQuery?: string;
};
export type ProjectWorkspacePatch = Partial<ProjectWorkspace>;

/**
 * The store these preferences live in, or `undefined` where the host has none.
 *
 * A host without web storage and a store that refuses a write are different
 * failures, and the `catch` in every function below is for the second: a quota
 * that is full, an origin that is blocked. Reaching for an absent global threw
 * a `TypeError` into those same catches, so a persistence layer that could
 * never work looked exactly like one that had merely been refused once — which
 * is how a whole environment's silent no-op went unnoticed (LC-161).
 *
 * Both still degrade to "this choice does not survive the session". The point
 * is that the code can now tell which one it is.
 */
function store(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Reading the global is itself blocked on some hosts.
    return undefined;
  }
}

export function readActiveProjectId(): string | undefined {
  const storage = store();
  if (!storage) return undefined;
  try {
    return storage.getItem(ACTIVE_PROJECT_KEY) || undefined;
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

export function readProjectWorkspaces(): Record<string, ProjectWorkspace> {
  const workspaces: Record<string, ProjectWorkspace> = {};
  for (const [projectId, candidate] of Object.entries(
    readRecord(PROJECT_WORKSPACES_KEY),
  )) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }
    const value = candidate as Record<string, unknown>;
    const workspace: ProjectWorkspace = {};
    if (value.view === "board" || value.view === "list") {
      workspace.view = value.view;
    }
    if (isOrderingMode(value.ordering)) {
      workspace.ordering = value.ordering;
    }
    if (typeof value.filterQuery === "string") {
      workspace.filterQuery = value.filterQuery;
    }
    if (Object.keys(workspace).length > 0) workspaces[projectId] = workspace;
  }

  // Before LC-49, ordering was the only persisted per-project workspace field.
  // Adopt that key once so existing Manual choices survive the schema merge.
  const legacyOrdering = readRecord(LEGACY_ORDERING_KEY);
  let migrated = false;
  for (const [projectId, ordering] of Object.entries(legacyOrdering)) {
    if (ordering !== "manual" || workspaces[projectId]?.ordering) continue;
    workspaces[projectId] = { ...workspaces[projectId], ordering };
    migrated = true;
  }
  const storage = store();
  try {
    // Write the replacement before deleting the old key so a storage failure
    // cannot discard a valid Manual preference during migration.
    if (migrated) {
      storage?.setItem(PROJECT_WORKSPACES_KEY, JSON.stringify(workspaces));
    }
    storage?.removeItem(LEGACY_ORDERING_KEY);
  } catch {
    // A later launch can retry the legacy migration.
  }
  return workspaces;
}

export function rememberActiveProject(projectId: string) {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } catch {
    // The selected project still works for this session.
  }
}

export function rememberProjectWorkspaces(
  workspaces: Record<string, ProjectWorkspace>,
) {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(PROJECT_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {
    // Workspace choices still work for this session.
  }
}
