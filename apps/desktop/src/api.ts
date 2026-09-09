import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  CreateTicketRequest,
  EditTicketRequest,
  EstimateSystem,
  ProjectReference,
  ProjectSnapshot,
  SearchResult,
  StreamEnvelope,
  StreamFrame,
  TicketDetail,
  TicketProperty,
  VisibleUiProbe,
  WriteResult,
} from "./types";

const PROJECT_EVENT_NAME = "longclaw://project-event";

export async function listProjects(): Promise<ProjectReference[]> {
  return invoke("list_projects");
}

/**
 * The native folder picker on its own, answering with a path and creating
 * nothing. `null` is a cancelled picker — a normal answer, not a failure.
 *
 * One body under two names, because after LC-170 the title is the only thing
 * about a picker that may differ by the button that opened it: what happens to
 * the folder it answers with is a fact about the folder
 * (`screen-specs.md:99-101`). The choose-and-act pairs these replace — a picker
 * that registered, or created in, whatever it was handed — could not survive
 * that, because both now have to be able to end on either screen.
 */
function chooseFolder(title: string): Promise<string | null> {
  return open({ directory: true, multiple: false, title });
}

/**
 * First launch asks the folder before it asks anything else
 * (`screen-specs.md:97-106`, D-11): the create form shows the chosen path back
 * (D-13), which it cannot do while the picker is the last step rather than the
 * first.
 */
export async function chooseProjectFolder(): Promise<string | null> {
  return chooseFolder("Create a LongClaw project");
}

/** The same picker, under the title `Open a folder` asks for. */
export async function chooseOpenFolder(): Promise<string | null> {
  return chooseFolder("Open a LongClaw project");
}

/**
 * Whether a folder already holds a project, which is the question that decides
 * which screen a picked folder leads to. The frontend has no filesystem of its
 * own, so this is Rust's to answer, and it is the same predicate creation
 * refuses on (`storage.rs`, `holds_project`) — the two agreeing is what keeps
 * the create form off a folder that will not take one.
 */
export async function folderHoldsProject(rootPath: string): Promise<boolean> {
  return invoke("folder_holds_project", { rootPath });
}

/** Records a reference to a folder that already holds a project. Writes nothing. */
export async function registerProject(
  rootPath: string,
): Promise<ProjectReference> {
  return invoke("register_project", { rootPath });
}

/**
 * Everything a new project needs that the folder does not supply. The same
 * shape as `ProjectDraft`, and deliberately not that import: this is the IPC
 * request `create_project` deserializes, and the day the form grows a field the
 * backend does not take, the two should be allowed to disagree.
 */
export type NewProjectRequest = { name: string; key: string; theme: string };

export async function createProjectInFolder(
  rootPath: string,
  request: NewProjectRequest,
): Promise<ProjectReference> {
  return invoke("create_project", {
    request: { rootPath, ...request },
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

/**
 * Turns one of the four opt-in properties on or off (LC-227).
 *
 * Off hides and never deletes: every ticket keeps the value it carries, and the
 * project keeps what it configured. The same toggle puts it back, which is the
 * undo — and the reason this write asks nothing first.
 */
export async function setProjectPropertyEnabled(request: {
  projectId: string;
  property: TicketProperty;
  enabled: boolean;
}): Promise<ProjectReference> {
  return invoke("set_project_property_enabled", request);
}

/** The width of the approaching window, in days. `0` empties that rung. */
export async function setProjectDueWindow(request: {
  projectId: string;
  attentionDays: number;
}): Promise<ProjectReference> {
  return invoke("set_project_due_window", request);
}

/**
 * Moves the project to another estimate system. Nothing stored is rewritten —
 * a value written under the old one reads as unreadable until it switches back.
 */
export async function setProjectEstimateSystem(request: {
  projectId: string;
  system: EstimateSystem;
}): Promise<ProjectReference> {
  return invoke("set_project_estimate_system", request);
}

/** Both halves of the conversion at once, because it is one setting. */
export async function setProjectEstimateConversion(request: {
  projectId: string;
  hoursPerDay: number;
  daysPerWeek: number;
}): Promise<ProjectReference> {
  return invoke("set_project_estimate_conversion", request);
}

/** The t-shirt scale, whole and in order — the order is the scale. */
export async function setProjectEstimateScale(request: {
  projectId: string;
  values: string[];
}): Promise<ProjectReference> {
  return invoke("set_project_estimate_scale", request);
}

/** Defines a type value. Tickets store the slug, so this touches no ticket. */
export async function addProjectTypeValue(request: {
  projectId: string;
  slug: string;
  name: string;
  color?: string;
}): Promise<ProjectReference> {
  return invoke("add_project_type_value", request);
}

/** Renames a type value, recolours it, or both. The slug is not editable. */
export async function updateProjectTypeValue(request: {
  projectId: string;
  slug: string;
  name?: string;
  color?: string;
}): Promise<ProjectReference> {
  return invoke("update_project_type_value", request);
}

/** Removes a definition. Tickets keep the slug and render it as itself. */
export async function removeProjectTypeValue(request: {
  projectId: string;
  slug: string;
}): Promise<ProjectReference> {
  return invoke("remove_project_type_value", request);
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

/**
 * The device's preferences, as the last process left them (`devicePreferences.ts`).
 *
 * Deliberately untyped past "an object": the shape is the frontend's, Rust keeps
 * the file without reading it, and the copy on disk may have been written by
 * another build or by hand. It is validated where it is adopted, not here.
 */
export async function readPreferences(): Promise<Record<string, unknown>> {
  return invoke("read_preferences");
}

/** Replaces the document on disk. */
export async function writePreferences(
  document: Record<string, unknown>,
): Promise<void> {
  await invoke("write_preferences", { document });
}

/** The current user's home directory, for tilde-abbreviating paths in the UI. */
export async function homeDir(): Promise<string | null> {
  return invoke("home_dir");
}
