//! Whether the `longclaw` command is installed, and putting it there (LC-233).
//!
//! **The binary needs no installing.** `tauri build` compiles every `[[bin]]`
//! this crate declares and the bundler seals each one into `Contents/MacOS/`,
//! so the CLI beside the window is always exactly the app's own build and the
//! two can never disagree about the file format. `binary-audit.mjs` is what
//! holds that true rather than incidental. What is missing after a `.dmg` is
//! opened is a *name on `PATH`*, and that is the only thing this module is
//! about.
//!
//! **The vocabulary is shared and the act is not.** Every platform can say
//! whether its command is installed, where the app's own copy of it is, and
//! what a person would run to install it by hand. How it gets installed is not
//! shared at all: macOS symlinks into `/usr/local/bin` because that is the one
//! directory on a stock Mac's `PATH` that a user can sometimes write, while an
//! NSIS installer amends `PATH` at install time and a `.deb` drops a binary in
//! `/usr/bin` — on both of those the command is already there before the app
//! first runs. So `status` and `install` dispatch to the platform *whole*,
//! rather than being composed here out of a link path and a symlink call. Code
//! shared with Windows that knew about a symlink would be code only macOS can
//! answer, which is the trap the `platform/` seam exists to avoid.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::core::AppResult;

/// The name the command answers to, on `PATH` and inside the bundle.
pub const COMMAND_NAME: &str = "longclaw";

/// What the OS currently offers under that name.
///
/// A closed set the frontend switches on, like `ErrorCode` and for the same
/// reason (ADR 0010): each variant is a different sentence and a different
/// button, so it is behaviour rather than prose.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CommandLineState {
    /// Installed, and resolving to *this* build's own binary.
    Linked,
    /// A link is installed and points somewhere else — an older bundle, one
    /// that has moved, or one that has been deleted. Re-linking is the fix, and
    /// it is the case the offer must not read as "already done".
    Stale,
    /// Something that is not a link is in the way: a real binary somebody
    /// installed another way. Never replaced — see `macos::install_into`.
    Occupied,
    /// Nothing is there.
    Absent,
    /// This build has no CLI beside it to link, which is a `cargo run` window
    /// rather than a bundle. There is nothing to offer and nothing is wrong.
    Unavailable,
}

/// Everything a surface needs to say what is installed and what pressing
/// `Install` would do.
///
/// The paths are absolute and reach the webview, which is unusual here — a
/// view payload does not normally carry one (ADR 0006). They are the subject
/// rather than an implementation detail: the whole question is *which* binary
/// the name on `PATH` resolves to, and a pane that could not show a stale link
/// pointing at a bundle in `~/Downloads` could not answer it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLineStatus {
    pub state: CommandLineState,
    /// The app's own copy of the CLI. Absent only when `state` is `unavailable`.
    pub source_path: Option<String>,
    /// Where the command goes on this platform.
    pub link_path: String,
    /// What is installed now, as it is written — the *link's own* target rather
    /// than what it resolves to, because a stale link is worth reading as the
    /// path somebody's previous copy of the app was at.
    pub current_target: Option<String>,
    /// The one line that does this from a terminal, with the paths filled in.
    ///
    /// Present whenever there is a binary to install, not only after a refusal:
    /// the pane offers it as the way out of every state it cannot write itself,
    /// and a command computed only on failure is a command with no test that
    /// ever reads it.
    pub manual_command: Option<String>,
}

impl CommandLineStatus {
    /// The answer when there is no binary beside this one to install.
    pub fn unavailable(link_path: &Path) -> Self {
        Self {
            state: CommandLineState::Unavailable,
            source_path: None,
            link_path: link_path.display().to_string(),
            current_target: None,
            manual_command: None,
        }
    }
}

/// Where the running binary is, resolved.
///
/// One line, and here rather than in each platform, because *what counts as an
/// installed package* is the part that differs and this is the part that does
/// not. Canonicalised, so the comparison an installed link is judged by has one
/// spelling of the path on both sides.
pub fn running_binary() -> Option<PathBuf> {
    std::fs::canonicalize(std::env::current_exe().ok()?).ok()
}

/// Whether the command is installed, and what it points at.
#[cfg(target_os = "macos")]
pub fn status() -> CommandLineStatus {
    super::macos::command_line_status()
}

/// Installs it, and answers with the status that follows.
#[cfg(target_os = "macos")]
pub fn install() -> AppResult<CommandLineStatus> {
    super::macos::install_command_line()
}

/// v0 ships macOS only. Off it there is no second implementation to keep
/// honest, so this reports that nothing is installable rather than claiming a
/// command the human will never have — the same shape `open_in_default_app`
/// takes in `platform/mod.rs`.
#[cfg(not(target_os = "macos"))]
pub fn status() -> CommandLineStatus {
    CommandLineStatus::unavailable(Path::new(COMMAND_NAME))
}

#[cfg(not(target_os = "macos"))]
pub fn install() -> AppResult<CommandLineStatus> {
    Err(crate::core::AppError::new(
        crate::core::ErrorCode::Internal,
        "Installing the longclaw command is macOS-only in v0.",
        false,
    ))
}
