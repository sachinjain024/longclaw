//! The canonical ticket record: `ticket.md`.
//!
//! One file carries a ticket's current state, description, checklist, attachment
//! registry, and activity. Humans, agents, and LongClaw all write it, so this
//! module is built around one rule from `docs/file_format.md`: a write touches
//! only what it means to change, and everything else — unknown frontmatter keys,
//! comment placement, an agent's Markdown, records this build does not
//! understand — comes back byte-for-byte.
//!
//! That is why the document keeps the raw bytes of every region it parsed instead
//! of re-serializing a struct. [`TicketDocument::render`] on an unmodified
//! document returns its input exactly; an edit rewrites the lines it owns and
//! leaves the rest alone.
//!
//! Reserved-section rule: `## Checklist`, `## Attachments`, and `## Activity`
//! each run until the next reserved heading or the end of the file. Ordinary
//! headings, fenced code, and bounded records never end a section, so an agent
//! can quote `## Checklist` inside a comment without changing what the file means.

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::Diagnostic;
use super::yaml::{encode_scalar, lines_with_endings, validate_subset, Mapping};

pub const TICKET_FORMAT: &str = "longclaw.ticket/v1";
const FORMAT_FAMILY: &str = "longclaw.ticket/v";
const EVENT_OPEN: &str = "<!-- longclaw:event";
const EVENT_CLOSE: &str = "<!-- /longclaw:event -->";
const ATTACHMENT_OPEN: &str = "<!-- longclaw:attachment";
const ATTACHMENT_CLOSE: &str = "<!-- /longclaw:attachment -->";
const HEADER_TERMINATOR: &str = "-->";
const ITEM_MARKER_OPEN: &str = "<!-- longclaw:item=";
const ITEM_MARKER_CLOSE: &str = "-->";

/// The reserved local human actor. Local projects expose no identity UI
/// (ADR 0001), so app-authored changes are attributed to this actor and rendered
/// as "You".
pub const LOCAL_ACTOR_ID: &str = "local";

// ---------------------------------------------------------------- domain types

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
    pub const ALL: [Self; 6] = [
        Self::Backlog,
        Self::Todo,
        Self::InProgress,
        Self::InReview,
        Self::Done,
        Self::Canceled,
    ];

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

    fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|candidate| candidate.as_str() == value)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Urgent,
    P1,
    P2,
    P3,
    P4,
    None,
}

impl Priority {
    pub const ALL: [Self; 6] = [
        Self::Urgent,
        Self::P1,
        Self::P2,
        Self::P3,
        Self::P4,
        Self::None,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Urgent => "urgent",
            Self::P1 => "p1",
            Self::P2 => "p2",
            Self::P3 => "p3",
            Self::P4 => "p4",
            Self::None => "none",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|candidate| candidate.as_str() == value)
    }
}

/// Whether an actor is a person or a program. The app never infers this from a
/// name; a record that does not say degrades instead.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ActorType {
    Human,
    Agent,
    /// An externally observed change with no attribution.
    Unknown,
}

impl ActorType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Human => "human",
            Self::Agent => "agent",
            Self::Unknown => "unknown",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        [Self::Human, Self::Agent, Self::Unknown]
            .into_iter()
            .find(|candidate| candidate.as_str() == value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    #[serde(rename = "type")]
    pub actor_type: ActorType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl Actor {
    pub fn local_human() -> Self {
        Self {
            actor_type: ActorType::Human,
            id: Some(LOCAL_ACTOR_ID.to_owned()),
            name: None,
        }
    }
}

/// Activity kinds this build understands. An unfamiliar kind is preserved rather
/// than dropped, so a newer writer's timeline entry stays visible and intact.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventKind {
    Create,
    Update,
    Comment,
    ExternalChange,
    Other(String),
}

impl EventKind {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Create => "create",
            Self::Update => "update",
            Self::Comment => "comment",
            Self::ExternalChange => "external_change",
            Self::Other(kind) => kind,
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "create" => Self::Create,
            "update" => Self::Update,
            "comment" => Self::Comment,
            "external_change" => Self::ExternalChange,
            other => Self::Other(other.to_owned()),
        }
    }
}

impl Serialize for EventKind {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub field: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
}

impl FieldChange {
    fn new(field: impl Into<String>, from: Option<String>, to: Option<String>) -> Self {
        Self {
            field: field.into(),
            from,
            to,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub kind: EventKind,
    pub occurred_at: String,
    pub actor: Actor,
    pub changes: Vec<FieldChange>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    /// Absent when an agent appended a plain Markdown task. LongClaw adopts the
    /// item by minting an id on its next write.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub text: String,
    pub checked: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub file: String,
    pub name: String,
    pub media_type: String,
    pub size: u64,
    pub added_at: String,
    pub added_by: Actor,
}

/// A ticket as its file describes it. Counts, progress, and freshness are derived
/// at render time and never stored.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticket {
    pub id: String,
    pub key: String,
    pub title: String,
    pub status: Status,
    pub priority: Priority,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    pub labels: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
    pub description: String,
    pub checklist: Vec<ChecklistItem>,
    pub attachments: Vec<Attachment>,
    pub activity: Vec<ActivityEvent>,
    /// True when the ticket's state is newer than its newest activity entry,
    /// meaning someone changed it without narrating the change. State stands and
    /// the history is simply incomplete; it is never rolled back to match.
    pub history_incomplete: bool,
    /// Frontmatter keys this build does not interpret and must preserve.
    pub unknown_keys: Vec<String>,
    /// Embedded records that could not be read. The rest of the ticket is still
    /// valid, so each of these degrades one entry rather than the whole file.
    pub record_diagnostics: Vec<Diagnostic>,
}

impl Ticket {
    pub fn is_archived(&self) -> bool {
        self.archived_at.is_some()
    }

    pub fn checked_count(&self) -> usize {
        self.checklist.iter().filter(|item| item.checked).count()
    }

    /// The newest activity entry by `occurred_at`, with `id` as a deterministic
    /// tie-breaker.
    pub fn last_activity(&self) -> Option<&ActivityEvent> {
        self.activity.last()
    }
}

// -------------------------------------------------------------------- the edit

/// A requested change to a ticket. Every field is optional; absent means "leave
/// this alone", which is what keeps a read-modify-write from touching bytes the
/// caller never mentioned. `assignee` is deliberately absent: local projects have
/// no assignee (ADR 0001), and an existing value is preserved untouched.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TicketEdit {
    pub title: Option<String>,
    pub status: Option<Status>,
    pub priority: Option<Priority>,
    pub labels: Option<Vec<String>>,
    /// Absent leaves the rank alone; `null` clears it. A rank is written only by
    /// manual reordering (ADR 0003), so leaving Manual has to be able to put one
    /// back to absent rather than to some placeholder value.
    #[serde(default, deserialize_with = "nullable")]
    pub rank: Option<Option<String>>,
    pub archived: Option<bool>,
    pub description: Option<String>,
    #[serde(default)]
    pub checklist: Vec<ChecklistToggle>,
    #[serde(default)]
    pub add_checklist_items: Vec<String>,
    pub comment: Option<String>,
}

/// Reads a field that may be absent or explicitly null as two distinct answers.
/// Plain `Option<Option<T>>` collapses both onto the outer `None`, which would
/// turn "clear this" into "leave this alone".
fn nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChecklistToggle {
    pub item_id: String,
    pub checked: bool,
}

impl TicketEdit {
    fn is_empty(&self) -> bool {
        self.title.is_none()
            && self.status.is_none()
            && self.priority.is_none()
            && self.labels.is_none()
            && self.rank.is_none()
            && self.archived.is_none()
            && self.description.is_none()
            && self.checklist.is_empty()
            && self.add_checklist_items.is_empty()
            && self.comment.is_none()
    }
}

/// The bytes an edit produced, the changes it recorded, and the reparsed result.
#[derive(Debug)]
pub struct AppliedEdit {
    pub bytes: Vec<u8>,
    pub changes: Vec<FieldChange>,
    pub document: TicketDocument,
}

// --------------------------------------------------------------- the document

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Role {
    Text,
    Checklist,
    Attachments,
    Activity,
}

#[derive(Debug, Clone)]
struct Chunk {
    role: Role,
    raw: String,
    /// 1-based line in the file where this region starts, so a diagnostic about
    /// an embedded record can point at the right line of the raw-file view.
    start_line: u32,
}

/// `ticket.md`, parsed but never rewritten wholesale.
#[derive(Debug, Clone)]
pub struct TicketDocument {
    frontmatter: Mapping,
    open: String,
    close: String,
    chunks: Vec<Chunk>,
    ticket: Ticket,
}

impl TicketDocument {
    /// Reads `raw`. `directory_key` is the ticket directory's name: the format
    /// contract makes the directory and the frontmatter key one identity, so a
    /// disagreement is refused rather than repaired.
    pub fn parse(raw: &str, directory_key: &str) -> Result<Self, Diagnostic> {
        if raw.contains("\r\n") {
            return Err(Diagnostic::parse(
                "ticket.md uses CRLF line endings; LongClaw v0 reads LF files. \
                 Convert the line endings and the ticket parses again.",
            ));
        }
        let after_open = raw.strip_prefix("---\n").ok_or_else(|| {
            Diagnostic::parse_at("ticket.md must begin with a --- frontmatter delimiter", 1)
        })?;
        let (frontmatter_raw, close, body_raw, body_start_line) = split_frontmatter(after_open)?;

        let mapping = Mapping::parse(frontmatter_raw).map_err(|error| error.shift_lines(1))?;
        let fields: FrontmatterFields = serde_yaml::from_str(frontmatter_raw).map_err(|error| {
            yaml_diagnostic("Ticket frontmatter is invalid", &error).shift_lines(1)
        })?;

        validate_format(&fields.format, directory_key)?;
        if fields.key != directory_key {
            return Err(Diagnostic::parse(format!(
                "Ticket key {} does not match its directory {directory_key}. \
                 A ticket's key and path never change after creation.",
                fields.key
            )));
        }
        require_non_empty("id", &fields.id)?;
        require_non_empty("title", &fields.title)?;
        let status = Status::parse(&fields.status).ok_or_else(|| {
            Diagnostic::parse(format!(
                "status must be one of {}; found {}",
                joined(Status::ALL.map(Status::as_str)),
                fields.status
            ))
        })?;
        let priority = Priority::parse(&fields.priority).ok_or_else(|| {
            Diagnostic::parse(format!(
                "priority must be one of {}; found {}",
                joined(Priority::ALL.map(Priority::as_str)),
                fields.priority
            ))
        })?;
        validate_timestamp("created_at", &fields.created_at)?;
        validate_timestamp("updated_at", &fields.updated_at)?;
        if let Some(archived_at) = &fields.archived_at {
            validate_timestamp("archived_at", archived_at)?;
        }
        for label in &fields.labels {
            if label.is_empty() || label.chars().any(char::is_whitespace) {
                return Err(Diagnostic::parse(format!(
                    "labels hold project label slugs without whitespace; found {label:?}"
                )));
            }
        }

        let (chunks, mut record_diagnostics) = split_chunks(body_raw, body_start_line);
        let description = chunks
            .iter()
            .find(|chunk| chunk.role == Role::Text)
            .map(|chunk| chunk.raw.trim().to_owned())
            .unwrap_or_default();
        let checklist = chunks
            .iter()
            .filter(|chunk| chunk.role == Role::Checklist)
            .flat_map(|chunk| parse_checklist(&chunk.raw))
            .collect();
        let mut attachments = Vec::new();
        let mut activity = Vec::new();
        for chunk in &chunks {
            match chunk.role {
                Role::Attachments => {
                    collect_attachments(chunk, &mut attachments, &mut record_diagnostics)
                }
                Role::Activity => collect_activity(chunk, &mut activity, &mut record_diagnostics),
                Role::Text | Role::Checklist => {}
            }
        }
        // Sorted by instant rather than by string: a file can mix second and
        // millisecond precision, which text ordering gets wrong for the same second.
        activity.sort_by(|left, right| {
            instant_of(&left.occurred_at)
                .cmp(&instant_of(&right.occurred_at))
                .then_with(|| left.id.cmp(&right.id))
        });
        let history_incomplete = match activity
            .iter()
            .map(|event| &event.occurred_at)
            .max_by_key(|occurred_at| instant_of(occurred_at))
        {
            Some(newest) => instant_of(&fields.updated_at) > instant_of(newest),
            None => true,
        };

        let unknown_keys = mapping
            .keys()
            .filter(|key| !KNOWN_KEYS.contains(key))
            .map(str::to_owned)
            .collect();

        Ok(Self {
            frontmatter: mapping,
            open: "---\n".to_owned(),
            close: close.to_owned(),
            chunks,
            ticket: Ticket {
                id: fields.id,
                key: fields.key,
                title: fields.title,
                status,
                priority,
                assignee: fields.assignee,
                labels: fields.labels,
                rank: fields.rank,
                created_at: fields.created_at,
                updated_at: fields.updated_at,
                archived_at: fields.archived_at,
                description,
                checklist,
                attachments,
                activity,
                history_incomplete,
                unknown_keys,
                record_diagnostics,
            },
        })
    }

    pub fn ticket(&self) -> &Ticket {
        &self.ticket
    }

    /// The document's bytes: identical to the parsed input until something is
    /// edited, and thereafter identical apart from the edited regions.
    pub fn render(&self) -> String {
        let mut rendered = String::with_capacity(self.open.len() + self.close.len() + 1024);
        rendered.push_str(&self.open);
        rendered.push_str(&self.frontmatter.render());
        rendered.push_str(&self.close);
        for chunk in &self.chunks {
            rendered.push_str(&chunk.raw);
        }
        rendered
    }

    /// Applies `edit` and returns the bytes to write, the changes to record, and
    /// the reparsed document. The output is parsed before it is returned, so a
    /// mutation that would produce a file this build cannot read back is refused
    /// rather than written.
    pub fn apply(&self, edit: &TicketEdit, now: &str) -> Result<AppliedEdit, Diagnostic> {
        if edit.is_empty() {
            return Err(Diagnostic::parse("An edit has to change something"));
        }
        let mut next = self.clone();
        let mut changes = Vec::new();
        let current = &self.ticket;

        if let Some(title) = &edit.title {
            let title = title.trim();
            if title.is_empty() || title.chars().count() > 300 || title.contains('\n') {
                return Err(Diagnostic::parse(
                    "A title is a single line of 1 to 300 characters",
                ));
            }
            if title != current.title {
                next.frontmatter.set_scalar("title", title);
                changes.push(FieldChange::new(
                    "title",
                    Some(current.title.clone()),
                    Some(title.to_owned()),
                ));
            }
        }
        if let Some(status) = edit.status {
            if status != current.status {
                next.frontmatter.set_scalar("status", status.as_str());
                changes.push(FieldChange::new(
                    "status",
                    Some(current.status.as_str().to_owned()),
                    Some(status.as_str().to_owned()),
                ));
            }
        }
        if let Some(priority) = edit.priority {
            if priority != current.priority {
                next.frontmatter.set_scalar("priority", priority.as_str());
                changes.push(FieldChange::new(
                    "priority",
                    Some(current.priority.as_str().to_owned()),
                    Some(priority.as_str().to_owned()),
                ));
            }
        }
        if let Some(labels) = &edit.labels {
            if labels != &current.labels {
                if labels.is_empty() {
                    next.frontmatter.remove("labels");
                } else {
                    next.frontmatter.set_sequence_after(
                        "labels",
                        labels,
                        &["assignee", "priority"],
                    );
                }
                changes.push(FieldChange::new(
                    "labels",
                    Some(current.labels.join(", ")),
                    Some(labels.join(", ")),
                ));
            }
        }
        if let Some(rank) = &edit.rank {
            match (rank.as_deref(), current.rank.clone()) {
                (Some(rank), previous) if Some(rank) != previous.as_deref() => {
                    next.frontmatter
                        .set_scalar_after("rank", rank, &["labels", "priority"]);
                    changes.push(FieldChange::new("rank", previous, Some(rank.to_owned())));
                }
                (None, Some(previous)) => {
                    next.frontmatter.remove("rank");
                    changes.push(FieldChange::new("rank", Some(previous), None));
                }
                _ => {}
            }
        }
        if let Some(archived) = edit.archived {
            match (archived, current.archived_at.clone()) {
                (true, None) => {
                    next.frontmatter
                        .set_scalar_after("archived_at", now, &["updated_at"]);
                    changes.push(FieldChange::new("archived_at", None, Some(now.to_owned())));
                }
                (false, Some(previous)) => {
                    next.frontmatter.remove("archived_at");
                    changes.push(FieldChange::new("archived_at", Some(previous), None));
                }
                _ => {}
            }
        }
        if let Some(description) = &edit.description {
            if description.trim() != current.description {
                next.set_description(description);
                changes.push(FieldChange::new("description", None, None));
            }
        }
        for toggle in &edit.checklist {
            let item = current
                .checklist
                .iter()
                .find(|item| item.id.as_deref() == Some(toggle.item_id.as_str()))
                .ok_or_else(|| {
                    Diagnostic::parse(format!(
                        "Checklist item {} is not in this ticket",
                        toggle.item_id
                    ))
                })?;
            if item.checked != toggle.checked {
                next.set_checklist_checked(&toggle.item_id, toggle.checked);
                changes.push(FieldChange::new(
                    format!("checklist.{}.checked", toggle.item_id),
                    Some(item.checked.to_string()),
                    Some(toggle.checked.to_string()),
                ));
            }
        }
        for text in &edit.add_checklist_items {
            let text = text.trim();
            if text.is_empty() || text.contains('\n') {
                return Err(Diagnostic::parse(
                    "A checklist item is a single non-empty line",
                ));
            }
            let id = mint_id("ck");
            next.append_checklist_item(&id, text);
            changes.push(FieldChange::new(
                format!("checklist.{id}.added"),
                None,
                Some(text.to_owned()),
            ));
        }
        // An agent may append a plain Markdown task. Adopting it on the next app
        // write is what makes that item addressable afterwards.
        next.adopt_checklist_ids();

        let comment = match &edit.comment {
            Some(comment) if comment.trim().is_empty() => {
                return Err(Diagnostic::parse("A comment needs text"))
            }
            Some(comment) => comment.trim(),
            None => "",
        };
        if changes.is_empty() && comment.is_empty() {
            return Err(Diagnostic::parse(
                "The ticket already matches this edit; nothing was written",
            ));
        }
        // One write appends one event. A state change carrying a note is an update
        // whose body is that note, which is the shape the format contract
        // documents; a note on its own is a comment. Two events sharing one
        // timestamp would leave their order to the id tie-breaker, so the timeline
        // would not reliably read in the order the change happened.
        if changes.is_empty() {
            next.append_activity(&render_event(
                &EventKind::Comment,
                now,
                &[],
                "### You commented",
                comment,
            ));
        } else {
            next.frontmatter.set_scalar("updated_at", now);
            next.append_activity(&render_event(
                &EventKind::Update,
                now,
                &changes,
                "### You updated this ticket",
                comment,
            ));
        }

        let rendered = next.render();
        let document = Self::parse(&rendered, &self.ticket.key).map_err(|error| {
            Diagnostic::parse(format!(
                "Refusing to write a ticket this build cannot read back: {error}"
            ))
        })?;
        // A description holding a reserved heading would start a section instead of
        // staying description text, so the next read would see it truncated. Compare
        // what came back with what was asked for and refuse rather than write that.
        if let Some(requested) = &edit.description {
            if document.ticket().description != requested.trim() {
                return Err(Diagnostic::parse(format!(
                    "A description cannot contain a reserved heading ({}), because \
                     that starts a section. Indent it or wrap it in a code fence.",
                    joined(["## Checklist", "## Attachments", "## Activity"])
                )));
            }
        }
        Ok(AppliedEdit {
            bytes: rendered.into_bytes(),
            changes,
            document,
        })
    }

    fn chunk_mut(&mut self, role: Role) -> Option<&mut Chunk> {
        self.chunks.iter_mut().find(|chunk| chunk.role == role)
    }

    fn set_description(&mut self, description: &str) {
        let trimmed = description.trim();
        let has_following = self
            .chunks
            .iter()
            .any(|chunk| chunk.role != Role::Text && !chunk.raw.trim().is_empty());
        let rendered = if trimmed.is_empty() {
            "\n".to_owned()
        } else if has_following {
            format!("\n{trimmed}\n\n")
        } else {
            format!("\n{trimmed}\n")
        };
        match self.chunk_mut(Role::Text) {
            Some(chunk) => chunk.raw = rendered,
            None => self.chunks.insert(
                0,
                Chunk {
                    role: Role::Text,
                    raw: rendered,
                    start_line: 0,
                },
            ),
        }
    }

    fn set_checklist_checked(&mut self, item_id: &str, checked: bool) {
        let marker = if checked { "- [x] " } else { "- [ ] " };
        for chunk in self
            .chunks
            .iter_mut()
            .filter(|chunk| chunk.role == Role::Checklist)
        {
            chunk.raw = rewrite_lines(&chunk.raw, |line| {
                let item = parse_checklist_line(line)?;
                if item.id.as_deref() != Some(item_id) {
                    return None;
                }
                let indent = &line[..line.len() - line.trim_start().len()];
                let rest = line.trim_start().get(6..).unwrap_or_default();
                Some(format!("{indent}{marker}{rest}"))
            });
        }
    }

    fn append_checklist_item(&mut self, id: &str, text: &str) {
        let line = format!("- [ ] {text} {ITEM_MARKER_OPEN}{id} {ITEM_MARKER_CLOSE}\n");
        match self.chunk_mut(Role::Checklist) {
            Some(chunk) => {
                let insert_at = insertion_offset_after_last_item(&chunk.raw);
                chunk.raw.insert_str(insert_at, &line);
            }
            None => {
                let mut raw = String::from("\n## Checklist\n\n");
                raw.push_str(&line);
                let position = self
                    .chunks
                    .iter()
                    .position(|chunk| matches!(chunk.role, Role::Attachments | Role::Activity))
                    .unwrap_or(self.chunks.len());
                self.chunks.insert(
                    position,
                    Chunk {
                        role: Role::Checklist,
                        raw,
                        start_line: 0,
                    },
                );
            }
        }
    }

    fn adopt_checklist_ids(&mut self) {
        for chunk in self
            .chunks
            .iter_mut()
            .filter(|chunk| chunk.role == Role::Checklist)
        {
            chunk.raw = rewrite_lines(&chunk.raw, |line| {
                let item = parse_checklist_line(line)?;
                if item.id.is_some() {
                    return None;
                }
                let ending = if line.ends_with('\n') { "\n" } else { "" };
                Some(format!(
                    "{} {ITEM_MARKER_OPEN}{} {ITEM_MARKER_CLOSE}{ending}",
                    line.trim_end(),
                    mint_id("ck")
                ))
            });
        }
    }

    fn append_activity(&mut self, record: &str) {
        match self.chunk_mut(Role::Activity) {
            Some(chunk) => {
                if !chunk.raw.ends_with('\n') {
                    chunk.raw.push('\n');
                }
                chunk.raw.push('\n');
                chunk.raw.push_str(record);
            }
            None => {
                let mut raw = String::new();
                if self.chunks.iter().any(|chunk| !chunk.raw.trim().is_empty()) {
                    raw.push('\n');
                }
                raw.push_str("## Activity\n\n");
                raw.push_str(record);
                self.chunks.push(Chunk {
                    role: Role::Activity,
                    raw,
                    start_line: 0,
                });
            }
        }
    }
}

// ------------------------------------------------------------------- rendering

/// Renders one bounded activity record. Structured metadata lives inside the
/// markers; the Markdown underneath is what a human reads.
fn render_event(
    kind: &EventKind,
    occurred_at: &str,
    changes: &[FieldChange],
    heading: &str,
    body: &str,
) -> String {
    let mut record = String::new();
    record.push_str(EVENT_OPEN);
    record.push('\n');
    record.push_str(&format!("id: {}\n", mint_id("evt")));
    record.push_str(&format!("kind: {}\n", kind.as_str()));
    record.push_str(&format!("occurred_at: {}\n", encode_scalar(occurred_at)));
    record.push_str("actor:\n  type: human\n");
    record.push_str(&format!("  id: {LOCAL_ACTOR_ID}\n"));
    if !changes.is_empty() {
        record.push_str("changes:\n");
        for change in changes {
            record.push_str(&format!("  - field: {}\n", encode_scalar(&change.field)));
            if let Some(from) = &change.from {
                record.push_str(&format!("    from: {}\n", encode_scalar(from)));
            }
            if let Some(to) = &change.to {
                record.push_str(&format!("    to: {}\n", encode_scalar(to)));
            }
        }
    }
    record.push_str(HEADER_TERMINATOR);
    record.push('\n');
    record.push_str(heading);
    record.push('\n');
    if !body.trim().is_empty() {
        record.push('\n');
        record.push_str(body.trim());
        record.push('\n');
    }
    record.push_str(EVENT_CLOSE);
    record.push('\n');
    record
}

/// Renders a brand-new ticket in the documented key order. This is the one place
/// a ticket file is written from nothing.
pub fn render_new_ticket(
    key: &str,
    title: &str,
    status: Status,
    priority: Priority,
    description: &str,
    checklist: &[String],
    now: &str,
) -> String {
    render_new_ticket_with_labels(
        key,
        title,
        status,
        priority,
        &[],
        description,
        checklist,
        now,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn render_new_ticket_with_labels(
    key: &str,
    title: &str,
    status: Status,
    priority: Priority,
    labels: &[String],
    description: &str,
    checklist: &[String],
    now: &str,
) -> String {
    let mut rendered = String::from("---\n");
    rendered.push_str(&format!("format: {TICKET_FORMAT}\n"));
    rendered.push_str(&format!("id: {}\n", Uuid::new_v4()));
    rendered.push_str(&format!("key: {}\n", encode_scalar(key)));
    rendered.push_str(&format!("title: {}\n", encode_scalar(title)));
    rendered.push_str(&format!("status: {}\n", status.as_str()));
    rendered.push_str(&format!("priority: {}\n", priority.as_str()));
    if !labels.is_empty() {
        rendered.push_str("labels:\n");
        for label in labels {
            rendered.push_str(&format!("  - {}\n", encode_scalar(label.trim())));
        }
    }
    rendered.push_str(&format!("created_at: {}\n", encode_scalar(now)));
    rendered.push_str(&format!("updated_at: {}\n", encode_scalar(now)));
    rendered.push_str("---\n");
    let description = description.trim();
    if !description.is_empty() {
        rendered.push('\n');
        rendered.push_str(description);
        rendered.push('\n');
    }
    if !checklist.is_empty() {
        rendered.push_str("\n## Checklist\n\n");
        for text in checklist {
            rendered.push_str(&format!(
                "- [ ] {} {ITEM_MARKER_OPEN}{} {ITEM_MARKER_CLOSE}\n",
                text.trim(),
                mint_id("ck")
            ));
        }
    }
    rendered.push_str("\n## Activity\n\n");
    rendered.push_str(&render_event(
        &EventKind::Create,
        now,
        &[],
        "### You created this ticket",
        "",
    ));
    rendered
}

fn mint_id(prefix: &str) -> String {
    let uuid = Uuid::new_v4().simple().to_string();
    format!("{prefix}_{}", &uuid[..8])
}

// --------------------------------------------------------------------- parsing

const KNOWN_KEYS: [&str; 12] = [
    "format",
    "id",
    "key",
    "title",
    "status",
    "priority",
    "assignee",
    "labels",
    "rank",
    "created_at",
    "updated_at",
    "archived_at",
];

#[derive(Debug, Deserialize)]
struct FrontmatterFields {
    format: String,
    id: String,
    key: String,
    title: String,
    status: String,
    priority: String,
    #[serde(default)]
    assignee: Option<String>,
    #[serde(default)]
    labels: Vec<String>,
    #[serde(default)]
    rank: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    archived_at: Option<String>,
}

/// Splits the text after the opening delimiter into the frontmatter, the closing
/// delimiter line, the body, and the body's first line number.
fn split_frontmatter(after_open: &str) -> Result<(&str, &str, &str, u32), Diagnostic> {
    let mut offset = 0;
    for (number, line) in lines_with_endings(after_open) {
        if line.trim() == "---" {
            let frontmatter = &after_open[..offset];
            let close = &after_open[offset..offset + line.len()];
            let body = &after_open[offset + line.len()..];
            // +1 for the opening delimiter, +1 to land after the closing one.
            return Ok((frontmatter, close, body, number + 2));
        }
        offset += line.len();
    }
    Err(Diagnostic::parse(
        "ticket.md frontmatter has no closing --- delimiter. \
         A file caught mid-write looks like this, so LongClaw leaves it alone.",
    ))
}

fn validate_format(format: &str, directory_key: &str) -> Result<(), Diagnostic> {
    if format == TICKET_FORMAT {
        return Ok(());
    }
    if format.starts_with(FORMAT_FAMILY) {
        return Err(Diagnostic::unsupported_version(format!(
            "{directory_key} declares {format}. This build reads {TICKET_FORMAT}, \
             so the ticket is shown read-only instead of being migrated."
        )));
    }
    Err(Diagnostic::parse(format!(
        "format must be {TICKET_FORMAT}; found {format}"
    )))
}

fn require_non_empty(field: &str, value: &str) -> Result<(), Diagnostic> {
    if value.trim().is_empty() {
        return Err(Diagnostic::parse(format!("{field} must not be empty")));
    }
    Ok(())
}

fn validate_timestamp(field: &str, value: &str) -> Result<(), Diagnostic> {
    let is_utc = DateTime::parse_from_rfc3339(value)
        .is_ok_and(|parsed| parsed.offset().local_minus_utc() == 0);
    if is_utc {
        return Ok(());
    }
    Err(Diagnostic::parse(format!(
        "{field} must be a UTC RFC 3339 timestamp such as 2026-07-29T00:00:00Z; found {value}"
    )))
}

/// A validated timestamp as a comparable instant. Every timestamp is checked at
/// parse time, so an unparseable one here can only be a programming error; it
/// sorts first rather than panicking.
fn instant_of(timestamp: &str) -> DateTime<chrono::FixedOffset> {
    DateTime::parse_from_rfc3339(timestamp).unwrap_or(DateTime::UNIX_EPOCH.into())
}

fn joined(values: impl IntoIterator<Item = &'static str>) -> String {
    values.into_iter().collect::<Vec<_>>().join(", ")
}

fn yaml_diagnostic(prefix: &str, error: &serde_yaml::Error) -> Diagnostic {
    let diagnostic = Diagnostic::parse(format!("{prefix}: {error}"));
    match error.location() {
        Some(location) => diagnostic.at_line(location.line() as u32),
        None => diagnostic,
    }
}

fn reserved_role(trimmed: &str) -> Option<Role> {
    match trimmed {
        "## Checklist" => Some(Role::Checklist),
        "## Attachments" => Some(Role::Attachments),
        "## Activity" => Some(Role::Activity),
        _ => None,
    }
}

/// Splits the body into regions, and reports records that landed outside the
/// section that owns them.
///
/// Fenced code and bounded records are consumed whole, so nothing inside them can
/// look like a section boundary — or like a stray record. Detecting a misplaced
/// record here rather than in a second pass is what keeps a fenced example of a
/// record in a description from being reported as a real one.
fn split_chunks(body: &str, first_line: u32) -> (Vec<Chunk>, Vec<Diagnostic>) {
    let mut chunks: Vec<Chunk> = Vec::new();
    let mut misplaced = Vec::new();
    let mut current = Chunk {
        role: Role::Text,
        raw: String::new(),
        start_line: first_line,
    };
    let mut fence: Option<String> = None;
    let mut record_close: Option<&str> = None;

    for (offset, line) in lines_with_endings(body) {
        let number = first_line + offset - 1;
        let trimmed = line.trim();
        if let Some(close) = record_close {
            current.raw.push_str(line);
            if trimmed == close {
                record_close = None;
            }
            continue;
        }
        if let Some(marker) = &fence {
            current.raw.push_str(line);
            if trimmed.starts_with(marker.as_str()) {
                fence = None;
            }
            continue;
        }
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            fence = Some(trimmed.chars().take(3).collect());
            current.raw.push_str(line);
            continue;
        }
        if let Some((close, role, section)) = record_opener(trimmed) {
            record_close = Some(close);
            if current.role != role {
                misplaced.push(Diagnostic::parse_at(
                    format!(
                        "A {} record appears outside its {section} section",
                        label_of(role)
                    ),
                    number,
                ));
            }
            current.raw.push_str(line);
            continue;
        }
        if let Some(role) = reserved_role(trimmed) {
            chunks.push(std::mem::replace(
                &mut current,
                Chunk {
                    role,
                    raw: String::new(),
                    start_line: number,
                },
            ));
        }
        current.raw.push_str(line);
    }
    chunks.push(current);
    chunks.retain(|chunk| !chunk.raw.is_empty());
    (chunks, misplaced)
}

/// The closing marker, owning section, and heading for a record-opening line.
fn record_opener(trimmed: &str) -> Option<(&'static str, Role, &'static str)> {
    if trimmed.starts_with(EVENT_OPEN) {
        return Some((EVENT_CLOSE, Role::Activity, "## Activity"));
    }
    if trimmed.starts_with(ATTACHMENT_OPEN) {
        return Some((ATTACHMENT_CLOSE, Role::Attachments, "## Attachments"));
    }
    None
}

fn label_of(role: Role) -> &'static str {
    match role {
        Role::Activity => "activity",
        Role::Attachments => "attachment",
        Role::Text | Role::Checklist => "unknown",
    }
}

fn parse_checklist(raw: &str) -> Vec<ChecklistItem> {
    lines_with_endings(raw)
        .into_iter()
        .filter_map(|(_, line)| parse_checklist_line(line))
        .collect()
}

fn parse_checklist_line(line: &str) -> Option<ChecklistItem> {
    let trimmed = line.trim_start();
    let checked = match trimmed.get(..6)? {
        "- [ ] " => false,
        "- [x] " | "- [X] " => true,
        _ => return None,
    };
    let mut text = trimmed[6..].trim_end().to_owned();
    let mut id = None;
    if let Some(open) = text.find(ITEM_MARKER_OPEN) {
        let after = &text[open + ITEM_MARKER_OPEN.len()..];
        if let Some(close) = after.find(ITEM_MARKER_CLOSE) {
            let candidate = after[..close].trim();
            if !candidate.is_empty() && !candidate.contains(char::is_whitespace) {
                id = Some(candidate.to_owned());
                text = text[..open].trim_end().to_owned();
            }
        }
    }
    Some(ChecklistItem { id, text, checked })
}

/// Rewrites the lines a closure claims and leaves every other byte untouched.
fn rewrite_lines(raw: &str, mut rewrite: impl FnMut(&str) -> Option<String>) -> String {
    lines_with_endings(raw)
        .into_iter()
        .map(|(_, line)| rewrite(line).unwrap_or_else(|| line.to_owned()))
        .collect()
}

/// Where a new checklist line goes: right after the last existing item, so any
/// prose that follows the list stays below it.
fn insertion_offset_after_last_item(raw: &str) -> usize {
    let mut offset = 0;
    let mut insert_at = None;
    for (_, line) in lines_with_endings(raw) {
        offset += line.len();
        if parse_checklist_line(line).is_some() {
            insert_at = Some(offset);
        }
    }
    insert_at.unwrap_or(raw.len())
}

/// One bounded record's header YAML, Markdown body, and position.
struct RawRecord {
    header: String,
    body: String,
    header_line: u32,
}

fn collect_raw_records(
    chunk: &Chunk,
    open: &str,
    close: &str,
    label: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<RawRecord> {
    enum State {
        Outside,
        Header,
        Body,
    }
    let mut records = Vec::new();
    let mut state = State::Outside;
    let mut header = String::new();
    let mut body = String::new();
    let mut opened_at = 0;

    for (offset, line) in lines_with_endings(&chunk.raw) {
        let number = chunk.start_line + offset - 1;
        let trimmed = line.trim();
        match state {
            State::Outside => {
                if trimmed.starts_with(open) {
                    state = State::Header;
                    header.clear();
                    body.clear();
                    opened_at = number;
                }
            }
            State::Header => {
                if trimmed == HEADER_TERMINATOR {
                    state = State::Body;
                } else {
                    header.push_str(line);
                }
            }
            State::Body => {
                if trimmed == close {
                    records.push(RawRecord {
                        header: std::mem::take(&mut header),
                        body: std::mem::take(&mut body).trim().to_owned(),
                        header_line: opened_at + 1,
                    });
                    state = State::Outside;
                } else {
                    body.push_str(line);
                }
            }
        }
    }
    match state {
        State::Outside => {}
        State::Header => diagnostics.push(Diagnostic::parse_at(
            format!(
                "An {label} record is missing its closing {HEADER_TERMINATOR} header terminator"
            ),
            opened_at,
        )),
        State::Body => diagnostics.push(Diagnostic::parse_at(
            format!("An {label} record is missing its closing {close} marker"),
            opened_at,
        )),
    }
    records
}

#[derive(Debug, Deserialize)]
struct ActorHeader {
    #[serde(rename = "type")]
    actor_type: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

impl ActorHeader {
    fn into_actor(self) -> Result<Actor, String> {
        let actor_type = ActorType::parse(&self.actor_type).ok_or_else(|| {
            format!(
                "actor type must be one of {}; found {}",
                joined([
                    ActorType::Human.as_str(),
                    ActorType::Agent.as_str(),
                    ActorType::Unknown.as_str()
                ]),
                self.actor_type
            )
        })?;
        Ok(Actor {
            actor_type,
            id: self.id,
            name: self.name,
        })
    }
}

#[derive(Debug, Deserialize)]
struct EventHeader {
    id: String,
    kind: String,
    occurred_at: String,
    actor: ActorHeader,
    #[serde(default)]
    changes: Vec<ChangeHeader>,
}

#[derive(Debug, Deserialize)]
struct ChangeHeader {
    field: String,
    #[serde(default)]
    from: Option<String>,
    #[serde(default)]
    to: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AttachmentHeader {
    id: String,
    file: String,
    name: String,
    media_type: String,
    size: u64,
    added_at: String,
    added_by: ActorHeader,
}

fn collect_activity(
    chunk: &Chunk,
    activity: &mut Vec<ActivityEvent>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for record in collect_raw_records(chunk, EVENT_OPEN, EVENT_CLOSE, "activity", diagnostics) {
        match parse_event(&record) {
            Ok(event) => activity.push(event),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }
}

fn parse_event(record: &RawRecord) -> Result<ActivityEvent, Diagnostic> {
    let describe = |message: String| {
        Diagnostic::parse_at(
            format!("An activity record is invalid: {message}"),
            record.header_line,
        )
    };
    validate_subset(&record.header).map_err(|error| describe(error.message))?;
    let header: EventHeader =
        serde_yaml::from_str(&record.header).map_err(|error| describe(error.to_string()))?;
    require_non_empty("id", &header.id).map_err(|error| describe(error.message))?;
    validate_timestamp("occurred_at", &header.occurred_at)
        .map_err(|error| describe(error.message))?;
    let actor = header.actor.into_actor().map_err(describe)?;
    Ok(ActivityEvent {
        id: header.id,
        kind: EventKind::parse(&header.kind),
        occurred_at: header.occurred_at,
        actor,
        changes: header
            .changes
            .into_iter()
            .map(|change| FieldChange {
                field: change.field,
                from: change.from,
                to: change.to,
            })
            .collect(),
        body: record.body.clone(),
    })
}

fn collect_attachments(
    chunk: &Chunk,
    attachments: &mut Vec<Attachment>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for record in collect_raw_records(
        chunk,
        ATTACHMENT_OPEN,
        ATTACHMENT_CLOSE,
        "attachment",
        diagnostics,
    ) {
        match parse_attachment(&record) {
            Ok(attachment) => attachments.push(attachment),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }
}

fn parse_attachment(record: &RawRecord) -> Result<Attachment, Diagnostic> {
    let describe = |message: String| {
        Diagnostic::parse_at(
            format!("An attachment record is invalid: {message}"),
            record.header_line,
        )
    };
    validate_subset(&record.header).map_err(|error| describe(error.message))?;
    let header: AttachmentHeader =
        serde_yaml::from_str(&record.header).map_err(|error| describe(error.to_string()))?;
    validate_timestamp("added_at", &header.added_at).map_err(|error| describe(error.message))?;
    let file = header.file.replace('\\', "/");
    if file.starts_with('/') || file.split('/').any(|segment| segment == "..") {
        return Err(describe(format!(
            "file must be a relative path inside the ticket directory; found {}",
            header.file
        )));
    }
    let added_by = header.added_by.into_actor().map_err(describe)?;
    Ok(Attachment {
        id: header.id,
        file,
        name: header.name,
        media_type: header.media_type,
        size: header.size,
        added_at: header.added_at,
        added_by,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        render_new_ticket, ChecklistToggle, Priority, Status, TicketDocument, TicketEdit,
        TICKET_FORMAT,
    };

    const NOW: &str = "2026-07-30T10:00:00.000Z";

    const TICKET: &str = concat!(
        "---\n",
        "format: longclaw.ticket/v1\n",
        "id: 019c8ca0-0000-7000-8000-000000000001\n",
        "key: LC-1\n",
        "title: Load canonical ticket files\n",
        "status: todo\n",
        "priority: p2\n",
        "labels:\n",
        "  - storage\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "updated_at: 2026-07-29T00:00:00Z\n",
        "x_extension:\n",
        "  owner: future-version\n",
        "---\n",
        "\n",
        "The description, with a fence:\n",
        "\n",
        "```md\n",
        "## Activity\n",
        "```\n",
        "\n",
        "## Checklist\n",
        "\n",
        "- [ ] first <!-- longclaw:item=ck_0001 -->\n",
        "- [x] second <!-- longclaw:item=ck_0002 -->\n",
        "\n",
        "## Activity\n",
        "\n",
        "<!-- longclaw:event\n",
        "id: evt_0001\n",
        "kind: comment\n",
        "occurred_at: 2026-07-29T01:00:00Z\n",
        "actor:\n",
        "  type: agent\n",
        "  id: fixture-agent\n",
        "-->\n",
        "### Fixture Agent commented\n",
        "<!-- /longclaw:event -->\n",
    );

    fn document() -> TicketDocument {
        TicketDocument::parse(TICKET, "LC-1").expect("the fixture ticket should parse")
    }

    fn apply(edit: TicketEdit) -> (String, TicketDocument) {
        let applied = document()
            .apply(&edit, NOW)
            .expect("the edit should be accepted");
        (
            String::from_utf8(applied.bytes.clone()).expect("UTF-8 output"),
            applied.document,
        )
    }

    #[test]
    fn an_unmodified_document_renders_its_own_bytes() {
        assert_eq!(document().render(), TICKET);
    }

    #[test]
    fn the_description_stops_at_the_first_reserved_heading() {
        let ticket = document();
        assert_eq!(
            ticket.ticket().description,
            "The description, with a fence:\n\n```md\n## Activity\n```"
        );
        assert_eq!(ticket.ticket().checklist.len(), 2);
        assert_eq!(ticket.ticket().activity.len(), 1);
    }

    /// Every `field` value `apply` can write, pinned against the fixture the
    /// frontend reads.
    ///
    /// The timeline turns each of these into a sentence a human reads
    /// (`src/timelineEvents.ts`), and it can only do that for a field it knows —
    /// an unrecognised one falls back to showing its own path. So the list is
    /// written down once, in `tests/fixtures/ipc-contract.json`, and both sides
    /// assert against it: adding a field here goes red in
    /// `src/timelineEvents.test.ts` as well, rather than reaching a human as a
    /// raw wire value.
    #[test]
    fn json_contract_applied_field_changes() {
        let applied = document()
            .apply(
                &TicketEdit {
                    title: Some("Renamed by the fixture".to_owned()),
                    status: Some(Status::InReview),
                    priority: Some(Priority::Urgent),
                    labels: Some(vec!["storage".to_owned(), "reliability".to_owned()]),
                    rank: Some(Some("0|hzzzzz:".to_owned())),
                    archived: Some(true),
                    description: Some("A new description.".to_owned()),
                    checklist: vec![ChecklistToggle {
                        item_id: "ck_0001".to_owned(),
                        checked: true,
                    }],
                    add_checklist_items: vec!["Write the migration".to_owned()],
                    comment: None,
                },
                NOW,
            )
            .expect("the every-field edit should be accepted");

        let mut actual =
            serde_json::to_value(&applied.changes).expect("field changes must serialize");
        // An appended item's id is minted per write, so the fixture pins the
        // shape of the dotted path rather than the id inside it.
        for change in actual.as_array_mut().expect("an array of changes") {
            let field = change["field"].as_str().expect("a field name").to_owned();
            if field.ends_with(".added") {
                change["field"] = serde_json::json!("checklist.ck_minted.added");
            }
        }

        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/ipc-contract.json"))
                .expect("IPC contract fixture must be valid JSON");
        assert_eq!(
            actual, fixture["appliedFieldChanges"],
            "the set of fields an edit can write changed"
        );
    }

    #[test]
    fn a_status_change_rewrites_one_line_and_appends_one_event() {
        let (rendered, next) = apply(TicketEdit {
            status: Some(Status::InProgress),
            ..TicketEdit::default()
        });
        assert!(rendered.contains("status: in_progress\n"));
        assert!(rendered.contains("x_extension:\n  owner: future-version\n"));
        assert_eq!(next.ticket().updated_at, NOW);
        assert_eq!(next.ticket().activity.len(), 2);
        let event = next.ticket().last_activity().expect("appended event");
        assert_eq!(event.kind.as_str(), "update");
        assert_eq!(event.actor.id.as_deref(), Some("local"));
        assert_eq!(event.actor.name, None);
        assert_eq!(event.changes.len(), 1);
        assert_eq!(event.changes[0].field, "status");
        assert_eq!(event.changes[0].from.as_deref(), Some("todo"));
        assert_eq!(event.changes[0].to.as_deref(), Some("in_progress"));
        assert_eq!(
            rendered.matches("## Activity").count(),
            2,
            "one heading, one fenced mention"
        );
    }

    #[test]
    fn checking_an_item_flips_only_that_marker() {
        let (rendered, next) = apply(TicketEdit {
            checklist: vec![ChecklistToggle {
                item_id: "ck_0001".to_owned(),
                checked: true,
            }],
            ..TicketEdit::default()
        });
        assert!(rendered.contains("- [x] first <!-- longclaw:item=ck_0001 -->\n"));
        assert!(rendered.contains("- [x] second <!-- longclaw:item=ck_0002 -->\n"));
        assert_eq!(next.ticket().checked_count(), 2);
        let event = next.ticket().last_activity().expect("appended event");
        assert_eq!(event.changes[0].field, "checklist.ck_0001.checked");
    }

    #[test]
    fn unchecking_an_item_flips_it_back() {
        let (rendered, _) = apply(TicketEdit {
            checklist: vec![ChecklistToggle {
                item_id: "ck_0002".to_owned(),
                checked: false,
            }],
            ..TicketEdit::default()
        });
        assert!(rendered.contains("- [ ] second <!-- longclaw:item=ck_0002 -->\n"));
    }

    #[test]
    fn toggling_an_unknown_item_is_refused_before_anything_is_written() {
        let error = document()
            .apply(
                &TicketEdit {
                    checklist: vec![ChecklistToggle {
                        item_id: "ck_missing".to_owned(),
                        checked: true,
                    }],
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect_err("an unknown checklist item should be refused");
        assert!(error.message.contains("ck_missing"));
    }

    #[test]
    fn a_description_edit_keeps_every_reserved_section() {
        let (rendered, next) = apply(TicketEdit {
            description: Some("Rewritten by the app.".to_owned()),
            ..TicketEdit::default()
        });
        assert_eq!(next.ticket().description, "Rewritten by the app.");
        assert_eq!(next.ticket().checklist.len(), 2);
        assert_eq!(next.ticket().activity.len(), 2);
        assert!(rendered.contains("---\n\nRewritten by the app.\n\n## Checklist\n"));
    }

    #[test]
    fn archiving_and_unarchiving_leave_the_other_keys_alone() {
        let archived = document()
            .apply(
                &TicketEdit {
                    archived: Some(true),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("archiving should be accepted");
        let rendered = String::from_utf8(archived.bytes).expect("UTF-8");
        assert!(rendered.contains(&format!("updated_at: {NOW}\narchived_at: {NOW}\n")));
        assert_eq!(archived.document.ticket().archived_at.as_deref(), Some(NOW));
        assert!(archived.document.ticket().is_archived());

        let restored = archived
            .document
            .apply(
                &TicketEdit {
                    archived: Some(false),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("unarchiving should be accepted");
        assert_eq!(restored.document.ticket().archived_at, None);
        assert_eq!(
            restored.document.ticket().unknown_keys,
            document().ticket().unknown_keys
        );
    }

    #[test]
    fn setting_and_clearing_a_rank_leave_the_other_keys_alone() {
        let ranked = document()
            .apply(
                &TicketEdit {
                    rank: Some(Some("a0V".to_owned())),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("setting a rank should be accepted");
        let rendered = String::from_utf8(ranked.bytes).expect("UTF-8");
        assert!(rendered.contains("priority: p2\nrank: a0V\nlabels:\n  - storage\n"));
        assert_eq!(ranked.document.ticket().rank.as_deref(), Some("a0V"));

        let cleared = ranked
            .document
            .apply(
                &TicketEdit {
                    rank: Some(None),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("clearing a rank should be accepted");
        let rendered = String::from_utf8(cleared.bytes).expect("UTF-8");
        assert!(!rendered.contains("rank:"));
        assert_eq!(cleared.document.ticket().rank, None);
        assert_eq!(
            cleared.document.ticket().unknown_keys,
            document().ticket().unknown_keys
        );
        // Recorded the way `archived_at` removal is: the value that went, and no
        // replacement.
        assert_eq!(cleared.changes.len(), 1);
        assert_eq!(cleared.changes[0].field, "rank");
        assert_eq!(cleared.changes[0].from.as_deref(), Some("a0V"));
        assert_eq!(cleared.changes[0].to, None);
    }

    #[test]
    fn clearing_a_rank_that_is_already_absent_changes_nothing() {
        let error = document()
            .apply(
                &TicketEdit {
                    rank: Some(None),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect_err("there is no rank to clear");
        assert!(error.message.contains("already matches"), "{error}");
    }

    #[test]
    fn a_comment_only_edit_records_history_without_touching_state() {
        let (rendered, next) = apply(TicketEdit {
            comment: Some("Looked at this with fresh eyes.".to_owned()),
            ..TicketEdit::default()
        });
        assert!(rendered.contains("updated_at: 2026-07-29T00:00:00Z\n"));
        assert_eq!(next.ticket().updated_at, "2026-07-29T00:00:00Z");
        assert_eq!(next.ticket().status, Status::Todo);
        assert_eq!(next.ticket().activity.len(), 2);
        let event = next.ticket().last_activity().expect("appended comment");
        assert_eq!(event.kind.as_str(), "comment");
        assert_eq!(
            event.body,
            "### You commented\n\nLooked at this with fresh eyes."
        );
    }

    #[test]
    fn labels_can_be_replaced_and_cleared() {
        let (rendered, next) = apply(TicketEdit {
            labels: Some(vec!["reliability".to_owned(), "backend".to_owned()]),
            ..TicketEdit::default()
        });
        assert!(rendered.contains("labels:\n  - reliability\n  - backend\n"));
        assert_eq!(next.ticket().labels, vec!["reliability", "backend"]);

        let cleared = next
            .apply(
                &TicketEdit {
                    labels: Some(Vec::new()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("clearing labels should be accepted");
        assert!(cleared.document.ticket().labels.is_empty());
        assert!(!String::from_utf8(cleared.bytes)
            .expect("UTF-8")
            .contains("labels:"));
    }

    #[test]
    fn an_edit_that_matches_the_ticket_writes_nothing() {
        let error = document()
            .apply(
                &TicketEdit {
                    status: Some(Status::Todo),
                    title: Some("Load canonical ticket files".to_owned()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect_err("a no-op edit should be refused");
        assert!(error.message.contains("nothing was written"));
    }

    #[test]
    fn an_empty_edit_is_refused() {
        let error = document()
            .apply(&TicketEdit::default(), NOW)
            .expect_err("an empty edit should be refused");
        assert!(error.message.contains("change something"));
    }

    #[test]
    fn a_title_longer_than_the_limit_is_refused() {
        let error = document()
            .apply(
                &TicketEdit {
                    title: Some("x".repeat(301)),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect_err("an over-long title should be refused");
        assert!(error.message.contains("300"));
    }

    #[test]
    fn successive_writes_keep_the_file_shape_stable() {
        let first = document()
            .apply(
                &TicketEdit {
                    title: Some("First".to_owned()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("first write");
        let second = first
            .document
            .apply(
                &TicketEdit {
                    title: Some("Second".to_owned()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("second write");
        let rendered = String::from_utf8(second.bytes).expect("UTF-8");
        assert_eq!(rendered.matches("## Checklist").count(), 1);
        assert_eq!(rendered.matches("title:").count(), 1);
        assert_eq!(rendered.matches("updated_at:").count(), 1);
        assert_eq!(second.document.ticket().activity.len(), 3);
        assert_eq!(
            second.document.ticket().unknown_keys,
            vec!["x_extension".to_owned()]
        );
        assert!(rendered.ends_with("<!-- /longclaw:event -->\n"));
    }

    #[test]
    fn an_agent_task_without_an_id_is_adopted_on_the_next_write() {
        let raw = TICKET.replace(
            "- [x] second <!-- longclaw:item=ck_0002 -->\n",
            "- [x] second <!-- longclaw:item=ck_0002 -->\n- [ ] agent appended this\n",
        );
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        assert_eq!(document.ticket().checklist[2].id, None);

        let applied = document
            .apply(
                &TicketEdit {
                    title: Some("Adopted".to_owned()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("the write should be accepted");
        let adopted = &applied.document.ticket().checklist[2];
        assert_eq!(adopted.text, "agent appended this");
        assert!(!adopted.checked);
        assert!(adopted
            .id
            .as_ref()
            .is_some_and(|id| id.starts_with("ck_") && id.len() == 11));
    }

    #[test]
    fn a_new_checklist_item_lands_after_the_last_one() {
        let (rendered, next) = apply(TicketEdit {
            add_checklist_items: vec!["third".to_owned()],
            ..TicketEdit::default()
        });
        assert_eq!(next.ticket().checklist.len(), 3);
        assert_eq!(next.ticket().checklist[2].text, "third");
        let checklist_block = rendered
            .split("## Checklist\n")
            .nth(1)
            .expect("a checklist section");
        assert!(checklist_block.trim_start().starts_with("- [ ] first"));
        assert!(rendered.contains("- [ ] third <!-- longclaw:item=ck_"));
    }

    #[test]
    fn a_description_holding_a_reserved_heading_is_refused_rather_than_truncated() {
        // Written verbatim, this would start a second Checklist section and the next
        // read would see the description cut off at "Plan:".
        let error = document()
            .apply(
                &TicketEdit {
                    description: Some("Plan:\n\n## Checklist\n\nWe will add one later.".to_owned()),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect_err("a description cannot contain a reserved heading");
        assert!(error.message.contains("## Checklist"));
        // The original document is untouched, because nothing was written.
        assert_eq!(document().render(), TICKET);
    }

    #[test]
    fn a_description_may_quote_a_reserved_heading_inside_a_fence() {
        let (rendered, next) = apply(TicketEdit {
            description: Some(
                "Quoting the format:\n\n```md\n## Checklist\n\n- [ ] not real\n```".to_owned(),
            ),
            ..TicketEdit::default()
        });
        assert_eq!(
            next.ticket().description,
            "Quoting the format:\n\n```md\n## Checklist\n\n- [ ] not real\n```"
        );
        // The real checklist is still the only one, with both its items.
        assert_eq!(next.ticket().checklist.len(), 2);
        assert_eq!(rendered.matches("## Checklist").count(), 2);
        assert!(next.ticket().record_diagnostics.is_empty());
    }

    #[test]
    fn a_fenced_record_example_is_documentation_not_a_misplaced_record() {
        let raw = TICKET.replace(
            "The description, with a fence:",
            "How an agent writes one:\n\n```md\n<!-- longclaw:event\nid: evt_example\n-->\n<!-- /longclaw:event -->\n```\n\nAnd a fence:",
        );
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        assert!(
            document.ticket().record_diagnostics.is_empty(),
            "a quoted record must not be reported: {:?}",
            document.ticket().record_diagnostics
        );
        assert_eq!(document.ticket().activity.len(), 1);
        assert_eq!(document.render(), raw);
    }

    #[test]
    fn history_is_incomplete_when_state_is_newer_than_the_last_event() {
        // The fixture's comment is newer than its updated_at, so nothing is missing.
        assert!(!document().ticket().history_incomplete);

        // Someone changes the state without narrating it.
        let raw = TICKET.replace(
            "updated_at: 2026-07-29T00:00:00Z",
            "updated_at: 2026-07-29T02:00:00Z",
        );
        let unnarrated = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        assert!(unnarrated.ticket().history_incomplete);

        // An app write records what it changed, which closes the gap.
        let closed = unnarrated
            .apply(
                &TicketEdit {
                    status: Some(Status::InProgress),
                    ..TicketEdit::default()
                },
                NOW,
            )
            .expect("the write should be accepted");
        assert!(!closed.document.ticket().history_incomplete);
    }

    #[test]
    fn a_ticket_with_no_activity_has_incomplete_history() {
        let raw = TICKET
            .split("## Activity")
            .next()
            .expect("the body before the activity section")
            .to_owned();
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        assert!(document.ticket().activity.is_empty());
        assert!(document.ticket().history_incomplete);
    }

    #[test]
    fn events_sort_by_instant_even_when_precision_differs() {
        let raw = TICKET.replace(
            "<!-- /longclaw:event -->\n",
            concat!(
                "<!-- /longclaw:event -->\n",
                "\n",
                "<!-- longclaw:event\n",
                "id: evt_0002\n",
                "kind: comment\n",
                "occurred_at: 2026-07-29T01:00:00.500Z\n",
                "actor:\n",
                "  type: human\n",
                "  id: local\n",
                "-->\n",
                "### You commented\n",
                "<!-- /longclaw:event -->\n",
            ),
        );
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        let ids: Vec<&str> = document
            .ticket()
            .activity
            .iter()
            .map(|event| event.id.as_str())
            .collect();
        assert_eq!(ids, vec!["evt_0001", "evt_0002"]);
    }

    #[test]
    fn crlf_files_are_reported_rather_than_rewritten() {
        let error = TicketDocument::parse(&TICKET.replace('\n', "\r\n"), "LC-1")
            .expect_err("CRLF should be reported");
        assert!(error.message.contains("CRLF"));
    }

    #[test]
    fn an_unfamiliar_event_kind_is_preserved_rather_than_dropped() {
        let raw = TICKET.replace("kind: comment", "kind: some_future_kind");
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should parse");
        assert_eq!(
            document.ticket().activity[0].kind.as_str(),
            "some_future_kind"
        );
        assert!(document.ticket().record_diagnostics.is_empty());
        assert_eq!(document.render(), raw);
    }

    #[test]
    fn a_record_outside_its_section_is_reported_without_being_moved() {
        let raw = TICKET.replace(
            "## Activity\n\n<!-- longclaw:event",
            "## Attachments\n\n<!-- longclaw:event",
        );
        let document = TicketDocument::parse(&raw, "LC-1").expect("the ticket should still parse");
        assert!(document.ticket().activity.is_empty());
        assert_eq!(document.render(), raw);
        assert!(document.ticket().record_diagnostics[0]
            .message
            .contains("outside"));
    }

    #[test]
    fn a_new_ticket_parses_and_round_trips() {
        let rendered = super::render_new_ticket_with_labels(
            "LC-7",
            "Ship the storage engine",
            Status::Todo,
            Priority::P1,
            &["backend".to_owned(), "reliability".to_owned()],
            "Written from nothing.",
            &["Parse".to_owned(), "Write".to_owned()],
            NOW,
        );
        let document =
            TicketDocument::parse(&rendered, "LC-7").expect("a new ticket should be readable");
        let ticket = document.ticket();
        assert_eq!(document.render(), rendered);
        assert!(rendered.contains(&format!("format: {TICKET_FORMAT}\n")));
        assert_eq!(ticket.key, "LC-7");
        assert_eq!(ticket.title, "Ship the storage engine");
        assert_eq!(ticket.status, Status::Todo);
        assert_eq!(ticket.priority, Priority::P1);
        assert_eq!(ticket.labels, vec!["backend", "reliability"]);
        assert_eq!(ticket.description, "Written from nothing.");
        assert_eq!(ticket.checklist.len(), 2);
        assert!(ticket.checklist.iter().all(|item| item.id.is_some()));
        assert_eq!(ticket.created_at, NOW);
        assert_eq!(ticket.updated_at, NOW);
        assert_eq!(ticket.activity.len(), 1);
        assert_eq!(ticket.activity[0].kind.as_str(), "create");
        assert!(ticket.unknown_keys.is_empty());
        assert!(ticket.record_diagnostics.is_empty());
    }

    #[test]
    fn a_new_ticket_with_a_colon_in_its_title_is_quoted_and_reads_back() {
        let rendered = render_new_ticket(
            "LC-8",
            "Fix: the sync worker",
            Status::Backlog,
            Priority::None,
            "",
            &[],
            NOW,
        );
        assert!(rendered.contains("title: \"Fix: the sync worker\"\n"));
        let document = TicketDocument::parse(&rendered, "LC-8").expect("should parse");
        assert_eq!(document.ticket().title, "Fix: the sync worker");
        assert_eq!(document.ticket().description, "");
    }
}
