use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Weak};
use std::thread;
use std::time::{Duration, Instant};

use chrono::Utc;
#[cfg(test)]
use notify::{Config, PollWatcher};
use notify::{Event, RecursiveMode, Watcher};
use parking_lot::Mutex;

use crate::core::storage::{atomic_write, content_hash, parse_project, patch_ticket_title};
use crate::core::{
    AppError, AppResult, ErrorCode, EventSource, ProjectEvent, ProjectReference, ProjectSnapshot,
    RebuildReason, SearchResult, StreamEnvelope, TicketIndex, WriteResult,
};

const DEBOUNCE: Duration = Duration::from_millis(140);
const MAX_BURST: Duration = Duration::from_millis(900);
const SELF_WRITE_TTL: Duration = Duration::from_secs(5);

type EventSink = Arc<dyn Fn(StreamEnvelope) + Send + Sync + 'static>;

struct WriteReceipt {
    hash: String,
    expires_at: Instant,
}

#[derive(Default)]
struct ReceiptBook {
    entries: HashMap<PathBuf, WriteReceipt>,
}

impl ReceiptBook {
    fn remember(&mut self, path: PathBuf, hash: String, now: Instant) {
        self.entries.insert(
            path,
            WriteReceipt {
                hash,
                expires_at: now + SELF_WRITE_TTL,
            },
        );
    }

    fn forget(&mut self, path: &Path) {
        self.entries.remove(path);
    }

    fn consume_if_match(&mut self, path: &Path, hash: &str, now: Instant) -> bool {
        self.entries.retain(|_, receipt| receipt.expires_at > now);
        let matched = self
            .entries
            .get(path)
            .is_some_and(|receipt| receipt.hash == hash);
        // A mismatched hash is external and invalidates the stale receipt.
        self.entries.remove(path);
        matched
    }
}

pub struct ProjectEngine {
    project: ProjectReference,
    root: PathBuf,
    index: TicketIndex,
    receipts: Mutex<ReceiptBook>,
    sequence: AtomicU64,
    sink: EventSink,
    watcher: Mutex<Option<ProjectWatcher>>,
}

struct ProjectWatcher {
    watcher: Option<Box<dyn Watcher + Send>>,
    worker: Option<thread::JoinHandle<()>>,
}

#[derive(Clone, Copy)]
enum WatcherMode {
    Native,
    #[cfg(test)]
    Polling,
}

impl Drop for ProjectWatcher {
    fn drop(&mut self) {
        // Dropping RecommendedWatcher disconnects the callback sender.
        // The worker exits on disconnect; joining keeps teardown deterministic.
        drop(self.watcher.take());
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl ProjectEngine {
    pub fn start(project: ProjectReference, sink: EventSink) -> AppResult<Arc<Self>> {
        Self::start_with_mode(project, sink, WatcherMode::Native)
    }

    fn start_with_mode(
        project: ProjectReference,
        sink: EventSink,
        watcher_mode: WatcherMode,
    ) -> AppResult<Arc<Self>> {
        let root = PathBuf::from(&project.root_path);
        let engine = Arc::new(Self {
            project,
            root,
            index: TicketIndex::default(),
            receipts: Mutex::new(ReceiptBook::default()),
            sequence: AtomicU64::new(0),
            sink,
            watcher: Mutex::new(None),
        });
        engine.index.rebuild(&engine.root)?;
        let watcher = ProjectWatcher::start(Arc::downgrade(&engine), watcher_mode)?;
        *engine.watcher.lock() = Some(watcher);
        Ok(engine)
    }

    #[cfg(test)]
    fn start_polling(project: ProjectReference, sink: EventSink) -> AppResult<Arc<Self>> {
        Self::start_with_mode(project, sink, WatcherMode::Polling)
    }

    pub fn snapshot(&self) -> ProjectSnapshot {
        let index = self.index.snapshot();
        ProjectSnapshot {
            project: self.project.clone(),
            tickets: index.tickets,
            generation: index.generation,
            rebuilt_in_ms: index.rebuilt_in_ms,
        }
    }

    pub fn rebuild(&self, reason: RebuildReason, emit: bool) -> AppResult<ProjectSnapshot> {
        if !self.root.is_dir() {
            self.emit(ProjectEvent::ProjectUnavailable {
                root_path: self.root.display().to_string(),
            });
            return Err(AppError::new(
                ErrorCode::ProjectUnavailable,
                "The selected project folder is no longer available",
                true,
            )
            .with_context("path", self.root.display().to_string()));
        }
        // Clear first to prove no device-local state is authoritative.
        self.index.clear();
        let index = self.index.rebuild(&self.root)?;
        let mut project = parse_project(&self.root)?;
        project.reachable = true;
        let snapshot = ProjectSnapshot {
            project,
            tickets: index.tickets,
            generation: index.generation,
            rebuilt_in_ms: index.rebuilt_in_ms,
        };
        if emit {
            self.emit(ProjectEvent::IndexRebuilt {
                snapshot: snapshot.clone(),
                reason,
            });
        }
        Ok(snapshot)
    }

    pub fn search(&self, query: &str) -> SearchResult {
        self.index.search(query)
    }

    pub fn write_title(
        &self,
        key: &str,
        title: &str,
        expected_hash: &str,
    ) -> AppResult<WriteResult> {
        let (path, next) = patch_ticket_title(&self.root, key, title, expected_hash)?;
        let next_hash = content_hash(&next);
        self.receipts
            .lock()
            .remember(path.clone(), next_hash, Instant::now());
        if let Err(error) = atomic_write(&path, &next) {
            self.receipts.lock().forget(&path);
            return Err(error);
        }
        let ticket = self.index.ingest(&path, &self.root)?;
        let generation = self.index.snapshot().generation;
        Ok(WriteResult {
            ticket,
            generation,
            atomic_rename: true,
            watcher_echo_suppressed: true,
        })
    }

    fn emit(&self, event: ProjectEvent) {
        let envelope = StreamEnvelope {
            contract_version: 1,
            sequence: self.sequence.fetch_add(1, Ordering::Relaxed) + 1,
            project_id: self.project.id.clone(),
            emitted_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            event,
        };
        (self.sink)(envelope);
    }

    fn process_paths(&self, paths: HashMap<PathBuf, usize>, started: Instant) {
        if !self.root.is_dir() {
            self.emit(ProjectEvent::ProjectUnavailable {
                root_path: self.root.display().to_string(),
            });
            return;
        }

        for (path, coalesced_events) in paths {
            if path.file_name().and_then(|value| value.to_str()) != Some("ticket.md") {
                continue;
            }
            if path.exists() {
                if !stable_file(&path) {
                    continue;
                }
                let bytes = match fs::read(&path) {
                    Ok(bytes) => bytes,
                    Err(_) => continue,
                };
                let hash = content_hash(&bytes);
                let now = Instant::now();
                let mut receipts = self.receipts.lock();
                if receipts.consume_if_match(&path, &hash, now) {
                    continue;
                }
                drop(receipts);

                if let Ok(ticket) = self.index.ingest(&path, &self.root) {
                    self.emit(ProjectEvent::TicketChanged {
                        ticket,
                        source: EventSource::External,
                        coalesced_events,
                        detected_in_ms: started.elapsed().as_secs_f64() * 1_000.0,
                    });
                }
            } else if let Some(ticket_key) = self.index.remove_path(&path) {
                self.emit(ProjectEvent::TicketRemoved {
                    ticket_key,
                    source: EventSource::External,
                });
            }
        }
    }
}

impl ProjectWatcher {
    fn start(engine: Weak<ProjectEngine>, mode: WatcherMode) -> AppResult<Self> {
        let (event_tx, event_rx) = mpsc::channel::<notify::Result<Event>>();
        let watcher_result: notify::Result<Box<dyn Watcher + Send>> = match mode {
            WatcherMode::Native => {
                let event_tx = event_tx.clone();
                notify::recommended_watcher(move |event| {
                    let _ = event_tx.send(event);
                })
                .map(|watcher| Box::new(watcher) as Box<dyn Watcher + Send>)
            }
            #[cfg(test)]
            WatcherMode::Polling => {
                let event_tx = event_tx.clone();
                PollWatcher::new(
                    move |event| {
                        let _ = event_tx.send(event);
                    },
                    Config::default().with_poll_interval(Duration::from_millis(50)),
                )
                .map(|watcher| Box::new(watcher) as Box<dyn Watcher + Send>)
            }
        };
        let mut watcher = watcher_result.map_err(|error| {
            AppError::new(
                ErrorCode::Io,
                format!("Creating filesystem watcher failed: {error}"),
                true,
            )
        })?;
        let Some(strong) = engine.upgrade() else {
            return Err(AppError::new(
                ErrorCode::Internal,
                "Project engine disappeared before watcher startup",
                false,
            ));
        };
        let tickets_root = strong.root.join(".longclaw/tickets");
        watcher
            .watch(&tickets_root, RecursiveMode::Recursive)
            .map_err(|error| {
                AppError::new(
                    ErrorCode::Io,
                    format!("Watching {} failed: {error}", tickets_root.display()),
                    true,
                )
            })?;
        drop(strong);

        let worker = thread::Builder::new()
            .name("longclaw-watch-coalescer".to_owned())
            .spawn(move || {
                while let Ok(first) = event_rx.recv() {
                    let burst_started = Instant::now();
                    let mut paths = HashMap::<PathBuf, usize>::new();
                    collect_event(first, &mut paths);
                    while burst_started.elapsed() < MAX_BURST {
                        match event_rx.recv_timeout(DEBOUNCE) {
                            Ok(event) => collect_event(event, &mut paths),
                            Err(mpsc::RecvTimeoutError::Timeout) => break,
                            Err(mpsc::RecvTimeoutError::Disconnected) => return,
                        }
                    }
                    if let Some(engine) = engine.upgrade() {
                        engine.process_paths(paths, burst_started);
                    } else {
                        return;
                    }
                }
            })
            .map_err(|error| {
                AppError::new(
                    ErrorCode::Internal,
                    format!("Starting watcher worker failed: {error}"),
                    false,
                )
            })?;
        Ok(Self {
            watcher: Some(watcher),
            worker: Some(worker),
        })
    }
}

fn collect_event(event: notify::Result<Event>, paths: &mut HashMap<PathBuf, usize>) {
    let Ok(event) = event else {
        return;
    };
    let mut unique = HashSet::new();
    for path in event.paths {
        if path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name.contains(".longclaw-") && name.ends_with(".tmp"))
        {
            continue;
        }
        if unique.insert(path.clone()) {
            *paths.entry(path).or_default() += 1;
        }
    }
}

fn stable_file(path: &Path) -> bool {
    let first = fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok().map(|time| (metadata.len(), time)));
    thread::sleep(Duration::from_millis(35));
    let second = fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok().map(|time| (metadata.len(), time)));
    first.is_some() && first == second
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::{mpsc, Arc, Mutex as StdMutex, MutexGuard, OnceLock};
    use std::time::{Duration, Instant};

    use tempfile::TempDir;
    use walkdir::WalkDir;

    use super::ProjectEngine;
    use crate::core::storage::{content_hash, parse_project, parse_ticket, patch_ticket_title};
    use crate::core::{
        ErrorCode, EventSource, ProjectEvent, RebuildReason, StreamEnvelope, TicketIndex,
    };

    fn filesystem_test_guard() -> MutexGuard<'static, ()> {
        static SERIAL: OnceLock<StdMutex<()>> = OnceLock::new();
        SERIAL
            .get_or_init(|| StdMutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn copy_fixture() -> (TempDir, PathBuf) {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .expect("repository root")
            .join("fixtures/representative-project");
        let temp = tempfile::tempdir().expect("temp fixture parent");
        let target = temp.path().join("representative-project");
        for entry in WalkDir::new(&source).into_iter().map(Result::unwrap) {
            let relative = entry.path().strip_prefix(&source).unwrap();
            let destination = target.join(relative);
            if entry.file_type().is_dir() {
                fs::create_dir_all(&destination).unwrap();
            } else {
                fs::copy(entry.path(), &destination).unwrap();
            }
        }
        (temp, target)
    }

    fn start_engine(root: &Path) -> (Arc<ProjectEngine>, mpsc::Receiver<StreamEnvelope>) {
        let project = parse_project(root).unwrap();
        let (sender, receiver) = mpsc::channel();
        let sink = Arc::new(move |event| {
            sender.send(event).unwrap();
        });
        let engine = ProjectEngine::start_polling(project, sink).unwrap();
        // Let the deterministic polling adapter establish its first snapshot.
        // The production adapter remains native FSEvents and is covered by the
        // release-window acceptance probe.
        std::thread::sleep(Duration::from_millis(100));
        (engine, receiver)
    }

    fn editor_atomic_replace(path: &Path, raw: &str, sequence: usize) {
        let temporary = path.with_file_name(format!("ticket.md.editor-{sequence}.tmp"));
        fs::write(&temporary, raw).unwrap();
        fs::rename(temporary, path).unwrap();
    }

    fn replace_title(raw: &str, title: &str) -> String {
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

    #[test]
    fn index_is_disposable_and_rebuilds_degraded_records_from_files() {
        let _serial = filesystem_test_guard();
        let (_temp, root) = copy_fixture();
        let index = TicketIndex::default();
        let first = index.rebuild(&root).unwrap();
        assert_eq!(first.tickets.len(), 5);
        assert_eq!(
            first
                .tickets
                .iter()
                .filter(|ticket| ticket.degraded)
                .count(),
            2
        );
        index.clear();
        assert!(index.snapshot().tickets.is_empty());
        let rebuilt = index.rebuild(&root).unwrap();
        assert_eq!(rebuilt.tickets, first.tickets);
        assert!(rebuilt.generation > first.generation);
    }

    #[test]
    #[ignore = "filesystem watcher integration; run through npm run test:watcher"]
    fn filesystem_round_trip_covers_self_write_external_burst_deletion_and_reconcile() {
        let _serial = filesystem_test_guard();
        let (temp, root) = copy_fixture();
        let (engine, receiver) = start_engine(&root);
        let ticket = engine
            .snapshot()
            .tickets
            .into_iter()
            .find(|ticket| ticket.key == "LC-2")
            .unwrap();
        let result = engine
            .write_title(
                "LC-2",
                "The UI write crossed IPC once",
                &ticket.content_hash,
            )
            .unwrap();
        assert!(result.atomic_rename);
        assert!(result.watcher_echo_suppressed);
        assert_eq!(result.ticket.title, "The UI write crossed IPC once");

        let raw = fs::read_to_string(root.join(".longclaw/tickets/LC-2/ticket.md")).unwrap();
        assert!(raw.contains("x_fixture_extension:\n  owner: future-version"));
        assert_eq!(
            raw.matches("kind: update").count(),
            1,
            "one UI mutation creates one durable activity event"
        );
        assert!(
            receiver.recv_timeout(Duration::from_millis(800)).is_err(),
            "the watcher must not echo a self-authored atomic rename"
        );

        let path = root.join(".longclaw/tickets/LC-1/ticket.md");
        let initial = fs::read_to_string(&path).unwrap();
        for sequence in 1..=4 {
            let raw = replace_title(&initial, &format!("Rapid external edit {sequence}"));
            editor_atomic_replace(&path, &raw, sequence);
        }

        let event = receiver.recv_timeout(Duration::from_secs(10)).unwrap();
        match event.event {
            ProjectEvent::TicketChanged {
                ticket,
                source,
                coalesced_events,
                detected_in_ms,
            } => {
                println!(
                    "PERF external_visibility_pipeline_ms={detected_in_ms:.2} coalesced_events={coalesced_events}"
                );
                assert_eq!(ticket.title, "Rapid external edit 4");
                assert_eq!(source, EventSource::External);
                assert!(coalesced_events >= 1);
                assert!(detected_in_ms < 1_500.0);
            }
            other => panic!("expected ticket change, got {other:?}"),
        }
        assert!(
            receiver.recv_timeout(Duration::from_millis(500)).is_err(),
            "one editor save burst should produce one visible update"
        );
        assert_eq!(
            engine
                .snapshot()
                .tickets
                .iter()
                .find(|ticket| ticket.key == "LC-1")
                .unwrap()
                .title,
            "Rapid external edit 4"
        );

        let deleted_path = root.join(".longclaw/tickets/LC-3/ticket.md");
        fs::remove_file(&deleted_path).unwrap();
        let deleted = receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("external ticket deletion event");
        assert_eq!(
            serde_json::to_value(&deleted.event).unwrap(),
            serde_json::json!({
                "type": "ticketRemoved",
                "data": {
                    "ticketKey": "LC-3",
                    "source": "external"
                }
            }),
            "external deletion must cross IPC with the frontend field contract"
        );
        assert!(matches!(
            deleted.event,
            ProjectEvent::TicketRemoved {
                ref ticket_key,
                ref source
            } if ticket_key == "LC-3" && *source == EventSource::External
        ));
        assert!(
            engine
                .snapshot()
                .tickets
                .iter()
                .all(|ticket| ticket.key != "LC-3"),
            "external deletion must remove the indexed row"
        );
        assert!(
            receiver.recv_timeout(Duration::from_millis(500)).is_err(),
            "one external deletion should produce one visible event"
        );

        let resumed = engine.rebuild(RebuildReason::Resume, true).unwrap();
        assert_eq!(resumed.tickets.len(), 4);
        let resume_event = receiver.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(matches!(
            resume_event.event,
            ProjectEvent::IndexRebuilt {
                reason: RebuildReason::Resume,
                ..
            }
        ));

        let moved = temp.path().join("folder-moved");
        fs::rename(&root, &moved).unwrap();
        let error = engine.rebuild(RebuildReason::Resume, true).unwrap_err();
        assert_eq!(error.code, ErrorCode::ProjectUnavailable);
        let unavailable = receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("project unavailable event");
        assert!(matches!(
            unavailable.event,
            ProjectEvent::ProjectUnavailable { .. }
        ));
        assert!(moved.join(".longclaw/longclaw.yaml").is_file());
    }

    #[test]
    fn self_write_receipts_require_an_exact_path_and_hash_match() {
        let now = Instant::now();
        let path = PathBuf::from("/project/.longclaw/tickets/LC-2/ticket.md");
        let mut receipts = super::ReceiptBook::default();
        receipts.remember(path.clone(), "app-hash".to_owned(), now);
        assert!(!receipts.consume_if_match(&path, "external-hash", now));

        receipts.remember(path.clone(), "app-hash".to_owned(), now);
        assert!(receipts.consume_if_match(&path, "app-hash", now));
        assert!(!receipts.consume_if_match(&path, "app-hash", now));
    }

    #[test]
    fn stale_in_app_write_returns_a_typed_conflict_without_overwrite() {
        let _serial = filesystem_test_guard();
        let (_temp, root) = copy_fixture();
        let path = root.join(".longclaw/tickets/LC-1/ticket.md");
        let ticket = parse_ticket(&path, &root).unwrap();
        let external = replace_title(
            &fs::read_to_string(&path).unwrap(),
            "External version wins until review",
        );
        editor_atomic_replace(&path, &external, 1);

        let error = patch_ticket_title(
            &root,
            "LC-1",
            "Stale local version",
            &ticket.view.content_hash,
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::Conflict);
        assert!(fs::read_to_string(&path)
            .unwrap()
            .contains("title: External version wins until review"));
    }

    #[test]
    #[ignore = "explicit performance harness"]
    fn performance_budgets_for_project_load_and_search() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("large-project");
        let tickets = root.join(".longclaw/tickets");
        fs::create_dir_all(&tickets).unwrap();
        fs::write(
            root.join(".longclaw/longclaw.yaml"),
            "format: longclaw.project/v1\nid: perf-project\nname: Performance Fixture\nkey: PF\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n",
        )
        .unwrap();
        for sequence in 1..=5_000 {
            let directory = tickets.join(format!("PF-{sequence}"));
            fs::create_dir(&directory).unwrap();
            fs::write(
                directory.join("ticket.md"),
                format!(
                    "---\nformat: longclaw.ticket/v1\nid: perf-{sequence}\nkey: PF-{sequence}\ntitle: Searchable architecture ticket {sequence}\nstatus: todo\npriority: none\ncreated_at: 2026-07-29T00:00:00Z\nupdated_at: 2026-07-29T00:00:00Z\n---\n\n## Checklist\n\n- [ ] Measure it <!-- longclaw:item=ck_{sequence} -->\n"
                ),
            )
            .unwrap();
        }
        let index = TicketIndex::default();
        let loaded = index.rebuild(&root).unwrap();
        let search = index.search("ticket 4999");
        println!(
            "PERF large_project_load_ms={:.2} search_ms={:.2} records={}",
            loaded.rebuilt_in_ms,
            search.elapsed_ms,
            loaded.tickets.len()
        );
        assert_eq!(loaded.tickets.len(), 5_000);
        assert!(
            loaded.rebuilt_in_ms <= 2_500.0,
            "5k project load budget exceeded: {:.2}ms",
            loaded.rebuilt_in_ms
        );
        assert!(
            search.elapsed_ms <= 50.0,
            "search budget exceeded: {:.2}ms",
            search.elapsed_ms
        );
        assert_eq!(search.tickets.len(), 1);

        let sample = fs::read(root.join(".longclaw/tickets/PF-4999/ticket.md")).unwrap();
        assert!(!content_hash(&sample).is_empty());
    }
}
