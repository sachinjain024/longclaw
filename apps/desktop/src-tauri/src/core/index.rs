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

use super::attribution::attribute_change;
use super::error::AppResult;
use super::model::{ActivitySummary, IndexSnapshot, SearchResult, TicketRow};
use super::storage;
use super::storage::{collapse_whitespace, read_ticket_file, scan_ticket_paths};
use super::ticket::Status;

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
    /// The status each directory was last read as, which is the only place a
    /// file that will not parse can be given a seat from. See `place`.
    seats: HashMap<String, Status>,
    generation: u64,
}

impl State {
    /// Gives a row its seat, and takes the seat from a row that has one.
    ///
    /// A file that will not parse names no status — the file is exactly what
    /// could not be read — so the board would have nowhere to draw its card but
    /// the `Unreadable` column at the end, and a card that jumps to the end of
    /// the board the moment somebody breaks the frontmatter is a ticket the
    /// human has to go looking for (`states.md:92-93`, D-50). What the index can
    /// answer is where the directory sat when it last read, and that is what
    /// this lends it.
    ///
    /// Deliberately not a fact about the file: it is remembered, session-lived,
    /// and reconstructed by the next successful read. Losing it costs a
    /// placement and never a byte — the `Unreadable` group is the answer for a
    /// directory this index has never seen parse.
    fn place(&mut self, key: &str, row: &mut TicketRow) {
        match row {
            TicketRow::Indexed(indexed) => {
                self.seats.insert(key.to_owned(), indexed.status);
            }
            TicketRow::Degraded(degraded) => {
                degraded.last_known_status = self.seats.get(key).copied();
            }
        }
    }

    /// Places the row, stores it, and hands back the row as it was stored — the
    /// caller's copy has to be the placed one, since that is what the event it
    /// emits carries to the board.
    fn insert(&mut self, key: String, mut record: Record) -> TicketRow {
        self.place(&key, &mut record.row);
        if let Some(previous) = self.records.get(&key) {
            if previous.path != record.path {
                self.paths.remove(&previous.path);
            }
        }
        let row = record.row.clone();
        self.paths.insert(record.path.clone(), key.clone());
        self.records.insert(key, record);
        self.generation += 1;
        row
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
    ///
    /// `project_key` is passed in on every call rather than held here: the project
    /// document is authoritative for it and is re-read on each rebuild, so the
    /// index would only be caching an answer it does not own. Rows are all this
    /// stores; whose ticket a row is remains the caller's question to answer.
    pub fn rebuild(&self, project_root: &Path, project_key: &str) -> AppResult<IndexSnapshot> {
        let started = Instant::now();
        let paths = scan_ticket_paths(project_root)?;
        let mut records = HashMap::with_capacity(paths.len());
        let mut by_path = HashMap::with_capacity(paths.len());
        for path in paths {
            let Ok(file) = read_ticket_file(&path, project_key) else {
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
        for (key, record) in records.iter_mut() {
            state.place(key, &mut record.row);
        }
        // A directory that is gone takes its seat with it: nothing on disk names
        // it any more, and a folder put back is read before it is placed.
        state.seats.retain(|key, _| records.contains_key(key));
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
    ///
    /// The seats survive, and they are the one thing here that is not a row: no
    /// file says where an unreadable ticket was sitting, so a rebuild that
    /// dropped them would move a degraded card to the end of the board every
    /// time the app resumed. Every row still comes back from disk — that is the
    /// property this method exists for — and a seat is only remembered while
    /// this index is alive.
    pub fn clear(&self) {
        let mut state = self.state.write();
        state.records.clear();
        state.paths.clear();
    }

    /// Reads one ticket file into the index and returns the row it produced.
    pub fn ingest(&self, path: &Path, project_key: &str) -> AppResult<TicketRow> {
        Ok(self.ingest_attributing(path, project_key, None)?.0)
    }

    /// Ingests, and also says which record explains the change that brought us
    /// here, given the id of the newest record the app had already seen.
    ///
    /// The two are one call because the parsed document is the only place both
    /// answers exist, and reading the file twice to ask separately would be a
    /// second chance for the file to move underneath us. The rule itself lives in
    /// `core::attribution`, not here — the index stores rows, it does not decide
    /// who did what.
    pub fn ingest_attributing(
        &self,
        path: &Path,
        project_key: &str,
        previously_seen: Option<&str>,
    ) -> AppResult<(TicketRow, Option<ActivitySummary>)> {
        let file = read_ticket_file(path, project_key)?;
        let attribution = match &file.parsed {
            Ok(document) => attribute_change(previously_seen, &document.ticket().activity),
            // A file this build cannot parse, or one belonging to another project,
            // has no records to attribute from.
            Err(_) => None,
        };
        let record = Record {
            row: file.row(),
            path: file.path.clone(),
            search_text: file.search_text(),
        };
        // The stored row rather than the one just read: `insert` is where a file
        // that will not parse is given the seat its directory last read in, and
        // the row this returns is the one the change event carries.
        let row = self.state.write().insert(file.key, record);
        Ok((row, attribution))
    }

    /// Drops the record for a path that is gone, returning the key it held.
    pub fn remove_path(&self, path: &Path) -> Option<String> {
        let mut state = self.state.write();
        let key = state.paths.remove(path)?;
        state.records.remove(&key);
        // The seat goes with it. A directory that comes back is read before it is
        // placed, so remembering where a deleted one sat could only ever seat a
        // different ticket.
        state.seats.remove(&key);
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

/// Orders `LC-9` before `LC-10`, which plain string ordering does not, and
/// `LC-99x` before `LC-100`, which neither does.
///
/// Every name is ranked into one comparable tuple rather than dispatched to one
/// of two comparisons, and that shape is the whole point. The version that
/// compared *pairs* — numerically when both parsed, byte-wise otherwise — was not
/// a total order, because a name that did not parse was byte-compared against
/// keys that were being compared numerically to each other. `LC-234q` walked
/// straight into it when keys grew a trailing character (LC-232): `LC-234q` <
/// `LC-9` by bytes, `LC-9` < `LC-10` by number, `LC-10` < `LC-234q` by bytes.
///
/// `sort_by` given a cycle may return an arbitrary permutation or panic — "user-
/// provided comparison function does not correctly implement a total order" —
/// and both callers here are a render: `State::rows` is the board and the list,
/// and `Index::search` truncates to `SEARCH_LIMIT` *after* sorting, so a wrong
/// order is also the wrong hundred rows.
///
/// A name that is not a key sorts after every name that is, and then by its
/// bytes. Those are directory names the app is showing as degraded rows; they
/// have no number to be in sequence with.
fn compare_keys(left: &str, right: &str) -> std::cmp::Ordering {
    /// `(is_not_a_key, prefix, number, trailing character, name)`.
    fn rank(key: &str) -> (u8, &str, u64, Option<char>, &str) {
        let parsed = key.rsplit_once('-').and_then(|(prefix, sequence)| {
            let (number, suffix) = storage::split_key_suffix(sequence);
            number
                .parse::<u64>()
                .ok()
                .map(|number| (prefix, number, suffix))
        });
        match parsed {
            Some((prefix, number, suffix)) => (0, prefix, number, suffix, key),
            None => (1, "", 0, None, key),
        }
    }
    rank(left).cmp(&rank(right))
}

#[cfg(test)]
mod tests {
    use std::cmp::Ordering;

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

    /// A key that carries a trailing character sorts by its number like every
    /// other key (LC-232).
    #[test]
    fn a_suffixed_key_orders_by_its_number_and_not_by_its_bytes() {
        let mut keys = vec!["LC-234q", "LC-9", "LC-10", "LC-99x", "LC-100", "LC-1000a"];
        keys.sort_by(|left, right| compare_keys(left, right));
        assert_eq!(
            keys,
            vec!["LC-9", "LC-10", "LC-99x", "LC-100", "LC-234q", "LC-1000a"]
        );
    }

    /// Two keys on one number are what two branches landing on 234 look like,
    /// and the order between them has to be *an* order rather than none.
    #[test]
    fn two_keys_on_one_number_order_by_their_trailing_character() {
        let mut keys = vec!["LC-234q", "LC-234b", "LC-234"];
        keys.sort_by(|left, right| compare_keys(left, right));
        assert_eq!(keys, vec!["LC-234", "LC-234b", "LC-234q"]);
    }

    /// The comparator is a total order, and this is not a stylistic point.
    ///
    /// `sort_by` with an intransitive comparator may return an arbitrary
    /// permutation or panic outright — "user-provided comparison function does not
    /// correctly implement a total order" — which on this path takes out the
    /// board's whole render. An unparseable directory name reached the byte-order
    /// fallback while its neighbours were compared numerically, and `LC-234q`
    /// joined it the moment keys grew a trailing character: `LC-234q < LC-9` by
    /// bytes, `LC-9 < LC-10` by number, `LC-10 < LC-234q` by bytes is a cycle.
    ///
    /// Every triple of a set holding both shapes, checked rather than argued.
    #[test]
    fn the_order_is_total_over_keys_and_over_names_that_are_not_keys() {
        let keys = [
            "LC-9",
            "LC-10",
            "LC-234q",
            "LC-234b",
            "LC-100",
            "AB-2",
            "AB-2z",
            "not-a-key",
            "LC-2-bad",
            "LC-0",
            "",
        ];
        for left in keys {
            assert_eq!(
                compare_keys(left, left),
                Ordering::Equal,
                "{left:?} is not equal to itself"
            );
            for right in keys {
                assert_eq!(
                    compare_keys(left, right),
                    compare_keys(right, left).reverse(),
                    "{left:?} and {right:?} disagree about which comes first"
                );
                for third in keys {
                    if compare_keys(left, right) != Ordering::Greater
                        && compare_keys(right, third) != Ordering::Greater
                    {
                        assert_ne!(
                            compare_keys(left, third),
                            Ordering::Greater,
                            "{left:?} <= {right:?} <= {third:?}, but {left:?} > {third:?}"
                        );
                    }
                }
            }
        }
    }
}
