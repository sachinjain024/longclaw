//! Shared setup for the integration suites: a throwaway copy of the
//! representative project and an engine running against it.
//!
//! Each test binary compiles this module and uses part of it, so unused helpers
//! here are expected rather than dead.
#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::Duration;
use std::{fs, thread};

use longclaw_desktop_lib::core::storage::read_project;
use longclaw_desktop_lib::core::{ProjectReference, StreamEnvelope};
use longclaw_desktop_lib::engine::{ProjectEngine, WatcherAdapter};
use tempfile::TempDir;
use walkdir::WalkDir;

/// How often the deterministic test watcher polls.
pub const POLL_INTERVAL_MS: u64 = 50;

/// Watcher tests assert on timing, so they run one at a time.
pub fn serially() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("repository root")
        .to_path_buf()
}

/// Copies `fixtures/representative-project` into a temporary directory, so a test
/// can write to it without touching the fixture in the repository.
pub fn copy_representative_project() -> (TempDir, PathBuf) {
    let source = repository_root().join("fixtures/representative-project");
    let temp = tempfile::tempdir().expect("temporary project parent");
    let target = temp.path().join("representative-project");
    for entry in WalkDir::new(&source).into_iter().map(Result::unwrap) {
        let relative = entry.path().strip_prefix(&source).expect("fixture path");
        let destination = target.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination).expect("fixture directory");
        } else {
            fs::copy(entry.path(), &destination).expect("fixture file");
        }
    }
    (temp, target)
}

/// Creates an empty project the way first launch does, so a test can walk the
/// human's own path: choose a folder, then create the first ticket in it.
pub fn new_project(name: &str, key: &str) -> (TempDir, PathBuf) {
    let temp = tempfile::tempdir().expect("temporary project parent");
    let root = temp.path().join(name);
    fs::create_dir_all(&root).expect("project folder");
    longclaw_desktop_lib::core::storage::initialize_project(
        &root,
        name,
        key,
        None,
        "2026-07-30T09:00:00Z",
    )
    .expect("the folder should become a project");
    (temp, root)
}

pub fn project_reference(root: &Path) -> ProjectReference {
    let document = read_project(root).expect("the fixture project should be readable");
    ProjectReference::from_project(document.project(), root.display().to_string())
}

/// Starts an engine with the deterministic polling watcher and waits for its first
/// poll, so a later write is seen as a change rather than as the initial state.
pub fn start_engine(root: &Path) -> (Arc<ProjectEngine>, Receiver<StreamEnvelope>) {
    start_engine_with(
        root,
        WatcherAdapter::Polling {
            interval_ms: POLL_INTERVAL_MS,
        },
    )
}

pub fn start_engine_with(
    root: &Path,
    adapter: WatcherAdapter,
) -> (Arc<ProjectEngine>, Receiver<StreamEnvelope>) {
    let (sender, receiver) = mpsc::channel();
    let sink = Arc::new(move |event| {
        let _ = sender.send(event);
    });
    let engine = ProjectEngine::start_with_adapter(project_reference(root), sink, adapter)
        .expect("the engine should start");
    thread::sleep(Duration::from_millis(150));
    (engine, receiver)
}

pub fn ticket_path(root: &Path, key: &str) -> PathBuf {
    root.join(".longclaw/tickets").join(key).join("ticket.md")
}

/// A ticket key's number and its trailing character, if it carries one.
///
/// Read with the grammar's own splitter rather than a second copy of the rule.
/// A helper that approximated it — "trim the trailing letters" — would accept
/// keys the format refuses and quietly pass tests about keys that cannot exist.
fn split_key(key: &str) -> (u64, Option<char>) {
    let sequence = key
        .split_once('-')
        .unwrap_or_else(|| panic!("{key} is a ticket key"))
        .1;
    let (number, suffix) = longclaw_desktop_lib::core::storage::split_key_suffix(sequence);
    (
        number
            .parse()
            .unwrap_or_else(|_| panic!("{key} carries a number")),
        suffix,
    )
}

/// The number a ticket key spends, without its trailing character.
///
/// A minted key carries a randomly drawn suffix (LC-232), so a test that means
/// "the next number after LC-99" asserts on this rather than on the whole key.
/// The key itself is never composed by a test — it comes back from the create.
pub fn number_of(key: &str) -> u64 {
    split_key(key).0
}

/// Asserts that `key` is a freshly minted key spending `number`: the number the
/// caller expects, and exactly one lowercase trailing character.
pub fn assert_minted(key: &str, number: u64) {
    let (spent, suffix) = split_key(key);
    assert_eq!(spent, number, "{key} should spend {number}");
    let suffix = suffix.unwrap_or_else(|| panic!("{key} carries a trailing character"));
    assert!(
        suffix.is_ascii_lowercase(),
        "{key} carries a lowercase trailing character"
    );
}

/// Replaces a file the way an ordinary editor does: write a temporary file next to
/// it, then rename it into place.
pub fn editor_atomic_replace(path: &Path, contents: &str, sequence: usize) {
    let temporary = path.with_file_name(format!("ticket.md.editor-{sequence}.tmp"));
    fs::write(&temporary, contents).expect("editor temporary file");
    fs::rename(temporary, path).expect("editor rename");
}

pub fn replace_title(raw: &str, title: &str) -> String {
    raw.lines()
        .map(|line| {
            if line.starts_with("title:") {
                format!("title: {title}")
            } else {
                line.to_owned()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}
