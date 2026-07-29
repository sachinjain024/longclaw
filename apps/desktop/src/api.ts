import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ProjectReference,
  ProjectSnapshot,
  SearchResult,
  StreamEnvelope,
  StreamFrame,
  VisibleUiProbe,
  WriteResult,
  WriteTicketTitleRequest,
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

export async function openProject(projectId: string): Promise<ProjectSnapshot> {
  return invoke("open_project", { projectId });
}

export async function writeTicketTitle(
  request: WriteTicketTitleRequest,
): Promise<WriteResult> {
  return invoke("write_ticket_title", { request });
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
