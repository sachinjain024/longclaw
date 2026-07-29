use std::fs;
use std::path::{Path, PathBuf};

use longclaw_tauri_spike_lib::core::storage::{content_hash, parse_ticket, patch_ticket_title};
use longclaw_tauri_spike_lib::core::ErrorCode;

fn write_ticket(project_root: &Path, key: &str, priority: &str) -> PathBuf {
    write_ticket_with_status(project_root, key, "todo", priority)
}

fn write_ticket_with_status(
    project_root: &Path,
    key: &str,
    status: &str,
    priority: &str,
) -> PathBuf {
    let ticket_dir = project_root.join(".longclaw/tickets").join(key);
    fs::create_dir_all(&ticket_dir).expect("ticket directory should be created");
    let ticket_path = ticket_dir.join("ticket.md");
    fs::write(
        &ticket_path,
        format!(
            "---\n\
             format: longclaw.ticket/v1\n\
             id: fixture-{key}\n\
             key: {key}\n\
             title: Priority contract\n\
             status: {status}\n\
             priority: {priority}\n\
             created_at: 2026-07-29T00:00:00Z\n\
             updated_at: 2026-07-29T00:00:00Z\n\
             ---\n"
        ),
    )
    .expect("ticket fixture should be written");
    ticket_path
}

#[test]
fn v1_accepts_only_the_canonical_priority_values() {
    let project = tempfile::tempdir().expect("temporary project should be created");

    for (sequence, priority) in ["urgent", "p1", "p2", "p3", "p4", "none"]
        .into_iter()
        .enumerate()
    {
        let key = format!("LC-{}", sequence + 1);
        let ticket_path = write_ticket(project.path(), &key, priority);
        parse_ticket(&ticket_path, project.path())
            .unwrap_or_else(|error| panic!("{priority} should be accepted: {}", error.message));
    }

    let legacy_path = write_ticket(project.path(), "LC-7", "high");
    let error = parse_ticket(&legacy_path, project.path())
        .expect_err("legacy priority names should be rejected");
    assert_eq!(error.code, ErrorCode::ParseFailed);
}

#[test]
fn v1_accepts_only_the_fixed_status_values() {
    let project = tempfile::tempdir().expect("temporary project should be created");

    for (sequence, status) in [
        "backlog",
        "todo",
        "in_progress",
        "in_review",
        "done",
        "canceled",
    ]
    .into_iter()
    .enumerate()
    {
        let key = format!("LC-{}", sequence + 1);
        let ticket_path = write_ticket_with_status(project.path(), &key, status, "none");
        parse_ticket(&ticket_path, project.path())
            .unwrap_or_else(|error| panic!("{status} should be accepted: {}", error.message));
    }

    let custom_path = write_ticket_with_status(project.path(), "LC-7", "blocked", "none");
    let error = parse_ticket(&custom_path, project.path())
        .expect_err("custom v0 statuses should be rejected");
    assert_eq!(error.code, ErrorCode::ParseFailed);
}

#[test]
fn v1_rejects_a_frontmatter_key_that_does_not_match_its_directory() {
    let project = tempfile::tempdir().expect("temporary project should be created");
    let ticket_path = write_ticket(project.path(), "LC-1", "none");
    let raw = fs::read_to_string(&ticket_path).expect("ticket fixture should be readable");
    fs::write(&ticket_path, raw.replace("key: LC-1", "key: LC-2"))
        .expect("mismatched ticket fixture should be written");

    let error = parse_ticket(&ticket_path, project.path())
        .expect_err("frontmatter and directory keys should agree");
    assert_eq!(error.code, ErrorCode::ParseFailed);
}

#[test]
fn v1_app_writes_use_the_reserved_local_human_actor() {
    let project = tempfile::tempdir().expect("temporary project should be created");
    let ticket_path = write_ticket(project.path(), "LC-1", "none");
    let initial = fs::read(&ticket_path).expect("ticket fixture should be readable");

    let (_, next) = patch_ticket_title(
        project.path(),
        "LC-1",
        "Updated locally",
        &content_hash(&initial),
    )
    .expect("a compatible title update should be produced");
    let next = String::from_utf8(next).expect("ticket output should be UTF-8");

    assert!(next.contains("actor:\n  type: human\n  id: local\n"));
    assert!(!next.contains("name: LongClaw spike UI"));
}
