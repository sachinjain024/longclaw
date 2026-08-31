//! The vertical slice, end to end: human → disk → external agent → disk → app.
//!
//! This is the automated backbone of the manual acceptance scenario in
//! `docs/acceptance/agent-round-trip.md`. The "agent" here writes the ticket file
//! exactly the way the generated `.longclaw/AGENTS.md` instructs — a rename over
//! `ticket.md`, an explicit agent actor, an appended activity record — so the test
//! fails if those published instructions stop producing a file the app can read.

mod common;

use std::fs;
use std::sync::mpsc::Receiver;
use std::time::Duration;

use common::{
    assert_minted, editor_atomic_replace, new_project, serially, start_engine, ticket_path,
    POLL_INTERVAL_MS,
};
use longclaw_desktop_lib::core::storage::NewTicket;
use longclaw_desktop_lib::core::ticket::{ActorType, NewChecklistItem, Status, TicketEdit};
use longclaw_desktop_lib::core::{
    IndexedRow, ProjectEvent, RebuildReason, StreamEnvelope, TicketRow,
};

const VISIBLE_WITHIN: Duration = Duration::from_secs(10);

fn indexed(tickets: &[TicketRow], key: &str) -> IndexedRow {
    match tickets
        .iter()
        .find(|row| row.key() == key)
        .unwrap_or_else(|| panic!("{key} should be in the index"))
    {
        TicketRow::Indexed(row) => row.clone(),
        TicketRow::Degraded(row) => panic!("{key} should be readable: {}", row.diagnostic.message),
    }
}

fn next_change(events: &Receiver<StreamEnvelope>) -> TicketRow {
    let envelope = events
        .recv_timeout(VISIBLE_WITHIN)
        .expect("an agent's write should reach the app without a manual refresh");
    match envelope.event {
        ProjectEvent::TicketChanged { ticket, .. } => *ticket,
        other => panic!("expected a ticket change, got {other:?}"),
    }
}

fn expect_quiet(events: &Receiver<StreamEnvelope>, why: &str) {
    let quiet = Duration::from_millis(POLL_INTERVAL_MS * 8);
    if let Ok(envelope) = events.recv_timeout(quiet) {
        panic!("{why}, but {:?} arrived", envelope.event);
    }
}

/// The instant just after the one the file already carries.
///
/// The simulated agent stamps its record with this rather than with a literal, so
/// its record is unambiguously newer than the creation it follows and older than
/// any later app write, however fast the test runs. It adds a digit of precision
/// rather than arithmetic on the clock, which the format allows and the parser
/// already compares across precisions.
fn just_after_updated_at(raw: &str) -> String {
    let updated_at = raw
        .lines()
        .find_map(|line| line.strip_prefix("updated_at: "))
        .expect("a created ticket carries updated_at");
    let fraction = updated_at
        .strip_suffix('Z')
        .and_then(|rest| rest.split_once('.'))
        .map(|(_, fraction)| fraction)
        .unwrap_or_else(|| panic!("the app writes millisecond precision, got {updated_at}"));
    assert_eq!(fraction.len(), 3, "expected millisecond precision");
    format!("{}1Z", updated_at.trim_end_matches('Z'))
}

/// Rewrites `ticket.md` the way `.longclaw/AGENTS.md` tells an agent to: change
/// state, tick a task, and append an attributed activity record.
fn agent_rewrite(raw: &str, description: &str) -> String {
    let agent_at = just_after_updated_at(raw);
    let mut with_state = String::new();
    let mut ticked = false;
    for line in raw.lines() {
        if line == "status: todo" {
            with_state.push_str("status: in_progress\n");
        } else if line.starts_with("updated_at:") {
            // The contract asks an agent that changes state to set updated_at.
            with_state.push_str(&format!("updated_at: {agent_at}\n"));
            // An agent that writes an assignee still cannot become one: v0 renders
            // no assignee at all (ADR 0001). The value is preserved, never promoted.
            with_state.push_str("assignee: claude-code\n");
        } else if !ticked && line.starts_with("- [ ] ") {
            ticked = true;
            with_state.push_str(&line.replacen("- [ ] ", "- [x] ", 1));
            with_state.push('\n');
        } else {
            with_state.push_str(line);
            with_state.push('\n');
        }
    }
    assert!(ticked, "the ticket should have an unchecked task to tick");
    let (before_description, rest) = with_state
        .split_once("\n\nCheck whether the round trip holds.\n")
        .expect("the description the human wrote");
    format!(
        "{before_description}\n\n{description}\n{rest}\
         \n<!-- longclaw:event\n\
         id: evt_a17c40b2\n\
         kind: update\n\
         occurred_at: {agent_at}\n\
         actor:\n\
         \x20 type: agent\n\
         \x20 id: claude-code\n\
         \x20 name: Claude Code\n\
         changes:\n\
         \x20 - field: status\n\
         \x20   from: todo\n\
         \x20   to: in_progress\n\
         -->\n\
         ### Claude Code updated this ticket\n\
         \n\
         Read the ticket, started the work, and ticked the first task.\n\
         <!-- /longclaw:event -->\n"
    )
}

fn create_first_ticket(engine: &longclaw_desktop_lib::engine::ProjectEngine) -> IndexedRow {
    let result = engine
        .create_ticket(&NewTicket {
            title: "Prove the agent round trip".to_owned(),
            description: "Check whether the round trip holds.".to_owned(),
            status: Some(Status::Todo),
            priority: None,
            labels: vec![],
            checklist: vec![
                NewChecklistItem::open("Let an agent read this ticket"),
                NewChecklistItem::open("Review what it changed"),
            ],
        })
        .expect("the app should create the ticket");
    match result.ticket {
        TicketRow::Indexed(row) => row,
        TicketRow::Degraded(row) => panic!("a created ticket must be readable: {:?}", row),
    }
}

#[test]
fn a_ticket_a_human_created_comes_back_changed_by_an_agent_and_survives_a_restart() {
    let _serial = serially();
    let (_temp, root) = new_project("round-trip", "RT");

    // The instructions an agent discovers are generated with the project, and they
    // name the file it has to read.
    let contract =
        fs::read_to_string(root.join(".longclaw/AGENTS.md")).expect("the agent contract");
    assert!(contract.contains(".longclaw/tickets/<KEY>/ticket.md"));
    assert!(contract.contains("type: agent"));

    let (engine, events) = start_engine(&root);
    let created = create_first_ticket(&engine);
    // The number, not the whole key: the trailing character is drawn at random
    // when the key is minted (LC-232), and the caller reads it back from here.
    let key = created.key.clone();
    assert_minted(&key, 1);
    assert_eq!(created.status, Status::Todo);
    assert_eq!(created.checklist_count, 2);

    // The human's creation is a real file, in the documented place.
    let path = ticket_path(&root, &key);
    let raw = fs::read_to_string(&path).expect("ticket.md");
    assert!(raw.contains(&format!("key: {key}\n")));
    assert!(raw.contains("title: Prove the agent round trip\n"));
    assert!(raw.contains("- [ ] Let an agent read this ticket <!-- longclaw:item="));
    assert!(raw.contains("### You created this ticket"));
    // The app's own write is recognized as its own, so the board does not
    // acknowledge the human's action as an incoming change.
    expect_quiet(
        &events,
        "an app write must not come back as an external change",
    );

    // An external agent reads the file, changes state, ticks a task, and says so.
    let agent_description = "Check whether the round trip holds.\n\n\
                             Confirmed: the watcher carried this edit back.";
    editor_atomic_replace(
        &path,
        &agent_rewrite(&fs::read_to_string(&path).unwrap(), agent_description),
        1,
    );

    let changed = next_change(&events);
    let row = match &changed {
        TicketRow::Indexed(row) => row.clone(),
        TicketRow::Degraded(row) => panic!("the agent's write should parse: {row:?}"),
    };
    assert_eq!(row.key, key);
    assert_eq!(row.status, Status::InProgress);
    assert_eq!(row.checked_count, 1);
    let activity = row.last_activity.clone().expect("the agent's own record");
    assert_eq!(activity.actor.actor_type, ActorType::Agent);
    assert_eq!(activity.actor.name.as_deref(), Some("Claude Code"));
    assert_eq!(activity.kind, "update");

    // The panel reads the file itself, so it shows the agent's description and its
    // timeline entry — and no assignee, whatever the agent wrote there.
    let detail = engine.detail(&key).expect("the panel should read the file");
    let ticket = detail.ticket.expect("a readable ticket");
    assert_eq!(ticket.description, agent_description);
    assert_eq!(ticket.assignee.as_deref(), Some("claude-code"));
    assert!(!ticket.history_incomplete);
    let agent_events: Vec<_> = ticket
        .activity
        .iter()
        .filter(|event| event.actor.actor_type == ActorType::Agent)
        .collect();
    assert_eq!(agent_events.len(), 1);
    assert!(agent_events[0].body.contains("ticked the first task"));

    // A restart and a full index rebuild both reproduce the same visible state.
    let (restarted, _events) = start_engine(&root);
    let after_restart = indexed(&restarted.snapshot().tickets, &key);
    assert_eq!(after_restart, row);
    let rebuilt = restarted
        .rebuild(RebuildReason::Manual, false)
        .expect("the index should rebuild from the files");
    assert_eq!(indexed(&rebuilt.tickets, &key), row);
}

#[test]
fn a_human_reply_to_an_agent_change_keeps_both_voices_in_the_file() {
    let _serial = serially();
    let (_temp, root) = new_project("round-trip-reply", "RT");
    let (engine, events) = start_engine(&root);
    let key = create_first_ticket(&engine).key.clone();
    let path = ticket_path(&root, &key);

    editor_atomic_replace(
        &path,
        &agent_rewrite(
            &fs::read_to_string(&path).unwrap(),
            "Check whether the round trip holds.",
        ),
        1,
    );
    let after_agent = match next_change(&events) {
        TicketRow::Indexed(row) => row,
        TicketRow::Degraded(row) => panic!("the agent's write should parse: {row:?}"),
    };

    // The human answers from the panel, carrying the hash the panel read.
    let result = engine
        .edit_ticket(
            &key,
            &TicketEdit {
                status: Some(Status::InReview),
                comment: Some("Thanks — moving this to review.".to_owned()),
                ..TicketEdit::default()
            },
            &after_agent.content_hash,
        )
        .expect("a human reply on top of the agent's file should be accepted");

    let raw = fs::read_to_string(&path).expect("ticket.md");
    // Both records are in the one file, in order, with their own actors.
    assert!(raw.contains("id: claude-code"));
    assert!(raw.contains("### Claude Code updated this ticket"));
    assert!(raw.contains("### You updated this ticket\n\nThanks — moving this to review."));
    assert_eq!(raw.matches("type: agent").count(), 1);
    // The agent's assignee line is preserved by a write that never mentioned it.
    assert!(raw.contains("assignee: claude-code\n"));

    let row = match result.ticket {
        TicketRow::Indexed(row) => row,
        TicketRow::Degraded(row) => panic!("the reply should stay readable: {row:?}"),
    };
    assert_eq!(row.status, Status::InReview);
    assert_eq!(
        row.last_activity
            .expect("the human's record")
            .actor
            .actor_type,
        ActorType::Human
    );
    // The human's own write is not echoed back as somebody else's change.
    expect_quiet(
        &events,
        "a human write must not come back as an external change",
    );
}
