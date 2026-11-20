//! Installing the `longclaw` command through the administrator prompt
//! (LC-285r), driven the way the two IPC commands drive it: the plain write
//! first, then — only when that write was refused for want of rights — the
//! link script through the `Privileged` port, run here by `/bin/sh` with no
//! rights at all.
//!
//! Here rather than beside the platform module because running the script is
//! a process launch, and the release audit holds shipped source to none.
#![cfg(target_os = "macos")]

use std::cell::Cell;
use std::fs;
use std::os::unix::fs::{symlink, PermissionsExt};
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::core::{AppError, ErrorCode};
use longclaw_desktop_lib::platform::macos::{install_as_admin, install_into};
use longclaw_desktop_lib::privileged::{Privileged, PromptError, Script};

/// Runs the script with `/bin/sh` and no rights, after giving `folder` back
/// its write bit — standing in for the rights a password grants.
struct Shell<'a> {
    folder: &'a Path,
    ran: Cell<bool>,
}

impl<'a> Shell<'a> {
    fn granting(folder: &'a Path) -> Self {
        Self {
            folder,
            ran: Cell::new(false),
        }
    }
}

impl Privileged for Shell<'_> {
    fn run(&self, script: &Script) -> Result<(), PromptError> {
        self.ran.set(true);
        assert!(
            matches!(script, Script::LinkCommand { .. }),
            "the install asked for {script:?}"
        );
        fs::set_permissions(self.folder, fs::Permissions::from_mode(0o755))
            .map_err(|error| PromptError::broken(error.to_string()))?;
        let output = std::process::Command::new("/bin/sh")
            .arg("-c")
            .arg(script.source())
            .output()
            .map_err(|error| PromptError::broken(error.to_string()))?;
        if output.status.success() {
            Ok(())
        } else {
            Err(PromptError::Failed {
                code: output.status.code(),
                reason: String::from_utf8_lossy(&output.stderr).into_owned(),
            })
        }
    }
}

/// A prompt that answers without running anything.
struct Answers(fn() -> PromptError);

impl Privileged for Answers {
    fn run(&self, _script: &Script) -> Result<(), PromptError> {
        Err(self.0())
    }
}

/// A prompt the plain write must never reach.
struct NoPrompt;

impl Privileged for NoPrompt {
    fn run(&self, script: &Script) -> Result<(), PromptError> {
        panic!("no administrator prompt was expected, and {script:?} was asked for");
    }
}

/// A temp directory standing in for `/usr/local`, with `bin` inside it, and a
/// file standing in for the bundle's own binary — under a name a careless
/// script would split.
struct Mac {
    _root: tempfile::TempDir,
    source: PathBuf,
    local: PathBuf,
    bin: PathBuf,
    link: PathBuf,
}

impl Mac {
    fn new() -> Self {
        let root = tempfile::tempdir().unwrap();
        let macos = root
            .path()
            .join("Apps it's $HOME/LongClaw.app/Contents/MacOS");
        fs::create_dir_all(&macos).unwrap();
        let source = macos.join("longclaw");
        fs::write(&source, b"#!/bin/sh\n").unwrap();
        let source = fs::canonicalize(&source).unwrap();
        let local = fs::canonicalize(root.path()).unwrap().join("usr/local");
        let bin = local.join("bin");
        fs::create_dir_all(&bin).unwrap();
        let link = bin.join("longclaw");
        Mac {
            _root: root,
            source,
            local,
            bin,
            link,
        }
    }

    /// A clean Apple Silicon Mac: no `bin` at all, in a `local` only root
    /// may write.
    fn without_bin() -> Self {
        let mac = Mac::new();
        fs::remove_dir(&mac.bin).unwrap();
        lock(&mac.local);
        mac
    }

    /// `bin` is there and owned by root.
    fn with_locked_bin() -> Self {
        let mac = Mac::new();
        lock(&mac.bin);
        mac
    }

    fn linked_here(&self) -> bool {
        fs::canonicalize(&self.link).is_ok_and(|resolved| resolved == self.source)
    }

    /// What is in `bin`, so a test can say nothing was left behind.
    fn entries(&self) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(&self.bin)
            .map(|entries| {
                entries
                    .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                    .collect()
            })
            .unwrap_or_default();
        names.sort();
        names
    }
}

impl Drop for Mac {
    fn drop(&mut self) {
        // A locked folder would otherwise outlive the test's temp directory.
        unlock(&self.local);
        if self.bin.exists() {
            unlock(&self.bin);
        }
    }
}

fn lock(folder: &Path) {
    fs::set_permissions(folder, fs::Permissions::from_mode(0o555)).unwrap();
}

fn unlock(folder: &Path) {
    let _ = fs::set_permissions(folder, fs::Permissions::from_mode(0o755));
}

fn escalates(error: &AppError) -> bool {
    error.context.get("escalate").map(String::as_str) == Some("true")
}

/// The two IPC steps, in the order the frontend takes them.
fn install(mac: &Mac, privileged: &dyn Privileged) -> Result<(), AppError> {
    match install_into(&mac.source, &mac.link) {
        Ok(()) => Ok(()),
        Err(error) if escalates(&error) => install_as_admin(&mac.source, &mac.link, privileged),
        Err(error) => Err(error),
    }
}

#[test]
fn a_missing_folder_is_created_and_linked_through_the_prompt() {
    let mac = Mac::without_bin();
    let shell = Shell::granting(&mac.local);

    install(&mac, &shell).unwrap();

    assert!(shell.ran.get());
    assert!(mac.linked_here());
    assert_eq!(mac.entries(), vec!["longclaw"]);
}

#[test]
fn a_locked_folder_escalates_and_links() {
    let mac = Mac::with_locked_bin();
    let shell = Shell::granting(&mac.bin);

    install(&mac, &shell).unwrap();

    assert!(shell.ran.get());
    assert!(mac.linked_here());
    assert_eq!(mac.entries(), vec!["longclaw"]);
}

#[test]
fn a_stale_link_in_a_locked_folder_is_re_pointed() {
    let mac = Mac::new();
    symlink(
        "/Applications/Old LongClaw.app/Contents/MacOS/longclaw",
        &mac.link,
    )
    .unwrap();
    lock(&mac.bin);
    let shell = Shell::granting(&mac.bin);

    install(&mac, &shell).unwrap();

    assert!(mac.linked_here());
    assert_eq!(mac.entries(), vec!["longclaw"]);
}

/// A stale link to a *folder* is replaced, not given the new link inside it,
/// which is what a plain `mv` onto it would do.
#[test]
fn a_stale_link_to_a_folder_is_replaced_rather_than_filled() {
    let mac = Mac::new();
    let elsewhere = mac.local.join("elsewhere");
    fs::create_dir(&elsewhere).unwrap();
    symlink(&elsewhere, &mac.link).unwrap();
    lock(&mac.bin);
    let shell = Shell::granting(&mac.bin);

    install(&mac, &shell).unwrap();

    assert!(mac.linked_here());
    assert_eq!(fs::read_dir(&elsewhere).unwrap().count(), 0);
}

#[test]
fn an_occupied_path_is_refused_without_a_prompt_and_left_alone() {
    let mac = Mac::new();
    fs::write(&mac.link, b"somebody else's longclaw").unwrap();

    let error = install(&mac, &NoPrompt).unwrap_err();

    assert!(!escalates(&error));
    assert_eq!(fs::read(&mac.link).unwrap(), b"somebody else's longclaw");
}

/// The plain write looked before the password; the script looks again after
/// it, as root, so a file that arrived in between is still never replaced.
#[test]
fn an_occupied_path_found_as_root_is_the_occupied_refusal_and_left_alone() {
    let mac = Mac::with_locked_bin();
    let shell = Shell::granting(&mac.bin);
    let refused = install_into(&mac.source, &mac.link).unwrap_err();
    assert!(escalates(&refused));
    unlock(&mac.bin);
    fs::write(&mac.link, b"arrived while the sheet was up").unwrap();
    lock(&mac.bin);

    let error = install_as_admin(&mac.source, &mac.link, &shell).unwrap_err();

    let plain = {
        unlock(&mac.bin);
        install_into(&mac.source, &mac.link).unwrap_err()
    };
    assert_eq!(error.code, plain.code);
    assert_eq!(error.message, plain.message);
    assert!(!escalates(&error));
    assert_eq!(
        fs::read(&mac.link).unwrap(),
        b"arrived while the sheet was up"
    );
    assert_eq!(mac.entries(), vec!["longclaw"]);
}

#[test]
fn a_cancel_changes_nothing() {
    let mac = Mac::with_locked_bin();

    let error = install(&mac, &Answers(|| PromptError::Cancelled)).unwrap_err();

    assert_eq!(error.code, ErrorCode::Cancelled);
    assert!(!mac.link.exists());
    assert_eq!(mac.entries(), Vec::<String>::new());
}

#[test]
fn a_refused_authorization_changes_nothing_and_hands_over_the_line() {
    let mac = Mac::with_locked_bin();

    let error = install(&mac, &Answers(|| PromptError::Refused)).unwrap_err();

    assert_eq!(error.code, ErrorCode::PermissionDenied);
    assert!(!escalates(&error), "a refusal must not ask again by itself");
    let command = error.context.get("command").unwrap();
    assert!(command.starts_with("sudo mkdir -p "), "{command}");
    assert!(!mac.link.exists());
}

/// The script ran as root and still failed — here because the stand-in grants
/// no rights to a folder it was not told about.
#[test]
fn a_script_that_fails_says_why_and_leaves_nothing_behind() {
    let mac = Mac::with_locked_bin();
    let elsewhere = mac.local.join("elsewhere");
    fs::create_dir(&elsewhere).unwrap();
    let shell = Shell::granting(&elsewhere);

    let error = install(&mac, &shell).unwrap_err();

    assert!(shell.ran.get());
    assert_eq!(error.code, ErrorCode::Io);
    assert!(!escalates(&error));
    assert!(
        error.message.contains("even as an administrator"),
        "{}",
        error.message
    );
    unlock(&mac.bin);
    assert_eq!(mac.entries(), Vec::<String>::new());
}
