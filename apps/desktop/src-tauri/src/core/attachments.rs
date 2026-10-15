//! Attaching a file to a ticket, and pointing a ticket at a doc (LC-206).
//!
//! One deep operation, _attach_, that both of its callers — the app's command
//! and `longclaw ticket attach` — wrap without reimplementing a step. It reads
//! what the bytes are rather than what the name says, refuses what the format
//! does not carry, copies the bytes into the ticket's `attachments/` folder
//! **first**, and hands back the `ticket.md` write that registers them
//! **second** (`file_format.md`, _Write and conflict rules_). A crash between
//! the two leaves an orphan, which the detail read reports and a re-attach
//! recovers; it never leaves a record pointing at bytes that were not copied.
//!
//! The same module settles the two edits that name a file on disk —
//! restoring a removed attachment and adding a reference — because a
//! `TicketDocument` only ever sees `ticket.md` and cannot check either.

use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use super::error::{AppError, AppResult, ErrorCode};
use super::model::{OrphanAttachment, TicketWrite};
use super::storage::{self, prepare_ticket_edit_as};
use super::ticket::{self, Actor, Attachment, AttachmentRegistration, RecordSlot, TicketEdit};

/// The format's per-file limit: 10 MB, in decimal bytes.
pub const ATTACHMENT_SIZE_LIMIT: u64 = 10_000_000;

const ATTACHMENTS: &str = "attachments";
/// What a name that sanitizes to nothing is called on disk.
const FALLBACK_NAME: &str = "file";
/// Long enough to recognise a file by, short enough that a path never nears a
/// file system's limit with the id in front of it.
const STEM_LIMIT: usize = 80;

/// An attachment whose bytes are on disk, and the write that registers it.
#[derive(Debug, Clone)]
pub struct PreparedAttachment {
    /// `ticket.md` with the record appended, for the caller to place. Until it
    /// does, the bytes are an orphan.
    pub write: TicketWrite,
    pub attachment: Attachment,
    /// The link to paste where the file is written about — the plain link
    /// form whatever the type (`cli.attach.markdown`). An agent is told one
    /// shape, and the renderer decides from the registry how it looks.
    pub markdown_link: String,
}

/// Copies `bytes` into the ticket as a new attachment named after `name`, and
/// returns the `ticket.md` write that registers it.
///
/// Every refusal comes before any byte is written: a file over the limit, a
/// type outside `image/*`, `text/*` and `video/*`, a ticket that changed since
/// `expected_hash`, and an `attachments/` folder that leads out of the ticket.
/// The write it returns is checked against the same hash again when placed.
#[allow(clippy::too_many_arguments)]
pub fn prepare_attachment(
    project_root: &Path,
    project_key: &str,
    key: &str,
    bytes: &[u8],
    name: &str,
    expected_hash: &str,
    now: &str,
    author: &Actor,
) -> AppResult<PreparedAttachment> {
    let name = display_name(name);
    let size = bytes.len() as u64;
    if size > ATTACHMENT_SIZE_LIMIT {
        return Err(too_large(&name, size));
    }
    let media_type = media_type(bytes, &name).ok_or_else(|| unsupported(&name))?;
    let id = ticket::mint_id("att");
    let attachment = Attachment {
        file: format!("{ATTACHMENTS}/{id}-{}", sanitized_name(&name)),
        id,
        name,
        media_type: media_type.to_owned(),
        size,
        added_at: now.to_owned(),
        added_by: author.clone(),
    };
    let write = register(
        project_root,
        project_key,
        key,
        &attachment,
        false,
        expected_hash,
        now,
        author,
    )?;
    let folder = attachments_folder(&write.path, true)?;
    let target = folder.join(file_name(&attachment.file));
    // The id is fresh, so nothing should be here; something that is, is not
    // this attach's to replace.
    if fs::symlink_metadata(&target).is_ok() {
        return Err(AppError::new(
            ErrorCode::Conflict,
            format!(
                "{} already exists in this ticket's attachments folder",
                attachment.file
            ),
            true,
        ));
    }
    storage::atomic_write("Attaching a file", &target, bytes)?;
    Ok(prepared(write, attachment))
}

/// [`prepare_attachment`] for a file on disk: the CLI's argument, or what the
/// app's file picker returns. The size is judged from the file system before a
/// byte is read, so a 4 GB video is refused without loading it. `name` is the
/// display name, and defaults to the file's own.
#[allow(clippy::too_many_arguments)]
pub fn prepare_attachment_file(
    project_root: &Path,
    project_key: &str,
    key: &str,
    source: &Path,
    name: Option<&str>,
    expected_hash: &str,
    now: &str,
    author: &Actor,
) -> AppResult<PreparedAttachment> {
    let shown = source.display().to_string();
    let name = display_name(name.unwrap_or_else(|| {
        source
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(FALLBACK_NAME)
    }));
    let metadata = fs::metadata(source).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            not_found(format!("{shown} does not exist"))
        } else {
            AppError::io("Reading the file to attach", source, error)
        }
    })?;
    if !metadata.is_file() {
        return Err(AppError::new(
            ErrorCode::UnsupportedMediaType,
            format!("{shown} is a folder; attach the files in it one at a time"),
            true,
        )
        .with_context("fileName", name));
    }
    if metadata.len() > ATTACHMENT_SIZE_LIMIT {
        return Err(too_large(&name, metadata.len()));
    }
    let bytes = fs::read(source)
        .map_err(|error| AppError::io("Reading the file to attach", source, error))?;
    prepare_attachment(
        project_root,
        project_key,
        key,
        &bytes,
        &name,
        expected_hash,
        now,
        author,
    )
}

/// Registers a file already under `attachments/` — an orphan — without
/// copying it, held to the same type and size rules as an attach.
///
/// A file whose name starts with an `att_…` id the ticket does not already use
/// gets that id and the rest of its name back, which is what an orphan left by
/// a removal looks like. Any other file keeps its name and gets a fresh id.
#[allow(clippy::too_many_arguments)]
pub fn prepare_reattachment(
    project_root: &Path,
    project_key: &str,
    key: &str,
    file: &str,
    expected_hash: &str,
    now: &str,
    author: &Actor,
) -> AppResult<PreparedAttachment> {
    let ticket_path = storage::resolve_ticket_path(project_root, key)?;
    let path = existing_attachment(&ticket_path, file)?;
    let (media_type, size) = read_and_judge(&path, file_name(file))?;
    let detail = storage::read_ticket_detail(project_root, project_key, key)?;
    let taken = |id: &str| {
        detail
            .ticket
            .as_ref()
            .is_some_and(|ticket| ticket.attachments.iter().any(|kept| kept.id == id))
    };
    let (id, name) = match recovered_identity(file_name(file)) {
        Some((id, name)) if !taken(id) => (id.to_owned(), name.to_owned()),
        _ => (ticket::mint_id("att"), file_name(file).to_owned()),
    };
    let attachment = Attachment {
        id,
        file: file.to_owned(),
        name,
        media_type,
        size,
        added_at: now.to_owned(),
        added_by: author.clone(),
    };
    let write = register(
        project_root,
        project_key,
        key,
        &attachment,
        true,
        expected_hash,
        now,
        author,
    )?;
    Ok(prepared(write, attachment))
}

/// The edit as a document may apply it: a restore turned into a registration
/// whose type and size were read off the file again, and a reference path in
/// its stored form. `None` when the edit names nothing on disk.
///
/// `storage::prepare_ticket_edit_as` calls this for every edit, so no caller
/// can reach a document with either request unchecked.
pub(crate) fn settle(
    project_root: &Path,
    ticket_path: &Path,
    edit: &TicketEdit,
) -> AppResult<Option<TicketEdit>> {
    if edit.restore_attachment.is_none() && edit.add_reference.is_none() {
        return Ok(None);
    }
    let mut settled = edit.clone();
    if let Some(restore) = settled.restore_attachment.take() {
        let path = existing_attachment(ticket_path, &restore.file)?;
        let (media_type, size) = read_and_judge(&path, &restore.name)?;
        settled.register_attachment = Some(AttachmentRegistration {
            attachment: Attachment {
                id: restore.id,
                file: restore.file,
                name: restore.name,
                media_type,
                size,
                added_at: restore.added_at,
                added_by: restore.added_by,
            },
            slot: match restore.after {
                Some(after) => RecordSlot::After(after),
                None => RecordSlot::First,
            },
            // An undo puts back the row it took away; nothing was re-attached.
            reattached: false,
        });
    }
    if let Some(path) = &settled.add_reference {
        settled.add_reference = Some(reference_path(project_root, path)?);
    }
    Ok(Some(settled))
}

/// The file a registered attachment's bytes live in, and its record — the one
/// question serving a file to the webview asks (LC-206). `file` must be a
/// registered record's own `file`, and it must still be a regular file inside
/// the ticket's `attachments/` folder: a link, a folder, an orphan and a path
/// with a way out are all refused before anything is opened.
pub fn registered_attachment(
    project_root: &Path,
    project_key: &str,
    key: &str,
    file: &str,
) -> AppResult<(PathBuf, Attachment)> {
    let ticket_path = storage::resolve_ticket_path(project_root, key)?;
    let path = existing_attachment(&ticket_path, file)?;
    let ticket_file = storage::read_ticket_file(&ticket_path, project_key)?;
    let document = ticket_file.parsed.map_err(|diagnostic| {
        not_found(format!(
            "{key} cannot be read, so none of its attachments are served: {}",
            diagnostic.message
        ))
    })?;
    let attachment = document
        .ticket()
        .attachments
        .iter()
        .find(|attachment| attachment.file == file)
        .cloned()
        .ok_or_else(|| not_found(format!("{file} is not registered in {key}")))?;
    Ok((path, attachment))
}

/// Any regular file directly inside the ticket's `attachments/`, registered or
/// not, for **Show in Finder** (LC-206). Finder only selects it, so an orphan
/// qualifies — the not-attached row offers it — and only containment is asked:
/// no way out, no link, no folder.
pub fn attachment_in_folder(project_root: &Path, key: &str, file: &str) -> AppResult<PathBuf> {
    let ticket_path = storage::resolve_ticket_path(project_root, key)?;
    existing_attachment(&ticket_path, file)
}

/// How much of an orphan is read to say what it is: enough for every signature
/// `media_type` knows and for a fair look at whether it is text.
const SNIFF_PREFIX: usize = 64 * 1024;

/// What a file no record names is, for the References row that lists it
/// (LC-206): its size, and its type sniffed the way an attach sniffs one.
///
/// Read through [`existing_attachment`], so a link or a way out of the folder
/// is described as nothing rather than followed, and only the first
/// [`SNIFF_PREFIX`] bytes are read — this runs on every detail read, external
/// writes included, and a stray film must not be read whole each time. A
/// prefix that ends inside a character is cut back to the last whole one.
pub(crate) fn describe_orphan(ticket_path: &Path, file: &str) -> OrphanAttachment {
    let described = existing_attachment(ticket_path, file)
        .ok()
        .and_then(|path| {
            let size = fs::metadata(&path).ok()?.len();
            let mut prefix = Vec::with_capacity(SNIFF_PREFIX.min(size as usize));
            fs::File::open(&path)
                .ok()?
                .take(SNIFF_PREFIX as u64)
                .read_to_end(&mut prefix)
                .ok()?;
            if (prefix.len() as u64) < size {
                if let Err(error) = std::str::from_utf8(&prefix) {
                    if error.error_len().is_none() {
                        prefix.truncate(error.valid_up_to());
                    }
                }
            }
            Some((
                size,
                media_type(&prefix, file_name(file)).map(str::to_owned),
            ))
        });
    let (size, media_type) = described.unwrap_or((0, None));
    OrphanAttachment {
        file: file.to_owned(),
        size,
        media_type,
    }
}

/// The extensions a registered file may carry and still be opened in its
/// default app: ones LaunchServices hands to a viewer or an editor.
///
/// An allow-list, because the question is what macOS will *do* with the file,
/// and it decides that by name rather than by the bytes this module sniffed. A
/// shell script is text by content, and `fix.command` still opens in Terminal,
/// which runs it — so a chip an agent attached must not be one click from that.
/// SVG and XML are images and text by content, and are left out for the same
/// reason: macOS hands them to Safari, where a script inside one runs.
const OPENABLE_EXTENSIONS: &[&str] = &[
    // Images.
    "png", "jpg", "jpeg", "gif", "tif", "tiff", "webp", "avif", "heic", "heif",
    // Videos.
    "mp4", "m4v", "mov", "webm", "mkv", "avi", "ogv", "3gp", "3g2",
    // Text that opens in an editor or a viewer.
    "txt", "text", "log", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "diff", "patch",
    "toml", "ini",
];

/// The file to hand to its default app, for a chip or a viewer's **Open**
/// (LC-206). Only a registered attachment, proven inside its folder by
/// [`registered_attachment`], and only one whose name LaunchServices opens
/// rather than runs; anything else is refused with **Show in Finder** as the
/// way round it.
pub fn attachment_to_open(
    project_root: &Path,
    project_key: &str,
    key: &str,
    file: &str,
) -> AppResult<PathBuf> {
    let (path, attachment) = registered_attachment(project_root, project_key, key, file)?;
    let extension = file_name(&attachment.file)
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase());
    if extension.is_some_and(|extension| OPENABLE_EXTENSIONS.contains(&extension.as_str())) {
        return Ok(path);
    }
    Err(AppError::new(
        ErrorCode::UnsupportedMediaType,
        format!(
            "{} isn’t opened from LongClaw, because macOS might run a file with that name \
             rather than show it. Use Show in Finder instead.",
            attachment.name
        ),
        true,
    )
    .with_context("file", attachment.file))
}

/// The reference ids whose path does not resolve, for the detail read.
pub(crate) fn missing_references(project_root: &Path, ticket: &ticket::Ticket) -> Vec<String> {
    ticket
        .references
        .iter()
        .filter(|reference| {
            let path = Path::new(&reference.path);
            let resolved = if path.is_absolute() {
                path.to_path_buf()
            } else {
                project_root.join(path)
            };
            !resolved.is_file()
        })
        .map(|reference| reference.id.clone())
        .collect()
}

/// The media type `bytes` hold, judged by their content first. The name only
/// says which kind of text a text file is, and never makes a file text.
///
/// `None` is anything outside the three families the format carries — a PDF,
/// an archive, audio, or bytes that are not valid UTF-8 text.
pub fn media_type(bytes: &[u8], name: &str) -> Option<&'static str> {
    let starts = |signature: &[u8]| bytes.starts_with(signature);
    if starts(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png");
    }
    if starts(b"\xff\xd8\xff") {
        return Some("image/jpeg");
    }
    if starts(b"GIF87a") || starts(b"GIF89a") {
        return Some("image/gif");
    }
    if starts(b"II*\0") || starts(b"MM\0*") {
        return Some("image/tiff");
    }
    if starts(b"RIFF") && bytes.len() >= 12 {
        match &bytes[8..12] {
            b"WEBP" => return Some("image/webp"),
            b"AVI " => return Some("video/x-msvideo"),
            _ => return None,
        }
    }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        return match &bytes[8..12] {
            b"avif" | b"avis" => Some("image/avif"),
            b"heic" | b"heix" | b"mif1" | b"msf1" => Some("image/heic"),
            b"qt  " => Some("video/quicktime"),
            b"3gp4" | b"3gp5" | b"3gp6" | b"3g2a" => Some("video/3gpp"),
            // Audio-only brands: an ISO file, but not a video.
            b"M4A " | b"M4B " | b"M4P " => None,
            _ => Some("video/mp4"),
        };
    }
    if starts(b"\x1a\x45\xdf\xa3") {
        let head = &bytes[..bytes.len().min(64)];
        return Some(if contains(head, b"webm") {
            "video/webm"
        } else {
            "video/x-matroska"
        });
    }
    if starts(b"OggS") {
        let head = &bytes[..bytes.len().min(512)];
        return contains(head, b"\x80theora").then_some("video/ogg");
    }
    // Formats whose first bytes can read as text, so the UTF-8 check below
    // would take a small one for a text file.
    let documents: [&[u8]; 6] = [
        b"%PDF-",
        b"PK\x03\x04",
        b"\x7fELF",
        b"Rar!",
        b"ID3",
        b"fLaC",
    ];
    if documents.iter().any(|signature| starts(signature)) {
        return None;
    }
    let text = std::str::from_utf8(bytes).ok()?;
    if text.contains('\0') || text.chars().any(is_binary_control) {
        return None;
    }
    if is_svg(text) {
        return Some("image/svg+xml");
    }
    let extension = name
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase());
    Some(match extension.as_deref() {
        Some("md" | "markdown") => "text/markdown",
        Some("csv") => "text/csv",
        Some("tsv") => "text/tab-separated-values",
        Some("html" | "htm") => "text/html",
        Some("css") => "text/css",
        Some("xml") => "text/xml",
        Some("js" | "mjs") => "text/javascript",
        Some("yaml" | "yml") => "text/yaml",
        _ => "text/plain",
    })
}

/// A file name that is safe on every disk the format meets: ASCII letters,
/// digits, `.`, `_` and `-`, lowercased, with anything else folded into one
/// `-`. The extension is kept apart so it survives the cut to length.
pub fn sanitized_name(name: &str) -> String {
    let name = display_name(name);
    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.trim_matches('.').is_empty() => (stem, Some(extension)),
        _ => (name.as_str(), None),
    };
    let fold = |text: &str| {
        let mut folded = String::with_capacity(text.len());
        for character in text.chars() {
            let kept = if character.is_ascii_alphanumeric() || matches!(character, '_' | '.') {
                character.to_ascii_lowercase()
            } else {
                '-'
            };
            if kept == '-' && folded.ends_with('-') {
                continue;
            }
            folded.push(kept);
        }
        folded.trim_matches(|c| c == '-' || c == '.').to_owned()
    };
    let mut stem = fold(stem);
    if stem.len() > STEM_LIMIT {
        stem.truncate(STEM_LIMIT);
        stem = stem.trim_end_matches(['-', '.']).to_owned();
    }
    if stem.is_empty() {
        stem = FALLBACK_NAME.to_owned();
    }
    match extension
        .map(fold)
        .filter(|extension| !extension.is_empty())
    {
        Some(extension) => format!("{stem}.{extension}"),
        None => stem,
    }
}

/// The link a caller pastes for an attachment: `[name](./attachments/…)`,
/// never the image form, for the reason [`PreparedAttachment::markdown_link`]
/// gives.
pub fn markdown_link(attachment: &Attachment) -> String {
    format!(
        "[{}]({})",
        ticket::link_text(&attachment.name),
        ticket::attachment_href(&attachment.file)
    )
}

// ------------------------------------------------------------------ internals

fn prepared(write: TicketWrite, attachment: Attachment) -> PreparedAttachment {
    PreparedAttachment {
        markdown_link: markdown_link(&attachment),
        write,
        attachment,
    }
}

/// The `ticket.md` write that appends `attachment`'s record. `reattached` is
/// whether its bytes were already on disk, which is what the activity says.
#[allow(clippy::too_many_arguments)]
fn register(
    project_root: &Path,
    project_key: &str,
    key: &str,
    attachment: &Attachment,
    reattached: bool,
    expected_hash: &str,
    now: &str,
    author: &Actor,
) -> AppResult<TicketWrite> {
    prepare_ticket_edit_as(
        project_root,
        project_key,
        key,
        &TicketEdit {
            register_attachment: Some(AttachmentRegistration {
                attachment: attachment.clone(),
                slot: RecordSlot::End,
                reattached,
            }),
            ..TicketEdit::default()
        },
        expected_hash,
        now,
        author,
    )
}

/// What the reader is shown: the last segment of whatever the caller called
/// it, on one line, or `file` when that leaves nothing.
fn display_name(name: &str) -> String {
    let last = name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(name)
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    let last = last.trim();
    if last.is_empty() {
        FALLBACK_NAME.to_owned()
    } else {
        last.to_owned()
    }
}

fn file_name(file: &str) -> &str {
    file.rsplit('/').next().unwrap_or(file)
}

/// `att_7d2a-debug-log.txt` → (`att_7d2a`, `debug-log.txt`).
fn recovered_identity(name: &str) -> Option<(&str, &str)> {
    let (id, rest) = name.split_once('-')?;
    let suffix = id.strip_prefix("att_")?;
    let well_formed = !suffix.is_empty()
        && suffix
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
        && !rest.is_empty();
    well_formed.then_some((id, rest))
}

/// The ticket's `attachments/` folder, proven to be inside the ticket's own
/// folder once links are followed. `create` makes it when it is absent, which
/// only an attach does.
fn attachments_folder(ticket_path: &Path, create: bool) -> AppResult<PathBuf> {
    let ticket_dir = ticket_path
        .parent()
        .ok_or_else(|| escaped("This ticket has no folder"))?;
    let folder = ticket_dir.join(ATTACHMENTS);
    if create {
        fs::create_dir_all(&folder)
            .map_err(|error| AppError::io("Creating the attachments folder", &folder, error))?;
    }
    let canonical = folder.canonicalize().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            not_found(format!("This ticket has no {ATTACHMENTS} folder"))
        } else {
            AppError::io("Reading the attachments folder", &folder, error)
        }
    })?;
    let canonical_ticket = ticket_dir
        .canonicalize()
        .map_err(|error| AppError::io("Reading the ticket folder", ticket_dir, error))?;
    if canonical.parent() != Some(canonical_ticket.as_path()) || !canonical.is_dir() {
        return Err(escaped(
            "This ticket's attachments folder leads outside the ticket",
        ));
    }
    Ok(canonical)
}

/// The file `file` names, if it is a regular file directly inside the
/// ticket's `attachments/` folder. Never follows a link, so a link planted
/// there cannot lead a registration to bytes outside the ticket.
fn existing_attachment(ticket_path: &Path, file: &str) -> AppResult<PathBuf> {
    let name = file
        .strip_prefix(ATTACHMENTS)
        .and_then(|rest| rest.strip_prefix('/'))
        .filter(|name| {
            !name.is_empty()
                && !name.contains(['/', '\\'])
                && !matches!(*name, "." | "..")
                && !name.chars().any(char::is_control)
        })
        .ok_or_else(|| {
            escaped(format!(
                "{file} is not a file directly inside this ticket's {ATTACHMENTS} folder"
            ))
        })?;
    let path = attachments_folder(ticket_path, false)?.join(name);
    let metadata = fs::symlink_metadata(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            not_found(format!(
                "{file} is no longer in this ticket's {ATTACHMENTS} folder"
            ))
        } else {
            AppError::io("Reading an attachment", &path, error)
        }
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(escaped(format!(
            "{file} is a link or a folder, not a file this ticket holds"
        )));
    }
    Ok(path)
}

/// The media type and size of an existing file, or the refusal an attach of
/// the same bytes would get. The size is checked before anything is read.
fn read_and_judge(path: &Path, name: &str) -> AppResult<(String, u64)> {
    let size = fs::metadata(path)
        .map_err(|error| AppError::io("Reading an attachment", path, error))?
        .len();
    if size > ATTACHMENT_SIZE_LIMIT {
        return Err(too_large(name, size));
    }
    let bytes =
        fs::read(path).map_err(|error| AppError::io("Reading an attachment", path, error))?;
    let media_type = media_type(&bytes, name).ok_or_else(|| unsupported(name))?;
    Ok((media_type.to_owned(), bytes.len() as u64))
}

/// A path a caller gave for a reference, in its stored form: relative to the
/// project, with forward slashes, when the file is inside it; absolute when it
/// is not. A relative path is read from the project root — the CLI makes a
/// path typed in a shell absolute before it gets here.
fn reference_path(project_root: &Path, path: &str) -> AppResult<String> {
    let typed = path.trim();
    let given = Path::new(typed);
    let candidate = if given.is_absolute() {
        given.to_path_buf()
    } else {
        project_root.join(given)
    };
    let resolved = candidate.canonicalize().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            not_found(format!("{typed} does not exist"))
        } else {
            AppError::io("Reading a referenced file", &candidate, error)
        }
    })?;
    if !resolved.is_file() {
        return Err(AppError::new(
            ErrorCode::ParseFailed,
            format!("{typed} is a folder; a reference names a file"),
            true,
        ));
    }
    let root = project_root
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing project folder", project_root, error))?;
    let stored = match resolved.strip_prefix(&root) {
        Ok(inside) => inside
            .components()
            .map(|component| match component {
                Component::Normal(segment) => segment.to_str().map(str::to_owned),
                _ => None,
            })
            .collect::<Option<Vec<_>>>()
            .map(|segments| segments.join("/")),
        Err(_) => resolved.to_str().map(str::to_owned),
    };
    stored.ok_or_else(|| {
        AppError::new(
            ErrorCode::ParseFailed,
            format!("{typed} is not a path LongClaw can store as text"),
            true,
        )
    })
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}

/// A control character no text file carries: everything below space except
/// tab, line feed, carriage return and form feed, plus DEL.
fn is_binary_control(character: char) -> bool {
    (character < ' ' && !matches!(character, '\t' | '\n' | '\r' | '\x0c')) || character == '\x7f'
}

/// An SVG document: its root element is `<svg`, after an optional byte-order
/// mark, XML declaration, comments and an `svg` doctype. An HTML page with an
/// inline `<svg>` in it is text, not an image.
fn is_svg(text: &str) -> bool {
    let mut rest = text.trim_start_matches('\u{feff}').trim_start();
    loop {
        let skipped = if rest.starts_with("<?xml") {
            rest.find("?>").map(|end| end + 2)
        } else if rest.starts_with("<!--") {
            rest.find("-->").map(|end| end + 3)
        } else if rest.len() >= 13 && rest[..13].eq_ignore_ascii_case("<!doctype svg") {
            rest.find('>').map(|end| end + 1)
        } else {
            return rest.starts_with("<svg")
                && rest[4..].starts_with(|c: char| c.is_whitespace() || c == '>' || c == '/');
        };
        match skipped {
            Some(end) => rest = rest[end..].trim_start(),
            None => return false,
        }
    }
}

fn too_large(name: &str, size: u64) -> AppError {
    AppError::new(
        ErrorCode::TooLarge,
        format!(
            "{name} is {}. Attachments can be up to 10 MB.",
            megabytes(size)
        ),
        true,
    )
    .with_context("fileName", name.to_owned())
    .with_context("size", size.to_string())
    .with_context("limit", ATTACHMENT_SIZE_LIMIT.to_string())
}

fn unsupported(name: &str) -> AppError {
    AppError::new(
        ErrorCode::UnsupportedMediaType,
        format!("{name} can’t be attached. Only images, text files and videos are supported."),
        true,
    )
    .with_context("fileName", name.to_owned())
}

fn not_found(message: String) -> AppError {
    AppError::new(ErrorCode::NotFound, message, true)
}

fn escaped(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::PermissionDenied, message, false)
}

/// `12.4 MB`, in the decimal megabytes the limit is stated in.
fn megabytes(size: u64) -> String {
    format!("{:.1} MB", size as f64 / 1_000_000.0)
}

#[cfg(test)]
mod tests {
    use super::{media_type, recovered_identity, sanitized_name};

    #[test]
    fn audio_and_documents_are_not_attachments() {
        assert_eq!(media_type(b"\0\0\0\x20ftypM4A \0\0\0\0", "a.m4a"), None);
        assert_eq!(media_type(b"OggS\0\x02vorbis", "a.ogg"), None);
        assert_eq!(media_type(b"%PDF-1.4\n", "a.pdf"), None);
        assert_eq!(media_type(b"\xff\xfeh\0i\0", "utf16.txt"), None);
    }

    #[test]
    fn the_extension_names_the_kind_of_text_and_nothing_more() {
        assert_eq!(media_type(b"a,b\n", "data.CSV"), Some("text/csv"));
        assert_eq!(media_type(b"", "empty.txt"), Some("text/plain"));
        assert_eq!(media_type(b"{\"a\":1}", "x.json"), Some("text/plain"));
        assert_eq!(
            media_type(b"\x1aE\xdf\xa3\x01webm", "clip.mkv"),
            Some("video/webm")
        );
    }

    #[test]
    fn an_svg_is_one_whose_root_is_svg() {
        let svg = "<?xml version=\"1.0\"?>\n<!-- drawn -->\n<!DOCTYPE svg PUBLIC \"x\">\n<svg viewBox=\"0 0 1 1\"/>";
        assert_eq!(media_type(svg.as_bytes(), "a.txt"), Some("image/svg+xml"));
        let page = "<!DOCTYPE html>\n<html><body><svg/></body></html>";
        assert_eq!(media_type(page.as_bytes(), "a.html"), Some("text/html"));
        assert_eq!(media_type(b"<svgfoo/>", "a.txt"), Some("text/plain"));
    }

    #[test]
    fn a_long_name_keeps_its_extension() {
        let name = format!("{}.png", "a".repeat(200));
        let sanitized = sanitized_name(&name);
        assert!(sanitized.ends_with(".png"), "{sanitized}");
        assert!(sanitized.len() <= 84, "{sanitized}");
    }

    #[test]
    fn an_orphan_s_id_is_recovered_only_from_the_shape_the_app_writes() {
        assert_eq!(
            recovered_identity("att_7d2a-debug-log.txt"),
            Some(("att_7d2a", "debug-log.txt"))
        );
        assert_eq!(recovered_identity("att_-x.txt"), None);
        assert_eq!(recovered_identity("att_7d2a-"), None);
        assert_eq!(recovered_identity("notes.txt"), None);
        assert_eq!(recovered_identity("att_7d 2a-x.txt"), None);
    }
}
