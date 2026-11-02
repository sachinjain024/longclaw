//! The administrator path of the bundle replacement (LC-267r, ADR 0018),
//! driven through the public `replace` with the prompt's script run by
//! `/bin/sh` and no rights.
//!
//! Here rather than beside the module because running the script is a process
//! launch, and the release audit holds shipped source to none.
#![cfg(target_os = "macos")]

use std::cell::Cell;
use std::fs;
use std::io;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::bundle_replace::{replace, Privileged, Step};

const BUNDLE: &str = "LongClaw.app";

fn write_bundle(at: &Path, version: &str) {
    fs::create_dir_all(at.join("Contents/MacOS")).unwrap();
    fs::write(at.join("Contents/Info.plist"), format!("version {version}")).unwrap();
    fs::write(at.join("Contents/MacOS/longclaw-desktop"), b"#!/bin/sh\n").unwrap();
}

fn version_at(bundle: &Path) -> Option<String> {
    let plist = fs::read_to_string(bundle.join("Contents/Info.plist")).ok()?;
    bundle
        .join("Contents/MacOS/longclaw-desktop")
        .is_file()
        .then(|| plist.trim_start_matches("version ").to_string())
}

fn archive_of(version: &str) -> Vec<u8> {
    let source = tempfile::tempdir().unwrap();
    write_bundle(&source.path().join(BUNDLE), version);
    let encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
    let mut builder = tar::Builder::new(encoder);
    builder
        .append_dir_all(BUNDLE, source.path().join(BUNDLE))
        .unwrap();
    builder.into_inner().unwrap().finish().unwrap()
}

fn entries(folder: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(folder)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

/// Runs the script with `/bin/sh` and no rights, after giving the folder
/// back its write bit — standing in for the rights a password grants.
struct Shell<'a> {
    folder: &'a Path,
    ran: Cell<bool>,
    /// A command to shadow, and which of its calls fails.
    fail_on: Option<(&'a str, usize)>,
}

impl Privileged for Shell<'_> {
    fn run(&self, script: &str) -> io::Result<()> {
        self.ran.set(true);
        fs::set_permissions(self.folder, fs::Permissions::from_mode(0o755))?;
        let script = match self.fail_on {
            // Shadow one command so its nth call fails, the way a full
            // disk fails `ditto` or a vanished path fails `mv`.
            Some((command, nth)) => {
                let full = if command == "ditto" {
                    "/usr/bin/ditto"
                } else {
                    "/bin/mv"
                };
                format!(
                    "calls=0\n{command}() {{ calls=$((calls+1)); [ \"$calls\" -eq {nth} ] && return 1; {full} \"$@\"; }}\n{}",
                    script.replace(full, command)
                )
            }
            None => script.to_string(),
        };
        let status = std::process::Command::new("/bin/sh")
            .arg("-c")
            .arg(&script)
            .status()?;
        if status.success() {
            Ok(())
        } else {
            Err(io::Error::other(format!("script exited {status}")))
        }
    }
}

/// A folder holding the bundle that the user cannot write to, with a name
/// that a careless script would split.
fn locked() -> (tempfile::TempDir, PathBuf, PathBuf) {
    let root = tempfile::tempdir().unwrap();
    let folder = root.path().join("Apps it's 'quoted' $HOME");
    fs::create_dir(&folder).unwrap();
    let bundle = folder.join(BUNDLE);
    write_bundle(&bundle, "1.0");
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o555)).unwrap();
    (root, folder, bundle)
}

fn unlock(folder: &Path) {
    fs::set_permissions(folder, fs::Permissions::from_mode(0o755)).unwrap();
}

#[test]
fn a_folder_that_needs_an_administrator_is_replaced_through_the_prompt() {
    let (_root, folder, bundle) = locked();
    let shell = Shell {
        folder: &folder,
        ran: Cell::new(false),
        fail_on: None,
    };

    replace(&archive_of("2.0"), &bundle, &shell).unwrap();

    assert!(shell.ran.get());
    assert_eq!(version_at(&bundle).as_deref(), Some("2.0"));
    assert_eq!(entries(&folder), vec![BUNDLE]);
    unlock(&folder);
}

/// Window 2 of the ticket. The plugin's script removed the bundle first, so
/// a copy that failed partway left nothing; this one copies first.
#[test]
fn a_copy_that_fails_under_the_prompt_leaves_the_old_version() {
    let (_root, folder, bundle) = locked();
    let shell = Shell {
        folder: &folder,
        ran: Cell::new(false),
        fail_on: Some(("ditto", 1)),
    };

    let error = replace(&archive_of("2.0"), &bundle, &shell).unwrap_err();

    assert_eq!(error.step, Step::Privileged);
    assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
    assert_eq!(entries(&folder), vec![BUNDLE]);
}

#[test]
fn a_move_that_fails_under_the_prompt_puts_the_old_version_back() {
    let (_root, folder, bundle) = locked();
    // The first `mv` moves the bundle aside; the second, moving the new
    // version in, fails; the third puts the old one back.
    let shell = Shell {
        folder: &folder,
        ran: Cell::new(false),
        fail_on: Some(("mv", 2)),
    };

    let error = replace(&archive_of("2.0"), &bundle, &shell).unwrap_err();

    assert_eq!(error.step, Step::Privileged);
    assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
    assert_eq!(entries(&folder), vec![BUNDLE]);
}

/// The control for the two tests above: a shadow that never fires must
/// leave a script that still installs. Without it, a shadow that broke the
/// script outright would pass both as "failed, and 1.0 is still there".
#[test]
fn a_shadow_that_never_fires_still_installs() {
    for command in ["ditto", "mv"] {
        let (_root, folder, bundle) = locked();
        let shell = Shell {
            folder: &folder,
            ran: Cell::new(false),
            fail_on: Some((command, 99)),
        };

        replace(&archive_of("2.0"), &bundle, &shell).unwrap();

        assert_eq!(
            version_at(&bundle).as_deref(),
            Some("2.0"),
            "shadowing {command}"
        );
        assert_eq!(entries(&folder), vec![BUNDLE]);
    }
}
