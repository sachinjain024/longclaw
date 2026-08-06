import type { OrderingMode } from "./ordering";

const ACTIVE_PROJECT_KEY = "longclaw.activeProject";
const PROJECT_WORKSPACES_KEY = "longclaw.projectWorkspaces";
const LEGACY_ORDERING_KEY = "longclaw.boardOrdering";

export type ViewMode = "board" | "list";
export type ProjectWorkspace = {
  view?: ViewMode;
  ordering?: OrderingMode;
  filterQuery?: string;
};

export function readActiveProjectId(): string | undefined {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function readRecord(key: string): Record<string, unknown> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "");
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
    if (value.ordering === "priority" || value.ordering === "manual") {
      workspace.ordering = value.ordering;
    }
    if (typeof value.filterQuery === "string") {
      workspace.filterQuery = value.filterQuery;
    }
    if (Object.keys(workspace).length > 0) workspaces[projectId] = workspace;
  }

  // Before LC-49, ordering was the only persisted per-project workspace field.
  // Adopt that key once so existing Manual choices survive the schema merge.
  for (const [projectId, ordering] of Object.entries(
    readRecord(LEGACY_ORDERING_KEY),
  )) {
    if (ordering !== "manual" || workspaces[projectId]?.ordering) continue;
    workspaces[projectId] = { ...workspaces[projectId], ordering };
  }
  return workspaces;
}

export function rememberActiveProject(projectId: string) {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } catch {
    // The selected project still works for this session.
  }
}

export function rememberProjectWorkspaces(
  workspaces: Record<string, ProjectWorkspace>,
) {
  try {
    localStorage.setItem(PROJECT_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {
    // Workspace choices still work for this session.
  }
}
