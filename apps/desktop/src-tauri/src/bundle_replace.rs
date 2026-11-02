//! Putting a verified update where the installed bundle is (LC-267r, ADR 0018).
//!
//! **One rule: at every instant, a complete bundle is at the path the person
//! installed it to.** The updater plugin's own install moved the current bundle
//! into a `TempDir` and then moved the new one into place, and nothing put the
//! first back: a failed second move, a process that died between the two, or
//! the administrator path's `rm -rf` before its `mv` all left no LongClaw at
//! all. Here the new version is unpacked beside the old one, on the same
//! volume, and the two exchange names in one `renamex_np(RENAME_SWAP)`. The old
//! version is deleted only once the exchange has happened.
//!
//! The plugin still fetches and verifies. This module is handed bytes that have
//! already passed the signature check and never looks at a signature itself.

use std::ffi::{CString, OsString};
use std::fs;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::path::{Component, Path, PathBuf};

use crate::core::storage;

/// Which movement failed. Carried in the error so a report can say where,
/// which is the detail LC-265y's diagnosis did not have.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// Creating the staging directory beside the bundle.
    Stage,
    /// Unpacking the archive into it.
    Unpack,
    /// Confirming the unpacked tree is a bundle at all.
    Check,
    /// The atomic exchange.
    Swap,
    /// The two-rename fallback, on a volume that cannot exchange.
    Fallback,
    /// The administrator prompt, when the bundle's folder needs one.
    Privileged,
}

#[derive(Debug)]
pub struct ReplaceError {
    pub step: Step,
    pub source: io::Error,
}

impl std::fmt::Display for ReplaceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "bundle replacement failed at {:?}: {}",
            self.step, self.source
        )
    }
}

impl std::error::Error for ReplaceError {}

/// Runs a shell script with administrator rights, or refuses.
///
/// A port rather than a call, because the real one puts a password prompt on
/// the main thread and waits for a person: the adapter owns the main thread,
/// and the suite runs the same script with `/bin/sh` and no rights at all.
pub trait Privileged {
    fn run(&self, script: &str) -> io::Result<()>;
}

/// Replaces the bundle at `bundle` with the one in `archive`.
///
/// On every return a complete bundle is at `bundle`: the new one if this
/// returned `Ok`, the one that was there otherwise.
pub fn replace(
    archive: &[u8],
    bundle: &Path,
    privileged: &dyn Privileged,
) -> Result<(), ReplaceError> {
    replace_on(&System, archive, bundle, privileged)
}

/// Deletes what an interrupted replacement left beside `bundle`, and nothing
/// else. Returns how many entries it removed.
///
/// Only names this module derives from the bundle's own name are touched: a
/// hidden prefix, the bundle's name, one of the two kinds, and a 32-digit
/// lowercase token. A folder that cannot be read is a sweep that found nothing.
pub fn sweep(bundle: &Path) -> usize {
    let (Some(parent), Some(name)) = (bundle.parent(), bundle.file_name()) else {
        return 0;
    };
    let name = name.to_string_lossy();
    let Ok(listing) = fs::read_dir(parent) else {
        return 0;
    };
    listing
        .flatten()
        .filter(|entry| is_leftover(&name, &entry.file_name().to_string_lossy()))
        .filter(|entry| System.remove_all(&entry.path()).is_ok())
        .count()
}

/// The directory a new version is unpacked into, beside the bundle.
const STAGED: &str = "lc-update-";
/// Where the fallback and the prompt park the old version for a moment.
const PREVIOUS: &str = "lc-previous-";

fn leftover_name(bundle_name: &str, kind: &str, token: &str) -> String {
    format!(".{bundle_name}.{kind}{token}")
}

fn is_leftover(bundle_name: &str, entry: &str) -> bool {
    [STAGED, PREVIOUS].iter().any(|kind| {
        entry
            .strip_prefix(&leftover_name(bundle_name, kind, ""))
            .is_some_and(|token| {
                token.len() == 32
                    && token
                        .bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            })
    })
}

/// The four movements a replacement makes, so the suite can make any one of
/// them fail — or stop the process dead straight after it.
trait Disk {
    fn swap(&self, left: &Path, right: &Path) -> io::Result<()>;
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn remove_all(&self, path: &Path) -> io::Result<()>;
    fn mark_changed(&self, path: &Path) -> io::Result<()>;
}

struct System;

impl Disk for System {
    fn swap(&self, left: &Path, right: &Path) -> io::Result<()> {
        storage::swap_paths(left, right)
    }

    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }

    fn remove_all(&self, path: &Path) -> io::Result<()> {
        if fs::symlink_metadata(path)?.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        }
    }

    /// What the plugin's `touch` did, so Launch Services notices the bundle
    /// changed — by a call rather than a child process, which the release
    /// audit forbids in shipped source.
    fn mark_changed(&self, path: &Path) -> io::Result<()> {
        let path = CString::new(path.as_os_str().as_bytes())?;
        // SAFETY: a valid NUL-terminated path; a null `times` means "now".
        if unsafe { libc::utimes(path.as_ptr(), std::ptr::null()) } == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
}

fn fail(step: Step) -> impl FnOnce(io::Error) -> ReplaceError {
    move |source| ReplaceError { step, source }
}

fn replace_on(
    disk: &dyn Disk,
    archive: &[u8],
    bundle: &Path,
    privileged: &dyn Privileged,
) -> Result<(), ReplaceError> {
    let (parent, name) = parts_of(bundle).map_err(fail(Step::Stage))?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let container = parent.join(leftover_name(&name, STAGED, &token));

    match fs::create_dir(&container) {
        Ok(()) => {}
        // The folder holding the bundle is not ours to write — a standard
        // user, an `/Applications` they do not own. Nothing has been touched.
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            return replace_privileged(archive, bundle, &token, privileged);
        }
        Err(error) => return Err(fail(Step::Stage)(error)),
    }

    let staged = match unpack_and_check(archive, &container) {
        Ok(staged) => staged,
        Err(error) => {
            let _ = disk.remove_all(&container);
            return Err(error);
        }
    };

    match disk.swap(&staged, bundle) {
        Ok(()) => {
            // The new version is in place. Everything from here on is
            // tidying, and a failure in it is litter for the sweep rather than
            // a failed update.
            let _ = disk.mark_changed(bundle);
            let _ = disk.remove_all(&container);
            Ok(())
        }
        Err(error) if storage::is_unsupported(&error) => fallback(
            disk,
            &staged,
            bundle,
            &parent.join(leftover_name(&name, PREVIOUS, &token)),
            &container,
        ),
        Err(error) => {
            let _ = disk.remove_all(&container);
            Err(fail(Step::Swap)(error))
        }
    }
}

/// Two renames within one folder, for a volume that cannot exchange.
///
/// Both stay inside the bundle's own folder, so `EXDEV` cannot happen. If the
/// second fails the first is undone before returning; the one window left is a
/// process that dies between them, which leaves the old version beside the
/// path under a name the sweep knows.
fn fallback(
    disk: &dyn Disk,
    staged: &Path,
    bundle: &Path,
    previous: &Path,
    container: &Path,
) -> Result<(), ReplaceError> {
    if let Err(error) = disk.rename(bundle, previous) {
        let _ = disk.remove_all(container);
        return Err(fail(Step::Fallback)(error));
    }
    if let Err(error) = disk.rename(staged, bundle) {
        let _ = disk.rename(previous, bundle);
        let _ = disk.remove_all(container);
        return Err(fail(Step::Fallback)(error));
    }
    let _ = disk.mark_changed(bundle);
    let _ = disk.remove_all(previous);
    let _ = disk.remove_all(container);
    Ok(())
}

/// The same order under an administrator prompt: unpack as the user, then
/// copy beside the bundle, move the old aside, move the new in, and only then
/// remove the old. A cancelled prompt changes nothing.
fn replace_privileged(
    archive: &[u8],
    bundle: &Path,
    token: &str,
    privileged: &dyn Privileged,
) -> Result<(), ReplaceError> {
    let scratch = std::env::temp_dir().join(format!("longclaw-update-{token}"));
    fs::create_dir(&scratch).map_err(fail(Step::Stage))?;
    let outcome = unpack_and_check(archive, &scratch).and_then(|staged| {
        privileged
            .run(&privileged_script(&staged, bundle, token))
            .map_err(fail(Step::Privileged))
    });
    let _ = fs::remove_dir_all(&scratch);
    outcome
}

/// The script the prompt runs. Every path is single-quoted; the bundle is
/// never the target of an `rm`.
fn privileged_script(staged: &Path, bundle: &Path, token: &str) -> String {
    let (parent, name) = match parts_of(bundle) {
        Ok(parts) => parts,
        Err(_) => (PathBuf::from("/"), String::new()),
    };
    let copy = shell_quote(&parent.join(leftover_name(&name, STAGED, token)));
    let previous = shell_quote(&parent.join(leftover_name(&name, PREVIOUS, token)));
    let staged = shell_quote(staged);
    let bundle = shell_quote(bundle);
    [
        format!("/usr/bin/ditto {staged} {copy} || {{ /bin/rm -rf {copy}; exit 1; }}"),
        format!("/bin/mv {bundle} {previous} || {{ /bin/rm -rf {copy}; exit 1; }}"),
        format!("if ! /bin/mv {copy} {bundle}; then /bin/mv {previous} {bundle}; /bin/rm -rf {copy}; exit 1; fi"),
        format!("/bin/rm -rf {previous}"),
        format!("/usr/bin/touch {bundle}"),
    ]
    .join("\n")
}

fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', r"'\''"))
}

/// An AppleScript string literal holding `text`.
fn applescript_string(text: &str) -> String {
    format!("\"{}\"", text.replace('\\', r"\\").replace('"', "\\\""))
}

/// Runs `script` through one administrator prompt.
///
/// The prompt is AppKit's, so this must be called on the main thread — the
/// adapter owns that thread and is the only caller. This is the app's one
/// privileged execution (ADR 0018), and `osakit` appears nowhere else.
pub fn run_as_administrator(script: &str) -> io::Result<()> {
    let source = format!(
        "do shell script {} with administrator privileges",
        applescript_string(script)
    );
    let mut prompt = osakit::Script::new_from_source(osakit::Language::AppleScript, &source);
    prompt
        .compile()
        .map_err(|error| io::Error::other(format!("{error:?}")))?;
    prompt
        .execute()
        .map(|_| ())
        .map_err(|error| io::Error::other(format!("{error:?}")))
}

fn parts_of(bundle: &Path) -> io::Result<(PathBuf, String)> {
    match (bundle.parent(), bundle.file_name()) {
        (Some(parent), Some(name)) => {
            Ok((parent.to_path_buf(), name.to_string_lossy().into_owned()))
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "not a bundle path",
        )),
    }
}

/// Unpacks the release archive into `into` and returns the bundle inside it.
///
/// The plugin's layout rule is kept — one top-level directory, which is the
/// bundle — and a boundary is added: every entry must be plain path
/// components below that directory, no AppleDouble twin is unpacked (LC-265y's
/// 0.3.0 archive), and a link may not point outside the bundle.
fn unpack_and_check(archive: &[u8], into: &Path) -> Result<PathBuf, ReplaceError> {
    let top = unpack(archive, into).map_err(fail(Step::Unpack))?;
    let staged = into.join(top);
    check(&staged).map_err(fail(Step::Check))?;
    Ok(staged)
}

fn unpack(archive: &[u8], into: &Path) -> io::Result<OsString> {
    let mut entries = tar::Archive::new(flate2::read::GzDecoder::new(archive));
    entries.set_preserve_permissions(true);
    let mut top: Option<OsString> = None;

    for entry in entries.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        let parts = plain_parts(&path)?;
        let Some(first) = parts.first() else {
            return Err(refused(&path, "is empty"));
        };
        match &top {
            None => top = Some(first.clone()),
            Some(top) if top != first => return Err(refused(&path, "is outside the bundle")),
            Some(_) => {}
        }
        if let Some(target) = entry.link_name()? {
            let escapes = match entry.header().entry_type() {
                // A hard link names another entry of the archive.
                tar::EntryType::Link => plain_parts(&target)
                    .map(|t| t.first() != Some(first))
                    .unwrap_or(true),
                _ => link_escapes(&parts, &target),
            };
            if escapes {
                return Err(refused(&path, "links outside the bundle"));
            }
        }
        if !entry.unpack_in(into)? {
            return Err(refused(&path, "lands outside the staging directory"));
        }
    }
    top.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "the archive is empty"))
}

/// The entry's path as plain names, or a refusal.
fn plain_parts(path: &Path) -> io::Result<Vec<OsString>> {
    path.components()
        .map(|component| match component {
            Component::Normal(name) if !name.to_string_lossy().starts_with("._") => {
                Ok(name.to_os_string())
            }
            Component::Normal(_) => Err(refused(path, "is an AppleDouble file")),
            _ => Err(refused(path, "is not a plain relative path")),
        })
        .collect()
}

/// Whether a symlink at `at` (archive parts, bundle first) resolves outside the
/// bundle, worked out on the names alone.
fn link_escapes(at: &[OsString], target: &Path) -> bool {
    // Depth below the bundle of the directory holding the link.
    let mut depth = at.len().saturating_sub(2) as isize;
    for component in target.components() {
        match component {
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return true;
                }
            }
            Component::RootDir | Component::Prefix(_) => return true,
        }
    }
    false
}

fn refused(path: &Path, why: &str) -> io::Error {
    io::Error::new(
        io::ErrorKind::InvalidData,
        format!("{} {why}", path.display()),
    )
}

/// Refuses an unpacked tree that could not launch: no `Info.plist`, or no
/// executable under `Contents/MacOS`.
fn check(staged: &Path) -> io::Result<()> {
    let contents = staged.join("Contents");
    if !contents.join("Info.plist").is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the archive's bundle has no Info.plist",
        ));
    }
    let has_executable = fs::read_dir(contents.join("MacOS"))
        .map(|listing| listing.flatten().any(|entry| entry.path().is_file()))
        .unwrap_or(false);
    if !has_executable {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the archive's bundle has no executable",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    const BUNDLE: &str = "LongClaw.app";

    /// A bundle as small as one can be and still be one: an `Info.plist` that
    /// says which version this is, and an executable.
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

    /// An archive in the release layout: one top-level `LongClaw.app/`.
    fn archive_of(version: &str) -> Vec<u8> {
        let source = tempfile::tempdir().unwrap();
        write_bundle(&source.path().join(BUNDLE), version);
        archive_from(source.path(), &[BUNDLE])
    }

    fn archive_from(root: &Path, entries: &[&str]) -> Vec<u8> {
        let encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        let mut builder = tar::Builder::new(encoder);
        for entry in entries {
            let path = root.join(entry);
            if path.is_dir() {
                builder.append_dir_all(entry, &path).unwrap();
            } else {
                builder.append_path_with_name(&path, entry).unwrap();
            }
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    /// An archive with one hand-made entry beside a real bundle.
    fn archive_with_entry(
        version: &str,
        name: &str,
        kind: tar::EntryType,
        link: Option<&str>,
    ) -> Vec<u8> {
        let source = tempfile::tempdir().unwrap();
        write_bundle(&source.path().join(BUNDLE), version);
        let encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        let mut builder = tar::Builder::new(encoder);
        builder
            .append_dir_all(BUNDLE, source.path().join(BUNDLE))
            .unwrap();
        let mut header = tar::Header::new_gnu();
        header.set_entry_type(kind);
        header.set_mode(0o644);
        header.set_size(0);
        if let Some(target) = link {
            header.set_link_name(target).unwrap();
        }
        // `set_path` refuses `..`, which is the point of writing one by hand.
        let field = &mut header.as_old_mut().name;
        field[..name.len()].copy_from_slice(name.as_bytes());
        header.set_cksum();
        builder.append(&header, io::empty()).unwrap();
        builder.into_inner().unwrap().finish().unwrap()
    }

    /// A folder standing in for Applications, with 1.0 installed in it.
    fn installed() -> (tempfile::TempDir, PathBuf) {
        let folder = tempfile::tempdir().unwrap();
        let bundle = folder.path().join(BUNDLE);
        write_bundle(&bundle, "1.0");
        (folder, bundle)
    }

    fn entries(folder: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(folder)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    struct NoPrompt;
    impl Privileged for NoPrompt {
        fn run(&self, _script: &str) -> io::Result<()> {
            panic!("no administrator prompt was expected");
        }
    }

    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    enum Op {
        Swap,
        Rename,
        RemoveAll,
        MarkChanged,
    }

    /// The real disk, with one movement made to fail, or the process made to
    /// die straight after one.
    struct Faulty {
        op: Op,
        /// Which call of `op` — the fallback renames twice.
        nth: usize,
        seen: Cell<usize>,
        error: Option<i32>,
        die_after: bool,
    }

    impl Faulty {
        fn fail(op: Op, nth: usize, errno: i32) -> Self {
            Self {
                op,
                nth,
                seen: Cell::new(0),
                error: Some(errno),
                die_after: false,
            }
        }
        fn die_after(op: Op, nth: usize) -> Self {
            Self {
                op,
                nth,
                seen: Cell::new(0),
                error: None,
                die_after: true,
            }
        }
        fn gate(&self, op: Op, real: impl FnOnce() -> io::Result<()>) -> io::Result<()> {
            if op != self.op {
                return real();
            }
            self.seen.set(self.seen.get() + 1);
            if self.seen.get() != self.nth {
                return real();
            }
            if let Some(errno) = self.error {
                return Err(io::Error::from_raw_os_error(errno));
            }
            real()?;
            assert!(self.die_after);
            panic!("the process died here");
        }
    }

    impl Disk for Faulty {
        fn swap(&self, left: &Path, right: &Path) -> io::Result<()> {
            self.gate(Op::Swap, || System.swap(left, right))
        }
        fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
            self.gate(Op::Rename, || System.rename(from, to))
        }
        fn remove_all(&self, path: &Path) -> io::Result<()> {
            self.gate(Op::RemoveAll, || System.remove_all(path))
        }
        fn mark_changed(&self, path: &Path) -> io::Result<()> {
            self.gate(Op::MarkChanged, || System.mark_changed(path))
        }
    }

    /// Runs `replace_on` and swallows a planted death, the way a killed process
    /// would leave the disk.
    fn die_during(disk: &Faulty, archive: &[u8], bundle: &Path) {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            replace_on(disk, archive, bundle, &NoPrompt)
        }));
        assert!(outcome.is_err(), "the planted death did not happen");
    }

    // ---- the replacement ----------------------------------------------------

    #[test]
    fn a_good_archive_replaces_the_bundle_and_leaves_nothing_beside_it() {
        let (folder, bundle) = installed();

        replace_on(&System, &archive_of("2.0"), &bundle, &NoPrompt).unwrap();

        assert_eq!(version_at(&bundle).as_deref(), Some("2.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn a_truncated_archive_fails_while_unpacking_and_the_old_version_stays() {
        let (folder, bundle) = installed();
        let mut archive = archive_of("2.0");
        archive.truncate(archive.len() / 2);

        let error = replace_on(&System, &archive, &bundle, &NoPrompt).unwrap_err();

        assert_eq!(error.step, Step::Unpack);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn an_archive_that_is_not_a_bundle_is_refused_before_anything_moves() {
        let (folder, bundle) = installed();
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join("LongClaw.app/Contents")).unwrap();
        fs::write(
            source.path().join("LongClaw.app/Contents/readme"),
            b"no plist",
        )
        .unwrap();

        let error = replace_on(
            &System,
            &archive_from(source.path(), &[BUNDLE]),
            &bundle,
            &NoPrompt,
        )
        .unwrap_err();

        assert_eq!(error.step, Step::Check);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn an_entry_that_climbs_out_of_the_staging_directory_is_refused() {
        let (folder, bundle) = installed();
        let archive = archive_with_entry(
            "2.0",
            "LongClaw.app/../../escaped",
            tar::EntryType::Regular,
            None,
        );

        let error = replace_on(&System, &archive, &bundle, &NoPrompt).unwrap_err();

        assert_eq!(error.step, Step::Unpack);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
        assert!(!folder.path().parent().unwrap().join("escaped").exists());
    }

    #[test]
    fn a_link_pointing_out_of_the_bundle_is_refused() {
        let (_folder, bundle) = installed();
        let archive = archive_with_entry(
            "2.0",
            "LongClaw.app/Contents/out",
            tar::EntryType::Symlink,
            Some("../../../etc"),
        );

        let error = replace_on(&System, &archive, &bundle, &NoPrompt).unwrap_err();

        assert_eq!(error.step, Step::Unpack);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
    }

    #[test]
    fn a_link_inside_the_bundle_is_kept() {
        let (_folder, bundle) = installed();
        let archive = archive_with_entry(
            "2.0",
            "LongClaw.app/Contents/Current",
            tar::EntryType::Symlink,
            Some("MacOS"),
        );

        replace_on(&System, &archive, &bundle, &NoPrompt).unwrap();

        assert_eq!(
            fs::read_link(bundle.join("Contents/Current")).unwrap(),
            Path::new("MacOS")
        );
    }

    /// LC-265y's 0.3.0 archive: an AppleDouble twin of the bundle beside it.
    #[test]
    fn an_appledouble_entry_is_refused_rather_than_unpacked() {
        let (folder, bundle) = installed();
        let archive = archive_with_entry("2.0", "._LongClaw.app", tar::EntryType::Regular, None);

        let error = replace_on(&System, &archive, &bundle, &NoPrompt).unwrap_err();

        assert_eq!(error.step, Step::Unpack);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn a_failed_swap_leaves_the_old_version_and_nothing_beside_it() {
        let (folder, bundle) = installed();

        let error = replace_on(
            &Faulty::fail(Op::Swap, 1, libc::EIO),
            &archive_of("2.0"),
            &bundle,
            &NoPrompt,
        )
        .unwrap_err();

        assert_eq!(error.step, Step::Swap);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn a_volume_that_cannot_swap_falls_back_to_two_renames() {
        let (folder, bundle) = installed();

        replace_on(
            &Faulty::fail(Op::Swap, 1, libc::ENOTSUP),
            &archive_of("2.0"),
            &bundle,
            &NoPrompt,
        )
        .unwrap();

        assert_eq!(version_at(&bundle).as_deref(), Some("2.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    /// Window 1 of the ticket, on the fallback: the second rename fails after
    /// the first moved the bundle aside. The plugin lost the app here.
    #[test]
    fn a_failed_second_rename_in_the_fallback_puts_the_old_version_back() {
        let (folder, bundle) = installed();
        let disk = Faulty {
            op: Op::Rename,
            nth: 2,
            seen: Cell::new(0),
            error: Some(libc::EIO),
            die_after: false,
        };
        let unsupported = SwapUnsupported(disk);

        let error = replace_on(&unsupported, &archive_of("2.0"), &bundle, &NoPrompt).unwrap_err();

        assert_eq!(error.step, Step::Fallback);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    /// A disk whose volume cannot exchange, wrapping a faulty one.
    struct SwapUnsupported(Faulty);
    impl Disk for SwapUnsupported {
        fn swap(&self, _left: &Path, _right: &Path) -> io::Result<()> {
            Err(io::Error::from_raw_os_error(libc::ENOTSUP))
        }
        fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
            self.0.rename(from, to)
        }
        fn remove_all(&self, path: &Path) -> io::Result<()> {
            self.0.remove_all(path)
        }
        fn mark_changed(&self, path: &Path) -> io::Result<()> {
            self.0.mark_changed(path)
        }
    }

    /// After the exchange the new version is in place; failing to delete the
    /// old one is litter for the sweep, not a failed update.
    #[test]
    fn failing_to_delete_the_old_version_is_not_a_failed_install() {
        let (folder, bundle) = installed();

        replace_on(
            &Faulty::fail(Op::RemoveAll, 1, libc::EBUSY),
            &archive_of("2.0"),
            &bundle,
            &NoPrompt,
        )
        .unwrap();

        assert_eq!(version_at(&bundle).as_deref(), Some("2.0"));
        assert_eq!(
            entries(folder.path()).len(),
            2,
            "the old version is left for the sweep"
        );
        assert_eq!(sweep(&bundle), 1);
        assert_eq!(entries(folder.path()), vec![BUNDLE]);
    }

    #[test]
    fn failing_to_mark_the_bundle_changed_is_not_a_failed_install() {
        let (_folder, bundle) = installed();

        replace_on(
            &Faulty::fail(Op::MarkChanged, 1, libc::EPERM),
            &archive_of("2.0"),
            &bundle,
            &NoPrompt,
        )
        .unwrap();

        assert_eq!(version_at(&bundle).as_deref(), Some("2.0"));
    }

    /// Window 3 of the ticket: the process dies mid-update. Wherever it dies,
    /// a bundle is at the path, and the sweep leaves the folder as it was.
    #[test]
    fn a_process_that_dies_after_any_movement_leaves_a_bundle_and_the_sweep_tidies() {
        for (op, nth, expect) in [
            (Op::Swap, 1, "2.0"),
            (Op::MarkChanged, 1, "2.0"),
            (Op::RemoveAll, 1, "2.0"),
        ] {
            let (folder, bundle) = installed();
            die_during(&Faulty::die_after(op, nth), &archive_of("2.0"), &bundle);

            assert_eq!(version_at(&bundle).as_deref(), Some(expect), "after {op:?}");
            sweep(&bundle);
            assert_eq!(
                entries(folder.path()),
                vec![BUNDLE],
                "after {op:?} and a sweep"
            );
        }
    }

    #[test]
    fn a_process_that_dies_mid_fallback_leaves_the_old_version_beside_the_path() {
        let (folder, bundle) = installed();
        let disk = SwapUnsupported(Faulty::die_after(Op::Rename, 1));

        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            replace_on(&disk, &archive_of("2.0"), &bundle, &NoPrompt)
        }));
        assert!(outcome.is_err());

        // The residual window ADR 0018 names: no bundle at the path, the old
        // version beside it under a name the sweep knows.
        assert!(version_at(&bundle).is_none());
        let backups: Vec<String> = entries(folder.path())
            .into_iter()
            .filter(|name| name.contains(".lc-previous-"))
            .collect();
        assert_eq!(backups.len(), 1);
        assert_eq!(
            version_at(&folder.path().join(&backups[0])).as_deref(),
            Some("1.0")
        );
    }

    // ---- the administrator path ----------------------------------------------

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

    struct Cancelled;
    impl Privileged for Cancelled {
        fn run(&self, _script: &str) -> io::Result<()> {
            Err(io::Error::from(io::ErrorKind::PermissionDenied))
        }
    }

    #[test]
    fn a_cancelled_prompt_changes_nothing() {
        let (_root, folder, bundle) = locked();

        let error = replace_on(&System, &archive_of("2.0"), &bundle, &Cancelled).unwrap_err();

        assert_eq!(error.step, Step::Privileged);
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
        unlock(&folder);
        assert_eq!(entries(&folder), vec![BUNDLE]);
    }

    #[test]
    fn the_prompt_is_never_asked_to_remove_the_bundle_before_the_new_one_is_beside_it() {
        let script = privileged_script(
            Path::new("/tmp/staged/LongClaw.app"),
            Path::new("/Applications/LongClaw.app"),
            "abc",
        );
        let copy = script.find("/usr/bin/ditto").unwrap();
        let first_move = script.find("/bin/mv").unwrap();
        assert!(
            copy < first_move,
            "the copy must come before anything moves: {script}"
        );
        assert!(
            !script.contains("/bin/rm -rf '/Applications/LongClaw.app'"),
            "the bundle itself is never removed: {script}"
        );
    }

    #[test]
    fn the_prompt_quotes_every_path_it_names() {
        let script = privileged_script(
            Path::new("/tmp/it's/LongClaw.app"),
            Path::new("/Apps it's 'quoted' $HOME/LongClaw.app"),
            "abc",
        );
        assert!(
            script.contains(r"'/Apps it'\''s '\''quoted'\'' $HOME/LongClaw.app'"),
            "{script}"
        );
        assert!(
            !script.contains(" /Apps it"),
            "a path appears unquoted: {script}"
        );
    }

    #[test]
    fn applescript_quoting_escapes_backslashes_and_quotes() {
        assert_eq!(applescript_string(r#"a "b" \c"#), r#""a \"b\" \\c""#);
    }

    // ---- the sweep ------------------------------------------------------------

    #[test]
    fn the_sweep_removes_its_own_leftovers_and_nothing_else() {
        let (folder, bundle) = installed();
        for name in [
            ".LongClaw.app.lc-update-0123456789abcdef0123456789abcdef",
            ".LongClaw.app.lc-previous-0123456789abcdef0123456789abcdef",
        ] {
            write_bundle(&folder.path().join(name), "0.9");
        }
        for name in [
            ".Other.app.lc-update-0123456789abcdef0123456789abcdef",
            ".LongClaw.app.lc-update-not-hex",
            ".LongClaw.app.lc-update-",
            ".DS_Store",
            "LongClaw copy.app",
        ] {
            fs::write(folder.path().join(name), b"keep").unwrap();
        }

        assert_eq!(sweep(&bundle), 2);

        assert_eq!(
            entries(folder.path()),
            vec![
                ".DS_Store",
                ".LongClaw.app.lc-update-",
                ".LongClaw.app.lc-update-not-hex",
                ".Other.app.lc-update-0123456789abcdef0123456789abcdef",
                "LongClaw copy.app",
                BUNDLE,
            ]
        );
        assert_eq!(version_at(&bundle).as_deref(), Some("1.0"));
    }

    #[test]
    fn a_sweep_of_a_folder_it_cannot_read_removes_nothing_and_does_not_panic() {
        assert_eq!(sweep(Path::new("/nonexistent/LongClaw.app")), 0);
    }
}
