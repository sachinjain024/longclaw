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
    pub status: Status,
    pub priority: Priority,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Backlog,
    Todo,
    InProgress,
    InReview,
    Done,
    Canceled,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Backlog => "backlog",
            Self::Todo => "todo",
            Self::InProgress => "in_progress",
            Self::InReview => "in_review",
            Self::Done => "done",
            Self::Canceled => "canceled",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Urgent,
    P1,
    P2,
    P3,
    P4,
    None,
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EventSource {
    External,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RebuildReason {
    Manual,
    Resume,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StreamKind {
    ArchitectureProbe,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ProjectEvent {
    TicketChanged {
        ticket: TicketView,
        source: EventSource,
        coalesced_events: usize,
        detected_in_ms: f64,
    },
    TicketRemoved {
        ticket_key: String,
        source: EventSource,
    },
    IndexRebuilt {
        snapshot: ProjectSnapshot,
        reason: RebuildReason,
    },
    ProjectUnavailable {
        root_path: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "event",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum StreamFrame {
    Started {
        stream_id: String,
        kind: StreamKind,
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

#[cfg(test)]
mod json_contract_tests {
    use serde_json::Value;

    use super::{
        ActorSummary, EventSource, ProjectEvent, ProjectReference, ProjectSnapshot, RebuildReason,
        StreamEnvelope, StreamFrame, StreamKind, TicketView,
    };

    const EMITTED_AT: &str = "2026-07-29T12:00:00.000Z";
    const PROJECT_ID: &str = "project-fixture";
    const ROOT_PATH: &str = "/tmp/LongClaw Fixture";

    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../tests/fixtures/ipc-contract.json"))
            .expect("IPC contract fixture must be valid JSON")
    }

    fn ticket() -> TicketView {
        TicketView {
            key: "LC-3".to_owned(),
            title: "External deletion contract".to_owned(),
            status: "todo".to_owned(),
            checked_count: 1,
            checklist_count: 2,
            content_hash: "abc123".to_owned(),
            relative_path: ".longclaw/tickets/LC-3/ticket.md".to_owned(),
            degraded: false,
            diagnostic: None,
            last_actor: Some(ActorSummary {
                actor_type: "human".to_owned(),
                name: Some("Sachin".to_owned()),
            }),
        }
    }

    fn project() -> ProjectReference {
        ProjectReference {
            id: PROJECT_ID.to_owned(),
            name: "Fixture Project".to_owned(),
            root_path: ROOT_PATH.to_owned(),
            theme: "indigo".to_owned(),
            reachable: true,
        }
    }

    fn snapshot() -> ProjectSnapshot {
        ProjectSnapshot {
            project: project(),
            tickets: vec![ticket()],
            generation: 7,
            rebuilt_in_ms: 12.5,
        }
    }

    fn envelope(sequence: u64, event: ProjectEvent) -> StreamEnvelope {
        StreamEnvelope {
            contract_version: 1,
            sequence,
            project_id: PROJECT_ID.to_owned(),
            emitted_at: EMITTED_AT.to_owned(),
            event,
        }
    }

    fn assert_project_event_contract(name: &str, sequence: u64, event: ProjectEvent) {
        let expected = &fixture()["projectEventEnvelopes"][name];
        let actual =
            serde_json::to_value(envelope(sequence, event)).expect("project event must serialize");
        assert_eq!(&actual, expected, "{name} JSON contract changed");
    }

    fn assert_stream_frame_contract(name: &str, frame: StreamFrame) {
        let expected = &fixture()["streamFrames"][name];
        let actual = serde_json::to_value(frame).expect("stream frame must serialize");
        assert_eq!(&actual, expected, "{name} JSON contract changed");
    }

    #[test]
    fn json_contract_ticket_changed() {
        assert_project_event_contract(
            "ticketChanged",
            1,
            ProjectEvent::TicketChanged {
                ticket: ticket(),
                source: EventSource::External,
                coalesced_events: 4,
                detected_in_ms: 186.96,
            },
        );
    }

    #[test]
    fn json_contract_ticket_removed() {
        assert_project_event_contract(
            "ticketRemoved",
            2,
            ProjectEvent::TicketRemoved {
                ticket_key: "LC-3".to_owned(),
                source: EventSource::External,
            },
        );
    }

    #[test]
    fn json_contract_index_rebuilt() {
        assert_project_event_contract(
            "indexRebuilt",
            3,
            ProjectEvent::IndexRebuilt {
                snapshot: snapshot(),
                reason: RebuildReason::Resume,
            },
        );
    }

    #[test]
    fn json_contract_project_unavailable() {
        assert_project_event_contract(
            "projectUnavailable",
            4,
            ProjectEvent::ProjectUnavailable {
                root_path: ROOT_PATH.to_owned(),
            },
        );
    }

    #[test]
    fn json_contract_stream_started() {
        assert_stream_frame_contract(
            "started",
            StreamFrame::Started {
                stream_id: "stream-fixture".to_owned(),
                kind: StreamKind::ArchitectureProbe,
            },
        );
    }

    #[test]
    fn json_contract_stream_chunk() {
        assert_stream_frame_contract(
            "chunk",
            StreamFrame::Chunk {
                stream_id: "stream-fixture".to_owned(),
                sequence: 1,
                bytes: b"ok\n".to_vec(),
            },
        );
    }

    #[test]
    fn json_contract_stream_finished() {
        assert_stream_frame_contract(
            "finished",
            StreamFrame::Finished {
                stream_id: "stream-fixture".to_owned(),
                exit_code: 0,
            },
        );
    }
}
