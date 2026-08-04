use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};
use std::io;

use serde::Serialize;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Cancelled,
    InvalidProject,
    ProjectUnavailable,
    TicketNotFound,
    ParseFailed,
    UnsupportedVersion,
    Conflict,
    PermissionDenied,
    Io,
    Internal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub recoverable: bool,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub context: BTreeMap<String, String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>, recoverable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            recoverable,
            context: BTreeMap::new(),
        }
    }

    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }

    /// Fills a key the error did not already carry.
    ///
    /// For a seam that knows more about a failure than the layer that raised it —
    /// `Engine::commit` knows the ticket key and the file every write was aimed
    /// at, and the filesystem underneath it only ever knew a path. It fills gaps
    /// and never corrects: whoever raised the error was closer to it.
    pub fn with_context_if_absent(
        mut self,
        key: impl Into<String>,
        value: impl Into<String>,
    ) -> Self {
        self.context
            .entry(key.into())
            .or_insert_with(|| value.into());
        self
    }

    /// A filesystem failure as something the human can act on.
    ///
    /// The raw `io::Error` is diagnostic detail and goes to `context`; ADR 0010's
    /// `message` is presentation text, so it names the file and the two causes
    /// worth naming — a read-only file or folder, and a full volume. Anything
    /// else keeps the system's own words rather than guessing at a cause.
    pub fn io(action: &str, path: &std::path::Path, error: io::Error) -> Self {
        let code = if error.kind() == io::ErrorKind::PermissionDenied {
            ErrorCode::PermissionDenied
        } else {
            ErrorCode::Io
        };
        let name = file_label(path);
        // `cause` is the typed half of the same answer: the frontend offers the
        // recovery for a known cause and stays quiet for one it cannot name,
        // rather than pattern-matching the system's prose (ADR 0010).
        let (cause, why) = match error.kind() {
            io::ErrorKind::PermissionDenied => (
                Some("readOnly"),
                "The file or the folder it is in is read-only.".to_owned(),
            ),
            io::ErrorKind::StorageFull => (
                Some("noSpace"),
                "The volume it is on has no space left.".to_owned(),
            ),
            io::ErrorKind::NotFound => (
                Some("missing"),
                "It is no longer where LongClaw expected to find it.".to_owned(),
            ),
            _ => (None, format!("{error}.")),
        };
        let reported = Self::new(code, format!("{action} failed for {name}. {why}"), true)
            .with_context("path", path.display().to_string())
            .with_context("fileName", name)
            .with_context("systemError", error.to_string());
        match cause {
            Some(cause) => reported.with_context("cause", cause),
            None => reported,
        }
    }

    pub fn parse(path: &std::path::Path, message: impl Into<String>) -> Self {
        Self::new(ErrorCode::ParseFailed, message, true)
            .with_context("path", path.display().to_string())
    }
}

/// What to call a file in a sentence a human reads: its own name, and the whole
/// path only when it has no name to give.
fn file_label(path: &std::path::Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string())
}

impl Display for AppError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

/// Why a file or one embedded record inside it could not be read.
///
/// Diagnostics travel inside successful payloads — a degraded ticket is data,
/// not a failed command — so unlike the `AppError` channel that ADR 0010
/// describes, a diagnostic carries a typed line number the raw-file view can
/// point at.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
}

impl Diagnostic {
    pub fn parse(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::ParseFailed,
            message: message.into(),
            line: None,
        }
    }

    pub fn parse_at(message: impl Into<String>, line: u32) -> Self {
        Self::parse(message).at_line(line)
    }

    /// A construct outside the YAML subset the format contract defines.
    pub fn subset(detail: impl AsRef<str>, line: u32) -> Self {
        Self::parse_at(
            format!(
                "Frontmatter uses YAML outside the constrained subset: {}",
                detail.as_ref()
            ),
            line,
        )
    }

    /// A file this build must show read-only instead of migrating or rewriting.
    pub fn unsupported_version(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::UnsupportedVersion,
            message: message.into(),
            line: None,
        }
    }

    pub fn at_line(mut self, line: u32) -> Self {
        self.line = Some(line);
        self
    }

    /// Translates a line number measured inside an embedded block into the line
    /// number of the whole file.
    pub fn shift_lines(mut self, offset: u32) -> Self {
        self.line = self.line.map(|line| line + offset);
        self
    }

    /// A newer format version is shown as-is; every other diagnostic invites a
    /// fix, so the app offers a retry.
    pub fn is_read_only(&self) -> bool {
        self.code == ErrorCode::UnsupportedVersion
    }
}

impl Display for Diagnostic {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self.line {
            Some(line) => write!(formatter, "{} (line {line})", self.message),
            None => formatter.write_str(&self.message),
        }
    }
}

impl From<Diagnostic> for AppError {
    fn from(diagnostic: Diagnostic) -> Self {
        let error = Self::new(
            diagnostic.code,
            diagnostic.message,
            diagnostic.code != ErrorCode::UnsupportedVersion,
        );
        match diagnostic.line {
            Some(line) => error.with_context("line", line.to_string()),
            None => error,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn a_permission_failure_names_the_file_and_the_cause_rather_than_the_os_error() {
        let error = AppError::io(
            "Saving ticket",
            Path::new("/projects/app/.longclaw/tickets/LC-1/ticket.md"),
            io::Error::from(io::ErrorKind::PermissionDenied),
        );

        assert_eq!(error.code, ErrorCode::PermissionDenied);
        assert!(error.recoverable);
        assert!(error.message.contains("ticket.md"));
        assert!(error.message.contains("read-only"));
        // The raw `io::Error` is diagnostic detail, not presentation text.
        assert!(!error.message.contains("os error"));
        assert_eq!(
            error.context.get("path").map(String::as_str),
            Some("/projects/app/.longclaw/tickets/LC-1/ticket.md")
        );
        assert_eq!(
            error.context.get("fileName").map(String::as_str),
            Some("ticket.md")
        );
        assert!(error.context.contains_key("systemError"));
        assert_eq!(
            error.context.get("cause").map(String::as_str),
            Some("readOnly")
        );
    }

    #[test]
    fn a_full_volume_says_so_and_stays_recoverable() {
        let error = AppError::io(
            "Saving ticket",
            Path::new("/projects/app/.longclaw/tickets/LC-1/ticket.md"),
            io::Error::from(io::ErrorKind::StorageFull),
        );

        assert_eq!(error.code, ErrorCode::Io);
        assert!(error.recoverable);
        assert!(error.message.contains("ticket.md"));
        assert!(error.message.contains("no space left"));
        assert!(!error.message.contains("os error"));
        assert_eq!(
            error.context.get("cause").map(String::as_str),
            Some("noSpace")
        );
    }

    #[test]
    fn an_unclassified_io_failure_still_names_the_file_and_keeps_the_detail() {
        let error = AppError::io(
            "Reading ticket",
            Path::new("/projects/app/.longclaw/tickets/LC-1/ticket.md"),
            io::Error::other("the volume was ejected"),
        );

        assert_eq!(error.code, ErrorCode::Io);
        assert!(error.message.contains("ticket.md"));
        assert!(error.message.contains("the volume was ejected"));
        assert_eq!(
            error.context.get("systemError").map(String::as_str),
            Some("the volume was ejected")
        );
        // No cause the app can name, so it claims none and offers no recovery.
        assert!(!error.context.contains_key("cause"));
    }

    #[test]
    fn context_already_set_is_not_overwritten_by_a_later_seam() {
        let error = AppError::new(ErrorCode::Conflict, "changed on disk", true)
            .with_context("ticketKey", "LC-1")
            .with_context_if_absent("ticketKey", "LC-9")
            .with_context_if_absent("path", "/projects/app/ticket.md");

        assert_eq!(
            error.context.get("ticketKey").map(String::as_str),
            Some("LC-1")
        );
        assert_eq!(
            error.context.get("path").map(String::as_str),
            Some("/projects/app/ticket.md")
        );
    }
}
