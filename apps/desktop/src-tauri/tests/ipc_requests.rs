//! The request shapes the frontend sends, pinned from the outside.
//!
//! `tests/fixtures/ipc-contract.json` pins what Rust emits; this pins what it
//! accepts. The JSON literals here are what `src/api.ts` builds from `src/types.ts`,
//! so a rename on either side fails here rather than at runtime in the app.

use longclaw_desktop_lib::core::ticket::{Priority, Status};
use longclaw_desktop_lib::core::{CreateTicketRequest, EditTicketRequest};

/// Full create sends the whole shape (V0-16): every field the design approved,
/// in one write. This used to be named for quick create, which sent the same
/// six fields until V0-16 narrowed it to the two below.
#[test]
fn the_create_request_the_full_create_surface_sends() {
    let json = r#"{
        "projectId": "019c8c31-4d7e-71ad-8997-e67700962b55",
        "title": "Prove the agent round trip",
        "description": "Check whether the round trip holds.",
        "status": "todo",
        "priority": "p1",
        "labels": ["backend", "reliability"],
        "checklist": [
            {"text": "Let an agent read this ticket", "checked": true},
            {"text": "Review what it changed", "checked": false}
        ]
    }"#;

    let request: CreateTicketRequest = serde_json::from_str(json).expect("a create request");

    assert_eq!(request.project_id, "019c8c31-4d7e-71ad-8997-e67700962b55");
    assert_eq!(request.ticket.title, "Prove the agent round trip");
    assert_eq!(request.ticket.status, Some(Status::Todo));
    assert_eq!(request.ticket.priority, Some(Priority::P1));
    assert_eq!(request.ticket.labels, vec!["backend", "reliability"]);
    // Both halves of a row cross the wire (LC-242h): a create filed over work
    // already half done says which half, and a list of strings could not.
    assert_eq!(request.ticket.checklist.len(), 2);
    assert_eq!(
        request.ticket.checklist[0].text,
        "Let an agent read this ticket"
    );
    assert!(request.ticket.checklist[0].checked);
    assert!(!request.ticket.checklist[1].checked);
}

/// `checked` is what the panel sends for every row, but the field defaults, so a
/// row that arrives as text alone is an open row rather than a rejected request.
#[test]
fn a_create_checklist_row_without_checked_is_open() {
    let json = r#"{
        "projectId": "019c8c31-4d7e-71ad-8997-e67700962b55",
        "title": "Prove the agent round trip",
        "checklist": [{"text": "Review what it changed"}]
    }"#;

    let request: CreateTicketRequest = serde_json::from_str(json).expect("a create request");

    assert_eq!(request.ticket.checklist.len(), 1);
    assert!(!request.ticket.checklist[0].checked);
}

/// Quick create is title and status and nothing else (`screen-specs.md:253-262`),
/// so the fields it leaves out have to be genuinely optional on the wire rather
/// than merely always sent.
#[test]
fn the_create_request_quick_create_sends() {
    let json = r#"{
        "projectId": "019c8c31-4d7e-71ad-8997-e67700962b55",
        "title": "Prove the agent round trip",
        "status": "in_progress"
    }"#;

    let request: CreateTicketRequest = serde_json::from_str(json).expect("a create request");

    assert_eq!(request.ticket.status, Some(Status::InProgress));
    // Absent, not empty-and-sent: the defaults are Rust's to apply.
    assert_eq!(request.ticket.priority, None);
    assert!(request.ticket.description.is_empty());
    assert!(request.ticket.labels.is_empty());
    assert!(request.ticket.checklist.is_empty());
}

#[test]
fn every_edit_the_ticket_panel_can_send() {
    for (name, edit) in [
        ("title", r#"{"title":"A renamed ticket"}"#),
        ("status", r#"{"status":"in_review"}"#),
        ("priority", r#"{"priority":"p1"}"#),
        (
            "description",
            r#"{"description":"Rewritten in the panel."}"#,
        ),
        ("rank", r#"{"rank":"a0V"}"#),
        // Leaving Manual mode has to be able to put a rank back to absent, and an
        // absent `rank` already means "leave it alone", so `null` is the clear.
        ("rank clear", r#"{"rank":null}"#),
        (
            "checklist toggle",
            r#"{"checklist":[{"itemId":"ck_7d2a","checked":true}]}"#,
        ),
        (
            "checklist append",
            r#"{"addChecklistItems":["One more task"]}"#,
        ),
        (
            "comment",
            r#"{"comment":"Thanks — moving this to review."}"#,
        ),
    ] {
        let json = format!(
            r#"{{"projectId":"p","ticketKey":"LC-1","expectedHash":"abc123","edit":{edit}}}"#
        );
        let request: EditTicketRequest = serde_json::from_str(&json)
            .unwrap_or_else(|error| panic!("the {name} edit should deserialize: {error}"));
        assert_eq!(request.ticket_key, "LC-1");
        assert_eq!(request.expected_hash, "abc123");
    }
}

/// `null` and absent are different requests for `rank`, and serde collapses them
/// into the same `None` unless the field is read as a nested option.
#[test]
fn an_absent_rank_leaves_the_rank_alone_and_a_null_rank_clears_it() {
    let edit = |body: &str| {
        let json = format!(
            r#"{{"projectId":"p","ticketKey":"LC-1","expectedHash":"abc123","edit":{body}}}"#
        );
        serde_json::from_str::<EditTicketRequest>(&json)
            .unwrap_or_else(|error| panic!("{body} should deserialize: {error}"))
            .edit
            .rank
    };

    assert_eq!(edit(r#"{"title":"Untouched rank"}"#), None);
    assert_eq!(edit(r#"{"rank":null}"#), Some(None));
    assert_eq!(edit(r#"{"rank":"a0V"}"#), Some(Some("a0V".to_owned())));
}

#[test]
fn a_field_this_build_does_not_know_is_refused_rather_than_ignored() {
    let json =
        r#"{"projectId":"p","ticketKey":"LC-1","expectedHash":"h","edit":{"assignee":"someone"}}"#;

    let error = serde_json::from_str::<EditTicketRequest>(json)
        .expect_err("an edit cannot set an assignee: v0 has none (ADR 0001)");

    assert!(error.to_string().contains("assignee"), "{error}");
}

#[test]
fn priorities_and_statuses_use_their_on_disk_spellings() {
    let json = r#"{"projectId":"p","title":"T","status":"in_progress","priority":"urgent"}"#;
    let request: CreateTicketRequest = serde_json::from_str(json).expect("a create request");

    assert_eq!(request.ticket.status, Some(Status::InProgress));
    assert_eq!(request.ticket.priority, Some(Priority::Urgent));
}
