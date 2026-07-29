use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectDisk {
    pub format: String,
    pub id: String,
    pub name: String,
    pub key: String,
    pub theme: String,
    pub created_at: String,
    #[serde(default)]
    pub people: BTreeMap<String, serde_yaml::Value>,
    #[serde(default)]
    pub labels: BTreeMap<String, serde_yaml::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectReference {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub theme: String,
    pub reachable: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TicketFrontmatter {
    pub format: String,
    pub id: String,
    pub key: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActorSummary {
    #[serde(rename = "type")]
    pub actor_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActivityHeader {
    pub actor: ActorHeader,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActorHeader {
    #[serde(rename = "type")]
    pub actor_type: String,
    pub name: Option<String>,
    pub id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TicketRecord {
    pub view: TicketView,
    pub absolute_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TicketView {
    pub key: String,
    pub title: String,
    pub status: String,
    pub checked_count: usize,
    pub checklist_count: usize,
    pub content_hash: String,
    pub relative_path: String,
    pub degraded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_actor: Option<ActorSummary>,
}

#[derive(Debug, Clone)]
pub struct IndexSnapshot {
    pub tickets: Vec<TicketView>,
    pub generation: u64,
    pub rebuilt_in_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub project: ProjectReference,
    pub tickets: Vec<TicketView>,
    pub generation: u64,
    pub rebuilt_in_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub tickets: Vec<TicketView>,
    pub elapsed_ms: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTicketTitleRequest {
    pub project_id: String,
    pub ticket_key: String,
    pub title: String,
    pub expected_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub ticket: TicketView,
    pub generation: u64,
    pub atomic_rename: bool,
    pub watcher_echo_suppressed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEnvelope {
    pub contract_version: u8,
    pub sequence: u64,
    pub project_id: String,
    pub emitted_at: String,
    pub event: ProjectEvent,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum ProjectEvent {
    TicketChanged {
        ticket: TicketView,
        source: String,
        coalesced_events: usize,
        detected_in_ms: f64,
    },
    TicketRemoved {
        ticket_key: String,
        source: String,
    },
    IndexRebuilt {
        snapshot: ProjectSnapshot,
        reason: String,
    },
    ProjectUnavailable {
        root_path: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum StreamFrame {
    Started {
        stream_id: String,
        kind: String,
    },
    Chunk {
        stream_id: String,
        sequence: u64,
        bytes: Vec<u8>,
    },
    Finished {
        stream_id: String,
        exit_code: i32,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibleUiProbe {
    pub project_id: String,
    pub row_count: usize,
    pub row_titles: Vec<String>,
    pub last_sequence: u64,
    pub trace_text: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
}
