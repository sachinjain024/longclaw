//! External write → watcher → index.
//!
//! These tests drive the deterministic polling adapter so they assert the
//! pipeline's behaviour rather than the platform's event timing. The final test
//! runs the production FSEvents adapter and is ignored by default; `npm run
//! test:watcher` runs it.

mod common;

use std::fs;
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::Duration;

use common::{
    copy_representative_project, editor_atomic_replace, replace_title, serially, start_engine,
    start_engine_with, ticket_path,
};
use longclaw_desktop_lib::core::ticket::{Status, TicketEdit};
use longclaw_desktop_lib::core::{
    EventSource, ProjectEvent, RebuildReason, StreamEnvelope, TicketRow,
};
use longclaw_desktop_lib::engine::WatcherAdapter;

const VISIBLE_WITHIN: Duration = Duration::from_secs(10);
const QUIET_FOR: Duration = Duration::from_millis(700);

fn next_event(events: &Receiver<StreamEnvelope>) -> ProjectEvent {
    events
        .recv_timeout(VISIBLE_WITHIN)
        .expect("an external change should become visible without a manual refresh")
        .event
}

fn expect_no_event(events: &Receiver<StreamEnvelope>, why: &str) {
    match events.recv_timeout(QUIET_FOR) {
        Err(RecvTimeoutError::Timeout) => {}
        Err(RecvTimeoutError::Disconnected) => panic!("the engine stopped emitting"),
        Ok(event) => panic!(
            "{why}, got {}",
            serde_json::to_string(&event.event).unwrap_or_default()
        ),
    }
}

fn changed(event: ProjectEvent) -> (TicketRow, usize, f64) {
    match event {
        ProjectEvent::TicketChanged {
            ticket,
            source,
            coalesced_events,
            detected_in_ms,
        } => {
            assert_eq!(source, EventSource::External);
            (*ticket, coalesced_events, detected_in_ms)
        }
        other => panic!(
            "expected a ticket change, got {}",
            serde_json::to_string(&other).unwrap_or_default()
        ),
    }
}

fn title_of(row: &TicketRow) -> &str {
    match row {
        TicketRow::Indexed(row) => &row.title,
        TicketRow::Degraded(row) => panic!("expected a readable row: {}", row.diagnostic.message),
    }
}

#[test]
fn an_external_save_reaches_the_index_without_a_manual_refresh() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);

    let path = ticket_path(&root, "LC-3");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    editor_atomic_replace(&path, &replace_title(&raw, "An agent renamed this"), 1);

    let (row, _, detected_in_ms) = changed(next_event(&events));
    assert_eq!(row.key(), "LC-3");
    assert_eq!(title_of(&row), "An agent renamed this");
    assert!(
        detected_in_ms < 1_500.0,
        "external visibility budget exceeded: {detected_in_ms:.2}ms"
    );
    assert_eq!(
        engine
            .snapshot()
            .tickets
            .iter()
            .find(|indexed| indexed.key() == "LC-3")
            .map(title_of),
        Some("An agent renamed this")
    );
}

#[test]
fn one_burst_of_saves_produces_one_update_holding_the_final_content() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    let path = ticket_path(&root, "LC-1");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    for sequence in 1..=4 {
        editor_atomic_replace(
            &path,
            &replace_title(&raw, &format!("Rapid external edit {sequence}")),
            sequence,
        );
    }

    let (row, coalesced_events, _) = changed(next_event(&events));
    assert_eq!(title_of(&row), "Rapid external edit 4");
    assert!(coalesced_events >= 1);
    expect_no_event(&events, "one save burst should produce one visible update");
}

#[test]
fn an_app_write_is_not_echoed_back_as_an_external_change() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let hash = engine
        .snapshot()
        .tickets
        .iter()
        .find(|row| row.key() == "LC-2")
        .expect("LC-2")
        .content_hash()
        .to_owned();

    let result = engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("The app wrote this once".to_owned()),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("the write should be accepted");
    assert_eq!(title_of(&result.ticket), "The app wrote this once");

    expect_no_event(
        &events,
        "the watcher must not report the app's own write back to it",
    );
    // The index applied the change exactly once: the row the command returned is
    // the row the index holds.
    assert_eq!(
        engine
            .snapshot()
            .tickets
            .into_iter()
            .find(|row| row.key() == "LC-2"),
        Some(result.ticket)
    );
    let raw = fs::read_to_string(ticket_path(&root, "LC-2")).expect("ticket.md");
    assert_eq!(raw.matches("kind: update").count(), 1);
}

#[test]
fn a_later_external_edit_is_still_reported_inside_the_receipt_window() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let hash = engine
        .snapshot()
        .tickets
        .iter()
        .find(|row| row.key() == "LC-2")
        .expect("LC-2")
        .content_hash()
        .to_owned();

    engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("The app wrote this".to_owned()),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("the write should be accepted");

    // Immediately afterwards, while the receipt is still live, someone else saves.
    let path = ticket_path(&root, "LC-2");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    editor_atomic_replace(&path, &replace_title(&raw, "But an agent saved next"), 1);

    let (row, _, _) = changed(next_event(&events));
    assert_eq!(title_of(&row), "But an agent saved next");
}

#[test]
fn an_external_deletion_removes_the_row() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);

    fs::remove_file(ticket_path(&root, "LC-3")).expect("remove the ticket file");

    let event = next_event(&events);
    assert_eq!(
        serde_json::to_value(&event).expect("serializable"),
        serde_json::json!({
            "type": "ticketRemoved",
            "data": { "ticketKey": "LC-3", "source": "external" }
        }),
        "external deletion must cross IPC with the frontend's field contract"
    );
    assert!(engine
        .snapshot()
        .tickets
        .iter()
        .all(|row| row.key() != "LC-3"));
    expect_no_event(&events, "one deletion should produce one visible event");
}

#[test]
fn renaming_a_ticket_directory_removes_one_row_and_adds_another() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let tickets = root.join(".longclaw/tickets");

    fs::rename(tickets.join("LC-3"), tickets.join("LC-7")).expect("rename the ticket directory");

    // Both halves of the rename arrive; order depends on the platform.
    let mut removed = None;
    let mut arrived = None;
    for _ in 0..2 {
        match next_event(&events) {
            ProjectEvent::TicketRemoved { ticket_key, .. } => removed = Some(ticket_key),
            ProjectEvent::TicketChanged { ticket, .. } => arrived = Some(*ticket),
            other => panic!(
                "unexpected event {}",
                serde_json::to_string(&other).unwrap_or_default()
            ),
        }
    }
    assert_eq!(removed.as_deref(), Some("LC-3"));
    let arrived = arrived.expect("the renamed directory should arrive as a row");
    assert_eq!(arrived.key(), "LC-7");

    // Its frontmatter still says LC-3, so the pair no longer agrees and the ticket
    // is shown as degraded rather than quietly renamed.
    let TicketRow::Degraded(row) = &arrived else {
        panic!("a renamed directory whose key no longer matches should degrade");
    };
    assert!(row.diagnostic.message.contains("directory"));

    let snapshot = engine.snapshot();
    let keys: Vec<&str> = snapshot.tickets.iter().map(TicketRow::key).collect();
    assert!(keys.contains(&"LC-7"));
    assert!(!keys.contains(&"LC-3"));
}

#[test]
fn a_new_ticket_directory_appears_as_a_row() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    let directory = root.join(".longclaw/tickets/LC-5");
    fs::create_dir(&directory).expect("create the directory");
    fs::write(
        directory.join("ticket.md"),
        concat!(
            "---\n",
            "format: longclaw.ticket/v1\n",
            "id: 019c8ca0-0000-7000-8000-00000000ffff\n",
            "key: LC-5\n",
            "title: An agent created this ticket\n",
            "status: todo\n",
            "priority: p2\n",
            "created_at: 2026-07-29T00:00:00Z\n",
            "updated_at: 2026-07-29T00:00:00Z\n",
            "---\n",
        ),
    )
    .expect("write the ticket");

    let (row, _, _) = changed(next_event(&events));
    assert_eq!(row.key(), "LC-5");
    assert_eq!(title_of(&row), "An agent created this ticket");
}

#[test]
fn a_file_that_only_changed_its_timestamp_is_not_reported_as_a_change() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    // Rewriting identical bytes is a filesystem event with no visible change.
    let path = ticket_path(&root, "LC-1");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    editor_atomic_replace(&path, &raw, 1);

    expect_no_event(
        &events,
        "identical content is not a change, whoever wrote it",
    );
}

#[test]
fn a_half_written_file_settles_before_it_is_reported() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);
    let path = ticket_path(&root, "LC-1");
    let complete = fs::read_to_string(&path).expect("ticket.md");

    // An agent writing in place, caught between two writes.
    fs::write(
        &path,
        "---\nformat: longclaw.ticket/v1\nkey: LC-1\nstatus: to",
    )
    .expect("partial");
    fs::write(&path, replace_title(&complete, "Written in two passes")).expect("complete");

    let (row, _, _) = changed(next_event(&events));
    assert_eq!(
        title_of(&row),
        "Written in two passes",
        "the settled content is what becomes visible"
    );
    expect_no_event(&events, "the transient partial file should not be reported");
}

#[test]
fn a_ticket_that_becomes_unreadable_degrades_in_place() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let path = ticket_path(&root, "LC-1");
    let raw = fs::read_to_string(&path).expect("ticket.md");

    editor_atomic_replace(
        &path,
        &raw.replace("status: in_progress", "status: blocked"),
        1,
    );
    let (row, _, _) = changed(next_event(&events));
    let TicketRow::Degraded(degraded) = &row else {
        panic!("an unreadable ticket should degrade");
    };
    assert!(degraded.diagnostic.message.contains("status"));

    // Fixing the file externally brings it back without a manual retry.
    editor_atomic_replace(&path, &raw, 2);
    let (restored, _, _) = changed(next_event(&events));
    assert_eq!(title_of(&restored), "Load canonical ticket files");
    assert!(!engine
        .snapshot()
        .tickets
        .iter()
        .any(|indexed| indexed.key() == "LC-1" && indexed.is_degraded()));
}

/// The production watcher, end to end: an app write that is not echoed, an
/// external burst that becomes one update, a deletion, a reconcile, and a project
/// folder that moves away. Ignored by default because it depends on FSEvents
/// timing; `npm run test:watcher` runs it.
#[test]
#[ignore = "native filesystem watcher; run through npm run test:watcher"]
fn filesystem_round_trip_covers_self_writes_bursts_deletion_and_reconcile() {
    let _serial = serially();
    let (temp, root) = copy_representative_project();
    let (engine, events) = start_engine_with(&root, WatcherAdapter::Native);

    let hash = engine
        .snapshot()
        .tickets
        .iter()
        .find(|row| row.key() == "LC-2")
        .expect("LC-2")
        .content_hash()
        .to_owned();
    engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                status: Some(Status::InProgress),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("the write should be accepted");
    let raw = fs::read_to_string(ticket_path(&root, "LC-2")).expect("ticket.md");
    assert!(raw.contains("x_fixture_extension:\n  owner: future-version\n"));
    expect_no_event(&events, "a self-authored atomic rename must not echo");

    let path = ticket_path(&root, "LC-1");
    let original = fs::read_to_string(&path).expect("ticket.md");
    for sequence in 1..=4 {
        editor_atomic_replace(
            &path,
            &replace_title(&original, &format!("Rapid external edit {sequence}")),
            sequence,
        );
    }
    let (row, coalesced_events, detected_in_ms) = changed(next_event(&events));
    println!(
        "PERF external_visibility_pipeline_ms={detected_in_ms:.2} coalesced_events={coalesced_events}"
    );
    assert_eq!(title_of(&row), "Rapid external edit 4");
    assert!(detected_in_ms < 1_500.0);
    expect_no_event(&events, "one editor burst should produce one update");

    fs::remove_file(ticket_path(&root, "LC-3")).expect("remove the ticket file");
    match next_event(&events) {
        ProjectEvent::TicketRemoved { ticket_key, .. } => assert_eq!(ticket_key, "LC-3"),
        other => panic!(
            "expected a removal, got {}",
            serde_json::to_string(&other).unwrap_or_default()
        ),
    }

    let resumed = engine
        .rebuild(RebuildReason::Resume, true)
        .expect("a reconcile should succeed");
    assert_eq!(resumed.tickets.len(), 5);
    assert!(matches!(
        next_event(&events),
        ProjectEvent::IndexRebuilt {
            reason: RebuildReason::Resume,
            ..
        }
    ));

    let moved = temp.path().join("folder-moved");
    fs::rename(&root, &moved).expect("move the project folder");
    assert!(engine.rebuild(RebuildReason::Resume, true).is_err());
    assert!(matches!(
        next_event(&events),
        ProjectEvent::ProjectUnavailable { .. }
    ));
    assert!(moved.join(".longclaw/longclaw.yaml").is_file());
}
