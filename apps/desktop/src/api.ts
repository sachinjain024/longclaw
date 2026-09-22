import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  CommandLineStatus,
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
  UpdateProgress,
  UpdateStatus,
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
 * (`screen-specs.md:113-115`). The choose-and-act pairs these replace — a picker
 * that registered, or created in, whatever it was handed — could not survive
 * that, because both now have to be able to end on either screen.
 */
function chooseFolder(title: string): Promise<string | null> {
  return open({ directory: true, multiple: false, title });
}

/**
 * First launch asks the folder before it asks anything else
 * (`screen-specs.md:111-120`, D-11): the create form shows the chosen path back
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

/**
 * Puts a project row after another in the sidebar, or first when `after` is
 * `null` (LC-260j).
 *
 * A neighbour rather than an index, the way a checklist move names the row it
 * follows. The whole list comes back because a move renumbers every row between
 * the two ends of it, and `⌘1`–`⌘9` is that number.
 */
export async function moveProjectAfter(
  projectId: string,
  after: string | null,
): Promise<ProjectReference[]> {
  return invoke("move_project_after", {
    projectId,
    afterProjectId: after,
  });
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

/**
 * Whether the `longclaw` command is on `PATH`, and what it points at (LC-233).
 *
 * Read rather than remembered: another process can change the answer — a second
 * copy of the app, or a `sudo ln -s` run by hand — so a value cached across a
 * session would go stale exactly when it mattered.
 */
export async function commandLineStatus(): Promise<CommandLineStatus> {
  return invoke("command_line_status");
}

/**
 * Puts `longclaw` on `PATH`, and answers with the status that follows.
 *
 * No path crosses the wire, the same way none does for `openTicketFile`: this
 * surface has no filesystem capability, and Rust decides both where the link
 * goes and what it refuses to replace. A refused write rejects with the usual
 * tagged error; `manualCommand` on the status is the way out of it.
 */
export async function installCommandLine(): Promise<CommandLineStatus> {
  return invoke("install_command_line");
}

/**
 * Whether a newer LongClaw exists
 * ([ADR 0014](../../../docs/adr/0014-one-optional-check-for-a-newer-longclaw.md)).
 *
 * **No URL crosses the wire**, the same way none does for `openTicketFile`:
 * this surface has no network capability, and Rust owns the host, the key and
 * the budget. The webview asks for a check and names nothing.
 *
 * `force` is *Check now*. A scheduled check passes `false`, and Rust makes at
 * most one request per slot — so two schedulers, a re-render and a failed
 * attempt cost one request between them, and a failure is never retried until
 * the next slot.
 */
export async function checkForUpdate(force: boolean): Promise<UpdateStatus> {
  return invoke("check_for_update", { force });
}

/**
 * What the pane should draw, without asking the network anything.
 *
 * Safe on every render, and that is the point: a pane that is merely open must
 * not become a second schedule.
 */
export async function updateStatus(): Promise<UpdateStatus> {
  return invoke("update_status");
}

/**
 * The first press. Fetches and verifies the pending version, reporting progress
 * on a channel (ADR 0007).
 *
 * A failure leaves the installed bundle untouched and keeps no partial file, so
 * losing the network halfway costs the download and nothing else.
 */
export async function downloadUpdate(
  onProgress: (frame: UpdateProgress) => void,
): Promise<UpdateStatus> {
  const channel = new Channel<UpdateProgress>();
  channel.onmessage = onProgress;
  return invoke("download_update", { onProgress: channel });
}

/**
 * The second press. Refuses while a ticket write is outstanding, with
 * `context.reason` of `writeInFlight`.
 *
 * The pane holds the button and says why; this refusal is the guarantee behind
 * that sentence, and it reads a count kept around the atomic write seams rather
 * than anything the webview told it (ADR 0009).
 */
export async function installUpdate(): Promise<void> {
  return invoke("install_update");
}

/** The way out when the in-app update cannot finish. The webview names no URL. */
export async function openDownloadPage(): Promise<void> {
  return invoke("open_download_page");
}

/**
 * Opens the LongClaw repository on GitHub, in the default browser (LC-257s).
 *
 * The webview names no URL, the same way it names none for `openTicketFile` or
 * `openDownloadPage`: it asks for *the repository* and Rust holds the one it
 * means. A surface that could pass a URL here would be a network capability
 * spelled differently.
 */
export async function openRepository(): Promise<void> {
  return invoke("open_repository");
}

/**
 * The repository's star count, or `null` when there is nothing to say
 * (LC-257s, [ADR 0015](../../../docs/adr/0015-the-star-count-rides-the-update-path.md)).
 *
 * **`null` is an answer, never an error.** Offline, rate limited, refused by a
 * proxy, or asked again inside the same slot: all of them come back as `null`,
 * the control stays in its no-count state, and nothing is raised. Rust owns the
 * host and the slot — at most one request a day however often this is called —
 * so a caller cannot turn a re-render into a second request.
 */
export async function starCount(): Promise<number | null> {
  return invoke("star_count");
}
