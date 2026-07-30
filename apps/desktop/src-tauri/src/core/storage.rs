//! Filesystem access for a project: scanning, reading, and writing.
//!
//! Rust owns every path decision (ADR 0009). Callers name a project root and a
//! ticket key; this module canonicalizes, refuses anything that escapes the
//! project, and performs the read or write.
//!
//! Three rules shape the write path:
//!
//! - Writes are atomic: a sibling temporary file, then a rename.
//! - A write carries the content hash the edit started from. A newer file on disk
//!   is a conflict, never an overwrite.
//! - A file this build cannot parse, or one from a newer format version, is never
//!   rewritten at all.

use std::collections::BTreeSet;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use uuid::Uuid;
use walkdir::WalkDir;

use super::error::{AppError, AppResult, Diagnostic, ErrorCode};
use super::model::{
    ActivitySummary, DegradedRow, IndexedRow, TicketDetail, TicketRow, TicketWrite,
};
use super::project::{
    is_project_key, is_theme_id, render_agent_contract, render_new_project, ProjectDocument,
    DEFAULT_THEME,
};
use super::ticket::{render_new_ticket, Priority, Status, Ticket, TicketDocument, TicketEdit};

const PROJECT_DIRECTORY: &str = ".longclaw";
const PROJECT_FILE: &str = "longclaw.yaml";
const TICKETS_DIRECTORY: &str = "tickets";
const TICKET_FILE: &str = "ticket.md";
const ATTACHMENTS_DIRECTORY: &str = "attachments";
const AGENT_CONTRACT_FILE: &str = "AGENTS.md";
/// Bounds how much of a description the index keeps for search.
const SEARCH_TEXT_LIMIT: usize = 4_096;
/// Bounds how much of an unreadable file the raw view carries across IPC.
const RAW_VIEW_LIMIT: usize = 256 * 1024;

pub fn content_hash(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn project_file_path(project_root: &Path) -> PathBuf {
    project_root.join(PROJECT_DIRECTORY).join(PROJECT_FILE)
}

pub fn tickets_root(project_root: &Path) -> PathBuf {
    project_root.join(PROJECT_DIRECTORY).join(TICKETS_DIRECTORY)
}

/// The canonical ticket file inside a ticket directory.
pub fn ticket_file_path(tickets_root: &Path, key: &str) -> PathBuf {
    tickets_root.join(key).join(TICKET_FILE)
}

pub fn agent_contract_path(project_root: &Path) -> PathBuf {
    project_root
        .join(PROJECT_DIRECTORY)
        .join(AGENT_CONTRACT_FILE)
}

/// `<PREFIX>-<n>`, where the prefix is the project key and `n` has no leading
/// zero. Anything else cannot be a ticket directory, which is what stops a
/// caller-supplied key from becoming a path.
///
/// The prefix is held to `project::is_project_key` rather than a looser local
/// rule. When the two disagreed, this validator accepted ticket directories
/// under a key that project creation refused.
pub fn valid_ticket_key(key: &str) -> bool {
    let Some((prefix, sequence)) = key.split_once('-') else {
        return false;
    };
    is_project_key(prefix)
        && !sequence.is_empty()
        && sequence.bytes().all(|byte| byte.is_ascii_digit())
        && !sequence.starts_with('0')
        && !sequence.contains('-')
}

fn key_error(key: &str) -> AppError {
    AppError::new(
        ErrorCode::PermissionDenied,
        "Ticket key is outside the allowed key grammar",
        false,
    )
    .with_context("ticketKey", key.to_owned())
}

/// The canonical path of an existing ticket, proven to live inside the project.
pub fn resolve_ticket_path(project_root: &Path, key: &str) -> AppResult<PathBuf> {
    if !valid_ticket_key(key) {
        return Err(key_error(key));
    }
    let canonical_tickets = canonical_tickets_root(project_root)?;
    let requested = canonical_tickets.join(key).join(TICKET_FILE);
    let canonical = requested.canonicalize().map_err(|error| {
        let code = if error.kind() == std::io::ErrorKind::NotFound {
            ErrorCode::TicketNotFound
        } else {
            ErrorCode::Io
        };
        AppError::new(
            code,
            format!("Ticket {key} is not available: {error}"),
            true,
        )
        .with_context("ticketKey", key.to_owned())
    })?;
    if !canonical.starts_with(&canonical_tickets) || !canonical.is_file() {
        return Err(AppError::new(
            ErrorCode::PermissionDenied,
            "Resolved ticket path escapes the selected project",
            false,
        )
        .with_context("ticketKey", key.to_owned()));
    }
    Ok(canonical)
}

fn canonical_tickets_root(project_root: &Path) -> AppResult<PathBuf> {
    let canonical_root = project_root
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing project folder", project_root, error))?;
    let tickets = tickets_root(&canonical_root);
    tickets
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing tickets folder", &tickets, error))
}

// -------------------------------------------------------------------- reading

pub fn read_project(project_root: &Path) -> AppResult<ProjectDocument> {
    let path = project_file_path(project_root);
    let bytes =
        fs::read(&path).map_err(|error| AppError::io("Reading project metadata", &path, error))?;
    let raw = String::from_utf8(bytes).map_err(|error| {
        AppError::new(
            ErrorCode::InvalidProject,
            format!("{PROJECT_FILE} is not UTF-8: {error}"),
            true,
        )
        .with_context("path", path.display().to_string())
    })?;
    ProjectDocument::parse(&raw).map_err(|diagnostic| {
        let code = if diagnostic.code == ErrorCode::UnsupportedVersion {
            ErrorCode::UnsupportedVersion
        } else {
            ErrorCode::InvalidProject
        };
        AppError::new(code, diagnostic.message, true)
            .with_context("path", path.display().to_string())
    })
}

/// One ticket file as read: its bytes, its hash, and either the parsed document or
/// the diagnostic explaining why it could not be read.
pub struct TicketFile {
    pub key: String,
    pub path: PathBuf,
    pub relative_path: String,
    pub content_hash: String,
    pub byte_length: usize,
    /// The file as it is on disk. Invalid UTF-8 is replaced for display only; the
    /// bytes themselves are never rewritten.
    pub raw: String,
    pub parsed: Result<TicketDocument, Diagnostic>,
}

impl TicketFile {
    pub fn row(&self) -> TicketRow {
        match &self.parsed {
            Ok(document) => TicketRow::Indexed(self.indexed_row(document.ticket())),
            Err(diagnostic) => TicketRow::Degraded(DegradedRow {
                key: self.key.clone(),
                content_hash: self.content_hash.clone(),
                relative_path: self.relative_path.clone(),
                byte_length: self.byte_length,
                read_only: diagnostic.is_read_only(),
                diagnostic: diagnostic.clone(),
            }),
        }
    }

    fn indexed_row(&self, ticket: &Ticket) -> IndexedRow {
        IndexedRow {
            key: ticket.key.clone(),
            id: ticket.id.clone(),
            title: ticket.title.clone(),
            status: ticket.status,
            priority: ticket.priority,
            labels: ticket.labels.clone(),
            rank: ticket.rank.clone(),
            created_at: ticket.created_at.clone(),
            updated_at: ticket.updated_at.clone(),
            archived_at: ticket.archived_at.clone(),
            checked_count: ticket.checked_count(),
            checklist_count: ticket.checklist.len(),
            comment_count: ticket
                .activity
                .iter()
                .filter(|event| event.kind.as_str() == "comment")
                .count(),
            attachment_count: ticket.attachments.len(),
            last_activity: ticket.last_activity().map(|event| ActivitySummary {
                id: event.id.clone(),
                kind: event.kind.as_str().to_owned(),
                occurred_at: event.occurred_at.clone(),
                actor: event.actor.clone(),
            }),
            content_hash: self.content_hash.clone(),
            relative_path: self.relative_path.clone(),
            record_diagnostics: ticket.record_diagnostics.clone(),
        }
    }

    /// What search matches on. Bounded so a long description cannot make the index
    /// grow without limit.
    pub fn search_text(&self) -> String {
        let mut parts = vec![self.key.clone()];
        if let Ok(document) = &self.parsed {
            let ticket = document.ticket();
            parts.push(ticket.title.clone());
            parts.extend(ticket.labels.iter().cloned());
            parts.push(ticket.description.clone());
        }
        truncate_on_char_boundary(collapse_whitespace(&parts.join(" ")), SEARCH_TEXT_LIMIT)
    }
}

/// Reads one ticket file. A read never fails as a whole: an unreadable file
/// becomes a degraded record carrying its raw bytes and a diagnostic.
pub fn read_ticket_file(path: &Path) -> AppResult<TicketFile> {
    let bytes = fs::read(path).map_err(|error| AppError::io("Reading ticket", path, error))?;
    let key = directory_key(path).ok_or_else(|| {
        AppError::new(
            ErrorCode::ParseFailed,
            "A ticket directory must have a UTF-8 name",
            false,
        )
        .with_context("path", path.display().to_string())
    })?;
    let relative_path = relative_ticket_path(&key);
    let content_hash = content_hash(&bytes);
    let byte_length = bytes.len();
    let (raw, parsed) = match std::str::from_utf8(&bytes) {
        Ok(raw) => (raw.to_owned(), TicketDocument::parse(raw, &key)),
        Err(error) => (
            String::from_utf8_lossy(&bytes).into_owned(),
            Err(Diagnostic::parse(format!(
                "{TICKET_FILE} is not UTF-8 and was left untouched: {error}"
            ))),
        ),
    };
    Ok(TicketFile {
        key,
        path: path.to_path_buf(),
        relative_path,
        content_hash,
        byte_length,
        raw,
        parsed,
    })
}

/// The ticket key a canonical path belongs to: its parent directory's name.
pub fn directory_key(ticket_path: &Path) -> Option<String> {
    ticket_path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .map(str::to_owned)
}

/// A ticket's path relative to the project folder. Derived from the key rather
/// than by subtracting one path from another, which on macOS would depend on
/// whether the root had been resolved through its symlinks.
fn relative_ticket_path(key: &str) -> String {
    format!("{PROJECT_DIRECTORY}/{TICKETS_DIRECTORY}/{key}/{TICKET_FILE}")
}

/// Reduces every run of whitespace to one space, lowercased.
///
/// Descriptions are hard-wrapped by the humans and agents writing them, so a
/// query has to match across a line break: searching for "watcher coalescing"
/// should find a sentence that happens to wrap between those two words.
pub fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn truncate_on_char_boundary(mut text: String, limit: usize) -> String {
    if text.len() <= limit {
        return text;
    }
    let boundary = (0..=limit)
        .rev()
        .find(|index| text.is_char_boundary(*index))
        .unwrap_or(0);
    text.truncate(boundary);
    text
}

/// Every canonical ticket file in the project, in key order.
///
/// Symlinks are not followed, so a link pointing outside the project is skipped
/// rather than read.
pub fn scan_ticket_paths(project_root: &Path) -> AppResult<Vec<PathBuf>> {
    let tickets = tickets_root(project_root);
    if !tickets.is_dir() {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            format!("Project is missing {PROJECT_DIRECTORY}/{TICKETS_DIRECTORY}"),
            true,
        )
        .with_context("path", tickets.display().to_string()));
    }
    let mut paths: Vec<PathBuf> = WalkDir::new(&tickets)
        .min_depth(2)
        .max_depth(2)
        .follow_links(false)
        .sort_by_file_name()
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == TICKET_FILE)
        .map(|entry| entry.into_path())
        .collect();
    paths.sort();
    Ok(paths)
}

/// Every directory name under `tickets/`, whether or not it holds a readable
/// ticket. Key allocation reads this rather than the index, so a number is never
/// reused because a ticket was archived or became unreadable.
fn scan_ticket_directory_names(project_root: &Path) -> AppResult<BTreeSet<String>> {
    let tickets = tickets_root(project_root);
    let entries = fs::read_dir(&tickets)
        .map_err(|error| AppError::io("Listing ticket directories", &tickets, error))?;
    let mut names = BTreeSet::new();
    for entry in entries {
        let entry =
            entry.map_err(|error| AppError::io("Listing ticket directories", &tickets, error))?;
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            if let Some(name) = entry.file_name().to_str() {
                names.insert(name.to_owned());
            }
        }
    }
    Ok(names)
}

/// The full record behind the ticket panel, including the raw file and the state
/// of the attachment directory.
pub fn read_ticket_detail(project_root: &Path, key: &str) -> AppResult<TicketDetail> {
    let path = resolve_ticket_path(project_root, key)?;
    let file = read_ticket_file(&path)?;
    let ticket = file
        .parsed
        .as_ref()
        .ok()
        .map(|document| document.ticket().clone());
    let diagnostic = file.parsed.as_ref().err().cloned();
    let (missing_attachments, orphan_attachments) = match &ticket {
        Some(ticket) => attachment_state(&path, ticket),
        None => (Vec::new(), Vec::new()),
    };
    let truncated = file.raw.len() > RAW_VIEW_LIMIT;
    let raw = truncate_on_char_boundary(file.raw, RAW_VIEW_LIMIT);
    Ok(TicketDetail {
        key: file.key,
        relative_path: file.relative_path,
        content_hash: file.content_hash,
        byte_length: file.byte_length,
        read_only: diagnostic.as_ref().is_some_and(Diagnostic::is_read_only),
        ticket,
        diagnostic,
        raw,
        raw_truncated: truncated,
        missing_attachments,
        orphan_attachments,
    })
}

/// Registry entries whose bytes are gone, and bytes with no registry entry.
/// Neither is repaired here: a missing file keeps its metadata and an orphan file
/// is surfaced for recovery, never deleted.
fn attachment_state(ticket_path: &Path, ticket: &Ticket) -> (Vec<String>, Vec<String>) {
    let directory = match ticket_path.parent() {
        Some(parent) => parent.join(ATTACHMENTS_DIRECTORY),
        None => return (Vec::new(), Vec::new()),
    };
    let mut on_disk = BTreeSet::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            if entry.file_type().is_ok_and(|kind| kind.is_file()) {
                if let Some(name) = entry.file_name().to_str() {
                    on_disk.insert(format!("{ATTACHMENTS_DIRECTORY}/{name}"));
                }
            }
        }
    }
    let registered: BTreeSet<String> = ticket
        .attachments
        .iter()
        .map(|attachment| attachment.file.clone())
        .collect();
    let missing = ticket
        .attachments
        .iter()
        .filter(|attachment| !on_disk.contains(&attachment.file))
        .map(|attachment| attachment.id.clone())
        .collect();
    let orphans = on_disk.difference(&registered).cloned().collect();
    (missing, orphans)
}

// -------------------------------------------------------------------- writing

/// Writes `bytes` to `path` by writing a sibling temporary file and renaming it,
/// so a reader sees either the old file or the new one and never a partial write.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path.parent().ok_or_else(|| {
        AppError::new(
            ErrorCode::PermissionDenied,
            "Atomic writes need a sibling temporary file",
            false,
        )
    })?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(TICKET_FILE);
    let temporary = parent.join(format!(".{name}.longclaw-{}.tmp", Uuid::new_v4()));
    let result = (|| -> AppResult<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| AppError::io("Creating sibling temporary file", &temporary, error))?;
        file.write_all(bytes)
            .map_err(|error| AppError::io("Writing sibling temporary file", &temporary, error))?;
        file.sync_all()
            .map_err(|error| AppError::io("Syncing sibling temporary file", &temporary, error))?;
        if let Ok(metadata) = fs::metadata(path) {
            fs::set_permissions(&temporary, metadata.permissions())
                .map_err(|error| AppError::io("Preserving file permissions", &temporary, error))?;
        }
        fs::rename(&temporary, path)
            .map_err(|error| AppError::io("Atomically replacing file", path, error))?;
        File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| AppError::io("Syncing directory", parent, error))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

/// Reads a ticket, applies `edit`, and returns the bytes to write. Nothing is
/// written here: the caller records its self-write receipt first, so the watcher
/// can recognize the change as its own.
pub fn prepare_ticket_edit(
    project_root: &Path,
    key: &str,
    edit: &TicketEdit,
    expected_hash: &str,
    now: &str,
) -> AppResult<TicketWrite> {
    let path = resolve_ticket_path(project_root, key)?;
    let file = read_ticket_file(&path)?;
    if file.content_hash != expected_hash {
        return Err(conflict_error(&file, expected_hash));
    }
    let document = file.parsed.map_err(|diagnostic| {
        let refusal = if diagnostic.is_read_only() {
            format!(
                "{key} uses a newer ticket format. This build shows it read-only rather than \
                 rewriting it: {}",
                diagnostic.message
            )
        } else {
            format!(
                "LongClaw will not rewrite a ticket it cannot parse. Fix {key} in an editor \
                 first: {}",
                diagnostic.message
            )
        };
        AppError::from(Diagnostic {
            code: diagnostic.code,
            message: refusal,
            line: diagnostic.line,
        })
        .with_context("ticketKey", key.to_owned())
    })?;
    let applied = document.apply(edit, now).map_err(|diagnostic| {
        AppError::from(diagnostic).with_context("ticketKey", key.to_owned())
    })?;
    Ok(TicketWrite {
        key: key.to_owned(),
        path,
        bytes: applied.bytes,
        changes: applied.changes,
    })
}

/// A stale edit is never written over a newer file. The context carries who
/// changed it and when, so the conflict banner can say so.
fn conflict_error(file: &TicketFile, expected_hash: &str) -> AppError {
    let mut error = AppError::new(
        ErrorCode::Conflict,
        "This ticket changed on disk while you were editing. \
         Reload it or keep your version, then save again.",
        true,
    )
    .with_context("ticketKey", file.key.clone())
    .with_context("expectedHash", expected_hash.to_owned())
    .with_context("actualHash", file.content_hash.clone());
    if let Ok(document) = &file.parsed {
        error = error.with_context("actualUpdatedAt", document.ticket().updated_at.clone());
        if let Some(event) = document.ticket().last_activity() {
            error = error
                .with_context("conflictingAt", event.occurred_at.clone())
                .with_context("conflictingActorType", event.actor.actor_type.as_str());
            if let Some(name) = event.actor.name.clone().or_else(|| event.actor.id.clone()) {
                error = error.with_context("conflictingActorName", name);
            }
        }
    }
    error
}

/// What a caller asks for when creating a ticket. The key is allocated here, not
/// requested.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewTicket {
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub status: Option<Status>,
    pub priority: Option<Priority>,
    #[serde(default)]
    pub checklist: Vec<String>,
}

/// Allocates the next key, creates the ticket directory, and returns the bytes to
/// write. The caller must hold the project's creation lock.
///
/// The scan reads canonical directory names rather than the disposable index, and
/// the directory is created with `create_new` semantics, so two racing creations
/// cannot claim the same key and a number is never reused.
pub fn prepare_new_ticket(
    project_root: &Path,
    project_key: &str,
    request: &NewTicket,
    now: &str,
) -> AppResult<TicketWrite> {
    let title = request.title.trim();
    if title.is_empty() || title.chars().count() > 300 || title.contains('\n') {
        return Err(AppError::new(
            ErrorCode::ParseFailed,
            "A title is a single line of 1 to 300 characters",
            true,
        ));
    }
    let tickets = tickets_root(project_root);
    if !tickets.is_dir() {
        fs::create_dir_all(&tickets)
            .map_err(|error| AppError::io("Creating the tickets folder", &tickets, error))?;
    }
    let taken = scan_ticket_directory_names(project_root)?;
    let mut sequence = taken
        .iter()
        .filter_map(|name| next_sequence_of(name, project_key))
        .max()
        .unwrap_or(0)
        + 1;

    for _ in 0..64 {
        let key = format!("{project_key}-{sequence}");
        if !valid_ticket_key(&key) {
            return Err(key_error(&key));
        }
        let directory = tickets.join(&key);
        match fs::create_dir(&directory) {
            Ok(()) => {
                let path = directory.join(TICKET_FILE);
                let rendered = render_new_ticket(
                    &key,
                    title,
                    request.status.unwrap_or(Status::Todo),
                    request.priority.unwrap_or(Priority::None),
                    &request.description,
                    &request.checklist,
                    now,
                );
                // The claimed directory goes back if the request would produce a
                // file this build cannot read, or one whose description a reserved
                // heading would cut short. The number stays spent either way.
                let checked = TicketDocument::parse(&rendered, &key)
                    .map_err(AppError::from)
                    .and_then(|document| {
                        if document.ticket().description == request.description.trim() {
                            Ok(())
                        } else {
                            Err(AppError::new(
                                ErrorCode::ParseFailed,
                                "A description cannot contain a reserved heading \
                                 (## Checklist, ## Attachments, or ## Activity), because that \
                                 starts a section. Indent it or wrap it in a code fence.",
                                true,
                            ))
                        }
                    });
                if let Err(error) = checked {
                    discard_claimed_ticket_directory(&path);
                    return Err(error);
                }
                return Ok(TicketWrite {
                    key,
                    path,
                    bytes: rendered.into_bytes(),
                    changes: Vec::new(),
                });
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => sequence += 1,
            Err(error) => {
                return Err(AppError::io(
                    "Creating the ticket directory",
                    &directory,
                    error,
                ))
            }
        }
    }
    Err(AppError::new(
        ErrorCode::Io,
        "Could not claim a free ticket key",
        true,
    ))
}

fn next_sequence_of(directory_name: &str, project_key: &str) -> Option<u64> {
    directory_name
        .strip_prefix(project_key)?
        .strip_prefix('-')?
        .parse()
        .ok()
}

/// Removes a ticket directory that was claimed but never written, so a failed
/// creation does not leave an empty directory behind. The key stays spent.
pub fn discard_claimed_ticket_directory(ticket_path: &Path) {
    if let Some(directory) = ticket_path.parent() {
        // remove_dir only succeeds while the directory is empty, so a partially
        // written ticket is never destroyed by a cleanup.
        let _ = fs::remove_dir(directory);
    }
}

/// Creates `.longclaw/` for a folder that is not a project yet.
pub fn initialize_project(
    project_root: &Path,
    name: &str,
    key: &str,
    theme: Option<&str>,
    now: &str,
) -> AppResult<ProjectDocument> {
    let project_path = project_file_path(project_root);
    if project_path.exists() {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            "This folder already holds a LongClaw project",
            true,
        )
        .with_context("path", project_path.display().to_string()));
    }
    // Refuse a bad key or theme before creating anything. These two come from a
    // create form, so they are the user's to fix, and a folder they chose must
    // look untouched when they fix it. Only after this can the render fail, and a
    // failure there is a programmer fault rather than something a form can fix.
    let theme = theme.unwrap_or(DEFAULT_THEME);
    if name.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            "Project name is required",
            true,
        ));
    }
    if !is_project_key(key) {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            "Project key must start with a letter and use only uppercase letters and digits, \
             such as LC",
            true,
        )
        .with_context("projectKey", key.to_owned()));
    }
    if !is_theme_id(theme) {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            "Theme must be a preset id with no spaces, such as indigo",
            true,
        )
        .with_context("theme", theme.to_owned()));
    }

    let rendered = render_new_project(&Uuid::new_v4().to_string(), name.trim(), key, theme, now);
    let document = ProjectDocument::parse(&rendered)
        .map_err(|diagnostic| AppError::new(ErrorCode::Internal, diagnostic.message, false))?;

    let tickets = tickets_root(project_root);
    fs::create_dir_all(&tickets)
        .map_err(|error| AppError::io("Creating the project folder", &tickets, error))?;
    atomic_write(&project_path, rendered.as_bytes())?;
    write_agent_contract(project_root, &document)?;
    Ok(document)
}

/// Writes the generated agent-facing contract. LongClaw owns
/// `.longclaw/AGENTS.md` and never touches a repository-root `AGENTS.md`.
pub fn write_agent_contract(project_root: &Path, document: &ProjectDocument) -> AppResult<()> {
    let contract = render_agent_contract(document.project());
    atomic_write(&agent_contract_path(project_root), contract.as_bytes())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{
        read_ticket_detail, read_ticket_file, resolve_ticket_path, scan_ticket_paths,
        valid_ticket_key,
    };
    use crate::core::ErrorCode;

    #[test]
    fn the_key_grammar_rejects_path_shaped_inputs() {
        assert!(valid_ticket_key("LC-42"));
        assert!(valid_ticket_key("LC2-42"));
        assert!(!valid_ticket_key("../LC-42"));
        assert!(!valid_ticket_key("LC/42"));
        assert!(!valid_ticket_key("lc-42"));
        assert!(!valid_ticket_key("LC-0"));
        assert!(!valid_ticket_key("LC-42-1"));
        assert!(!valid_ticket_key("LC-"));
        assert!(!valid_ticket_key("-42"));
        assert!(!valid_ticket_key("LC"));
        assert!(!valid_ticket_key(""));
    }

    #[cfg(unix)]
    #[test]
    fn a_ticket_symlink_that_escapes_the_project_is_refused_and_left_in_place() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        let tickets = project.join(".longclaw/tickets");
        let outside = temp.path().join("outside");
        fs::create_dir_all(&tickets).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("ticket.md"), "not in the project").unwrap();
        symlink(&outside, tickets.join("LC-1")).unwrap();

        let error = resolve_ticket_path(&project, "LC-1").unwrap_err();
        assert_eq!(error.code, ErrorCode::PermissionDenied);
        assert!(outside.join("ticket.md").is_file());
        assert!(scan_ticket_paths(&project).unwrap().is_empty());
    }

    #[test]
    fn a_file_that_is_not_utf8_becomes_a_degraded_record_with_its_bytes_intact() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join(".longclaw/tickets/LC-1");
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("ticket.md");
        fs::write(&path, [0xff, 0xfe, b'h', b'i']).unwrap();

        let file = read_ticket_file(&path).unwrap();
        assert_eq!(file.key, "LC-1");
        assert_eq!(file.relative_path, ".longclaw/tickets/LC-1/ticket.md");
        let diagnostic = file.parsed.as_ref().expect_err("should be degraded");
        assert!(diagnostic.message.contains("UTF-8"));
        assert_eq!(fs::read(&path).unwrap(), [0xff, 0xfe, b'h', b'i']);
    }

    #[test]
    fn a_registered_attachment_with_no_bytes_is_reported_and_an_orphan_file_is_kept() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join(".longclaw/tickets/LC-1");
        fs::create_dir_all(directory.join("attachments")).unwrap();
        fs::write(
            directory.join("ticket.md"),
            concat!(
                "---\n",
                "format: longclaw.ticket/v1\n",
                "id: storage-attachments\n",
                "key: LC-1\n",
                "title: Attachment states\n",
                "status: todo\n",
                "priority: none\n",
                "created_at: 2026-07-29T00:00:00Z\n",
                "updated_at: 2026-07-29T00:00:00Z\n",
                "---\n",
                "\n",
                "## Attachments\n",
                "\n",
                "<!-- longclaw:attachment\n",
                "id: att_gone\n",
                "file: attachments/att_gone-missing.txt\n",
                "name: missing.txt\n",
                "media_type: text/plain\n",
                "size: 3\n",
                "added_at: 2026-07-29T00:00:00Z\n",
                "added_by:\n",
                "  type: human\n",
                "  id: local\n",
                "-->\n",
                "[missing.txt](./attachments/att_gone-missing.txt)\n",
                "<!-- /longclaw:attachment -->\n",
            ),
        )
        .unwrap();
        fs::write(directory.join("attachments/stray.txt"), "stray").unwrap();

        let detail = read_ticket_detail(temp.path(), "LC-1").unwrap();
        assert_eq!(detail.missing_attachments, vec!["att_gone".to_owned()]);
        assert_eq!(
            detail.orphan_attachments,
            vec!["attachments/stray.txt".to_owned()]
        );
        assert!(directory.join("attachments/stray.txt").is_file());
        assert!(!detail.raw_truncated);
        assert!(detail.ticket.is_some());
        assert!(detail.diagnostic.is_none());
    }
}
