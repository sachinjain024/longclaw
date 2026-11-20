use std::fs;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::Arc;

use crate::privileged::{shell_quote, Privileged, PromptError, Script, LINK_OCCUPIED};

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

/// Shows one file selected in a Finder window (LC-206: **Show in Finder**).
///
/// The same AppKit surface as [`open_in_default_app`], and the safer half of
/// it: Finder selects the file and runs nothing, so this is the way round a
/// file that is not opened from the app. Returns whether Finder accepted it.
pub fn reveal_in_finder(path: &Path) -> bool {
    let Some(text) = path.to_str() else {
        return false;
    };
    // An empty root is "the Finder window the system picks", which is what a
    // person pressing the button expects.
    NSWorkspace::sharedWorkspace()
        .selectFile_inFileViewerRootedAtPath(Some(&NSString::from_str(text)), &NSString::new())
}

/// Hands one `https:` URL to the default browser.
///
/// The webview names no URL to reach this: the caller is `open_download_page`,
/// which has one constant to offer and no parameter, the same shape
/// `open_ticket_file` takes with a ticket key. A surface that could pass a URL
/// here would be a surface with a network capability spelled differently.
pub fn open_web_url(url: &str) -> bool {
    match NSURL::URLWithString(&NSString::from_str(url)) {
        Some(url) => NSWorkspace::sharedWorkspace().openURL(&url),
        None => false,
    }
}

// --------------------------------------------------- the `longclaw` command on PATH

/// Where a macOS install puts the command (LC-233).
///
/// `/usr/local/bin` because it is on `PATH` on every Mac by default and needs
/// no shell profile edited to become so. It is also the directory Homebrew
/// chowned to the console user for years, which is why on most developer Macs
/// the write below simply succeeds and no administrator is ever involved; on a
/// clean Apple Silicon machine it may not exist at all, and creating it does
/// need root. That case is answered with macOS's own password sheet, once,
/// running the link script in `privileged.rs` (LC-285r, ADR 0018 as amended);
/// the line to paste is left for when even the sheet is refused.
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
    let macos_dir = app_bundle_of(running)?.join("Contents/MacOS");
    let resolved = fs::canonicalize(macos_dir.join(COMMAND_NAME)).ok()?;
    resolved.is_file().then_some(resolved)
}

/// The `.app` a binary is running out of, if it is running out of one.
///
/// `Contents/MacOS/<binary>` and nothing else. Split out because two things now
/// ask the same question for the same reason: the command-line pane, which will
/// not offer a link to a binary inside `target/`, and the update path, which
/// has nothing to replace unless there is a bundle to replace (LC-256a).
fn app_bundle_of(running: &Path) -> Option<PathBuf> {
    let macos_dir = running.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }
    let contents = macos_dir.parent()?;
    if contents.file_name()? != "Contents" {
        return None;
    }
    let bundle = contents.parent()?;
    (bundle.extension()? == "app").then(|| bundle.to_path_buf())
}

/// Whether this process is running out of an installed `.app`.
///
/// The update path's availability test. A `npm run dev` window, a `cargo test`
/// binary and the perf harness all answer `false`, which is what makes a build
/// with no bundle to replace report itself unavailable rather than failing a
/// check it was never able to make (LC-256a, D10).
pub fn running_from_bundle() -> bool {
    running_bundle().is_some()
}

/// The `.app` this process is running out of — the one an update replaces,
/// and the one whose folder the replacement's sweep tidies (LC-267r).
pub fn running_bundle() -> Option<PathBuf> {
    command_line::running_binary()
        .as_deref()
        .and_then(app_bundle_of)
}

pub fn command_line_status() -> CommandLineStatus {
    describe(bundled_command().as_deref(), &install_path())
}

pub fn install_command_line() -> AppResult<CommandLineStatus> {
    let link = install_path();
    let source = bundled_command().ok_or_else(nothing_to_install)?;
    install_into(&source, &link)?;
    Ok(describe(Some(&source), &link))
}

/// The second step, after `install_command_line` was refused with
/// [`ESCALATE`]: the same link, made by the link script through one
/// administrator prompt (LC-285r).
///
/// Blocks until a person answers the sheet, so it must be called off the main
/// thread — the sheet needs that thread, and `MainThreadPrompt` hops onto it.
pub fn install_command_line_as_admin(privileged: &dyn Privileged) -> AppResult<CommandLineStatus> {
    let link = install_path();
    let source = bundled_command().ok_or_else(nothing_to_install)?;
    install_as_admin(&source, &link, privileged)?;
    Ok(describe(Some(&source), &link))
}

/// Nothing to install rather than a failed install: this window is not
/// running out of a bundle, and the pane already says so.
fn nothing_to_install() -> AppError {
    AppError::new(
        ErrorCode::Io,
        "LongClaw has no copy of the longclaw command beside it to install. \
         This window is not running from an installed app.",
        false,
    )
}

/// The context key on the one refusal an administrator can answer: the plain
/// write was refused for want of rights (`EACCES`). Nothing else carries it —
/// not a full disk or a read-only volume, which `sudo` would not fix either,
/// and not an occupied name, which is never replaced however it is asked.
pub const ESCALATE: &str = "escalate";

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

/// A refused write, in the words the *kind* of failure deserves.
///
/// `EACCES` is the case this whole feature is about: it gets its own sentence
/// naming the folder, and the [`ESCALATE`] flag that sends the install on to
/// the administrator prompt. Every other kind is handed to `AppError::io`,
/// which classifies by `io::ErrorKind` and names the cause: ADR 0010 keeps
/// those apart precisely because they need different actions, and an
/// administrator is bad advice for a volume with no space left on it, which
/// `sudo` will not fix either.
///
/// The line to paste rides only on the first, as the way out for a caller that
/// does not go on to the sheet — the app's own surfaces always do, and show
/// the line `install_as_admin` attaches if the password is refused. Never on
/// the second: it is the same write as root, so it is no way out of a failure
/// `sudo` cannot fix (LC-285r, item 4.1).
///
/// A full disk is the one other cause said in the install's own words — the
/// copy deck's `refusal.diskfull` (LC-285r, 6.1) — because `AppError::io`
/// names the folder by its last component, and "failed for bin." reads as a
/// typo. The rest of the app keeps the shared wording.
fn refused(at: &Path, error: std::io::Error, permission: String, command: String) -> AppError {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => {
            AppError::new(ErrorCode::PermissionDenied, permission, true)
                .with_context("path", at.display().to_string())
                .with_context("systemError", error.to_string())
                .with_context(ESCALATE, "true")
                .with_context("command", command)
        }
        std::io::ErrorKind::StorageFull => AppError::new(
            ErrorCode::Io,
            "Installing the longclaw command failed: there is no space left on the disk.",
            true,
        )
        .with_context("path", at.display().to_string())
        .with_context("systemError", error.to_string())
        .with_context("cause", "noSpace"),
        _ => AppError::io(INSTALL_ACTION, at, error),
    }
}

/// A file this app did not create is somebody's own install — a binary they
/// built, or one another tool put there. It is not replaced, because the undo
/// for replacing it does not exist: the link that would stand in its place
/// remembers nothing about the bytes it displaced. One sentence whether the app
/// saw it before the password or the link script found it after, and both say
/// the name is now `occupied`: the status the surface read before the press is
/// stale, and re-reading it puts the surface in the state that has no button.
fn occupied(link: &Path, command: String) -> AppError {
    AppError::new(
        ErrorCode::Io,
        // The copy deck's `status.occupied`, so the refusal and the state it
        // leaves the surface in say one thing.
        format!(
            "LongClaw cannot replace {}. Move it or rename it, then reopen \
             this pane, or run the line below yourself.",
            link.display()
        ),
        true,
    )
    .with_context("path", link.display().to_string())
    .with_context("command", command)
    .with_context("state", "occupied")
}

/// Where a link is made before it is renamed onto the name on `PATH`.
fn temporary_beside(folder: &Path) -> PathBuf {
    folder.join(format!(".{COMMAND_NAME}.longclaw-{}.tmp", Uuid::new_v4()))
}

/// Points `link` at `source` with the person's own rights, and refuses rather
/// than escalating.
///
/// **Always tried first.** A Mac whose `/usr/local/bin` the person can write —
/// most developer Macs, because Homebrew chowned it — never sees a password
/// sheet. Only a refusal for want of rights carries [`ESCALATE`], and the
/// frontend answers that with the second command, `install_as_admin`, rather
/// than this function asking for anything itself (LC-285r).
///
/// **The replacement is a rename, not a delete-then-create.** The link is built
/// under a temporary name first and moved onto the destination, so a working
/// install is never taken away before its replacement exists; a directory this
/// process cannot write fails at the temporary rather than after removing what
/// was there. That is `core::storage::atomic_write`'s shape, for the same
/// reason.
pub fn install_into(source: &Path, link: &Path) -> AppResult<()> {
    let command = manual_command(source, link);
    let parent = link.parent().ok_or_else(|| no_folder(link))?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|error| {
            refused(
                parent,
                error,
                format!(
                    "{} does not exist, and creating it needs an admin.",
                    parent.display()
                ),
                command.clone(),
            )
        })?;
    }
    if fs::symlink_metadata(link).is_ok_and(|entry| !entry.file_type().is_symlink()) {
        return Err(occupied(link, command));
    }
    let temporary = temporary_beside(parent);
    symlink(source, &temporary).map_err(|error| {
        refused(
            parent,
            error,
            format!("Writing to {} needs an admin.", parent.display()),
            command.clone(),
        )
    })?;
    fs::rename(&temporary, link).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        refused(
            link,
            error,
            format!("Replacing {} needs an admin.", link.display()),
            command,
        )
    })
}

/// Points `link` at `source` through the administrator prompt (LC-285r).
///
/// The link script does what `install_into` does, as root: makes the folder,
/// refuses an occupied name, links beside and renames in. What comes back is
/// the prompt's outcome in the words each one deserves — a cancel is nothing
/// to report, a refusal hands over the line for whoever does administer this
/// Mac, an occupied name found as root is the same refusal the plain write
/// gives, and anything else is the script's own reason.
pub fn install_as_admin(source: &Path, link: &Path, privileged: &dyn Privileged) -> AppResult<()> {
    let command = manual_command(source, link);
    let parent = link.parent().ok_or_else(|| no_folder(link))?;
    let script = Script::LinkCommand {
        source: source.to_path_buf(),
        link: link.to_path_buf(),
        temporary: temporary_beside(parent),
    };
    privileged.run(&script).map_err(|outcome| match outcome {
        PromptError::Cancelled => {
            AppError::new(ErrorCode::Cancelled, "Nothing was installed.", true)
        }
        PromptError::Refused => AppError::new(
            ErrorCode::PermissionDenied,
            "macOS did not accept an administrator password, so nothing was \
             installed. If someone else administers this Mac, they can run the \
             line below.",
            true,
        )
        .with_context("path", parent.display().to_string())
        .with_context("command", command),
        PromptError::Failed {
            code: Some(LINK_OCCUPIED),
            ..
        } => occupied(link, command),
        failed @ PromptError::Failed { .. } => AppError::new(
            ErrorCode::Io,
            format!("LongClaw could not install the command, even as an administrator: {failed}"),
            true,
        )
        .with_context("path", link.display().to_string()),
    })
}

/// A link path with no folder above it, which nothing can install into.
fn no_folder(link: &Path) -> AppError {
    AppError::new(
        ErrorCode::Io,
        format!("{} has no folder to install into.", link.display()),
        false,
    )
    .with_context("path", link.display().to_string())
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
        shell_quote(directory),
        shell_quote(source),
        shell_quote(link)
    )
}

#[cfg(test)]
mod command_line_tests {
    use std::fs;
    use std::os::unix::fs::{symlink, PermissionsExt};
    use std::path::Path;

    use super::{
        bundled_beside, describe, install_into, manual_command, refused, shell_quote,
        CommandLineState, ESCALATE,
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

        // The copy deck's `status.occupied` (LC-285r): no "try again", because
        // there is no button that could.
        assert_eq!(
            error.message,
            format!(
                "LongClaw cannot replace {}. Move it or rename it, then reopen \
                 this pane, or run the line below yourself.",
                link.display()
            )
        );
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

    /// The refusal is the password sheet's cue rather than something a person
    /// reads (LC-285r): it carries `escalate`, and the line for a caller that
    /// does not escalate. It no longer promises "the line below", which the
    /// copy deck deleted with the screen that showed it (`refusal.denied`).
    #[test]
    fn a_folder_this_process_cannot_write_is_refused_for_the_password_sheet() {
        let (_temp, source, link) = fixture();
        let directory = link.parent().unwrap();
        fs::set_permissions(directory, fs::Permissions::from_mode(0o555)).unwrap();

        let error = install_into(&source, &link).unwrap_err();

        fs::set_permissions(directory, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(error.code, crate::core::ErrorCode::PermissionDenied);
        assert!(error.context.contains_key(ESCALATE));
        assert!(!error.message.contains("line below"), "{}", error.message);
        let command = error.context.get("command").unwrap();
        assert!(command.starts_with("sudo mkdir -p "), "{command}");
        assert!(command.contains("ln -sf"), "{command}");
        assert!(command.contains(&source.display().to_string()), "{command}");
        // Nothing was left behind by the attempt.
        assert!(fs::read_dir(directory).unwrap().next().is_none());
    }

    /// Only a refusal for want of rights goes on to the password sheet. A full
    /// disk and a read-only volume are failures `sudo` cannot fix, so they are
    /// reported and never escalated (LC-285r, Q4).
    #[test]
    fn only_a_permission_refusal_offers_an_administrator() {
        let at = Path::new("/usr/local/bin");
        let escalates = |kind: std::io::ErrorKind| {
            refused(at, kind.into(), "denied".into(), "sudo …".into())
                .context
                .contains_key(ESCALATE)
        };

        assert!(escalates(std::io::ErrorKind::PermissionDenied));
        assert!(!escalates(std::io::ErrorKind::StorageFull));
        assert!(!escalates(std::io::ErrorKind::ReadOnlyFilesystem));
        assert!(!escalates(std::io::ErrorKind::QuotaExceeded));
    }

    /// A full disk reads as the copy deck's `refusal.diskfull` (LC-285r, 6.1),
    /// in the install's own words rather than the shared `failed for bin.`
    #[test]
    fn a_full_disk_says_so_in_the_install_s_own_words() {
        let error = refused(
            Path::new("/usr/local/bin"),
            std::io::ErrorKind::StorageFull.into(),
            "denied".into(),
            "sudo …".into(),
        );

        assert_eq!(error.code, crate::core::ErrorCode::Io);
        assert_eq!(
            error.message,
            "Installing the longclaw command failed: there is no space left on the disk."
        );
        assert_eq!(error.context.get("path").unwrap(), "/usr/local/bin");
    }

    /// And they hand over no `sudo` line either: running the same write as
    /// root does not make room on a full disk (LC-285r, item 4.1).
    #[test]
    fn a_failure_sudo_cannot_fix_hands_over_no_line() {
        let at = Path::new("/usr/local/bin");
        let line = |kind: std::io::ErrorKind| {
            refused(at, kind.into(), "denied".into(), "sudo …".into())
                .context
                .contains_key("command")
        };

        assert!(line(std::io::ErrorKind::PermissionDenied));
        assert!(!line(std::io::ErrorKind::StorageFull));
        assert!(!line(std::io::ErrorKind::ReadOnlyFilesystem));
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
        assert_eq!(shell_quote(Path::new("/a'b")), "'/a'\\''b'");
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
