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
