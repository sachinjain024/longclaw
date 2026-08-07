//! One open project: its index, its watcher, and every write that touches it.
//!
//! The engine is the seam the rest of the app uses, and it keeps the filesystem's
//! awkwardness behind that seam: `open`, `snapshot`, `detail`, `search`, `rebuild`,
//! `edit_ticket`, and `create_ticket`, as revised in ADR 0008. Anything beyond
//! reading and writing tickets — project settings, for instance — belongs outside
//! this type.
//!
//! Three behaviours are worth knowing about before changing anything here:
//!
//! - **Bursts collapse.** Editors and agents save in several syscalls. Events are
//!   coalesced per path over a quiet period, and the file must hold still before
//!   it is parsed, so one save produces one visible update with final content.
//! - **Self-writes are recognized, not ignored.** Before an app write is renamed
//!   into place, the engine records `(path, hash)`. A watcher event is suppressed
//!   only when both match. A different hash is always someone else's edit, even
//!   within the receipt window — the app never goes blind for a period of time.
//!   A write that does not land forgets its receipt, so suppression never outlives
//!   the bytes it was recorded for.
//! - **A rename is a removal and an arrival.** Every event path is normalized to
//!   the canonical `ticket.md` it concerns, so a directory rename removes one row
//!   and adds another without the watcher needing to understand rename semantics.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Weak};
use std::thread;
use std::time::{Duration, Instant};
use std::{fs, io};

use chrono::{SecondsFormat, Utc};
use notify::{Config, Event, PollWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;

use crate::core::storage::{
    self, atomic_write, content_hash, directory_key, prepare_new_ticket, prepare_ticket_edit,
    read_project, ticket_file_path, NewTicket,
};
use crate::core::ticket::TicketEdit;
use crate::core::{
    AppError, AppResult, ErrorCode, EventSource, ProjectEvent, ProjectReference, ProjectSnapshot,
    RebuildReason, SearchResult, StreamEnvelope, TicketDetail, TicketIndex, TicketRow, WriteResult,
};
use crate::platform::macos;

/// How long a burst of events must go quiet before it is processed.
const DEBOUNCE: Duration = Duration::from_millis(140);
/// The longest a burst is allowed to keep extending itself.
const MAX_BURST: Duration = Duration::from_millis(900);
/// How long the file must hold the same size and mtime to count as settled.
const STABILITY_INTERVAL: Duration = Duration::from_millis(35);
/// How many times to wait for a file to settle before reading it anyway. A file
/// still changing after this will send another event, so the worst case is a
/// short-lived degraded row rather than a stale one.
const STABILITY_ATTEMPTS: usize = 6;
/// How long a self-write receipt stays valid.
const SELF_WRITE_TTL: Duration = Duration::from_secs(5);
/// How often a quiet watcher checks that the project is still there.
///
/// The watcher is the only thing that would otherwise notice a folder going
/// away, and on macOS it notices nothing: renaming an *ancestor* of the watched
/// path delivers no event for the path itself, so a project root moved out from
/// under a running app produced silence — and a board full of cached rows
/// presented as live, which `states.md:96` forbids (LC-139). One `stat` per
/// interval on an idle watcher is what that silence costs to close.
const LIVENESS_PROBE: Duration = Duration::from_secs(2);

pub type EventSink = Arc<dyn Fn(StreamEnvelope) + Send + Sync + 'static>;

type BlockingJob = Box<dyn FnOnce() + Send + 'static>;

/// A small, per-project pool for filesystem and parsing work.
///
/// Keeping the pool on the engine bounds work independently for each open
/// project. Rebuild requests have an additional coalescing gate below, so a
/// burst of recovery requests cannot consume every worker with identical scans.
struct BlockingPool {
    sender: Option<mpsc::SyncSender<BlockingJob>>,
    workers: Vec<thread::JoinHandle<()>>,
}

impl BlockingPool {
    fn new(size: usize) -> AppResult<Self> {
        let (sender, receiver) = mpsc::sync_channel::<BlockingJob>(size);
        let receiver = Arc::new(Mutex::new(receiver));
        let mut workers = Vec::with_capacity(size);
        for number in 0..size {
            let receiver = Arc::clone(&receiver);
            workers.push(
                thread::Builder::new()
                    .name(format!("longclaw-blocking-{number}"))
                    .spawn(move || loop {
                        let job = receiver.lock().recv();
                        match job {
                            Ok(job) => job(),
                            Err(_) => break,
                        }
                    })
                    .map_err(|error| {
                        AppError::new(
                            ErrorCode::Internal,
                            format!("Starting blocking worker failed: {error}"),
                            false,
                        )
                    })?,
            );
        }
        Ok(Self {
            sender: Some(sender),
            workers,
        })
    }

    fn submit(&self, job: BlockingJob) -> AppResult<()> {
        self.sender
            .as_ref()
            .expect("blocking pool sender is present while the pool is live")
            .send(job)
            .map_err(|_| AppError::new(ErrorCode::Internal, "Blocking worker stopped", false))
    }

    fn run<T: Send + 'static>(
        &self,
        job: impl FnOnce() -> AppResult<T> + Send + 'static,
    ) -> AppResult<T> {
        let (result_tx, result_rx) = mpsc::sync_channel(1);
        self.submit(Box::new(move || {
            let _ = result_tx.send(job());
        }))?;
        result_rx
            .recv()
            .map_err(|_| AppError::new(ErrorCode::Internal, "Blocking worker stopped", false))?
    }
}

impl Drop for BlockingPool {
    fn drop(&mut self) {
        self.sender.take();
        for worker in self.workers.drain(..) {
            let _ = worker.join();
        }
    }
}

/// Which filesystem watcher to use.
#[derive(Debug, Clone, Copy)]
pub enum WatcherAdapter {
    /// The production adapter: FSEvents on macOS.
    Native,
    /// Deterministic polling. Integration tests use this so a test asserts the
    /// pipeline's behaviour rather than the platform's event timing.
    Polling { interval_ms: u64 },
}

struct Receipt {
    hash: String,
    expires_at: Instant,
}

/// The hashes the app itself just wrote, per path.
///
/// A path can hold several: two quick saves both have receipts in flight, and the
/// watcher may report either. Unmatched receipts are left to expire rather than
/// being cleared by someone else's edit, because only the app's own bytes can
/// produce a matching hash.
#[derive(Default)]
struct ReceiptBook {
    entries: HashMap<PathBuf, Vec<Receipt>>,
}

impl ReceiptBook {
    fn remember(&mut self, path: PathBuf, hash: String, now: Instant) {
        self.entries.entry(path).or_default().push(Receipt {
            hash,
            expires_at: now + SELF_WRITE_TTL,
        });
    }

    fn forget(&mut self, path: &Path, hash: &str) {
        if let Some(receipts) = self.entries.get_mut(path) {
            receipts.retain(|receipt| receipt.hash != hash);
            if receipts.is_empty() {
                self.entries.remove(path);
            }
        }
    }

    fn consume_if_match(&mut self, path: &Path, hash: &str, now: Instant) -> bool {
        for receipts in self.entries.values_mut() {
            receipts.retain(|receipt| receipt.expires_at > now);
        }
        self.entries.retain(|_, receipts| !receipts.is_empty());

        let Some(receipts) = self.entries.get_mut(path) else {
            return false;
        };
        let Some(position) = receipts.iter().position(|receipt| receipt.hash == hash) else {
            return false;
        };
        // Anything written before the matched write can no longer be observed.
        receipts.drain(..=position);
        if receipts.is_empty() {
            self.entries.remove(path);
        }
        true
    }
}

pub struct ProjectEngine {
    project: Mutex<ProjectReference>,
    root: PathBuf,
    index: TicketIndex,
    receipts: Mutex<ReceiptBook>,
    /// Held while a key is allocated so two creations cannot pick the same one.
    creation: Mutex<()>,
    sequence: AtomicU64,
    sink: EventSink,
    blocking: BlockingPool,
    watcher: Mutex<Option<ProjectWatcher>>,
    recovery: Mutex<Option<Instant>>,
    rebuild_queued: Mutex<bool>,
}

struct ProjectWatcher {
    watcher: Option<Box<dyn Watcher + Send>>,
    worker: Option<thread::JoinHandle<()>>,
    wake_observer: Option<macos::WakeObserver>,
}

enum WatchSignal {
    File(notify::Result<Event>),
    Wake,
}

impl Drop for ProjectWatcher {
    fn drop(&mut self) {
        // Dropping the watcher disconnects the callback sender. The worker exits on
        // disconnect; joining keeps teardown deterministic.
        drop(self.wake_observer.take());
        drop(self.watcher.take());
        if let Some(worker) = self.worker.take() {
            // Unless this *is* the worker. It upgrades the engine to probe and to
            // rebuild, so the last strong reference can be the one it is holding
            // — and then the engine, the watcher, and this join all run on the
            // thread being joined. `join` answers that with an error rather than
            // a hang, but it is an error raised inside a `Drop`, which is a
            // panic; the sender is already disconnected above, so the thread
            // ends either way and there is nothing left to wait for.
            if worker.thread().id() != thread::current().id() {
                let _ = worker.join();
            }
        }
    }
}

impl ProjectEngine {
    pub fn start(project: ProjectReference, sink: EventSink) -> AppResult<Arc<Self>> {
        Self::start_with_adapter(project, sink, WatcherAdapter::Native)
    }

    pub fn start_with_adapter(
        project: ProjectReference,
        sink: EventSink,
        adapter: WatcherAdapter,
    ) -> AppResult<Arc<Self>> {
        // The root is canonicalized once, here. macOS reports watcher paths in
        // resolved form (`/private/var/...`), so a root holding an unresolved
        // symlink would make every event look like it came from outside the
        // project.
        let requested = PathBuf::from(&project.root_path);
        let root = requested
            .canonicalize()
            .map_err(|error| AppError::io("Canonicalizing project folder", &requested, error))?;
        let mut project = project;
        project.root_path = root.display().to_string();
        let engine = Arc::new(Self {
            project: Mutex::new(project),
            root,
            index: TicketIndex::default(),
            receipts: Mutex::new(ReceiptBook::default()),
            creation: Mutex::new(()),
            sequence: AtomicU64::new(0),
            sink,
            blocking: BlockingPool::new(2)?,
            watcher: Mutex::new(None),
            recovery: Mutex::new(None),
            rebuild_queued: Mutex::new(false),
        });
        let project_key = engine.project.lock().key.clone();
        let initial_engine = Arc::clone(&engine);
        engine.blocking.run(move || {
            initial_engine
                .index
                .rebuild(&initial_engine.root, &project_key)
        })?;
        let watcher = ProjectWatcher::start(Arc::downgrade(&engine), adapter)?;
        *engine.watcher.lock() = Some(watcher);
        Ok(engine)
    }

    pub fn project(&self) -> ProjectReference {
        self.project.lock().clone()
    }

    pub fn snapshot(&self) -> ProjectSnapshot {
        // Before the rows, deliberately. See `ProjectSnapshot::sequence`.
        let sequence = self.sequence.load(Ordering::Relaxed);
        let index = self.index.snapshot();
        ProjectSnapshot {
            project: self.project(),
            tickets: index.tickets,
            generation: index.generation,
            rebuilt_in_ms: index.rebuilt_in_ms,
            sequence,
        }
    }

    /// Throws the index away and rebuilds it from the project files.
    pub fn rebuild(
        self: &Arc<Self>,
        reason: RebuildReason,
        emit: bool,
    ) -> AppResult<ProjectSnapshot> {
        let engine = Arc::clone(self);
        self.blocking.run(move || engine.rebuild_now(reason, emit))
    }

    fn rebuild_now(&self, reason: RebuildReason, emit: bool) -> AppResult<ProjectSnapshot> {
        // Availability is checked before coalescing, never after. A root that
        // disappeared between two recovery triggers has to surface as unavailable;
        // suppressing it would hand back a stale snapshot that looks live.
        if !self.root.is_dir() {
            return Err(self.report_unavailable());
        }
        if matches!(reason, RebuildReason::Resume | RebuildReason::Overflow) {
            let mut last_recovery = self.recovery.lock();
            if last_recovery.is_some_and(|at| at.elapsed() < DEBOUNCE) {
                return Ok(self.snapshot());
            }
            *last_recovery = Some(Instant::now());
        }
        // Before the rows, deliberately. See `ProjectSnapshot::sequence`.
        let sequence = self.sequence.load(Ordering::Relaxed);
        // Clear first, so a rebuild cannot pass by keeping stale rows.
        self.index.clear();
        // The project document is read before the tickets, deliberately: its key
        // decides which directories under `tickets/` are this project's at all, so
        // reading it afterwards would index a rebuild against the previous key.
        let project = ProjectReference::from_project(
            read_project(&self.root)?.project(),
            self.root.display().to_string(),
        );
        *self.project.lock() = project.clone();
        let index = self.index.rebuild(&self.root, &project.key)?;
        let snapshot = ProjectSnapshot {
            project,
            tickets: index.tickets,
            generation: index.generation,
            rebuilt_in_ms: index.rebuilt_in_ms,
            sequence,
        };
        if emit {
            self.emit(ProjectEvent::IndexRebuilt {
                snapshot: snapshot.clone(),
                reason,
            });
        }
        Ok(snapshot)
    }

    /// Starts one rebuild and returns the current snapshot immediately. A second
    /// request while the first is running is deliberately folded into that same
    /// completion event.
    pub fn request_rebuild(self: &Arc<Self>, reason: RebuildReason) -> AppResult<ProjectSnapshot> {
        if !self.root.is_dir() {
            return Err(self.report_unavailable());
        }
        let should_queue = {
            let mut queued = self.rebuild_queued.lock();
            if *queued {
                false
            } else {
                *queued = true;
                true
            }
        };
        if should_queue {
            let weak = Arc::downgrade(self);
            if let Err(error) = self.blocking.submit(Box::new(move || {
                let Some(engine) = weak.upgrade() else { return };
                let _ = engine.rebuild_now(reason, true);
                *engine.rebuild_queued.lock() = false;
            })) {
                *self.rebuild_queued.lock() = false;
                return Err(error);
            }
        }
        Ok(self.snapshot())
    }

    pub fn search(&self, query: &str) -> SearchResult {
        self.index.search(query)
    }

    /// Reads one ticket from disk, so the panel always opens the current file
    /// rather than an index row that may be a moment old.
    pub fn detail(&self, key: &str) -> AppResult<TicketDetail> {
        storage::read_ticket_detail(&self.root, &self.project().key, key)
    }

    /// The ticket's file, canonicalized and proven to live inside this project,
    /// for handing to the OS.
    ///
    /// The webview names a ticket and never a path — the same rule the read and
    /// write paths follow — so `Open in editor` cannot become an arbitrary
    /// filesystem reach out of a surface that has no filesystem capability. The
    /// proof is `storage::resolve_ticket_path`'s, which refuses a key outside
    /// the grammar and a symlink that leaves the project.
    pub fn canonical_ticket_path(&self, key: &str) -> AppResult<PathBuf> {
        storage::resolve_ticket_path(&self.root, key)
    }

    pub fn edit_ticket(
        &self,
        key: &str,
        edit: &TicketEdit,
        expected_hash: &str,
    ) -> AppResult<WriteResult> {
        let write = prepare_ticket_edit(
            &self.root,
            &self.project().key,
            key,
            edit,
            expected_hash,
            &now(),
        )?;
        self.commit(write, false)
    }

    pub fn create_ticket(&self, request: &NewTicket) -> AppResult<WriteResult> {
        let project_key = self.project().key;
        let write = {
            let _claim = self.creation.lock();
            prepare_new_ticket(&self.root, &project_key, request, &now())?
        };
        self.commit(write, true)
    }

    /// Records the receipt, places the bytes, and updates the index exactly once.
    ///
    /// An edit goes through `atomic_replace`, which refuses to displace bytes other
    /// than the ones its validation saw. A create goes through `atomic_write`: it
    /// has claimed a directory nobody else holds, so there is nothing to displace.
    fn commit(&self, write: crate::core::TicketWrite, created: bool) -> AppResult<WriteResult> {
        let hash = content_hash(&write.bytes);
        self.receipts
            .lock()
            .remember(write.path.clone(), hash.clone(), Instant::now());
        let path = write.path.clone();
        let bytes = write.bytes.clone();
        let expected_hash = write.expected_hash.clone();
        let replace_seams = storage::replace_seams_for_worker();
        let placed = self.blocking.run(move || match expected_hash {
            Some(expected) => {
                storage::atomic_replace_with_seams(&path, &bytes, &expected, replace_seams)
            }
            None => atomic_write(storage::SAVING_TICKET, &path, &bytes),
        });
        if let Err(error) = placed {
            // Our bytes are not on disk, so the receipt must go too. Left behind, it
            // would suppress the watcher event carrying whoever's write did land —
            // and the UI would learn nothing about a save it was just told failed.
            self.receipts.lock().forget(&write.path, &hash);
            if created {
                storage::discard_claimed_ticket_directory(&write.path);
            }
            // Every write failure leaves here knowing which ticket and which file
            // it was, whatever raised it: the filesystem underneath only ever
            // knew a path, and a swap that finds the file gone knows neither
            // (V0-29's must-pass). Existing context wins — whoever raised the
            // error was closer to it.
            return Err(error
                .with_context_if_absent("ticketKey", write.key.clone())
                .with_context_if_absent("path", write.path.display().to_string()));
        }
        let ticket = self.index.ingest(&write.path, &self.project().key)?;
        Ok(WriteResult {
            ticket,
            generation: self.index.snapshot().generation,
            changes: write.changes,
        })
    }

    fn report_unavailable(&self) -> AppError {
        let root_path = self.root.display().to_string();
        self.emit(ProjectEvent::ProjectUnavailable {
            root_path: root_path.clone(),
        });
        AppError::new(
            ErrorCode::ProjectUnavailable,
            "The selected project folder is no longer available",
            true,
        )
        .with_context("path", root_path)
    }

    fn emit(&self, event: ProjectEvent) {
        let envelope = StreamEnvelope {
            contract_version: 1,
            sequence: self.sequence.fetch_add(1, Ordering::Relaxed) + 1,
            project_id: self.project.lock().id.clone(),
            emitted_at: now(),
            event,
        };
        (self.sink)(envelope);
    }

    /// Turns one settled burst into visible events.
    fn process_burst(&self, paths: HashMap<PathBuf, usize>, started: Instant) {
        if !self.root.is_dir() {
            self.report_unavailable();
            return;
        }
        let mut ordered: Vec<(PathBuf, usize)> = paths.into_iter().collect();
        ordered.sort_by(|left, right| left.0.cmp(&right.0));
        // One key for the whole burst, so every path in it is judged against the
        // same project.
        let project_key = self.project.lock().key.clone();

        for (path, coalesced_events) in ordered {
            if !path.exists() {
                if let Some(ticket_key) = self.index.remove_path(&path) {
                    self.emit(ProjectEvent::TicketRemoved {
                        ticket_key,
                        source: EventSource::External,
                    });
                }
                continue;
            }
            let Some(bytes) = read_when_settled(&path) else {
                continue;
            };
            let hash = content_hash(&bytes);
            if self
                .receipts
                .lock()
                .consume_if_match(&path, &hash, Instant::now())
            {
                continue;
            }
            let previous = directory_key(&path).and_then(|key| self.index.row(&key));
            // The same bytes we already hold are not a change, whoever touched the
            // file. This is what keeps a metadata-only event from re-announcing a
            // change the app has already applied.
            if previous
                .as_ref()
                .is_some_and(|row| row.content_hash() == hash)
            {
                continue;
            }
            // The row we are about to replace is the only record of what this file
            // looked like before, so the newest record we had already seen has to be
            // read out of it here — after this ingest it is gone.
            let previously_seen = previous.as_ref().and_then(|row| match row {
                TicketRow::Indexed(row) => row.last_activity.as_ref().map(|event| event.id.clone()),
                TicketRow::Degraded(_) => None,
            });
            if let Ok((ticket, attribution)) =
                self.index
                    .ingest_attributing(&path, &project_key, previously_seen.as_deref())
            {
                self.emit(ProjectEvent::TicketChanged {
                    ticket: Box::new(ticket),
                    source: EventSource::External,
                    coalesced_events,
                    detected_in_ms: started.elapsed().as_secs_f64() * 1_000.0,
                    attribution,
                });
            }
        }
    }
}

impl ProjectWatcher {
    fn start(engine: Weak<ProjectEngine>, adapter: WatcherAdapter) -> AppResult<Self> {
        let (event_tx, event_rx) = mpsc::channel::<WatchSignal>();
        let watcher_result: notify::Result<Box<dyn Watcher + Send>> = match adapter {
            WatcherAdapter::Native => {
                let event_tx = event_tx.clone();
                notify::recommended_watcher(move |event| {
                    let _ = event_tx.send(WatchSignal::File(event));
                })
                .map(|watcher| Box::new(watcher) as Box<dyn Watcher + Send>)
            }
            WatcherAdapter::Polling { interval_ms } => {
                let event_tx = event_tx.clone();
                PollWatcher::new(
                    move |event| {
                        let _ = event_tx.send(WatchSignal::File(event));
                    },
                    // Polling compares modification times in whole seconds, so two
                    // writes inside one second look identical to it. Comparing
                    // contents costs a read per poll and is what makes this adapter
                    // deterministic enough to assert on.
                    Config::default()
                        .with_poll_interval(Duration::from_millis(interval_ms))
                        .with_compare_contents(true),
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
        let tickets_root = storage::tickets_root(&strong.root);
        watcher
            .watch(&tickets_root, RecursiveMode::Recursive)
            .map_err(|error| {
                AppError::new(
                    ErrorCode::Io,
                    format!("Watching {} failed: {error}", tickets_root.display()),
                    true,
                )
            })?;
        let wake_observer = if matches!(adapter, WatcherAdapter::Native) {
            let wake_tx = event_tx.clone();
            Some(macos::observe_wake(Arc::new(move || {
                let _ = wake_tx.send(WatchSignal::Wake);
            })))
        } else {
            None
        };
        drop(strong);

        let worker = thread::Builder::new()
            .name("longclaw-watch-coalescer".to_owned())
            .spawn(move || {
                // What the project was last said to be, so a probe reports each
                // transition once rather than once per tick.
                let mut reported_missing = false;
                loop {
                    let first = match event_rx.recv_timeout(LIVENESS_PROBE) {
                        Ok(signal) => signal,
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            let Some(engine) = engine.upgrade() else {
                                return;
                            };
                            probe_liveness(&engine, &tickets_root, &mut reported_missing);
                            continue;
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    };
                    let burst_started = Instant::now();
                    let mut paths = HashMap::<PathBuf, usize>::new();
                    let (mut root_touched, mut recovery_reason) = match first {
                        WatchSignal::File(event) => collect_event(event, &tickets_root, &mut paths),
                        WatchSignal::Wake => (false, Some(RebuildReason::Resume)),
                    };
                    while burst_started.elapsed() < MAX_BURST {
                        match event_rx.recv_timeout(DEBOUNCE) {
                            Ok(WatchSignal::File(event)) => {
                                let (touched, recovery) =
                                    collect_event(event, &tickets_root, &mut paths);
                                root_touched |= touched;
                                if recovery.is_some() {
                                    recovery_reason = recovery;
                                }
                            }
                            Ok(WatchSignal::Wake) => recovery_reason = Some(RebuildReason::Resume),
                            Err(mpsc::RecvTimeoutError::Timeout) => break,
                            Err(mpsc::RecvTimeoutError::Disconnected) => return,
                        }
                    }
                    let Some(engine) = engine.upgrade() else {
                        return;
                    };
                    // A tickets root that is gone means the project is gone. A root
                    // that is merely touched is left to the frontend's focus
                    // reconciliation rather than triggering a full rebuild here.
                    //
                    // An event is also proof of the opposite: if the last thing
                    // said about the project was that it was gone, this burst is
                    // the folder answering. Both readings are `probe_liveness`,
                    // which is why the answer is asked for in one place — and
                    // either way the burst is over, because a recovery rebuild
                    // already holds every row this burst was going to report.
                    if root_touched && !tickets_root.is_dir() {
                        probe_liveness(&engine, &tickets_root, &mut reported_missing);
                        continue;
                    }
                    if reported_missing {
                        probe_liveness(&engine, &tickets_root, &mut reported_missing);
                        continue;
                    }
                    if let Some(reason) = recovery_reason {
                        let _ = engine.rebuild(reason, true);
                    }
                    if !paths.is_empty() {
                        engine.process_burst(paths, burst_started);
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
            wake_observer,
        })
    }
}

/// One `stat`, and an event only when the answer changes.
///
/// Raising the unreachable state is the point (`states.md:80-98`): the trigger is
/// the project path being unreachable "at launch, on watcher signal, or on any
/// failed read", and a watcher that is merely quiet is not evidence of a folder
/// that is still there. Lowering it again is the same fact read the other way —
/// a returning folder recovers on its own (LC-141), and it recovers through a
/// rebuild because the changes made while it was away were never delivered.
fn probe_liveness(engine: &Arc<ProjectEngine>, tickets_root: &Path, reported_missing: &mut bool) {
    if !tickets_root.is_dir() {
        if !*reported_missing {
            engine.report_unavailable();
            *reported_missing = true;
        }
        return;
    }
    if *reported_missing {
        *reported_missing = false;
        let _ = engine.rebuild(RebuildReason::Recovered, true);
    }
}

/// Folds one notification into the burst. Returns whether the tickets root itself
/// was named.
fn collect_event(
    event: notify::Result<Event>,
    tickets_root: &Path,
    paths: &mut HashMap<PathBuf, usize>,
) -> (bool, Option<RebuildReason>) {
    let event = match event {
        Ok(event) => event,
        Err(error) if is_transient_not_found(&error) => return (false, None),
        Err(_) => {
            local_diagnostic("watcher overflow or dropped filesystem events; rebuilding index");
            return (false, Some(RebuildReason::Overflow));
        }
    };
    let mut root_touched = false;
    let mut seen = Vec::new();
    for path in event.paths {
        match normalize(&path, tickets_root) {
            Some(Target::Ticket(canonical)) => {
                if !seen.contains(&canonical) {
                    seen.push(canonical.clone());
                    *paths.entry(canonical).or_default() += 1;
                }
            }
            Some(Target::TicketsRoot) => root_touched = true,
            None => {}
        }
    }
    (root_touched, None)
}

fn is_transient_not_found(error: &notify::Error) -> bool {
    match &error.kind {
        notify::ErrorKind::Io(error) => error.kind() == io::ErrorKind::NotFound,
        _ => false,
    }
}

fn local_diagnostic(message: &str) {
    if std::env::var_os("LONGCLAW_LOCAL_DIAGNOSTIC").is_some() {
        println!("LONGCLAW_LOCAL_DIAGNOSTIC {message}");
    }
}

enum Target {
    Ticket(PathBuf),
    TicketsRoot,
}

/// Reduces any watched path to the canonical `ticket.md` it concerns.
///
/// This is where rename handling lives: an editor's temporary file is ignored, a
/// ticket directory resolves to the ticket inside it, and both halves of a rename
/// resolve to their own canonical paths, so one becomes a removal and the other an
/// arrival.
fn normalize(path: &Path, tickets_root: &Path) -> Option<Target> {
    if path == tickets_root {
        return Some(Target::TicketsRoot);
    }
    let relative = path.strip_prefix(tickets_root).ok()?;
    let mut components = relative.components();
    let key = components.next()?.as_os_str().to_str()?;
    if !storage::valid_ticket_key(key) {
        return None;
    }
    let ticket = ticket_file_path(tickets_root, key);
    match components.next() {
        // The ticket directory itself: created, removed, or renamed.
        None => Some(Target::Ticket(ticket)),
        Some(component) => {
            let name = component.as_os_str().to_str()?;
            // Attachment bytes and editor temporaries are not indexed. The registry
            // inside ticket.md is what the index reads.
            if ticket.file_name().is_none_or(|canonical| canonical != name)
                || components.next().is_some()
            {
                return None;
            }
            Some(Target::Ticket(ticket))
        }
    }
}

/// Waits for a file to hold the same size and mtime across an interval, then reads
/// it. A file that never settles is read anyway: another event is coming, so a
/// brief degraded row is better than a permanently stale one.
fn read_when_settled(path: &Path) -> Option<Vec<u8>> {
    let fingerprint = |path: &Path| {
        fs::metadata(path)
            .ok()
            .and_then(|metadata| metadata.modified().ok().map(|time| (metadata.len(), time)))
    };
    for _ in 0..STABILITY_ATTEMPTS {
        let first = fingerprint(path);
        thread::sleep(STABILITY_INTERVAL);
        let second = fingerprint(path);
        if first.is_some() && first == second {
            return fs::read(path).ok();
        }
        // Deleted while settling; the deletion event covers it.
        second?;
    }
    fs::read(path).ok()
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::io;
    use std::path::{Path, PathBuf};
    use std::time::Instant;

    use crate::core::RebuildReason;

    use super::{collect_event, normalize, ReceiptBook, Target};

    fn tickets_root() -> PathBuf {
        PathBuf::from("/project/.longclaw/tickets")
    }

    #[test]
    fn every_watched_path_reduces_to_the_ticket_it_concerns() {
        let root = tickets_root();
        let canonical = root.join("LC-2").join("ticket.md");

        assert!(matches!(
            normalize(&canonical, &root),
            Some(Target::Ticket(path)) if path == canonical
        ));
        // A directory rename or removal names the directory, not the file.
        assert!(matches!(
            normalize(&root.join("LC-2"), &root),
            Some(Target::Ticket(path)) if path == canonical
        ));
        assert!(matches!(normalize(&root, &root), Some(Target::TicketsRoot)));
    }

    #[test]
    fn paths_that_cannot_change_a_ticket_row_are_dropped() {
        let root = tickets_root();
        for ignored in [
            root.join("LC-2/.ticket.md.longclaw-1234.tmp"),
            root.join("LC-2/ticket.md.editor-1.tmp"),
            root.join("LC-2/attachments/att_1-log.txt"),
            root.join("LC-2/notes/scratch.md"),
            root.join("not-a-key/ticket.md"),
            root.join(".DS_Store"),
            PathBuf::from("/elsewhere/ticket.md"),
        ] {
            assert!(
                normalize(&ignored, &root).is_none(),
                "{} should be ignored",
                ignored.display()
            );
        }
    }

    #[test]
    fn a_missing_path_watcher_error_does_not_force_an_overflow_rebuild() {
        let mut paths = HashMap::new();
        let error = notify::Error::io(io::Error::from(io::ErrorKind::NotFound))
            .add_path(tickets_root().join("LC-2"));

        let (root_touched, recovery) = collect_event(Err(error), &tickets_root(), &mut paths);

        assert!(!root_touched);
        assert!(recovery.is_none());
        assert!(paths.is_empty());
    }

    #[test]
    fn non_missing_watcher_errors_still_force_an_overflow_rebuild() {
        let mut paths = HashMap::new();
        let error = notify::Error::io(io::Error::from(io::ErrorKind::PermissionDenied))
            .add_path(tickets_root());

        let (root_touched, recovery) = collect_event(Err(error), &tickets_root(), &mut paths);

        assert!(!root_touched);
        assert!(matches!(recovery, Some(RebuildReason::Overflow)));
        assert!(paths.is_empty());
    }

    #[test]
    fn a_receipt_needs_an_exact_path_and_hash_match() {
        let now = Instant::now();
        let path = tickets_root().join("LC-2/ticket.md");
        let mut receipts = ReceiptBook::default();

        receipts.remember(path.clone(), "app-hash".to_owned(), now);
        assert!(!receipts.consume_if_match(&path, "external-hash", now));
        assert!(!receipts.consume_if_match(Path::new("/other/ticket.md"), "app-hash", now));
        assert!(receipts.consume_if_match(&path, "app-hash", now));
        assert!(!receipts.consume_if_match(&path, "app-hash", now));
    }

    #[test]
    fn an_external_edit_between_two_app_writes_does_not_discard_the_pending_receipt() {
        let now = Instant::now();
        let path = tickets_root().join("LC-2/ticket.md");
        let mut receipts = ReceiptBook::default();

        receipts.remember(path.clone(), "first".to_owned(), now);
        receipts.remember(path.clone(), "second".to_owned(), now);
        assert!(!receipts.consume_if_match(&path, "someone-else".to_owned().as_str(), now));
        // Both app writes are still recognizable as the app's own.
        assert!(receipts.consume_if_match(&path, "second", now));
    }

    #[test]
    fn matching_a_later_write_retires_the_ones_it_replaced() {
        let now = Instant::now();
        let path = tickets_root().join("LC-2/ticket.md");
        let mut receipts = ReceiptBook::default();

        receipts.remember(path.clone(), "first".to_owned(), now);
        receipts.remember(path.clone(), "second".to_owned(), now);
        assert!(receipts.consume_if_match(&path, "second", now));
        assert!(!receipts.consume_if_match(&path, "first", now));
    }

    #[test]
    fn a_receipt_expires_so_a_missed_event_cannot_hide_a_later_edit() {
        let now = Instant::now();
        let path = tickets_root().join("LC-2/ticket.md");
        let mut receipts = ReceiptBook::default();

        receipts.remember(path.clone(), "app-hash".to_owned(), now);
        let later = now + super::SELF_WRITE_TTL + std::time::Duration::from_millis(1);
        assert!(!receipts.consume_if_match(&path, "app-hash", later));
    }

    #[test]
    fn a_failed_write_forgets_its_receipt() {
        let now = Instant::now();
        let path = tickets_root().join("LC-2/ticket.md");
        let mut receipts = ReceiptBook::default();

        receipts.remember(path.clone(), "app-hash".to_owned(), now);
        receipts.forget(&path, "app-hash");
        assert!(!receipts.consume_if_match(&path, "app-hash", now));
    }
}
