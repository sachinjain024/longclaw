//! Filesystem access for a project: scanning, reading, and writing.
//!
//! Rust owns every path decision (ADR 0009). Callers name a project root and a
//! ticket key; this module canonicalizes, refuses anything that escapes the
//! project, and performs the read or write.
//!
//! Three rules shape the write path:
//!
//! - Writes are atomic: a sibling temporary file, then a rename.
//! - A write carries the content hash the edit started from, and it is checked
//!   twice — once before the write, and again *as* the write happens, against the
//!   bytes the replacement actually displaced. A newer file on disk is a conflict,
//!   never an overwrite, however late it arrived. See [`atomic_replace`].
//! - A file this build cannot parse, or one from a newer format version, is never
//!   rewritten at all.

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use sha2::{Digest, Sha256};
use uuid::Uuid;
use walkdir::WalkDir;

use super::error::{AppError, AppResult, Diagnostic, ErrorCode};
use super::model::{
    ActivitySummary, DegradedRow, IndexedRow, TicketDetail, TicketRow, TicketWrite,
};
use super::project::{
    is_project_key, is_project_name, is_theme_id, render_agent_contract, render_new_project,
    ProjectDocument, DEFAULT_THEME, PROJECT_NAME_RULE,
};
use super::ticket::{Priority, Status, Ticket, TicketDocument, TicketEdit};

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

/// Whether a ticket directory belongs to the project keyed `project_key`.
///
/// [`valid_ticket_key`] proves a key's *shape*; this proves *whose* it is. A
/// directory copied out of another project, or left behind by one that was
/// renamed, satisfies the grammar and is still not this project's ticket. The two
/// checks are separate on purpose: grammar is a property of the string, ownership
/// is a property of where the string sits.
pub fn belongs_to_project(project_key: &str, ticket_key: &str) -> bool {
    ticket_key
        .split_once('-')
        .is_some_and(|(prefix, _)| prefix == project_key)
}

/// Why a ticket directory that names another project is shown rather than indexed.
///
/// Written for someone looking at a folder rather than for a format implementer
/// (ADR 0010): it names the key that is there and the key this project uses, and
/// every repair it suggests is one the human performs. LongClaw does not rename or
/// move the directory, and the wording must never imply that it will.
pub fn foreign_project_diagnostic(project_key: &str, ticket_key: &str) -> Diagnostic {
    match ticket_key.split_once('-') {
        Some((prefix, _)) if !prefix.is_empty() => Diagnostic::parse(format!(
            "{ticket_key} is a ticket of project {prefix}, and this project's key is \
             {project_key}. The folder is shown as it is on disk and nothing in it has been \
             changed. Move it back to the {prefix} project, or rename the folder and its \
             key field to a {project_key}- key yourself."
        )),
        _ => Diagnostic::parse(format!(
            "{ticket_key} is not a ticket of project {project_key}. A ticket folder is named \
             {project_key}-<number>, like {project_key}-1. The folder is shown as it is on \
             disk and nothing in it has been changed."
        )),
    }
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

/// Reads one ticket file as a ticket of the project keyed `project_key`. A read
/// never fails as a whole: an unreadable file, or one belonging to another
/// project, becomes a degraded record carrying its raw bytes and a diagnostic.
///
/// The project key is a parameter rather than something derived from the path so
/// that no caller can read a ticket without saying which project it is reading
/// for. Every reader — rebuild, ingest, the detail panel, and the write path that
/// refuses to rewrite a degraded file — inherits the ownership check from here.
pub fn read_ticket_file(path: &Path, project_key: &str) -> AppResult<TicketFile> {
    read_ticket_file_owned_by(path, Some(project_key))
}

/// Reads a ticket file without deciding whether the project owns it.
///
/// Only the conflict path in [`atomic_replace`] uses this. It has just displaced
/// bytes at a path the caller already proved is this project's ticket, and it
/// re-reads the file only to name whoever wrote what it found there.
fn read_ticket_file_unowned(path: &Path) -> AppResult<TicketFile> {
    read_ticket_file_owned_by(path, None)
}

fn read_ticket_file_owned_by(path: &Path, project_key: Option<&str>) -> AppResult<TicketFile> {
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
    // Ownership is settled before the contents are believed, and a foreign
    // directory is never parsed: it is not this project's ticket whatever its
    // frontmatter says. The bytes still reach `raw`, so the raw-file view shows it.
    let foreign = project_key.filter(|owner| !belongs_to_project(owner, &key));
    let (raw, parsed) = match foreign {
        Some(owner) => (
            String::from_utf8_lossy(&bytes).into_owned(),
            Err(foreign_project_diagnostic(owner, &key)),
        ),
        None => match std::str::from_utf8(&bytes) {
            Ok(raw) => (raw.to_owned(), TicketDocument::parse(raw, &key)),
            Err(error) => (
                String::from_utf8_lossy(&bytes).into_owned(),
                Err(Diagnostic::parse(format!(
                    "{TICKET_FILE} is not UTF-8 and was left untouched: {error}"
                ))),
            ),
        },
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
///
/// Names are returned unfiltered, including ones belonging to another project.
/// Filtering happens at the one place that cares: `next_sequence_of` only counts a
/// name that starts with this project's key, so a foreign directory cannot push
/// this project's sequence forward. See `a_foreign_prefix_directory_does_not_spend_a_key`.
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
pub fn read_ticket_detail(
    project_root: &Path,
    project_key: &str,
    key: &str,
) -> AppResult<TicketDetail> {
    let path = resolve_ticket_path(project_root, key)?;
    let file = read_ticket_file(&path, project_key)?;
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
///
/// The rename replaces the destination unconditionally, which is right for a file
/// this process owns — project metadata, the agent contract, the registry, a
/// brand-new ticket. It is *not* right for replacing a ticket the user and an agent
/// can both write: use [`atomic_replace`] there.
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
        write_durable_sibling(&temporary, path, bytes)?;
        fs::rename(&temporary, path).map_err(|error| AppError::io("Saving ticket", path, error))?;
        sync_directory(parent, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

// ------------------------------------------------- replacing a file we validated

/// Hooks that let a test drive the replace window. Production never installs any:
/// `replace_seams()` returns the default until a test calls `install_replace_seams`.
///
/// This is a public seam for the same reason `WatcherAdapter::Polling` is one — the
/// behaviour under test is an interleaving, and a test that waits for it to happen
/// by luck is not evidence that it was handled.
///
/// The seam is installed on the calling thread and explicitly captured by the
/// engine before it submits a write to a blocking worker. This keeps independent
/// tests isolated while ensuring the worker still drives the intended interleaving.
/// What runs inside the replace window, given the path being replaced.
pub type BeforeSwap = Arc<dyn Fn(&Path) + Send + Sync>;

#[derive(Clone, Default)]
pub struct ReplaceSeams {
    /// Runs after the temporary file is durable and immediately before the swap,
    /// so a write it performs provably lands inside the validate-to-replace window.
    pub before_swap: Option<BeforeSwap>,
    /// Forces the no-swap path, for volumes that do not support `RENAME_SWAP`.
    pub force_swap_unsupported: bool,
}

thread_local! {
    static REPLACE_SEAMS: RefCell<Option<ReplaceSeams>> = const { RefCell::new(None) };
}

pub fn install_replace_seams(seams: ReplaceSeams) {
    REPLACE_SEAMS.with(|cell| *cell.borrow_mut() = Some(seams));
}

pub fn clear_replace_seams() {
    REPLACE_SEAMS.with(|cell| *cell.borrow_mut() = None);
}

pub fn replace_seams_for_worker() -> ReplaceSeams {
    REPLACE_SEAMS.with(|cell| cell.borrow().clone().unwrap_or_default())
}

/// Whether this build can exchange two paths atomically.
///
/// macOS gives us `renamex_np(RENAME_SWAP)`. Nothing else does, and rather than
/// pretend, the caller refuses the write — see `swap_unsupported_error`.
#[cfg(target_os = "macos")]
const SWAP_SUPPORTED: bool = true;
#[cfg(not(target_os = "macos"))]
const SWAP_SUPPORTED: bool = false;

/// Exchanges the contents of two existing paths in one atomic step. After it
/// returns, each path holds what the other held.
#[cfg(target_os = "macos")]
fn swap_paths(left: &Path, right: &Path) -> std::io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    /// `<sys/stdio.h>`. Not re-exported by every `libc` release, so it is named here.
    const RENAME_SWAP: libc::c_uint = 0x0002;

    let left = CString::new(left.as_os_str().as_bytes())?;
    let right = CString::new(right.as_os_str().as_bytes())?;
    // SAFETY: both pointers are valid, NUL-terminated, and live for the call.
    let outcome = unsafe { libc::renamex_np(left.as_ptr(), right.as_ptr(), RENAME_SWAP) };
    if outcome == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(not(target_os = "macos"))]
fn swap_paths(_left: &Path, _right: &Path) -> std::io::Result<()> {
    Err(std::io::Error::from(std::io::ErrorKind::Unsupported))
}

/// Why a swap failed, in the app's own error vocabulary.
///
/// Only two outcomes are interesting: the volume cannot do it, or the destination
/// went away while we were saving. Everything else is an ordinary I/O failure, and
/// in every case the file is left holding whatever it held.
fn classify_swap_error(path: &Path, error: std::io::Error) -> AppError {
    if is_unsupported(&error) {
        return swap_unsupported_error(path);
    }
    if error.kind() == std::io::ErrorKind::NotFound {
        return AppError::new(
            ErrorCode::Conflict,
            "This ticket's file was removed while you were saving. Your version was \
             not written over whatever replaced it.",
            true,
        )
        .with_context("path", path.display().to_string());
    }
    AppError::io("Saving ticket", path, error)
}

#[cfg(target_os = "macos")]
fn is_unsupported(error: &std::io::Error) -> bool {
    // `EINVAL` is what a filesystem without `RENAME_SWAP` returns for the flag.
    matches!(
        error.raw_os_error(),
        Some(libc::ENOTSUP) | Some(libc::EINVAL)
    )
}

#[cfg(not(target_os = "macos"))]
fn is_unsupported(error: &std::io::Error) -> bool {
    error.kind() == std::io::ErrorKind::Unsupported
}

fn swap_unsupported_error(path: &Path) -> AppError {
    AppError::new(
        ErrorCode::Io,
        "This volume cannot exchange two files atomically, so LongClaw cannot \
         guarantee that a save will not overwrite someone else's edit. The ticket \
         was left as it was. Move the project to an APFS or HFS+ volume to edit it \
         in the app.",
        true,
    )
    .with_context("path", path.display().to_string())
}

/// Replaces `path` with `bytes`, but only if the bytes it displaces are the ones
/// validation saw.
///
/// `atomic_write` cannot express that: `fs::rename` replaces the destination
/// unconditionally, so an external write landing between the caller's hash check
/// and the rename is destroyed with nothing left to report. Re-reading just before
/// the rename narrows that window rather than closing it — two processes can still
/// interleave after the re-read.
///
/// So this does not check and then replace. It swaps, which puts the displaced
/// bytes in our hands at the temporary path, and *then* asks what they were:
///
/// - `expected_hash` — nothing external happened inside the window. Done.
/// - anything else — an external write landed inside the window. Swap back so the
///   external bytes are the file again, and return `ErrorCode::Conflict` with the
///   context the conflict banner already reads.
///
/// The external write is never lost. In the worst case — the restoring swap itself
/// fails — its bytes are preserved beside the ticket and the error names where.
pub fn atomic_replace(path: &Path, bytes: &[u8], expected_hash: &str) -> AppResult<()> {
    atomic_replace_with_seams(path, bytes, expected_hash, replace_seams_for_worker())
}

pub fn atomic_replace_with_seams(
    path: &Path,
    bytes: &[u8],
    expected_hash: &str,
    seams: ReplaceSeams,
) -> AppResult<()> {
    if !SWAP_SUPPORTED || seams.force_swap_unsupported {
        return Err(swap_unsupported_error(path));
    }
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

    if let Err(error) = write_durable_sibling(&temporary, path, bytes) {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }

    if let Some(before_swap) = &seams.before_swap {
        before_swap(path);
    }

    if let Err(error) = swap_paths(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(classify_swap_error(path, error));
    }

    // The swap succeeded, so `path` holds the new bytes and `temporary` holds
    // whatever `path` held a moment ago.
    let displaced = fs::read(&temporary).map_err(|error| {
        AppError::io("Saving ticket", path, error)
            .with_context("temporaryPath", temporary.display().to_string())
    })?;
    if content_hash(&displaced) == expected_hash {
        let _ = fs::remove_file(&temporary);
        sync_directory(parent, path)?;
        return Ok(());
    }

    // Someone else wrote inside the window. Their bytes win: this save was built on
    // a version that no longer exists, which is the same answer the pre-write check
    // gives, just discovered later.
    if let Err(error) = swap_paths(&temporary, path) {
        let preserved = parent.join(format!(".{name}.longclaw-conflict-{}.bak", Uuid::new_v4()));
        let _ = fs::rename(&temporary, &preserved);
        let _ = sync_directory(parent, path);
        return Err(AppError::io("Restoring the displaced file", path, error)
            .with_context("preservedPath", preserved.display().to_string()));
    }
    let _ = fs::remove_file(&temporary);
    sync_directory(parent, path)?;

    let file = read_ticket_file_unowned(path)?;
    Err(conflict_error(&file, expected_hash)
        .with_context("path", path.display().to_string())
        .with_context("racedInsideWrite", "true".to_owned()))
}

/// Writes `bytes` to `temporary` and makes them durable, carrying over `model`'s
/// permissions so a replace does not silently widen them.
fn write_durable_sibling(temporary: &Path, model: &Path, bytes: &[u8]) -> AppResult<()> {
    // Every failure here reports `model`, not `temporary`. The human's file is
    // `ticket.md`; `.ticket.md.longclaw-9f2e….tmp` is this function's business,
    // and "that file is read-only" is not a sentence anyone can act on when the
    // file it names did not exist a moment ago and will not exist a moment later
    // (V0-29). The path is kept in context for a bug report.
    let failed = |action: &'static str| {
        move |error: std::io::Error| {
            AppError::io(action, model, error)
                .with_context("temporaryPath", temporary.display().to_string())
        }
    };
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(temporary)
        .map_err(failed("Saving ticket"))?;
    file.write_all(bytes).map_err(failed("Saving ticket"))?;
    file.sync_all().map_err(failed("Saving ticket"))?;
    if let Ok(metadata) = fs::metadata(model) {
        fs::set_permissions(temporary, metadata.permissions()).map_err(failed("Saving ticket"))?;
    }
    Ok(())
}

/// Makes the directory entry durable, and reports a failure as what it is: the
/// last step of saving `subject`.
///
/// The error names the ticket rather than the folder. Every other step of the
/// save reports `ticket.md`, and one step reporting `LC-1` would have the same
/// failure describe itself two ways depending on how far it got (V0-29).
fn sync_directory(parent: &Path, subject: &Path) -> AppResult<()> {
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| {
            AppError::io("Saving ticket", subject, error)
                .with_context("directory", parent.display().to_string())
        })
}

/// Reads a ticket, applies `edit`, and returns the bytes to write. Nothing is
/// written here: the caller records its self-write receipt first, so the watcher
/// can recognize the change as its own.
///
/// A ticket the project does not own is refused here, by the same route as one
/// that will not parse: [`read_ticket_file`] degrades it, and a degraded file is
/// never rewritten. That is deliberate — rewriting a foreign ticket into
/// conformity is exactly the repair the format contract forbids.
pub fn prepare_ticket_edit(
    project_root: &Path,
    project_key: &str,
    key: &str,
    edit: &TicketEdit,
    expected_hash: &str,
    now: &str,
) -> AppResult<TicketWrite> {
    let path = resolve_ticket_path(project_root, key)?;
    let file = read_ticket_file(&path, project_key)?;
    if file.content_hash != expected_hash {
        return Err(
            conflict_error(&file, expected_hash).with_context("path", path.display().to_string())
        );
    }
    let foreign = !belongs_to_project(project_key, &file.key);
    let document = file.parsed.map_err(|diagnostic| {
        let refusal = if foreign {
            format!(
                "LongClaw will not write to a ticket that belongs to another project: {}",
                diagnostic.message
            )
        } else if diagnostic.is_read_only() {
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
        expected_hash: Some(expected_hash.to_owned()),
    })
}

/// A stale edit is never written over a newer file. The context carries who
/// changed it and when, so the conflict banner can say so.
///
/// The message states the fact and names no actions. A conflict can land in the
/// ticket panel, which offers Reload and Keep mine, or on the board, which has
/// neither — copy that names buttons is the surface's to write, not the typed
/// error's (V0-29, ADR 0010).
///
/// This reads `last_activity` — the newest record in the file — on purpose, and it
/// is **not** the mistake `core::attribution` exists to prevent. The question here
/// is "who is on disk now, so the banner can name them", not "who made the change
/// we just observed". Leave it alone.
fn conflict_error(file: &TicketFile, expected_hash: &str) -> AppError {
    let mut error = AppError::new(
        ErrorCode::Conflict,
        format!(
            "{} changed on disk. Your version was not written over it.",
            file.key
        ),
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
    pub labels: Vec<String>,
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
                let rendered = super::ticket::render_new_ticket_with_labels(
                    &key,
                    title,
                    request.status.unwrap_or(Status::Todo),
                    request.priority.unwrap_or(Priority::None),
                    &request.labels,
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
                    // A create claims a directory nobody else holds, so there is no
                    // predecessor for the write to displace.
                    expected_hash: None,
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
    initialize_project_with_contract_writer(
        project_root,
        name,
        key,
        theme,
        now,
        write_agent_contract,
    )
}

fn initialize_project_with_contract_writer(
    project_root: &Path,
    name: &str,
    key: &str,
    theme: Option<&str>,
    now: &str,
    write_contract: impl FnOnce(&Path, &ProjectDocument) -> AppResult<()>,
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
    if !is_project_name(name.trim()) {
        // The same rule renaming uses. Creation accepting a name that the rename
        // surface would refuse is the drift this validation exists to prevent.
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            PROJECT_NAME_RULE,
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

    let longclaw_dir = project_root.join(PROJECT_DIRECTORY);
    let initialization_paths = project_initialization_paths(project_root);
    let pre_existing: BTreeSet<PathBuf> = initialization_paths
        .iter()
        .filter(|path| path.exists())
        .cloned()
        .collect();
    let created_longclaw = !longclaw_dir.exists();
    let result: AppResult<()> = (|| {
        let tickets = tickets_root(project_root);
        fs::create_dir_all(&tickets)
            .map_err(|error| AppError::io("Creating the project folder", &tickets, error))?;
        atomic_write(&project_path, rendered.as_bytes())?;
        write_contract(project_root, &document)?;
        Ok(())
    })();
    if let Err(error) = result {
        let leftovers = if created_longclaw {
            cleanup_failed_project_initialization(project_root)
        } else {
            initialization_paths
                .into_iter()
                .filter(|path| path.exists() && !pre_existing.contains(path))
                .collect()
        };
        let error = if leftovers.is_empty() {
            error
        } else {
            error
                .with_context("leftBehindPaths", display_paths(&leftovers))
                .with_context(
                    "leftBehindReason",
                    if created_longclaw {
                        "Cleanup was attempted, but these claimed paths remained"
                    } else {
                        "Cleanup was skipped because .longclaw existed before this create attempt"
                    },
                )
        };
        return Err(error);
    }
    Ok(document)
}

/// Writes the generated agent-facing contract. LongClaw owns
/// `.longclaw/AGENTS.md` and never touches a repository-root `AGENTS.md`.
pub fn write_agent_contract(project_root: &Path, document: &ProjectDocument) -> AppResult<()> {
    let contract = render_agent_contract(document.project());
    atomic_write(&agent_contract_path(project_root), contract.as_bytes())
}

fn project_initialization_paths(project_root: &Path) -> Vec<PathBuf> {
    vec![
        agent_contract_path(project_root),
        project_file_path(project_root),
        tickets_root(project_root),
        project_root.join(PROJECT_DIRECTORY),
    ]
}

fn cleanup_failed_project_initialization(project_root: &Path) -> Vec<PathBuf> {
    let _ = fs::remove_file(agent_contract_path(project_root));
    let _ = fs::remove_file(project_file_path(project_root));
    let _ = fs::remove_dir(tickets_root(project_root));
    let _ = fs::remove_dir(project_root.join(PROJECT_DIRECTORY));
    project_initialization_paths(project_root)
        .into_iter()
        .filter(|path| path.exists())
        .collect()
}

fn display_paths(paths: &[PathBuf]) -> String {
    paths
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::fs;

    use super::{
        atomic_replace, belongs_to_project, content_hash, foreign_project_diagnostic,
        initialize_project_with_contract_writer, prepare_new_ticket, prepare_ticket_edit,
        read_ticket_detail, read_ticket_file, resolve_ticket_path, scan_ticket_paths,
        valid_ticket_key, NewTicket, TicketEdit,
    };
    use crate::core::ErrorCode;

    /// A project with one ticket already on disk, for the failure paths below.
    fn project_with_a_ticket(temp: &std::path::Path) -> (std::path::PathBuf, super::TicketWrite) {
        let project = temp.join("project");
        fs::create_dir_all(project.join(".longclaw/tickets")).unwrap();
        let write = prepare_new_ticket(
            &project,
            "LC",
            &NewTicket {
                title: "A ticket two writers want".to_owned(),
                ..NewTicket::default()
            },
            "2026-08-04T09:00:00Z",
        )
        .unwrap();
        fs::write(&write.path, &write.bytes).unwrap();
        (project, write)
    }

    #[test]
    fn a_refused_stale_write_states_the_fact_and_names_no_buttons() {
        let temp = tempfile::tempdir().unwrap();
        let (project, write) = project_with_a_ticket(temp.path());

        let error = prepare_ticket_edit(
            &project,
            "LC",
            &write.key,
            &TicketEdit {
                title: Some("Mine".to_owned()),
                ..TicketEdit::default()
            },
            "sha256:a-hash-the-disk-moved-past",
            "2026-08-04T09:01:00Z",
        )
        .unwrap_err();

        assert_eq!(error.code, ErrorCode::Conflict);
        // `ConflictBanner`'s two buttons are `TicketPanel` state. A conflict
        // raised on the board has neither, so the typed error must not name
        // them — the surface owns its own actions (V0-29).
        assert!(!error.message.contains("Reload"));
        assert!(!error.message.contains("keep your version"));
        assert!(error.message.contains("changed on disk"));
        assert!(error.message.contains("was not written"));
        // Both keys, so either surface can name what it is talking about. The
        // path is the canonical one the resolver proved is inside the project,
        // which on macOS is `/private/var/…` where the caller said `/var/…`.
        assert_eq!(error.context.get("ticketKey"), Some(&write.key));
        assert_eq!(
            error.context.get("path").map(std::path::PathBuf::from),
            Some(write.path.canonicalize().unwrap())
        );
    }

    #[test]
    fn a_directory_sync_failure_still_names_the_ticket_file() {
        let temp = tempfile::tempdir().unwrap();
        let (_project, write) = project_with_a_ticket(temp.path());
        let gone = temp.path().join("a-folder-that-is-not-there");

        let error = super::sync_directory(&gone, &write.path).unwrap_err();

        // The last step of a save is a directory sync, and the human's file is
        // still `ticket.md` — naming the folder here would make one write path
        // report a different thing from the rest of it (V0-29).
        assert!(error.message.contains("ticket.md"));
        assert_eq!(
            error.context.get("fileName").map(String::as_str),
            Some("ticket.md")
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_save_into_a_read_only_folder_names_the_ticket_and_leaves_it_as_it_was() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let (_project, write) = project_with_a_ticket(temp.path());
        let directory = write.path.parent().unwrap().to_path_buf();
        let original = fs::read(&write.path).unwrap();

        fs::set_permissions(&directory, fs::Permissions::from_mode(0o555)).unwrap();
        let error = atomic_replace(&write.path, b"mine", &content_hash(&original)).unwrap_err();
        // Restore before asserting, so a failed assertion still leaves a
        // directory the harness can remove.
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o755)).unwrap();

        assert_eq!(error.code, ErrorCode::PermissionDenied);
        assert!(error.recoverable);
        // The human's file is `ticket.md`. The sibling temporary this save would
        // have written first is LongClaw's business, not theirs.
        assert!(error.message.contains("ticket.md"));
        assert!(!error.message.contains(".tmp"));
        assert_eq!(
            error.context.get("fileName").map(String::as_str),
            Some("ticket.md")
        );
        assert_eq!(
            error.context.get("path").map(String::as_str),
            Some(write.path.display().to_string().as_str())
        );
        assert!(error.message.contains("read-only"));
        assert_eq!(fs::read(&write.path).unwrap(), original);
    }

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

    #[test]
    fn ownership_is_about_whose_key_it_is_and_not_about_the_grammar() {
        assert!(belongs_to_project("LC", "LC-1"));
        assert!(belongs_to_project("LC", "LC-4210"));
        // Shape is `valid_ticket_key`'s job, and these are still not ours.
        assert!(!belongs_to_project("LC", "ZZ-1"));
        assert!(!belongs_to_project("LC", "LCX-1"));
        assert!(!belongs_to_project("LC", "lc-1"));
        assert!(!belongs_to_project("LC", "LC"));
        assert!(!belongs_to_project("LC", "notes"));
        assert!(!belongs_to_project("LC", ""));
        // A longer project key is not shadowed by its own prefix.
        assert!(belongs_to_project("LC2", "LC2-1"));
        assert!(!belongs_to_project("LC2", "LC-1"));
    }

    #[test]
    fn the_diagnostic_names_both_keys_and_promises_nothing_was_touched() {
        let message = foreign_project_diagnostic("LC", "ZZ-1").message;
        assert!(message.contains("ZZ-1"));
        assert!(message.contains("ZZ"));
        assert!(message.contains("LC"));
        assert!(message.contains("nothing in it has been changed"));

        // A directory that is not key-shaped at all still gets an answer a human
        // can act on, without being told a prefix it does not have.
        let unshaped = foreign_project_diagnostic("LC", "notes").message;
        assert!(unshaped.contains("notes"));
        assert!(unshaped.contains("LC-<number>"));
    }

    #[test]
    fn a_late_project_creation_failure_removes_the_directory_it_claimed() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        fs::create_dir(&project).unwrap();

        let error = match initialize_project_with_contract_writer(
            &project,
            "Residue Proof",
            "RP",
            Some("indigo"),
            "2026-08-02T00:00:00Z",
            |_root, _document| {
                Err(crate::core::AppError::new(
                    ErrorCode::Io,
                    "injected agent-contract write failure",
                    true,
                ))
            },
        ) {
            Ok(_) => panic!("the injected contract write should fail"),
            Err(error) => error,
        };

        assert_eq!(error.code, ErrorCode::Io);
        assert!(!project.join(".longclaw/longclaw.yaml").exists());
        assert!(!project.join(".longclaw/tickets").exists());
        assert!(!project.join(".longclaw").exists());
    }

    #[test]
    fn a_late_project_creation_failure_names_pre_existing_residue() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/keep-me")).unwrap();

        let error = match initialize_project_with_contract_writer(
            &project,
            "Residue Naming",
            "RN",
            Some("indigo"),
            "2026-08-02T00:00:00Z",
            |_root, _document| {
                Err(crate::core::AppError::new(
                    ErrorCode::Io,
                    "injected agent-contract write failure",
                    true,
                ))
            },
        ) {
            Ok(_) => panic!("the injected contract write should fail"),
            Err(error) => error,
        };

        assert_eq!(
            error.context["leftBehindReason"],
            "Cleanup was skipped because .longclaw existed before this create attempt"
        );
        let left_behind_paths: BTreeSet<&str> = error.context["leftBehindPaths"].lines().collect();
        assert!(
            left_behind_paths.contains(project.join(".longclaw/longclaw.yaml").to_str().unwrap())
        );
        assert!(left_behind_paths.contains(project.join(".longclaw/tickets").to_str().unwrap()));
        assert!(!left_behind_paths.contains(project.join(".longclaw").to_str().unwrap()));
        assert!(!left_behind_paths.contains(project.join(".longclaw/keep-me").to_str().unwrap()));
        assert!(project.join(".longclaw/keep-me").is_dir());
        assert!(project.join(".longclaw/longclaw.yaml").is_file());
        assert!(project.join(".longclaw/tickets").is_dir());
    }

    #[test]
    fn a_directory_from_another_project_degrades_with_its_bytes_intact() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        let directory = project.join(".longclaw/tickets/ZZ-1");
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("ticket.md");
        let raw = concat!(
            "---\n",
            "format: longclaw.ticket/v1\n",
            "id: 019c8ca0-0000-7000-8000-0000000000ff\n",
            "key: ZZ-1\n",
            "title: A ticket of another project\n",
            "status: todo\n",
            "priority: none\n",
            "created_at: 2026-07-29T00:00:00Z\n",
            "updated_at: 2026-07-29T00:00:00Z\n",
            "---\n",
            "\nIts directory and its frontmatter agree with each other.\n",
        );
        fs::write(&path, raw).unwrap();

        // Read as its own project's ticket it is perfectly readable, which is the
        // point: the file is not broken, it is somewhere it does not belong.
        assert!(read_ticket_file(&path, "ZZ").unwrap().parsed.is_ok());

        let file = read_ticket_file(&path, "LC").unwrap();
        assert_eq!(file.key, "ZZ-1");
        let diagnostic = file.parsed.as_ref().expect_err("should be degraded");
        assert_eq!(diagnostic.code, ErrorCode::ParseFailed);
        assert!(!diagnostic.is_read_only());
        assert!(diagnostic.message.contains("ZZ"));
        assert!(diagnostic.message.contains("LC"));
        // Degrading is a display decision, never a repair.
        assert_eq!(fs::read_to_string(&path).unwrap(), raw);
        assert_eq!(file.raw, raw);
    }

    #[test]
    fn a_foreign_prefix_directory_does_not_spend_a_key() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        let tickets = project.join(".longclaw/tickets");
        fs::create_dir_all(tickets.join("LC-1")).unwrap();
        fs::create_dir_all(tickets.join("ZZ-9")).unwrap();

        let write = prepare_new_ticket(
            &project,
            "LC",
            &NewTicket {
                title: "The next key follows this project's own sequence".to_owned(),
                ..NewTicket::default()
            },
            "2026-07-30T09:00:00Z",
        )
        .unwrap();
        assert_eq!(write.key, "LC-2");
        assert!(tickets.join("ZZ-9").is_dir());
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

        let file = read_ticket_file(&path, "LC").unwrap();
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

        let detail = read_ticket_detail(temp.path(), "LC", "LC-1").unwrap();
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
