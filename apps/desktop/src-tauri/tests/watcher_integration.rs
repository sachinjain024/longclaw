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
use longclaw_desktop_lib::core::ticket::{ActorType, Status, TicketEdit};
use longclaw_desktop_lib::core::{
    ActivitySummary, EventSource, ProjectEvent, RebuildReason, StreamEnvelope, TicketRow,
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
    let (ticket, coalesced_events, detected_in_ms, _) = changed_with_attribution(event);
    (ticket, coalesced_events, detected_in_ms)
}

fn changed_with_attribution(
    event: ProjectEvent,
) -> (TicketRow, usize, f64, Option<ActivitySummary>) {
    match event {
        ProjectEvent::TicketChanged {
            ticket,
            source,
            coalesced_events,
            detected_in_ms,
            attribution,
        } => {
            assert_eq!(source, EventSource::External);
            (*ticket, coalesced_events, detected_in_ms, attribution)
        }
        other => panic!(
            "expected a ticket change, got {}",
            serde_json::to_string(&other).unwrap_or_default()
        ),
    }
}

/// Who the app says made a change, in the form the surfaces read: an agent's
/// name, `a person`, or the honest `actor unknown`.
fn attributed_to(attribution: Option<ActivitySummary>) -> String {
    let Some(record) = attribution else {
        return "actor unknown".to_owned();
    };
    match record.actor.actor_type {
        ActorType::Agent => record
            .actor
            .name
            .or(record.actor.id)
            .unwrap_or_else(|| "an agent".to_owned()),
        ActorType::Human => "a person".to_owned(),
        ActorType::Unknown => "actor unknown".to_owned(),
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

/// The failure the whole item is about: a person edits a file in an editor and
/// appends nothing, and the app credits it to whichever agent happened to write
/// the newest record.
///
/// LC-2's newest record belongs to Fixture Agent. Nothing here appends a record,
/// so nothing in the file describes this change, and the honest answer is that
/// nobody knows who made it.
#[test]
fn an_external_write_that_appended_no_record_is_actor_unknown() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    let path = ticket_path(&root, "LC-2");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    assert!(
        raw.contains("name: Fixture Agent"),
        "this test is only meaningful while the newest record is an agent's",
    );
    editor_atomic_replace(
        &path,
        &replace_title(&raw, "Edited by hand in an editor"),
        1,
    );

    let (row, _, _, attribution) = changed_with_attribution(next_event(&events));
    assert_eq!(title_of(&row), "Edited by hand in an editor");
    assert_eq!(attributed_to(attribution), "actor unknown");
}

/// The normal path, which must not regress into over-caution: a record that was
/// not there before *is* the actor of this change.
#[test]
fn a_newly_appended_record_is_credited_to_the_actor_who_wrote_it() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    let path = ticket_path(&root, "LC-2");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    editor_atomic_replace(&path, &with_appended_agent_record(&raw), 1);

    let (_, _, _, attribution) = changed_with_attribution(next_event(&events));
    assert_eq!(attributed_to(attribution), "Second Agent");
}

/// Reordered or rewritten history leaves no position from which "appended" means
/// anything, so the app says so instead of picking the last line.
#[test]
fn rewritten_history_is_actor_unknown_rather_than_a_guess() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (_engine, events) = start_engine(&root);

    let path = ticket_path(&root, "LC-2");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    // The record the index holds is gone, replaced by a different one.
    let rewritten = raw
        .replace("id: evt_9d0c4471", "id: evt_rewritten")
        .replace("name: Fixture Agent", "name: Second Agent");
    editor_atomic_replace(&path, &rewritten, 1);

    let (_, _, _, attribution) = changed_with_attribution(next_event(&events));
    assert_eq!(attributed_to(attribution), "actor unknown");
}

/// Appends a second activity record from a different agent, the way an agent
/// writing to the file would.
fn with_appended_agent_record(raw: &str) -> String {
    format!(
        "{}\n<!-- longclaw:event\n\
         id: evt_appended1\n\
         kind: comment\n\
         occurred_at: 2026-07-31T09:00:00Z\n\
         actor:\n  \
         type: agent\n  \
         id: second-agent\n  \
         name: Second Agent\n\
         -->\n\
         ### Second Agent commented\n\n\
         I picked this up after the fixture agent.\n\
         <!-- /longclaw:event -->\n",
        raw.trim_end(),
    )
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
fn repeated_rapid_external_bursts_converge_to_final_content() {
    let _serial = serially();
    for run in 1..=5 {
        let (_temp, root) = copy_representative_project();
        let (_engine, events) = start_engine(&root);
        let path = ticket_path(&root, "LC-1");
        let raw = fs::read_to_string(&path).expect("ticket.md");
        for sequence in 1..=6 {
            editor_atomic_replace(
                &path,
                &replace_title(&raw, &format!("Stress run {run} edit {sequence}")),
                sequence,
            );
        }

        let (row, _, _) = changed(next_event(&events));
        assert_eq!(title_of(&row), &format!("Stress run {run} edit 6"));
        expect_no_event(&events, "one repeated burst should produce one update");
    }
}

#[test]
fn an_overflow_recovery_converges_on_disk_state() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let path = ticket_path(&root, "LC-1");
    let raw = fs::read_to_string(&path).expect("ticket.md");
    editor_atomic_replace(&path, &replace_title(&raw, "Recovered after overflow"), 1);

    let snapshot = engine
        .rebuild(RebuildReason::Overflow, true)
        .expect("overflow recovery should rebuild");
    assert_eq!(
        snapshot
            .tickets
            .iter()
            .find(|ticket| ticket.key() == "LC-1")
            .map(title_of),
        Some("Recovered after overflow")
    );
    assert!(matches!(
        next_event(&events),
        ProjectEvent::IndexRebuilt {
            reason: RebuildReason::Overflow,
            ..
        }
    ));
}

#[test]
fn a_removed_root_can_be_restored_and_reconciled() {
    let _serial = serially();
    let (temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let moved = temp.path().join("temporarily-moved");
    fs::rename(&root, &moved).expect("move project root");
    assert!(engine.rebuild(RebuildReason::Resume, true).is_err());
    assert!(matches!(
        next_event(&events),
        ProjectEvent::ProjectUnavailable { .. }
    ));
    fs::rename(&moved, &root).expect("restore project root");
    std::thread::sleep(Duration::from_millis(200));
    let snapshot = engine
        .rebuild(RebuildReason::Resume, true)
        .expect("restored root should recover");
    assert_eq!(snapshot.tickets.len(), 6);
    assert!(root.join(".longclaw/longclaw.yaml").is_file());
}

#[test]
fn recovery_triggers_close_together_emit_one_rebuild() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let first = engine
        .rebuild(RebuildReason::Resume, true)
        .expect("first recovery");
    let second = engine
        .rebuild(RebuildReason::Overflow, true)
        .expect("coalesced recovery");
    assert_eq!(first.generation, second.generation);
    assert!(matches!(
        next_event(&events),
        ProjectEvent::IndexRebuilt { .. }
    ));
    expect_no_event(&events, "coalesced recovery must not emit a second rebuild");
}

#[test]
fn coalescing_does_not_mask_a_root_that_vanished() {
    let _serial = serially();
    let (temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    // Arm the coalescing window, then remove the root inside it. Suppressing the
    // second recovery here would report a live board over a folder that is gone.
    engine
        .rebuild(RebuildReason::Resume, true)
        .expect("first recovery");
    assert!(matches!(
        next_event(&events),
        ProjectEvent::IndexRebuilt { .. }
    ));
    fs::rename(&root, temp.path().join("vanished")).expect("move project root");
    assert!(
        engine.rebuild(RebuildReason::Resume, true).is_err(),
        "a removed root must be reported even inside the coalescing window"
    );
    assert!(matches!(
        next_event(&events),
        ProjectEvent::ProjectUnavailable { .. }
    ));
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
    let (removed, arrived) = next_rename(&events);
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

/// Both halves of a directory rename, in whatever order the platform reports them.
fn next_rename(events: &Receiver<StreamEnvelope>) -> (Option<String>, Option<TicketRow>) {
    let mut removed = None;
    let mut arrived = None;
    for _ in 0..2 {
        match next_event(events) {
            ProjectEvent::TicketRemoved { ticket_key, .. } => removed = Some(ticket_key),
            ProjectEvent::TicketChanged { ticket, .. } => arrived = Some(*ticket),
            other => panic!(
                "unexpected event {}",
                serde_json::to_string(&other).unwrap_or_default()
            ),
        }
    }
    (removed, arrived)
}

#[test]
fn renaming_a_ticket_directory_into_another_project_s_key_degrades_and_renaming_back_recovers() {
    let _serial = serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let tickets = root.join(".longclaw/tickets");
    let original = fs::read(ticket_path(&root, "LC-3")).expect("the ticket before the rename");

    fs::rename(tickets.join("LC-3"), tickets.join("ZZ-3")).expect("rename into a foreign key");

    let (removed, arrived) = next_rename(&events);
    assert_eq!(removed.as_deref(), Some("LC-3"));
    let arrived = arrived.expect("the renamed directory should arrive as a row");
    assert_eq!(arrived.key(), "ZZ-3");

    // The old row does not survive the rename, and the new one is not indexed as a
    // ticket of this project.
    //
    // The frontmatter still says LC-3, so this file now breaks two rules at once:
    // the pair no longer agrees, and the directory names a project that is not this
    // one. Ownership is settled before the contents are read, so the diagnostic is
    // the ownership one — asserted specifically here, because a message about the
    // directory alone is what this defect looked like before it was fixed.
    let TicketRow::Degraded(row) = &arrived else {
        panic!("a directory renamed into another project's key should degrade");
    };
    assert!(
        row.diagnostic.message.contains("project ZZ"),
        "expected an ownership diagnostic, got {:?}",
        row.diagnostic.message
    );
    assert!(row.diagnostic.message.contains("LC"));
    let snapshot = engine.snapshot();
    let keys: Vec<&str> = snapshot.tickets.iter().map(TicketRow::key).collect();
    assert!(keys.contains(&"ZZ-3"));
    assert!(!keys.contains(&"LC-3"));

    // The ingest read the file and changed nothing in it.
    assert_eq!(
        fs::read(ticket_path(&root, "ZZ-3")).expect("still there"),
        original
    );

    // Renaming it back recovers the row, from the same bytes.
    fs::rename(tickets.join("ZZ-3"), tickets.join("LC-3")).expect("rename back");
    let (removed, arrived) = next_rename(&events);
    assert_eq!(removed.as_deref(), Some("ZZ-3"));
    let arrived = arrived.expect("the restored directory should arrive as a row");
    assert_eq!(arrived.key(), "LC-3");
    let TicketRow::Indexed(recovered) = &arrived else {
        panic!("the restored directory should be readable again");
    };
    assert_eq!(recovered.key, "LC-3");
    assert_eq!(
        fs::read(ticket_path(&root, "LC-3")).expect("still there"),
        original
    );
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
