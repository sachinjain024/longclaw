//! `npm run probe:update`: the bundle replacement against a real built bundle
//! (LC-267r, spec seam 4).
//!
//! The unit tests prove the replacement's order over a fake `.app`. This asks
//! the questions a fake cannot answer: whether a refused swap leaves a *real*
//! bundle — Developer ID signature, `_CodeSignature`, two executables — still
//! verifying and still running; whether a good one installs a bundle that does;
//! and whether the release archive the release script actually produces gets
//! through the unpack's rules at all. A rule that refused every real archive
//! would fail every update safely, and nothing else here would notice.
//!
//! **What it calls "runs".** It executes the bundle's own `longclaw` binary
//! rather than opening the window, because the window would start against the
//! person's real projects and preferences. `codesign --verify --deep --strict`
//! is the stronger half: it fails on any file the replacement dropped, damaged
//! or left behind inside the bundle.
//!
//! **What it refuses to report on.** Every case first checks that the bundle it
//! is about to replace is intact on the volume it was copied to, and a case
//! whose precondition fails is skipped rather than passed. A skip fails the run
//! unless the wrapper was told to allow it.
//!
//! The archive it builds is unsigned on purpose: the replacement takes bytes
//! the plugin has already verified, and signing is not what is under test.
#![cfg(all(target_os = "macos", feature = "update-probe"))]

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use longclaw_desktop_lib::bundle_replace::{self, probe, Privileged, Step};

const NAME: &str = "LongClaw.app";
const NEWER: &str = "99.0.0";

struct NoPrompt;

impl Privileged for NoPrompt {
    fn run(&self, _script: &str) -> io::Result<()> {
        Err(io::Error::other("the probe never prompts"))
    }
}

enum Outcome {
    Passed,
    Failed(String),
    Skipped(String),
}

fn run(command: &mut Command) -> Result<String, String> {
    let output = command
        .output()
        .map_err(|error| format!("{command:?}: {error}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(format!(
            "{command:?} exited {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn version_of(bundle: &Path) -> Result<String, String> {
    run(Command::new("/usr/bin/plutil")
        .args(["-extract", "CFBundleShortVersionString", "raw"])
        .arg(bundle.join("Contents/Info.plist")))
}

/// The whole claim about a bundle at a path: it is the version expected, its
/// signature still covers every file in it, its executable runs, and nothing
/// but it is in the folder.
fn intact(bundle: &Path, version: &str) -> Result<(), String> {
    if !bundle.is_dir() {
        return Err(format!("no bundle at {}", bundle.display()));
    }
    let found = version_of(bundle)?;
    if found != version {
        return Err(format!("version {found}, expected {version}"));
    }
    run(Command::new("/usr/bin/codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(bundle))?;
    run(Command::new(bundle.join("Contents/MacOS/longclaw")).arg("--help"))?;
    let folder = bundle.parent().unwrap();
    let mut others: Vec<String> = fs::read_dir(folder)
        .map_err(|error| error.to_string())?
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        // A volume without extended attributes (FAT) keeps them in AppleDouble
        // `._` files the kernel moves with their owner; they are the volume's,
        // and the replacement's own leftovers never take that prefix.
        .filter(|name| {
            name != NAME
                && !name.starts_with("._")
                && !name.starts_with(".Trashes")
                && name != ".fseventsd"
        })
        .collect();
    others.sort();
    if !others.is_empty() {
        return Err(format!("left beside the bundle: {others:?}"));
    }
    Ok(())
}

/// A copy of the built bundle in `folder`, checked before anything is asked of
/// it. `Err` means the case cannot be driven, not that the replacement failed.
fn install_copy(built: &Path, folder: &Path) -> Result<(PathBuf, String), String> {
    let bundle = folder.join(NAME);
    run(Command::new("/usr/bin/ditto").arg(built).arg(&bundle))?;
    let version = version_of(&bundle)?;
    intact(&bundle, &version)
        .map_err(|why| format!("the copy is not intact before the update: {why}"))?;
    Ok((bundle, version))
}

/// The built bundle with its version raised and its signature redone ad hoc,
/// archived in the release layout: one top-level `LongClaw.app/`.
fn newer_archive(built: &Path, scratch: &Path) -> Result<Vec<u8>, String> {
    let source = scratch.join("newer");
    fs::create_dir_all(&source).map_err(|error| error.to_string())?;
    let bundle = source.join(NAME);
    run(Command::new("/usr/bin/ditto").arg(built).arg(&bundle))?;
    run(Command::new("/usr/bin/plutil")
        .args(["-replace", "CFBundleShortVersionString", "-string", NEWER])
        .arg(bundle.join("Contents/Info.plist")))?;
    run(Command::new("/usr/bin/codesign")
        .args(["--force", "--deep", "--sign", "-"])
        .arg(&bundle))?;
    let archive = scratch.join("newer.app.tar.gz");
    run(Command::new("/usr/bin/tar")
        .env("COPYFILE_DISABLE", "1")
        .arg("-czf")
        .arg(&archive)
        .arg("-C")
        .arg(&source)
        .arg(NAME))?;
    fs::read(&archive).map_err(|error| error.to_string())
}

/// The plugin's 2.11.0 order, written out here for `--self-test`: move the
/// current bundle into a `TempDir`, then fail the movement that puts the new
/// one in place. The `TempDir` drops, and the app goes with it.
fn plugin_order_with_the_placing_move_failed(bundle: &Path) -> Result<(), String> {
    let backup =
        tempfile::tempdir_in(bundle.parent().unwrap()).map_err(|error| error.to_string())?;
    fs::rename(bundle, backup.path().join("current_app")).map_err(|error| error.to_string())?;
    Err("the planted failure: the new version could not be moved into place".into())
}

fn refused_swap(built: &Path, archive: &[u8], self_test: bool) -> Outcome {
    let folder = tempfile::tempdir().unwrap();
    let (bundle, version) = match install_copy(built, folder.path()) {
        Ok(installed) => installed,
        Err(why) => return Outcome::Skipped(why),
    };
    if self_test {
        let _ = plugin_order_with_the_placing_move_failed(&bundle);
    } else {
        match probe::replace_with_swap_refused(archive, &bundle, libc::EIO, &NoPrompt) {
            Err(error) if error.step == Step::Swap => {}
            Err(error) => {
                return Outcome::Failed(format!(
                    "failed at {:?}, not at the swap: {error}",
                    error.step
                ))
            }
            Ok(()) => return Outcome::Failed("the refused swap reported success".into()),
        }
    }
    match intact(&bundle, &version) {
        Ok(()) => Outcome::Passed,
        Err(why) => Outcome::Failed(why),
    }
}

fn good_swap(built: &Path, archive: &[u8], expect: &str, folder: &Path) -> Outcome {
    let (bundle, _) = match install_copy(built, folder) {
        Ok(installed) => installed,
        Err(why) => return Outcome::Skipped(why),
    };
    if let Err(error) = bundle_replace::replace(archive, &bundle, &NoPrompt) {
        return Outcome::Failed(error.to_string());
    }
    match intact(&bundle, expect) {
        Ok(()) => Outcome::Passed,
        Err(why) => Outcome::Failed(why),
    }
}

fn release_archive(built: &Path, path: Option<PathBuf>) -> Outcome {
    let Some(path) = path else {
        return Outcome::Skipped("no release archive was named or found".into());
    };
    let archive = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) => return Outcome::Skipped(format!("{}: {error}", path.display())),
    };
    // The version the archive carries, read from the archive rather than its
    // file name.
    let scratch = tempfile::tempdir().unwrap();
    let expect = match run(Command::new("/usr/bin/tar")
        .arg("-xzf")
        .arg(&path)
        .arg("-C")
        .arg(scratch.path()))
    .and_then(|_| version_of(&scratch.path().join(NAME)))
    {
        Ok(version) => version,
        Err(why) => return Outcome::Skipped(format!("cannot read the archive's version: {why}")),
    };
    let folder = tempfile::tempdir().unwrap();
    good_swap(built, &archive, &expect, folder.path())
}

/// A FAT volume, where `RENAME_SWAP` should be refused for real and the
/// two-rename fallback run against a genuine refusal. That refusal is the
/// assumption this case checks before it reports anything.
fn fat_volume(built: &Path, archive: &[u8]) -> Outcome {
    let scratch = tempfile::tempdir().unwrap();
    let image = scratch.path().join("fat.dmg");
    let mount = scratch.path().join("mnt");
    if let Err(why) = run(Command::new("/usr/bin/hdiutil")
        .args([
            "create",
            "-size",
            "200m",
            "-fs",
            "MS-DOS FAT32",
            "-volname",
            "LCPROBE",
            "-quiet",
        ])
        .arg(&image))
    {
        return Outcome::Skipped(format!("cannot create a FAT image here: {why}"));
    }
    fs::create_dir_all(&mount).unwrap();
    if let Err(why) = run(Command::new("/usr/bin/hdiutil")
        .args(["attach", "-nobrowse", "-quiet", "-mountroot"])
        .arg(&mount)
        .arg(&image))
    {
        return Outcome::Skipped(format!("cannot mount the FAT image: {why}"));
    }
    let volume = mount.join("LCPROBE");
    let outcome = (|| {
        let left = volume.join("left");
        let right = volume.join("right");
        fs::create_dir_all(&left).unwrap();
        fs::create_dir_all(&right).unwrap();
        // Two non-empty directories, because on FAT32 an empty pair "swaps":
        // the driver ignores the flag and renames one over the other. A pair
        // that swaps for real means this volume can exchange, and the
        // fallback would never be reached.
        fs::write(left.join("side"), b"left").unwrap();
        fs::write(right.join("side"), b"right").unwrap();
        if swap_raw(&left, &right).is_ok() && fs::read(left.join("side")).unwrap() == b"right" {
            return Outcome::Failed(
                "this FAT volume swapped atomically, so the fallback was never reached — the case proves nothing"
                    .into(),
            );
        }
        let _ = fs::remove_dir_all(&left);
        let _ = fs::remove_dir_all(&right);
        good_swap(built, archive, NEWER, &volume)
    })();
    let _ = run(Command::new("/usr/bin/hdiutil")
        .args(["detach", "-quiet"])
        .arg(&volume));
    outcome
}

fn swap_raw(left: &Path, right: &Path) -> io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let left = CString::new(left.as_os_str().as_bytes())?;
    let right = CString::new(right.as_os_str().as_bytes())?;
    // SAFETY: two valid NUL-terminated paths; 0x2 is RENAME_SWAP.
    if unsafe { libc::renamex_np(left.as_ptr(), right.as_ptr(), 0x2) } == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[test]
#[ignore = "drives a built bundle; run through npm run probe:update"]
fn probe_update() {
    let built = PathBuf::from(
        std::env::var("LONGCLAW_PROBE_BUNDLE")
            .expect("LONGCLAW_PROBE_BUNDLE names the built LongClaw.app"),
    );
    let release = std::env::var("LONGCLAW_PROBE_RELEASE_ARCHIVE")
        .ok()
        .map(PathBuf::from);
    let self_test = std::env::var("LONGCLAW_PROBE_SELF_TEST").is_ok();
    let allow_skip = std::env::var("LONGCLAW_PROBE_ALLOW_SKIP").is_ok();

    let scratch = tempfile::tempdir().unwrap();
    let archive =
        newer_archive(&built, scratch.path()).expect("the newer archive could not be made");

    if self_test {
        match refused_swap(&built, &archive, true) {
            Outcome::Failed(why) => {
                println!("probe:update --self-test: the plugin's order lost the app, and the probe saw it ({why})");
                return;
            }
            Outcome::Passed => panic!("probe:update --self-test: the plugin's order lost the app and the probe called it intact"),
            Outcome::Skipped(why) => panic!("probe:update --self-test: could not be driven: {why}"),
        }
    }

    let good_folder = tempfile::tempdir().unwrap();
    let cases: Vec<(&str, Outcome)> = vec![
        (
            "a refused swap leaves the original intact",
            refused_swap(&built, &archive, false),
        ),
        (
            "a good swap installs the newer version",
            good_swap(&built, &archive, NEWER, good_folder.path()),
        ),
        (
            "the release archive gets through the unpack",
            release_archive(&built, release),
        ),
        (
            "a FAT volume replaces through the fallback",
            fat_volume(&built, &archive),
        ),
    ];

    let mut failed = 0;
    let mut skipped = 0;
    for (what, outcome) in &cases {
        match outcome {
            Outcome::Passed => println!("  pass  {what}"),
            Outcome::Failed(why) => {
                failed += 1;
                println!("  FAIL  {what}: {why}");
            }
            Outcome::Skipped(why) => {
                skipped += 1;
                println!("  skip  {what}: {why}");
            }
        }
    }
    println!(
        "probe:update: {} passed, {failed} failed, {skipped} skipped, against {}",
        cases.len() - failed - skipped,
        built.display()
    );
    assert_eq!(failed, 0, "a case failed");
    assert!(
        skipped == 0 || allow_skip,
        "a case could not be driven; rerun with --allow-skip to accept that, and say so where the run is quoted"
    );
    assert!(
        skipped < cases.len(),
        "every case was skipped, so nothing was shown"
    );
}
