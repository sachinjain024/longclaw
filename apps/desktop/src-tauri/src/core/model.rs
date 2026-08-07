//! The shapes that cross IPC.
//!
//! The frontend is a thin cache over these (ADR 0006), so they are projections of
//! what is on disk plus the small amount of state Rust owns. Two conventions
//! matter: fields are camelCase, and a ticket row says whether it is readable
//! instead of faking a title and status for a file that is not.

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::error::Diagnostic;
use super::project::{Label, Project};
use super::storage::NewTicket;
use super::ticket::{Actor, FieldChange, Priority, Status, Ticket, TicketEdit};

/// A registered project. `reachable` is false when the folder has moved or gone:
/// the entry stays listed with its cached name so it can be relocated.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectReference {
    pub id: String,
    pub name: String,
    pub root_path: String,
    #[serde(default)]
    pub key: String,
    pub theme: String,
    #[serde(default)]
    pub starred: bool,
    pub reachable: bool,
    /// Label definitions keyed by slug, so every surface holding a project
    /// reference can render a chip for a slug a ticket carries.
    ///
    /// `longclaw.yaml` is the source of truth: the registry rebuilds this from the
    /// file whenever the folder is readable, and the persisted copy only has to
    /// carry an unreachable project. `default` is what lets a registry file
    /// written before this field existed still load.
    #[serde(default)]
    pub labels: BTreeMap<String, Label>,
}

impl ProjectReference {
    pub fn from_project(project: &Project, root_path: String) -> Self {
        Self {
            id: project.id.clone(),
            name: project.name.clone(),
            root_path,
            key: project.key.clone(),
            theme: project.theme.clone(),
            starred: false,
            reachable: true,
            labels: project.labels.clone(),
        }
    }
}

/// The newest activity entry on a ticket, which is what "updated by an agent"
/// treatments read.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySummary {
    pub id: String,
    pub kind: String,
    pub occurred_at: String,
    pub actor: Actor,
}

/// A readable ticket, reduced to what a board, list, or palette row needs.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexedRow {
    pub key: String,
    pub id: String,
    pub title: String,
    pub status: Status,
    pub priority: Priority,
    pub labels: Vec<String>,
    // No assignee: local projects have none, and no v0 surface renders one
    // (ADR 0001). The field is preserved on disk by the writer, not carried here.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
    pub checked_count: usize,
    pub checklist_count: usize,
    pub comment_count: usize,
    pub attachment_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<ActivitySummary>,
    /// The hash an edit of this ticket must carry back to be saved.
    pub content_hash: String,
    pub relative_path: String,
    /// Embedded records that could not be read. The ticket is still usable.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub record_diagnostics: Vec<Diagnostic>,
}

/// A ticket file that could not be read. It keeps its place in the project with
/// enough detail to explain itself and to open the raw file.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DegradedRow {
    /// The ticket directory's name. A degraded file has no trustworthy key of its
    /// own, so its path is its identity.
    pub key: String,
    pub content_hash: String,
    pub relative_path: String,
    pub byte_length: usize,
    /// True for a newer format version: there is nothing to fix, so the app offers
    /// no retry-and-repair affordance.
    pub read_only: bool,
    /// The status this directory last parsed with, if this index has seen it read.
    ///
    /// Not read from the file: the file is exactly what could not be read. It is
    /// the index's own memory of the row it replaced, and it is what lets the
    /// board keep the card in the column the human left it in rather than moving
    /// it to the end of the board the moment somebody breaks the frontmatter
    /// (`states.md:92-93`, D-50). A cleared index has none, and the surfaces fall
    /// back to their `Unreadable` group — losing it is losing a placement, never
    /// data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_known_status: Option<Status>,
    pub diagnostic: Diagnostic,
}

/// One row of the project index.
///
/// The readable variant is much larger than the degraded one, and it is also the
/// common one: a project is mostly readable tickets. Boxing it to even the two out
/// would add an allocation per row to save space on the rare case, so the rows stay
/// inline.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum TicketRow {
    Indexed(IndexedRow),
    Degraded(DegradedRow),
}

impl TicketRow {
    pub fn key(&self) -> &str {
        match self {
            Self::Indexed(row) => &row.key,
            Self::Degraded(row) => &row.key,
        }
    }

    pub fn content_hash(&self) -> &str {
        match self {
            Self::Indexed(row) => &row.content_hash,
            Self::Degraded(row) => &row.content_hash,
        }
    }

    pub fn is_degraded(&self) -> bool {
        matches!(self, Self::Degraded(_))
    }
}

/// Everything the ticket panel needs, including the file as it is on disk so an
/// unreadable ticket can still be inspected.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketDetail {
    pub key: String,
    pub relative_path: String,
    pub content_hash: String,
    pub byte_length: usize,
    pub read_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ticket: Option<Ticket>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<Diagnostic>,
    pub raw: String,
    pub raw_truncated: bool,
    /// Registry entries whose bytes are gone. Their metadata is preserved.
    pub missing_attachments: Vec<String>,
    /// Files with no registry entry. Recoverable, never deleted.
    pub orphan_attachments: Vec<String>,
}

/// A prepared write: the bytes to place, and the changes the edit recorded. The
/// engine records its self-write receipt before these bytes reach disk.
#[derive(Debug, Clone)]
pub struct TicketWrite {
    pub key: String,
    pub path: PathBuf,
    pub bytes: Vec<u8>,
    pub changes: Vec<FieldChange>,
    /// The hash of the file this write was built from, for an edit; `None` for a
    /// create, which has no predecessor to displace.
    ///
    /// It is carried this far because validating it before the write is not enough:
    /// the write itself has to confirm that the bytes it displaced were still these
    /// ones. See `storage::atomic_replace`.
    pub expected_hash: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IndexSnapshot {
    pub tickets: Vec<TicketRow>,
    pub generation: u64,
    pub rebuilt_in_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub project: ProjectReference,
    pub tickets: Vec<TicketRow>,
    pub generation: u64,
    pub rebuilt_in_ms: f64,
    /// The event sequence these rows are current as of.
    ///
    /// A frontend that missed an event recovers by snapshot, and then has to know
    /// which incremental events the snapshot already accounts for. It is read
    /// *before* the rows are, so it can only ever be too low — which costs a
    /// redundant re-apply of an event the snapshot already contains, and those are
    /// idempotent. Reading it after the rows could skip an event that is not in
    /// them, which is the failure this whole field exists to prevent.
    pub sequence: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub tickets: Vec<TicketRow>,
    pub elapsed_ms: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EditTicketRequest {
    pub project_id: String,
    pub ticket_key: String,
    /// The hash the edit started from. A different hash on disk is a conflict.
    pub expected_hash: String,
    pub edit: TicketEdit,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateTicketRequest {
    pub project_id: String,
    #[serde(flatten)]
    pub ticket: NewTicket,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub ticket: TicketRow,
    pub generation: u64,
    pub changes: Vec<FieldChange>,
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

/// Where a change came from. App-authored writes are suppressed by their receipt,
/// so an event that reaches the frontend is always someone else's.
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
    Overflow,
    /// A project folder that was reported unreachable answered again. The rows
    /// it comes back with are the recovery: an unreachable stretch delivers no
    /// events, so there is nothing to catch up from (LC-141).
    Recovered,
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
        /// Boxed so one large variant does not set the size of every event. A box
        /// serializes transparently, so the wire shape is unchanged.
        ticket: Box<TicketRow>,
        source: EventSource,
        coalesced_events: usize,
        detected_in_ms: f64,
        /// The record that explains *this* change, or absent for actor unknown.
        ///
        /// Deliberately not the row's `last_activity`, which is only "the newest
        /// record in the file" and belongs to whoever wrote last rather than to
        /// whoever caused this event. Attribution is a property of the transition,
        /// so it rides on the event; a snapshot has no transition and carries none.
        /// See `core::attribution`.
        #[serde(skip_serializing_if = "Option::is_none")]
        attribution: Option<ActivitySummary>,
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
        ActivitySummary, BTreeMap, DegradedRow, EventSource, IndexedRow, Label, ProjectEvent,
        ProjectReference, ProjectSnapshot, RebuildReason, StreamEnvelope, StreamFrame, StreamKind,
        TicketRow,
    };
    use crate::core::ticket::{Actor, ActorType, Priority, Status};
    use crate::core::{Diagnostic, ErrorCode};

    const EMITTED_AT: &str = "2026-07-29T12:00:00.000Z";
    const PROJECT_ID: &str = "project-fixture";
    const ROOT_PATH: &str = "/tmp/LongClaw Fixture";

    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../tests/fixtures/ipc-contract.json"))
            .expect("IPC contract fixture must be valid JSON")
    }

    fn indexed() -> TicketRow {
        TicketRow::Indexed(IndexedRow {
            key: "LC-3".to_owned(),
            id: "019c8c7e-7b22-7ef0-9c33-84a1d5e0b7c6".to_owned(),
            title: "External deletion contract".to_owned(),
            status: Status::Todo,
            priority: Priority::P2,
            labels: vec!["reliability".to_owned()],
            rank: None,
            created_at: "2026-07-29T00:00:00Z".to_owned(),
            updated_at: "2026-07-29T09:00:00Z".to_owned(),
            archived_at: None,
            checked_count: 1,
            checklist_count: 2,
            comment_count: 1,
            attachment_count: 0,
            last_activity: Some(ActivitySummary {
                id: "evt_f83f615b".to_owned(),
                kind: "comment".to_owned(),
                occurred_at: "2026-07-29T09:00:00Z".to_owned(),
                actor: Actor {
                    actor_type: ActorType::Agent,
                    id: Some("claude-code".to_owned()),
                    name: Some("Claude Code".to_owned()),
                },
            }),
            content_hash: "abc123".to_owned(),
            relative_path: ".longclaw/tickets/LC-3/ticket.md".to_owned(),
            record_diagnostics: Vec::new(),
        })
    }

    fn degraded() -> TicketRow {
        TicketRow::Degraded(DegradedRow {
            key: "LC-98".to_owned(),
            content_hash: "def456".to_owned(),
            relative_path: ".longclaw/tickets/LC-98/ticket.md".to_owned(),
            byte_length: 420,
            read_only: false,
            last_known_status: Some(Status::Todo),
            diagnostic: Diagnostic {
                code: ErrorCode::ParseFailed,
                message: "status must be one of backlog, todo; found blocked".to_owned(),
                line: Some(6),
            },
        })
    }

    fn project() -> ProjectReference {
        ProjectReference {
            id: PROJECT_ID.to_owned(),
            name: "Fixture Project".to_owned(),
            root_path: ROOT_PATH.to_owned(),
            key: "LC".to_owned(),
            theme: "indigo".to_owned(),
            starred: false,
            reachable: true,
            labels: BTreeMap::from([(
                "reliability".to_owned(),
                Label {
                    name: "Reliability".to_owned(),
                    color: "amber".to_owned(),
                },
            )]),
        }
    }

    fn snapshot() -> ProjectSnapshot {
        ProjectSnapshot {
            project: project(),
            tickets: vec![indexed(), degraded()],
            generation: 7,
            rebuilt_in_ms: 12.5,
            sequence: 41,
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
                ticket: Box::new(indexed()),
                source: EventSource::External,
                coalesced_events: 4,
                detected_in_ms: 186.96,
                // The record this change appended, which here happens to be the
                // file's newest one. The two agree often and are not the same
                // thing: see `core::attribution`.
                attribution: Some(ActivitySummary {
                    id: "evt_f83f615b".to_owned(),
                    kind: "comment".to_owned(),
                    occurred_at: "2026-07-29T09:00:00Z".to_owned(),
                    actor: Actor {
                        actor_type: ActorType::Agent,
                        id: Some("claude-code".to_owned()),
                        name: Some("Claude Code".to_owned()),
                    },
                }),
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
