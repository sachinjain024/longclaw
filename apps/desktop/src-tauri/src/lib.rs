mod app_state;
pub mod cli;
pub mod core;
pub mod engine;
mod platform;
mod preferences;
mod registry;

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Instant;

use app_state::AppState;
use core::project::DEFAULT_LABEL_COLOR;
use core::{
    AppResult, CreateTicketRequest, EditTicketRequest, ProjectReference, ProjectSnapshot,
    RebuildReason, SearchResult, StreamEnvelope, StreamFrame, StreamKind, TicketDetail,
    VisibleUiProbe, WriteResult,
};
use preferences::PreferenceDocument;
use serde::Deserialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State};

const PROJECT_EVENT_NAME: &str = "longclaw://project-event";
static PROCESS_STARTED: OnceLock<Instant> = OnceLock::new();

fn tauri_sink(app: &AppHandle) -> Arc<dyn Fn(StreamEnvelope) + Send + Sync + 'static> {
    let app = app.clone();
    Arc::new(move |event| {
        let _ = app.emit(PROJECT_EVENT_NAME, event);
    })
}

#[tauri::command]
fn list_projects(state: State<'_, AppState>) -> Vec<ProjectReference> {
    state.list_projects()
}

#[tauri::command]
fn register_project(root_path: String, state: State<'_, AppState>) -> AppResult<ProjectReference> {
    state.register_project(PathBuf::from(root_path))
}

/// Whether the folder the picker just answered with already holds a project
/// (`screen-specs.md:99-101`). The frontend has no filesystem of its own, so
/// without this it can only find out by trying — `register_project` on a plain
/// folder, or `create_project` on an initialised one — and both find out by
/// failing, after the user has answered questions that were never going to be
/// used (LC-170).
///
/// No `AppState`: this touches the registry not at all and creates nothing. It
/// reads one path and answers, which is why it can be a plain `bool` rather than
/// an `AppResult` — an unreachable folder is a folder with no project in it, and
/// the picker still has a screen to show for that.
#[tauri::command]
fn folder_holds_project(root_path: String) -> bool {
    core::storage::holds_project(&PathBuf::from(root_path))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreateProjectRequest {
    root_path: String,
    name: String,
    key: String,
    theme: String,
}

#[tauri::command]
fn create_project(
    request: CreateProjectRequest,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.create_project(
        PathBuf::from(request.root_path),
        &request.name,
        &request.key,
        &request.theme,
    )
}

#[tauri::command]
fn relocate_project(
    project_id: String,
    root_path: String,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.relocate_project(&project_id, PathBuf::from(root_path))
}

#[tauri::command]
fn set_project_starred(
    project_id: String,
    starred: bool,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.set_project_starred(&project_id, starred)
}

#[tauri::command]
fn update_project_theme(
    project_id: String,
    theme: String,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.update_project_theme(&project_id, &theme)
}

#[tauri::command]
fn update_project_name(
    project_id: String,
    name: String,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.update_project_name(&project_id, &name)
}

/// Defines a label. `color` is optional so a caller that has no palette yet gets
/// the same default the parser applies to a definition that omits one.
#[tauri::command]
fn add_project_label(
    project_id: String,
    slug: String,
    name: String,
    color: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.add_project_label(
        &project_id,
        &slug,
        &name,
        color.as_deref().unwrap_or(DEFAULT_LABEL_COLOR),
    )
}

/// Renames a label, recolours it, or both. The slug is not editable: tickets
/// store it, so changing it would mean rewriting every ticket that carries it.
#[tauri::command]
fn update_project_label(
    project_id: String,
    slug: String,
    name: Option<String>,
    color: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.update_project_label(&project_id, &slug, name.as_deref(), color.as_deref())
}

/// Removes a definition. Tickets keep the slug and render it as itself.
#[tauri::command]
fn remove_project_label(
    project_id: String,
    slug: String,
    state: State<'_, AppState>,
) -> AppResult<ProjectReference> {
    state.remove_project_label(&project_id, &slug)
}

#[tauri::command]
fn remove_project(project_id: String, state: State<'_, AppState>) -> AppResult<()> {
    state.remove_project(&project_id)
}

#[tauri::command]
fn open_project(
    project_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<ProjectSnapshot> {
    state.open_snapshot(&project_id, tauri_sink(&app))
}

#[tauri::command]
fn rebuild_index(
    project_id: String,
    reason: RebuildReason,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<ProjectSnapshot> {
    state
        .engine(&project_id, tauri_sink(&app))?
        .request_rebuild(reason)
}

#[tauri::command]
fn search_tickets(
    project_id: String,
    query: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<SearchResult> {
    Ok(state.engine(&project_id, tauri_sink(&app))?.search(&query))
}

#[tauri::command]
fn read_ticket(
    project_id: String,
    ticket_key: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<TicketDetail> {
    state
        .engine(&project_id, tauri_sink(&app))?
        .detail(&ticket_key)
}

/// `Open in editor` from the raw-file view (`screen-specs.md:356`, D-54).
///
/// The webview sends a ticket key, never a path: the path is resolved against
/// the project the app already opened and proven to be inside it, which is what
/// keeps a surface with no filesystem capability from acquiring one by asking.
/// A file the system declines to open is reported rather than passed over — a
/// button that silently did nothing is the failure this state exists to avoid.
#[tauri::command]
fn open_ticket_file(
    project_id: String,
    ticket_key: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let path = state
        .engine(&project_id, tauri_sink(&app))?
        .canonical_ticket_path(&ticket_key)?;
    if platform::macos::open_in_default_app(&path) {
        return Ok(());
    }
    // The message names the file, the context carries the path — the split
    // `AppError::io` makes and ADR 0010 describes. A DTO that read an absolute
    // path back to the human in prose would also be the one thing ADR 0006 says
    // a view-oriented payload does not carry.
    Err(core::AppError::new(
        core::ErrorCode::Io,
        format!(
            "macOS would not open {ticket_key}'s file. Open it from Finder, or \
             set a default application for Markdown files."
        ),
        true,
    )
    .with_context("ticketKey", ticket_key)
    .with_context("path", path.display().to_string()))
}

#[tauri::command]
fn edit_ticket(
    request: EditTicketRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<WriteResult> {
    state
        .engine(&request.project_id, tauri_sink(&app))?
        .edit_ticket(&request.ticket_key, &request.edit, &request.expected_hash)
}

#[tauri::command]
fn create_ticket(
    request: CreateTicketRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<WriteResult> {
    state
        .engine(&request.project_id, tauri_sink(&app))?
        .create_ticket(&request.ticket)
}

/// Sends one frame on a typed channel. The channel is the extension point Phase 2
/// PTY output will use, so its failures translate at this seam like any other.
fn send_frame(channel: &Channel<StreamFrame>, frame: StreamFrame) -> AppResult<()> {
    channel.send(frame).map_err(|error| {
        core::AppError::new(
            core::ErrorCode::Internal,
            format!("Sending a stream frame failed: {error}"),
            false,
        )
    })
}

#[tauri::command]
fn stream_probe(on_event: Channel<StreamFrame>) -> AppResult<()> {
    let stream_id = format!("probe-{}", uuid::Uuid::new_v4().simple());
    send_frame(
        &on_event,
        StreamFrame::Started {
            stream_id: stream_id.clone(),
            kind: StreamKind::ArchitectureProbe,
        },
    )?;
    for (sequence, text) in ["ordered ", "binary-safe ", "channel\n"]
        .into_iter()
        .enumerate()
    {
        send_frame(
            &on_event,
            StreamFrame::Chunk {
                stream_id: stream_id.clone(),
                sequence: sequence as u64,
                bytes: text.as_bytes().to_vec(),
            },
        )?;
    }
    send_frame(
        &on_event,
        StreamFrame::Finished {
            stream_id,
            exit_code: 0,
        },
    )
}

/// The device's preferences, as the last process left them (LC-150, LC-151).
///
/// Read once at startup, before the first render: the appearance is stamped on
/// the root and the workspace record is the initial state of a `useState`, so a
/// document that arrives later is a flash of the wrong theme and a board that
/// was on the wrong project for a frame.
#[tauri::command]
fn read_preferences(state: State<'_, AppState>) -> PreferenceDocument {
    state.read_preferences()
}

/// Replaces the document. The webview owns its shape (`preferences.rs`).
#[tauri::command]
fn write_preferences(document: PreferenceDocument, state: State<'_, AppState>) -> AppResult<()> {
    state.write_preferences(document)
}

/// The current user's home directory, for tilde-abbreviating paths in the UI.
/// Only the actual home prefix is abbreviated — `/Users/other/...` stays as-is.
#[tauri::command]
fn home_dir(app: AppHandle) -> Option<String> {
    app.path()
        .home_dir()
        .ok()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn report_visible_ui(probe: VisibleUiProbe, app: AppHandle) -> AppResult<()> {
    let json = serde_json::to_string(&probe).map_err(|error| {
        core::AppError::new(
            core::ErrorCode::Internal,
            format!("Serializing visible UI probe failed: {error}"),
            false,
        )
    })?;
    println!("LONGCLAW_LOCAL_DIAGNOSTIC visible_ui_probe={json}");
    if let Some(started) = PROCESS_STARTED.get() {
        println!(
            "LONGCLAW_LOCAL_DIAGNOSTIC startup_to_rendered_ms={:.2}",
            started.elapsed().as_secs_f64() * 1_000.0
        );
    }
    if std::env::var_os("LONGCLAW_EXIT_AFTER_FIRST_PROBE").is_some() {
        app.exit(0);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = PROCESS_STARTED.set(Instant::now());
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state = AppState::new(&app_data_dir)?;
            #[cfg(debug_assertions)]
            if let Ok(root) = std::env::var("LONGCLAW_DEV_PROJECT") {
                state.register_project(PathBuf::from(root))?;
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            register_project,
            folder_holds_project,
            create_project,
            relocate_project,
            set_project_starred,
            update_project_theme,
            update_project_name,
            add_project_label,
            update_project_label,
            remove_project_label,
            remove_project,
            open_project,
            rebuild_index,
            search_tickets,
            read_ticket,
            open_ticket_file,
            edit_ticket,
            create_ticket,
            stream_probe,
            report_visible_ui,
            read_preferences,
            write_preferences,
            home_dir
        ])
        .run(tauri::generate_context!())
        .expect("LongClaw desktop should run");
}
