//! Offline is the baseline, not a degraded mode (LC-256a, ADR 0014, D10).
//!
//! The update path is new code in a product whose whole claim is that it needs
//! no network. The claim that matters is not that the new code works — that is
//! `update.rs`'s own suite — but that **everything else is unchanged**, and a
//! sentence in a decision record cannot hold that. These are the assertions
//! that can.
//!
//! Three questions, each asked against a real project on disk:
//!
//! - Does every operation a person performs complete while the updater is dead,
//!   hanging, or absent — and is the updater asked anything at all?
//! - Is the restart refusal a fact about the disk rather than about the button,
//!   measured from inside the replace window itself?
//! - Does a build with no updater answer, rather than fail?

mod common;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use common::{copy_representative_project, serially, start_engine, ticket_path};
use longclaw_desktop_lib::core::storage::{self, writes_in_flight};
use longclaw_desktop_lib::core::ticket::TicketEdit;
use longclaw_desktop_lib::core::{ErrorCode, TicketRow};
use longclaw_desktop_lib::update::{
    restart_guard, Clock, Release, SystemClock, UpdateFault, UpdatePath, UpdateState, Updater,
};

/// An updater that fails every call, and counts the ones it was asked.
///
/// The count is the assertion: nothing outside the pane and the frontend's
/// schedule may reach the update path, so after a full working session it must
/// still be zero.
struct DeadUpdater {
    calls: AtomicUsize,
}

impl DeadUpdater {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            calls: AtomicUsize::new(0),
        })
    }

    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl Updater for DeadUpdater {
    fn check(&self) -> Result<Option<Release>, UpdateFault> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Err(UpdateFault::Offline)
    }

    fn download(&self, _: &mut dyn FnMut(u64, Option<u64>)) -> Result<(), UpdateFault> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Err(UpdateFault::Offline)
    }

    fn install_and_restart(&self) -> Result<(), UpdateFault> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Err(UpdateFault::Offline)
    }
}

/// An updater that never answers, for the host that accepts a connection and
/// then says nothing. Anything that waited on it would hang the test out.
struct HangingUpdater;

impl Updater for HangingUpdater {
    fn check(&self) -> Result<Option<Release>, UpdateFault> {
        thread::sleep(Duration::from_secs(120));
        Err(UpdateFault::Offline)
    }

    fn download(&self, _: &mut dyn FnMut(u64, Option<u64>)) -> Result<(), UpdateFault> {
        thread::sleep(Duration::from_secs(120));
        Err(UpdateFault::Offline)
    }

    fn install_and_restart(&self) -> Result<(), UpdateFault> {
        thread::sleep(Duration::from_secs(120));
        Err(UpdateFault::Offline)
    }
}

fn indexed<'rows>(
    rows: &'rows [TicketRow],
    key: &str,
) -> &'rows longclaw_desktop_lib::core::IndexedRow {
    rows.iter()
        .find_map(|row| match row {
            TicketRow::Indexed(indexed) if indexed.key == key => Some(indexed),
            _ => None,
        })
        .unwrap_or_else(|| panic!("{key} should be indexed"))
}

/// A full working session, performed while the update path is dead.
///
/// Open, read, edit, search, rebuild. Each is the thing a person does, and none
/// of them may consult, wait on, or fail because of the updater.
///
/// The write count is one number for the whole process, so a test that reads it
/// has to be the only thing writing. `serially()` is the lock the watcher tests
/// already take, for the same reason.
#[test]
fn every_operation_completes_while_the_updater_is_dead() {
    let _serial = serially();
    let dead = DeadUpdater::new();
    let _path = UpdatePath::new(Some(dead.clone()), Arc::new(SystemClock), "0.1.0");

    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);

    let snapshot = engine.snapshot();
    assert!(
        !snapshot.tickets.is_empty(),
        "the project opened with its tickets"
    );

    let hash = indexed(&snapshot.tickets, "LC-2").content_hash.clone();
    engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("Edited with no network anywhere".to_owned()),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("a ticket write does not wait on an update check");

    engine.detail("LC-2").expect("a ticket reads back");
    assert!(
        !engine.search("Edited").tickets.is_empty(),
        "search finds the edit that was just made"
    );
    engine
        .request_rebuild(longclaw_desktop_lib::core::RebuildReason::Manual)
        .expect("the index rebuilds");

    assert_eq!(
        dead.calls(),
        0,
        "nothing but the frontend's schedule and the pane's buttons may reach the update path"
    );
    assert_eq!(
        writes_in_flight(),
        0,
        "the write count returns to zero, or every later restart is refused forever"
    );
}

/// The same, against a host that accepts and then never answers.
///
/// A hanging updater is the case a timeout is for, and the case a shared lock
/// would turn into a frozen app. The test would not finish if anything here
/// waited on it.
#[test]
fn every_operation_completes_while_the_updater_hangs() {
    let _serial = serially();
    let _path = UpdatePath::new(
        Some(Arc::new(HangingUpdater)),
        Arc::new(SystemClock),
        "0.1.0",
    );

    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let hash = indexed(&engine.snapshot().tickets, "LC-2")
        .content_hash
        .clone();

    engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("Edited while a host holds the line open".to_owned()),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("a ticket write does not wait on an update check");
    engine.detail("LC-2").expect("a ticket reads back");
}

/// A build with no updater at all — a dev window, the perf harness, this test
/// binary. It answers, and it answers `unavailable`.
#[test]
fn a_build_with_no_updater_answers_rather_than_fails() {
    let path = UpdatePath::new(None, Arc::new(SystemClock), "0.1.0");

    assert_eq!(path.status().state, UpdateState::Unavailable);
    assert_eq!(
        path.check(true)
            .expect("a missing updater is a failed check, never a failed launch")
            .state,
        UpdateState::Unavailable
    );

    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    assert!(!engine.snapshot().tickets.is_empty());
}

/// The restart refusal, measured from inside the replace window.
///
/// This is the difference between the button and the guarantee. The frontend
/// disables the control while its mutation store has a write outstanding; that
/// is the sentence a person reads. What ADR 0009 asks for is the invariant, and
/// the only place to prove it is the moment between "the new bytes are durable"
/// and "the swap happened" — where a restart would lose the write.
#[test]
fn a_restart_is_refused_from_inside_the_replace_window() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let hash = indexed(&engine.snapshot().tickets, "LC-2")
        .content_hash
        .clone();

    assert!(
        restart_guard(writes_in_flight()).is_ok(),
        "the disk is settled before the write"
    );

    /// What the guard answered inside the replace window, recorded rather than
    /// asserted there: a panic on the worker's stack reads as a failed write.
    type Asked = Arc<Mutex<Option<(usize, Option<ErrorCode>)>>>;

    let seen: Asked = Arc::new(Mutex::new(None));
    let recorded = seen.clone();
    storage::install_replace_seams(storage::ReplaceSeams {
        before_swap: Some(Arc::new(move |_target| {
            let count = writes_in_flight();
            let refusal = restart_guard(count).err().map(|error| error.code);
            *recorded.lock().unwrap() = Some((count, refusal));
        })),
        ..storage::ReplaceSeams::default()
    });
    let outcome = engine.edit_ticket(
        "LC-2",
        &TicketEdit {
            title: Some("A save that must outlive any restart".to_owned()),
            ..TicketEdit::default()
        },
        &hash,
    );
    storage::clear_replace_seams();
    outcome.expect("the write itself succeeds");

    let (count, refusal) = seen
        .lock()
        .unwrap()
        .expect("the replace window ran, so the guard was asked inside it");
    assert!(count > 0, "the write was counted while it was outstanding");
    assert_eq!(
        refusal,
        Some(ErrorCode::Conflict),
        "a restart asked for inside the replace window is refused"
    );

    assert!(
        restart_guard(writes_in_flight()).is_ok(),
        "and permitted again the moment the disk settles"
    );
    assert!(
        ticket_path(&root, "LC-2").exists(),
        "the ticket is still where it was"
    );
}

/// A clock that never moves, so "one attempt per slot" is a claim about the
/// slot rather than about how fast the test ran.
struct FrozenClock;

impl Clock for FrozenClock {
    fn now_ms(&self) -> u64 {
        1_000
    }
}

/// A failed check ends. It is not retried, not backed off, and not queued.
#[test]
fn a_failed_check_is_never_retried_inside_its_slot() {
    let dead = DeadUpdater::new();
    let path = UpdatePath::new(Some(dead.clone()), Arc::new(FrozenClock), "0.1.0");

    for _ in 0..20 {
        path.check(false).expect_err("offline");
    }

    assert_eq!(
        dead.calls(),
        1,
        "twenty scheduled checks in one slot are one request"
    );
}
