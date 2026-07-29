mod app_state;
pub mod core;
mod engine;
mod registry;

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Instant;

use app_state::AppState;
use core::{
    AppResult, ProjectReference, ProjectSnapshot, RebuildReason, SearchResult, StreamEnvelope,
    StreamFrame, StreamKind, VisibleUiProbe, WriteResult, WriteTicketTitleRequest,
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
fn write_ticket_title(
    request: WriteTicketTitleRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<WriteResult> {
    state
        .engine(&request.project_id, tauri_sink(&app))?
        .write_title(&request.ticket_key, &request.title, &request.expected_hash)
}

#[tauri::command]
fn stream_probe(on_event: Channel<StreamFrame>) -> AppResult<()> {
    let stream_id = format!("probe-{}", uuid::Uuid::new_v4().simple());
    on_event
        .send(StreamFrame::Started {
            stream_id: stream_id.clone(),
            kind: StreamKind::ArchitectureProbe,
        })
        .map_err(|error| {
            core::AppError::new(
                core::ErrorCode::Internal,
                format!("Sending stream-start frame failed: {error}"),
                false,
            )
        })?;
    for (sequence, text) in ["ordered ", "binary-safe ", "channel\n"]
        .into_iter()
        .enumerate()
    {
        on_event
            .send(StreamFrame::Chunk {
                stream_id: stream_id.clone(),
                sequence: sequence as u64,
                bytes: text.as_bytes().to_vec(),
            })
            .map_err(|error| {
                core::AppError::new(
                    core::ErrorCode::Internal,
                    format!("Sending stream chunk failed: {error}"),
                    false,
                )
            })?;
    }
    on_event
        .send(StreamFrame::Finished {
            stream_id,
            exit_code: 0,
        })
        .map_err(|error| {
            core::AppError::new(
                core::ErrorCode::Internal,
                format!("Sending stream-finished frame failed: {error}"),
                false,
            )
        })?;
    Ok(())
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
            write_ticket_title,
            stream_probe,
            report_visible_ui
        ])
        .run(tauri::generate_context!())
        .expect("LongClaw desktop should run");
}
