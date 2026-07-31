//! The request shapes the frontend sends, pinned from the outside.
//!
//! `tests/fixtures/ipc-contract.json` pins what Rust emits; this pins what it
//! accepts. The JSON literals here are what `src/api.ts` builds from `src/types.ts`,
//! so a rename on either side fails here rather than at runtime in the app.

use longclaw_desktop_lib::core::ticket::{Priority, Status};
use longclaw_desktop_lib::core::{CreateTicketRequest, EditTicketRequest};

#[test]
fn the_create_request_the_quick_create_form_sends() {
    let json = r#"{
        "projectId": "019c8c31-4d7e-71ad-8997-e67700962b55",
        "title": "Prove the agent round trip",
        "description": "Check whether the round trip holds.",
        "status": "todo",
        "priority": "p1",
        "labels": ["backend", "reliability"],
        "checklist": ["Let an agent read this ticket", "Review what it changed"]
    }"#;

    let request: CreateTicketRequest = serde_json::from_str(json).expect("a create request");

    assert_eq!(request.project_id, "019c8c31-4d7e-71ad-8997-e67700962b55");
    assert_eq!(request.ticket.title, "Prove the agent round trip");
    assert_eq!(request.ticket.status, Some(Status::Todo));
    assert_eq!(request.ticket.priority, Some(Priority::P1));
    assert_eq!(request.ticket.labels, vec!["backend", "reliability"]);
    assert_eq!(request.ticket.checklist.len(), 2);
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
