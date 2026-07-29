//! The disposable ticket index.
//!
//! Nothing here is authoritative. The index exists so a board, list, search, or
//! palette can answer instantly without re-reading the project, and it can be
//! cleared and rebuilt from the files at any moment — that is the property the
//! rebuild test asserts, and the reason index loss can never be data loss.
//!
//! Records are keyed by ticket directory name. A readable ticket's frontmatter key
//! and directory agree, and an unreadable one has no trustworthy key of its own,
//! so the directory is the identity in both cases.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

use parking_lot::RwLock;

use super::error::AppResult;
use super::model::{IndexSnapshot, SearchResult, TicketRow};
use super::storage::{collapse_whitespace, read_ticket_file, scan_ticket_paths};

/// How many rows a search returns before it stops looking.
const SEARCH_LIMIT: usize = 100;

#[derive(Debug, Clone)]
struct Record {
    row: TicketRow,
    path: PathBuf,
    /// Lowercased key, title, labels, and a bounded slice of the description.
    search_text: String,
}

#[derive(Default)]
struct State {
    records: HashMap<String, Record>,
    /// Canonical ticket path to directory key, so a watcher event about a path
    /// resolves without scanning every record.
    paths: HashMap<PathBuf, String>,
    generation: u64,
}

impl State {
    fn insert(&mut self, key: String, record: Record) {
        if let Some(previous) = self.records.get(&key) {
            if previous.path != record.path {
                self.paths.remove(&previous.path);
            }
        }
        self.paths.insert(record.path.clone(), key.clone());
        self.records.insert(key, record);
        self.generation += 1;
    }

    fn rows(&self) -> Vec<TicketRow> {
        let mut rows: Vec<TicketRow> = self
            .records
            .values()
            .map(|record| record.row.clone())
            .collect();
        rows.sort_by(|left, right| compare_keys(left.key(), right.key()));
        rows
    }
}

#[derive(Default)]
pub struct TicketIndex {
    state: RwLock<State>,
}

impl TicketIndex {
    /// Reads every canonical ticket file and replaces the index with the result.
    pub fn rebuild(&self, project_root: &Path) -> AppResult<IndexSnapshot> {
        let started = Instant::now();
        let paths = scan_ticket_paths(project_root)?;
        let mut records = HashMap::with_capacity(paths.len());
        let mut by_path = HashMap::with_capacity(paths.len());
        for path in paths {
            let Ok(file) = read_ticket_file(&path) else {
                // A file that vanished between the scan and the read belongs to
                // the next rebuild, not this one.
                continue;
            };
            let record = Record {
                row: file.row(),
                path: file.path.clone(),
                search_text: file.search_text(),
            };
            by_path.insert(record.path.clone(), file.key.clone());
            records.insert(file.key, record);
        }

        let mut state = self.state.write();
        state.records = records;
        state.paths = by_path;
        state.generation += 1;
        Ok(IndexSnapshot {
            tickets: state.rows(),
            generation: state.generation,
            rebuilt_in_ms: started.elapsed().as_secs_f64() * 1_000.0,
        })
    }

    /// Empties the index without touching a file, so a rebuild has to prove it can
    /// reconstruct everything from disk.
    pub fn clear(&self) {
        let mut state = self.state.write();
        state.records.clear();
        state.paths.clear();
    }

    /// Reads one ticket file into the index and returns the row it produced.
    pub fn ingest(&self, path: &Path) -> AppResult<TicketRow> {
        let file = read_ticket_file(path)?;
        let row = file.row();
        let record = Record {
            row: row.clone(),
            path: file.path.clone(),
            search_text: file.search_text(),
        };
        self.state.write().insert(file.key, record);
        Ok(row)
    }

    /// Drops the record for a path that is gone, returning the key it held.
    pub fn remove_path(&self, path: &Path) -> Option<String> {
        let mut state = self.state.write();
        let key = state.paths.remove(path)?;
        state.records.remove(&key);
        state.generation += 1;
        Some(key)
    }

    pub fn snapshot(&self) -> IndexSnapshot {
        let state = self.state.read();
        IndexSnapshot {
            tickets: state.rows(),
            generation: state.generation,
            rebuilt_in_ms: 0.0,
        }
    }

    pub fn row(&self, key: &str) -> Option<TicketRow> {
        self.state
            .read()
            .records
            .get(key)
            .map(|record| record.row.clone())
    }

    /// Matches a lowercased substring against key, title, labels, and description.
    /// Degraded rows match on their key alone: there is no trustworthy text in a
    /// file that would not parse.
    pub fn search(&self, query: &str) -> SearchResult {
        let started = Instant::now();
        let needle = collapse_whitespace(query);
        let state = self.state.read();
        let mut tickets: Vec<TicketRow> = state
            .records
            .values()
            .filter(|record| needle.is_empty() || record.search_text.contains(&needle))
            .map(|record| record.row.clone())
            .collect();
        tickets.sort_by(|left, right| compare_keys(left.key(), right.key()));
        tickets.truncate(SEARCH_LIMIT);
        SearchResult {
            tickets,
            elapsed_ms: started.elapsed().as_secs_f64() * 1_000.0,
        }
    }
}

/// Orders `LC-9` before `LC-10`, which plain string ordering does not.
fn compare_keys(left: &str, right: &str) -> std::cmp::Ordering {
    let split = |key: &str| {
        key.rsplit_once('-').and_then(|(prefix, sequence)| {
            sequence
                .parse::<u64>()
                .ok()
                .map(|number| (prefix.to_owned(), number))
        })
    };
    match (split(left), split(right)) {
        (Some((left_prefix, left_number)), Some((right_prefix, right_number))) => left_prefix
            .cmp(&right_prefix)
            .then(left_number.cmp(&right_number)),
        _ => left.cmp(right),
    }
}

#[cfg(test)]
mod tests {
    use super::compare_keys;

    #[test]
    fn keys_order_by_their_sequence_number() {
        let mut keys = vec!["LC-10", "LC-9", "LC-100", "AB-2", "LC-1"];
        keys.sort_by(|left, right| compare_keys(left, right));
        assert_eq!(keys, vec!["AB-2", "LC-1", "LC-9", "LC-10", "LC-100"]);
    }

    #[test]
    fn a_key_shaped_directory_name_still_sorts_deterministically() {
        let mut keys = vec!["LC-2", "not-a-key", "LC-1"];
        keys.sort_by(|left, right| compare_keys(left, right));
        assert_eq!(keys, vec!["LC-1", "LC-2", "not-a-key"]);
    }
}
