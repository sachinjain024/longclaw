mod app_state;
pub mod core;
pub mod engine;
mod registry;

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Instant;

use app_state::AppState;
use core::{
    AppResult, CreateTicketRequest, EditTicketRequest, ProjectReference, ProjectSnapshot,
    RebuildReason, SearchResult, StreamEnvelope, StreamFrame, StreamKind, TicketDetail,
    VisibleUiProbe, WriteResult,
};
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
        .rebuild(reason, true)
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
            open_project,
            rebuild_index,
            search_tickets,
            read_ticket,
            edit_ticket,
            create_ticket,
            stream_probe,
            report_visible_ui
        ])
        .run(tauri::generate_context!())
        .expect("LongClaw desktop should run");
}
