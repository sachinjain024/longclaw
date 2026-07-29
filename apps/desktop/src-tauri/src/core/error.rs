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

    pub fn io(action: &str, path: &std::path::Path, error: io::Error) -> Self {
        let code = if error.kind() == io::ErrorKind::PermissionDenied {
            ErrorCode::PermissionDenied
        } else {
            ErrorCode::Io
        };
        Self::new(
            code,
            format!("{action} failed for {}: {error}", path.display()),
            true,
        )
        .with_context("path", path.display().to_string())
    }

    pub fn parse(path: &std::path::Path, message: impl Into<String>) -> Self {
        Self::new(ErrorCode::ParseFailed, message, true)
            .with_context("path", path.display().to_string())
    }
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
