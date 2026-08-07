import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  CreateTicketRequest,
  EditTicketRequest,
  ProjectReference,
  ProjectSnapshot,
  SearchResult,
  StreamEnvelope,
  StreamFrame,
  TicketDetail,
  VisibleUiProbe,
  WriteResult,
} from "./types";

const PROJECT_EVENT_NAME = "longclaw://project-event";

export async function listProjects(): Promise<ProjectReference[]> {
  return invoke("list_projects");
}

export async function chooseAndRegisterProject(): Promise<ProjectReference | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open a LongClaw project",
  });

  if (!selected) return null;
  return invoke("register_project", { rootPath: selected });
}

export async function chooseAndCreateProject(request: {
  name: string;
  key: string;
  theme: string;
}): Promise<ProjectReference | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Create a LongClaw project",
  });

  if (!selected) return null;
  return invoke("create_project", {
    request: { rootPath: selected, ...request },
  });
}

export async function chooseAndRelocateProject(
  projectId: string,
): Promise<ProjectReference | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Locate the LongClaw project folder",
  });

  if (!selected) return null;
  return invoke("relocate_project", { projectId, rootPath: selected });
}

export async function setProjectStarred(
  projectId: string,
  starred: boolean,
): Promise<ProjectReference> {
  return invoke("set_project_starred", { projectId, starred });
}

export async function updateProjectTheme(
  projectId: string,
  theme: string,
): Promise<ProjectReference> {
  return invoke("update_project_theme", { projectId, theme });
}

export async function updateProjectName(
  projectId: string,
  name: string,
): Promise<ProjectReference> {
  return invoke("update_project_name", { projectId, name });
}

/**
 * Defines a label. Only the definition is written — a ticket carries the slug —
 * so this never touches a ticket file. `color` defaults to Rust's own preset.
 */
export async function addProjectLabel(request: {
  projectId: string;
  slug: string;
  name: string;
  color?: string;
}): Promise<ProjectReference> {
  return invoke("add_project_label", request);
}

/**
 * Renames a label, recolours it, or both. There is no slug edit: the slug is
 * what every ticket carrying the label stores.
 */
export async function updateProjectLabel(request: {
  projectId: string;
  slug: string;
  name?: string;
  color?: string;
}): Promise<ProjectReference> {
  return invoke("update_project_label", request);
}

/** Removes a definition. Tickets keep the slug and render it as itself. */
export async function removeProjectLabel(request: {
  projectId: string;
  slug: string;
}): Promise<ProjectReference> {
  return invoke("remove_project_label", request);
}

export async function removeProject(projectId: string): Promise<void> {
  return invoke("remove_project", { projectId });
}

export async function openProject(projectId: string): Promise<ProjectSnapshot> {
  return invoke("open_project", { projectId });
}

/** Reads one ticket from disk, including the raw file when it will not parse. */
export async function readTicket(
  projectId: string,
  ticketKey: string,
): Promise<TicketDetail> {
  return invoke("read_ticket", { projectId, ticketKey });
}

/**
 * Hands one ticket's file to whatever the human opens Markdown with.
 *
 * The key rather than the path: this surface has no filesystem capability
 * (`capabilities/main.json`), and Rust resolves the path against the project it
 * already opened, so the request cannot become a reach outside it.
 */
export async function openTicketFile(
  projectId: string,
  ticketKey: string,
): Promise<void> {
  return invoke("open_ticket_file", { projectId, ticketKey });
}

/**
 * Saves a change. The request carries the hash the edit started from; a newer
 * file on disk comes back as a `conflict` and is never overwritten.
 */
export async function editTicket(
  request: EditTicketRequest,
): Promise<WriteResult> {
  return invoke("edit_ticket", { request });
}

/** Creates a ticket. Rust allocates the key from the project's own files. */
export async function createTicket(
  request: CreateTicketRequest,
): Promise<WriteResult> {
  return invoke("create_ticket", { request });
}

export async function rebuildIndex(
  projectId: string,
): Promise<ProjectSnapshot> {
  return invoke("rebuild_index", { projectId, reason: "manual" });
}

export async function reconcileProject(
  projectId: string,
): Promise<ProjectSnapshot> {
  return invoke("rebuild_index", { projectId, reason: "resume" });
}

export async function searchTickets(
  projectId: string,
  query: string,
): Promise<SearchResult> {
  return invoke("search_tickets", { projectId, query });
}

export async function listenForProjectEvents(
  handler: (event: StreamEnvelope) => void,
): Promise<UnlistenFn> {
  return listen<StreamEnvelope>(PROJECT_EVENT_NAME, ({ payload }) =>
    handler(payload),
  );
}

export async function runStreamProbe(
  handler: (frame: StreamFrame) => void,
): Promise<void> {
  const onEvent = new Channel<StreamFrame>();
  onEvent.onmessage = handler;
  await invoke("stream_probe", { onEvent });
}

export async function reportVisibleUi(probe: VisibleUiProbe): Promise<void> {
  await invoke("report_visible_ui", { probe });
}

/** The current user's home directory, for tilde-abbreviating paths in the UI. */
export async function homeDir(): Promise<string | null> {
  return invoke("home_dir");
}
