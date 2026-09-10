use std::fs;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::Arc;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2_app_kit::{NSWorkspace, NSWorkspaceDidWakeNotification};
use objc2_foundation::{NSNotification, NSNotificationCenter, NSObjectProtocol, NSString, NSURL};
use uuid::Uuid;

use super::command_line::{self, CommandLineState, CommandLineStatus, COMMAND_NAME};
use crate::core::{AppError, AppResult, ErrorCode};

#[allow(dead_code)]
pub struct WakeObserver {
    center: Retained<NSNotificationCenter>,
    block: RcBlock<dyn Fn(NonNull<NSNotification>)>,
    token: Retained<ProtocolObject<dyn NSObjectProtocol>>,
}

unsafe impl Send for WakeObserver {}

impl Drop for WakeObserver {
    fn drop(&mut self) {
        let observer: &AnyObject = self.token.as_ref();
        unsafe { self.center.removeObserver(observer) };
    }
}

/// Installs a wake observer owned by one project watcher. Its token and callback
/// are released when that watcher is replaced or dropped.
pub fn observe_wake(callback: Arc<dyn Fn() + Send + Sync + 'static>) -> WakeObserver {
    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| callback());
    let token = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceDidWakeNotification),
            None,
            None,
            &block,
        )
    };
    WakeObserver {
        center,
        block,
        token,
    }
}

/// Hands one file to whatever the human has already chosen to open `.md` with.
///
/// LaunchServices rather than a shell: the release boundary forbids a shell or
/// process-launch plugin and the audit fails the build on `Command::new`
/// (`docs/acceptance/release-candidate.md`). `NSWorkspace` asks the system to
/// open a file the app already holds a canonical path to, which is the same
/// AppKit surface the wake observer above uses — no `$EDITOR`, no argument
/// string, nothing for a ticket key to be interpolated into.
///
/// Returns whether the system accepted the file.
pub fn open_in_default_app(path: &Path) -> bool {
    let Some(text) = path.to_str() else {
        return false;
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(text));
    NSWorkspace::sharedWorkspace().openURL(&url)
}

// --------------------------------------------------- the `longclaw` command on PATH

/// Where a macOS install puts the command (LC-233).
///
/// `/usr/local/bin` because it is on `PATH` on every Mac by default and needs
/// no shell profile edited to become so. It is also the directory Homebrew
/// chowned to the console user for years, which is why on most developer Macs
/// the write below simply succeeds and no administrator is ever involved; on a
/// clean Apple Silicon machine it may not exist at all, and creating it does
/// need root. Both cases are answered the same way — say what happened, and
/// hand over the line that does it.
const COMMAND_DIR: &str = "/usr/local/bin";

/// Where the command goes: `/usr/local/bin/longclaw`.
fn install_path() -> PathBuf {
    Path::new(COMMAND_DIR).join(COMMAND_NAME)
}

/// What a failure here is about, for `AppError::io` to open its sentence with,
/// in words that make sense to somebody who has never heard of a symlink
/// (V0-29). It is an action verb and not a message prefix: the refusals below
/// are whole sentences and read worse with one bolted on.
const INSTALL_ACTION: &str = "Installing the longclaw command";

/// The app's own copy of the CLI: the binary beside the running one, **inside an
/// installed app bundle**.
///
/// The bundle shape is checked rather than assumed, and that check is the whole
/// point of the function. "The sibling of `current_exe`" is true in a checkout
/// too — `cargo test` builds every `[[bin]]`, so `target/debug/longclaw` exists
/// on any machine that has ever run the suite — and a `npm run dev` window would
/// then read as `absent` and offer to link `/usr/local/bin/longclaw` at a path
/// inside `target/`. That link is a debug build, is wrong the moment anything is
/// rebuilt, and disappears on `cargo clean`. A link the app already knows will
/// break is not a link to offer, and `unavailable` is the honest answer for a
/// window that is not running out of a bundle.
fn bundled_command() -> Option<PathBuf> {
    bundled_beside(command_line::running_binary()?.as_path())
}

/// The same question about a given binary, so the suite can ask it. Split out
/// for the reason `describe` is: `current_exe` is not something a test can move.
fn bundled_beside(running: &Path) -> Option<PathBuf> {
    let macos_dir = running.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }
    let contents = macos_dir.parent()?;
    if contents.file_name()? != "Contents" {
        return None;
    }
    if contents.parent()?.extension()? != "app" {
        return None;
    }
    let resolved = fs::canonicalize(macos_dir.join(COMMAND_NAME)).ok()?;
    resolved.is_file().then_some(resolved)
}

pub fn command_line_status() -> CommandLineStatus {
    describe(bundled_command().as_deref(), &install_path())
}

pub fn install_command_line() -> AppResult<CommandLineStatus> {
    let link = install_path();
    let Some(source) = bundled_command() else {
        // Nothing to install rather than a failed install: this window is not
        // running out of a bundle, and the pane already says so.
        return Err(AppError::new(
            ErrorCode::Io,
            "LongClaw has no copy of the longclaw command beside it to install. \
             This window is not running from an installed app.",
            false,
        ));
    };
    install_into(&source, &link)?;
    Ok(describe(Some(&source), &link))
}

/// Reads what is installed, without writing anything.
///
/// Split from `install_command_line` and taking both paths so the suite can
/// drive it against a temporary directory: `/usr/local/bin` is not somewhere a
/// test may write, and a seam that could only be exercised by installing the
/// real thing would be a seam nothing ever exercised.
fn describe(source: Option<&Path>, link: &Path) -> CommandLineStatus {
    let Some(source) = source else {
        return CommandLineStatus::unavailable(link);
    };
    // `symlink_metadata`, not `metadata`: the question is what the *name* is,
    // and `metadata` follows a link — a dangling one would read as absent, which
    // is exactly the stale install this has to be able to re-link.
    let (state, current_target) = match fs::symlink_metadata(link) {
        Err(_) => (CommandLineState::Absent, None),
        Ok(entry) if entry.file_type().is_symlink() => {
            let target = fs::read_link(link).ok();
            let resolves_here = fs::canonicalize(link).is_ok_and(|resolved| resolved == source);
            let state = if resolves_here {
                CommandLineState::Linked
            } else {
                CommandLineState::Stale
            };
            (state, target)
        }
        Ok(_) => (CommandLineState::Occupied, None),
    };
    CommandLineStatus {
        state,
        source_path: Some(source.display().to_string()),
        link_path: link.display().to_string(),
        current_target: current_target.map(|path| path.display().to_string()),
        manual_command: Some(manual_command(source, link)),
    }
}

/// Points `link` at `source`, and refuses rather than escalating.
///
/// **No subprocess anywhere in it.** `osascript -e 'do shell script … with
/// administrator privileges'` is the usual way an app gets an authorisation
/// prompt, and it is not available here: the release boundary forbids a shell
/// or process-launch plugin and `release-audit.mjs:254` fails the build on
/// `Command::new`. The alternatives are a `Command::new` exemption or an
/// `SMAppService` privileged helper, and neither is worth a symlink — so a
/// refused write is answered in words, with the exact line to paste.
///
/// **The replacement is a rename, not a delete-then-create.** The link is built
/// under a temporary name first and moved onto the destination, so a working
/// install is never taken away before its replacement exists; a directory this
/// process cannot write fails at the temporary rather than after removing what
/// was there. That is `core::storage::atomic_write`'s shape, for the same
/// reason.
fn install_into(source: &Path, link: &Path) -> AppResult<()> {
    /// A refused write, in the words the *kind* of failure deserves.
    ///
    /// `EACCES` is the case this whole feature is about, and it gets its own
    /// sentence naming the folder and the way out. Every other kind is handed to
    /// `AppError::io`, which classifies by `io::ErrorKind` and names the cause:
    /// ADR 0010 keeps those apart precisely because they need different actions,
    /// and "not allowed to write it — run it from Terminal" is bad advice for a
    /// volume with no space left on it, which `sudo` will not fix either.
    ///
    /// The line to paste rides on both, because it is the way out of a refusal
    /// whatever the refusal was.
    fn refused(at: &Path, error: std::io::Error, permission: String, command: String) -> AppError {
        let reported = if error.kind() == std::io::ErrorKind::PermissionDenied {
            AppError::new(ErrorCode::PermissionDenied, permission, true)
                .with_context("path", at.display().to_string())
                .with_context("systemError", error.to_string())
        } else {
            AppError::io(INSTALL_ACTION, at, error)
        };
        reported.with_context("command", command)
    }

    let command = manual_command(source, link);
    let Some(parent) = link.parent() else {
        return Err(AppError::new(
            ErrorCode::Io,
            format!("{} has no folder to install into.", link.display()),
            false,
        )
        .with_context("path", link.display().to_string()));
    };
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|error| {
            refused(
                parent,
                error,
                format!(
                    "{} does not exist, and creating it needs an administrator. \
                     Run the install from Terminal instead.",
                    parent.display()
                ),
                command.clone(),
            )
        })?;
    }
    // A file this app did not create is somebody's own install — a binary they
    // built, or one another tool put there. It is not replaced, because the
    // undo for replacing it does not exist: the link that would stand in its
    // place remembers nothing about the bytes it displaced.
    if fs::symlink_metadata(link).is_ok_and(|entry| !entry.file_type().is_symlink()) {
        return Err(AppError::new(
            ErrorCode::Io,
            format!(
                "{} is a file LongClaw did not create, and LongClaw will not \
                 replace one. Move or rename it, then try again.",
                link.display()
            ),
            true,
        )
        .with_context("path", link.display().to_string())
        .with_context("command", command));
    }
    let temporary = parent.join(format!(".{COMMAND_NAME}.longclaw-{}.tmp", Uuid::new_v4()));
    symlink(source, &temporary).map_err(|error| {
        refused(
            parent,
            error,
            format!(
                "LongClaw is not allowed to write to {}. Run the install from \
                 Terminal instead.",
                parent.display()
            ),
            command.clone(),
        )
    })?;
    fs::rename(&temporary, link).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        refused(
            link,
            error,
            format!(
                "LongClaw is not allowed to replace {}. Run the install from \
                 Terminal instead.",
                link.display()
            ),
            command,
        )
    })
}

/// The line a person runs when the app is refused.
///
/// `mkdir -p` unconditionally, because it costs nothing on a directory that
/// exists and one line that works in every case beats two that each work in
/// one. `ln -sf` rather than `ln -s`, because the case this is most often
/// needed for is re-linking over an install that is already there, and `ln -s`
/// fails on it.
fn manual_command(source: &Path, link: &Path) -> String {
    let directory = link.parent().unwrap_or(Path::new(COMMAND_DIR));
    format!(
        "sudo mkdir -p {} && sudo ln -sf {} {}",
        shell_quoted(directory),
        shell_quoted(source),
        shell_quoted(link)
    )
}

/// One argument, safe to paste into a shell.
///
/// Single quotes and the `'\''` escape: the POSIX form that needs no exceptions.
/// A path with a space in it is ordinary on a Mac — `/Volumes/My Disk` — and a
/// command that has to be edited before it runs is not the "exact line" the
/// refusal promises.
fn shell_quoted(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', r"'\''"))
}

#[cfg(test)]
mod command_line_tests {
    use std::fs;
    use std::os::unix::fs::{symlink, PermissionsExt};
    use std::path::Path;

    use super::{
        bundled_beside, describe, install_into, manual_command, shell_quoted, CommandLineState,
    };

    /// A temp directory standing in for `/usr/local/bin`, and a file standing in
    /// for the bundle's own binary.
    fn fixture() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
        let temp = tempfile::tempdir().unwrap();
        let bundle = temp.path().join("LongClaw.app/Contents/MacOS");
        fs::create_dir_all(&bundle).unwrap();
        let source = bundle.join("longclaw");
        fs::write(&source, b"#!/bin/sh\n").unwrap();
        let source = fs::canonicalize(&source).unwrap();
        let bin = temp.path().join("usr/local/bin");
        fs::create_dir_all(&bin).unwrap();
        (temp, source, bin.join("longclaw"))
    }

    fn state(source: &Path, link: &Path) -> CommandLineState {
        describe(Some(source), link).state
    }

    #[test]
    fn nothing_installed_reads_as_absent_and_installing_links_this_build() {
        let (_temp, source, link) = fixture();

        assert_eq!(state(&source, &link), CommandLineState::Absent);
        install_into(&source, &link).unwrap();

        let after = describe(Some(&source), &link);
        assert_eq!(after.state, CommandLineState::Linked);
        assert_eq!(fs::read_link(&link).unwrap(), source);
        assert_eq!(after.current_target, Some(source.display().to_string()));
    }

    /// The case the offer must not read as "already done": a link left by a copy
    /// of the app that has since moved. Installing re-points it (LC-233).
    #[test]
    fn a_link_pointing_at_another_build_is_stale_and_is_relinked() {
        let (temp, source, link) = fixture();
        let previous = temp
            .path()
            .join("Downloads/LongClaw.app/Contents/MacOS/longclaw");
        fs::create_dir_all(previous.parent().unwrap()).unwrap();
        fs::write(&previous, b"#!/bin/sh\n").unwrap();
        symlink(&previous, &link).unwrap();

        let before = describe(Some(&source), &link);
        assert_eq!(before.state, CommandLineState::Stale);
        assert_eq!(before.current_target, Some(previous.display().to_string()));

        install_into(&source, &link).unwrap();
        assert_eq!(state(&source, &link), CommandLineState::Linked);
    }

    /// A link whose target has been deleted still *exists* as a name, so it is
    /// stale rather than absent — `metadata` would follow it and report neither.
    #[test]
    fn a_link_whose_target_is_gone_is_stale_rather_than_absent() {
        let (temp, source, link) = fixture();
        symlink(temp.path().join("gone/longclaw"), &link).unwrap();

        assert_eq!(state(&source, &link), CommandLineState::Stale);
        install_into(&source, &link).unwrap();
        assert_eq!(state(&source, &link), CommandLineState::Linked);
    }

    /// Somebody's own binary is not this app's to replace: there is no undo for
    /// the bytes a link would stand on top of.
    #[test]
    fn a_real_file_is_occupied_and_is_refused_rather_than_replaced() {
        let (_temp, source, link) = fixture();
        fs::write(&link, b"somebody else's longclaw").unwrap();

        assert_eq!(state(&source, &link), CommandLineState::Occupied);
        let error = install_into(&source, &link).unwrap_err();

        assert!(error.message.contains("will not"), "{}", error.message);
        assert!(error.context.contains_key("command"));
        assert_eq!(fs::read(&link).unwrap(), b"somebody else's longclaw");
    }

    /// A clean Apple Silicon machine has no `/usr/local/bin` at all. Creating it
    /// is tried, and the refusal when it cannot be is a sentence plus the line.
    #[test]
    fn a_missing_folder_is_created_when_it_can_be() {
        let (temp, source, _link) = fixture();
        let link = temp.path().join("fresh/usr/local/bin/longclaw");

        install_into(&source, &link).unwrap();

        assert_eq!(state(&source, &link), CommandLineState::Linked);
    }

    #[test]
    fn a_folder_this_process_cannot_write_is_refused_with_the_line_to_paste() {
        let (_temp, source, link) = fixture();
        let directory = link.parent().unwrap();
        fs::set_permissions(directory, fs::Permissions::from_mode(0o555)).unwrap();

        let error = install_into(&source, &link).unwrap_err();

        fs::set_permissions(directory, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(error.code, crate::core::ErrorCode::PermissionDenied);
        assert!(error.message.contains("Terminal"), "{}", error.message);
        let command = error.context.get("command").unwrap();
        assert!(command.starts_with("sudo mkdir -p "), "{command}");
        assert!(command.contains("ln -sf"), "{command}");
        assert!(command.contains(&source.display().to_string()), "{command}");
        // Nothing was left behind by the attempt.
        assert!(fs::read_dir(directory).unwrap().next().is_none());
    }

    /// The refusal promises the *exact* line. A path with a space in it is
    /// ordinary on a Mac, and a line that has to be edited before it runs is not
    /// the promise being kept.
    #[test]
    fn the_line_quotes_a_path_a_shell_would_otherwise_split() {
        let quoted = manual_command(
            Path::new("/Volumes/My Disk/LongClaw.app/Contents/MacOS/longclaw"),
            Path::new("/usr/local/bin/longclaw"),
        );

        assert!(quoted.contains("'/Volumes/My Disk/LongClaw.app/Contents/MacOS/longclaw'"));
        assert!(quoted.ends_with("'/usr/local/bin/longclaw'"));
        assert_eq!(shell_quoted(Path::new("/a'b")), "'/a'\\''b'");
    }

    /// The bundle is what makes a copy of the command installable, and a
    /// checkout is not one.
    ///
    /// `cargo test` builds every `[[bin]]`, so `target/debug/longclaw` exists on
    /// any machine that has run this suite — including the one running it now.
    /// A sibling check alone would call that installable, and a `npm run dev`
    /// window would offer to put a debug binary from `target/` on the user's
    /// `PATH`, where it would be wrong after the next rebuild and gone after a
    /// `cargo clean`.
    #[test]
    fn only_a_binary_inside_an_app_bundle_counts_as_installable() {
        let temp = tempfile::tempdir().unwrap();
        let bundled = |layout: &str| {
            let dir = temp.path().join(layout);
            fs::create_dir_all(&dir).unwrap();
            for name in ["longclaw", "longclaw-desktop"] {
                fs::write(dir.join(name), b"#!/bin/sh\n").unwrap();
            }
            bundled_beside(&dir.join("longclaw-desktop"))
        };

        assert!(bundled("LongClaw.app/Contents/MacOS").is_some());
        // The three shapes a checkout produces, and one near-miss.
        assert_eq!(bundled("target/debug"), None);
        assert_eq!(bundled("target/release"), None);
        assert_eq!(bundled("LongClaw/Contents/MacOS"), None);
        assert_eq!(bundled("LongClaw.app/Resources/MacOS"), None);
    }

    /// The sibling has to actually be there: a bundle is not a promise.
    #[test]
    fn a_bundle_missing_the_command_is_not_installable() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().join("LongClaw.app/Contents/MacOS");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("longclaw-desktop"), b"#!/bin/sh\n").unwrap();

        assert_eq!(bundled_beside(&dir.join("longclaw-desktop")), None);
    }

    /// A build with no CLI beside it has nothing to offer, which is not a
    /// failure and must not read as one.
    #[test]
    fn a_build_with_no_binary_beside_it_is_unavailable_and_offers_no_line() {
        let status = describe(None, Path::new("/usr/local/bin/longclaw"));

        assert_eq!(status.state, CommandLineState::Unavailable);
        assert_eq!(status.source_path, None);
        assert_eq!(status.manual_command, None);
        assert_eq!(status.link_path, "/usr/local/bin/longclaw");
    }
}
