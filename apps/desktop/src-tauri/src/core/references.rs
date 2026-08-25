//! Finding a ticket key in files this app does not own.
//!
//! `longclaw ticket renumber` (LC-232) re-keys one of two tickets that were
//! minted with the same key, and the key it gave up is quoted in commit
//! messages, design docs, source comments and other tickets. Those are the
//! human's next job, not LongClaw's — so this finds them and says where they
//! are, and nothing here writes (ADR 0009: Rust owns filesystem authority, and
//! this half of it owns none of these files).
//!
//! It lives beside `storage` rather than inside it because it is a different
//! kind of question. `storage` decides paths and reads ticket files; this reads
//! *every* file under a project root as text, and knows nothing about the ticket
//! format at all.

use std::fs;
use std::path::Path;

use walkdir::WalkDir;

/// Directories the reference scan does not descend into: generated trees where a
/// hit is a copy of a hit somewhere else, and `.git`, where a hit is history that
/// cannot be edited anyway.
const REFERENCE_SKIPPED_DIRECTORIES: &[&str] =
    &[".git", "node_modules", "target", "dist", ".next", ".venv"];

/// How much of a file the reference scan reads. A key is quoted in prose and in
/// source, not in a bundle or a database, and reading every large file under a
/// project root to find one would make the command's cost the repository's size.
/// Anything over this is named in `references_unread` rather than dropped.
const REFERENCE_FILE_LIMIT: u64 = 2 * 1024 * 1024;

/// How many referencing paths a renumber reports before it stops counting.
const REFERENCE_LIMIT: usize = 500;

/// What a reference scan found, and what it could not look at.
pub struct ReferenceScan {
    pub found: Vec<String>,
    pub truncated: bool,
    pub unread: Vec<String>,
}

/// Every text file under `project_root` that still names `key`, project-relative
/// and sorted, with `skip` left out.
///
/// A match is bounded on both sides, so renumbering `LC-230` does not report
/// `LC-2301` or the `LC-230q` that now holds the other half of the collision.
///
/// Two different things are left out, and only one of them is a surprise.
/// [`REFERENCE_SKIPPED_DIRECTORIES`] is a fixed list, stated here and in
/// `docs/agents/issue-tracker.md`, so a caller knows the shape of the sweep
/// before it runs. A file that is *inside* the sweep and could not be read is
/// the surprise, so those come back in `unread` — "no references left" must not
/// be able to mean "none in the files I happened to open", which is the shape of
/// claim this repository refuses elsewhere: the network audit fails a run rather
/// than reporting a silence it cannot back up.
pub fn paths_mentioning_key(project_root: &Path, key: &str, skip: &Path) -> ReferenceScan {
    let mut found = Vec::new();
    let mut unread = Vec::new();
    let mut truncated = false;
    let walk = WalkDir::new(project_root)
        .into_iter()
        .filter_entry(|entry| {
            if entry.path() == skip {
                return false;
            }
            !(entry.file_type().is_dir()
                && entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| REFERENCE_SKIPPED_DIRECTORIES.contains(&name)))
        });
    for step in walk {
        // A directory the walk could not open takes its whole subtree with it, so
        // dropping the error would be the largest silence this scan could keep.
        // `walkdir` gives the path when it has one; when it does not, the failure
        // is the root itself.
        let entry = match step {
            Ok(entry) => entry,
            Err(error) => {
                unread.push(relative_to(
                    project_root,
                    error.path().unwrap_or(project_root),
                ));
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        match entry.metadata() {
            Ok(metadata) if metadata.len() > REFERENCE_FILE_LIMIT => {
                unread.push(relative_to(project_root, entry.path()));
                continue;
            }
            Ok(_) => {}
            Err(_) => {
                unread.push(relative_to(project_root, entry.path()));
                continue;
            }
        }
        let contents = match fs::read_to_string(entry.path()) {
            Ok(contents) => contents,
            // Not UTF-8 is the ordinary case and not a silence: a key is quoted
            // in text, so a file that is not text holds no reference anyone
            // maintains. Anything else — a permission, a file gone since the walk
            // listed it — is a file the scan meant to read and did not.
            Err(error) if error.kind() == std::io::ErrorKind::InvalidData => continue,
            Err(_) => {
                unread.push(relative_to(project_root, entry.path()));
                continue;
            }
        };
        if mentions_key(&contents, key) {
            if found.len() == REFERENCE_LIMIT {
                truncated = true;
                break;
            }
            found.push(relative_to(project_root, entry.path()));
        }
    }
    found.sort();
    unread.sort();
    ReferenceScan {
        found,
        truncated,
        unread,
    }
}

/// Whether `haystack` names `key` as a key rather than as the head of a longer
/// one. `LC-230` is in `LC-2301` and in `LC-230q` as text and in neither as a
/// reference.
fn mentions_key(haystack: &str, key: &str) -> bool {
    let bounded = |character: Option<char>| {
        character.is_none_or(|character| !character.is_ascii_alphanumeric())
    };
    let mut from = 0;
    while let Some(offset) = haystack[from..].find(key) {
        let at = from + offset;
        let after = at + key.len();
        if bounded(haystack[..at].chars().next_back()) && bounded(haystack[after..].chars().next())
        {
            return true;
        }
        from = after;
    }
    false
}

/// A path as the report names it: relative to the project root, so the list a
/// person reads is a list they can paste into an editor.
pub fn relative_to(project_root: &Path, path: &Path) -> String {
    path.strip_prefix(project_root)
        .unwrap_or(path)
        .display()
        .to_string()
}
