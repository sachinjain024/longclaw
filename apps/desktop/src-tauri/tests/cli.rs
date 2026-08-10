//! The command-line creation surface, driven the way a caller drives it.
//!
//! These go through `cli::dispatch` rather than through the built binary: the
//! interesting behaviour is which core seam a command reaches and what it
//! refuses, and a subprocess would only add a spawn between the assertion and
//! the answer. What the binary adds on top — argv, stdout, the exit code — is
//! four lines in `src/bin/longclaw.rs`.
//!
//! Nothing here touches the project registry, and that is deliberate: the
//! registry lives in the user's application-support folder, and a test suite
//! that writes to a real one is a test suite that changes the machine it runs
//! on. `project init` is the one command that registers, so it is the one
//! command these tests do not drive.

mod common;

use std::fs;
use std::path::Path;

use longclaw_desktop_lib::cli::dispatch;
use longclaw_desktop_lib::core::storage;
use serde_json::Value;

/// The words of a command, as `env::args` would hand them over.
fn words(line: &[&str]) -> Vec<String> {
    line.iter().map(|word| (*word).to_owned()).collect()
}

fn run(root: &Path, line: &[&str]) -> Value {
    let mut arguments = words(line);
    arguments.push("--path".to_owned());
    arguments.push(root.display().to_string());
    dispatch(&arguments)
        .unwrap_or_else(|error| panic!("{line:?} should succeed, got {error:?}"))
        .expect("a command returns a value")
}

fn refuse(root: &Path, line: &[&str]) -> String {
    let mut arguments = words(line);
    arguments.push("--path".to_owned());
    arguments.push(root.display().to_string());
    match dispatch(&arguments) {
        Err(error) => error.message,
        Ok(value) => panic!("{line:?} should have been refused, got {value:?}"),
    }
}

fn read(root: &Path, key: &str) -> String {
    fs::read_to_string(common::ticket_path(root, key)).expect("the ticket should be readable")
}

fn defined_label(root: &Path, slug: &str) {
    run(root, &["label", "add", "--slug", slug, "--name", "Storage"]);
}

/// The whole reason the surface exists: LongClaw allocates the key, not its
/// caller. Nothing in the CLI composes one, so the numbers come out of the same
/// directory scan the app's own create uses.
#[test]
fn longclaw_allocates_the_key_and_the_caller_never_names_one() {
    let (_temp, root) = common::new_project("keys", "LC");

    let first = run(&root, &["ticket", "create", "--title", "First"]);
    let second = run(&root, &["ticket", "create", "--title", "Second"]);

    assert_eq!(first["key"], "LC-1");
    assert_eq!(second["key"], "LC-2");
    assert!(common::ticket_path(&root, "LC-1").is_file());
    assert!(common::ticket_path(&root, "LC-2").is_file());
}

/// The format contract's rule, held at the surface that made it reachable: an
/// actor is declared. The agent flags are the declaration, and their absence
/// declares the person who typed the command.
#[test]
fn an_agent_is_recorded_as_an_agent_and_a_person_as_themselves() {
    let (_temp, root) = common::new_project("actors", "LC");

    run(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Written by an agent",
            "--agent-id",
            "claude-code",
            "--agent-name",
            "Claude Code",
        ],
    );
    run(
        &root,
        &["ticket", "create", "--title", "Written by a person"],
    );

    let agent = read(&root, "LC-1");
    assert!(agent.contains("actor:\n  type: agent\n"), "{agent}");
    assert!(agent.contains("  id: claude-code\n"), "{agent}");
    assert!(agent.contains("  name: Claude Code\n"), "{agent}");
    assert!(
        agent.contains("### Claude Code created this ticket"),
        "{agent}"
    );

    let person = read(&root, "LC-2");
    assert!(person.contains("actor:\n  type: human\n"), "{person}");
    assert!(person.contains("  id: local\n"), "{person}");
    assert!(person.contains("### You created this ticket"), "{person}");
}

/// The order is a thing an agent can put right, not only a thing a human drags
/// (LC-185). `--after` names the item the moved one now follows, and its absence
/// is the top of the list.
#[test]
fn an_item_moves_to_the_place_the_command_names() {
    let (_temp, root) = common::new_project("reorder", "LC");
    let created = run(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Ordered work",
            "--checklist",
            "first",
            "--checklist",
            "second",
            "--checklist",
            "third",
        ],
    );
    let ids: Vec<String> = created["ticket"]["checklist"]
        .as_array()
        .expect("a created checklist")
        .iter()
        .map(|item| item["id"].as_str().expect("an id").to_owned())
        .collect();
    let texts = |value: &Value| -> Vec<String> {
        value["ticket"]["checklist"]
            .as_array()
            .expect("a checklist")
            .iter()
            .map(|item| item["text"].as_str().expect("text").to_owned())
            .collect()
    };

    let moved = run(
        &root,
        &[
            "ticket",
            "edit",
            "LC-1",
            "--move-item",
            &ids[2],
            "--after",
            &ids[0],
        ],
    );
    assert_eq!(texts(&moved), ["first", "third", "second"]);

    let promoted = run(&root, &["ticket", "edit", "LC-1", "--move-item", &ids[1]]);
    assert_eq!(texts(&promoted), ["second", "first", "third"]);

    let raw = read(&root, "LC-1");
    assert!(
        raw.contains(&format!("field: checklist.{}.moved", ids[1])),
        "{raw}"
    );

    assert_eq!(
        refuse(&root, &["ticket", "edit", "LC-1", "--after", &ids[0]]),
        "--after needs --move-item"
    );
}

/// An agent that edits is an agent in the history too, not only at creation.
#[test]
fn an_agent_edit_appends_an_agent_authored_event() {
    let (_temp, root) = common::new_project("agent-edit", "LC");
    let created = run(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Needs a second pass",
            "--checklist",
            "Prove it",
        ],
    );
    let item = created["ticket"]["checklist"][0]["id"]
        .as_str()
        .expect("a created checklist item carries an id")
        .to_owned();

    let edited = run(
        &root,
        &[
            "ticket",
            "edit",
            "LC-1",
            "--check",
            &item,
            "--status",
            "done",
            "--comment",
            "Verified.",
            "--agent-id",
            "claude-code",
        ],
    );

    assert_eq!(edited["ticket"]["status"], "done");
    assert_eq!(edited["ticket"]["checklist"][0]["checked"], true);
    let raw = read(&root, "LC-1");
    assert!(raw.contains("kind: update"), "{raw}");
    assert!(raw.contains("### claude-code updated this ticket"), "{raw}");
    assert!(raw.contains("Verified."), "{raw}");
}

/// A stale write is refused rather than landed. The CLI reads immediately
/// before it writes, so this is the race it cannot close by reading again —
/// `atomic_replace` confirms the bytes it displaces, and that is what makes a
/// command safe to run beside an open app.
#[test]
fn an_edit_built_from_bytes_that_moved_is_a_conflict() {
    let (_temp, root) = common::new_project("conflict", "LC");
    run(&root, &["ticket", "create", "--title", "Contended"]);
    let stale = storage::read_ticket_detail(&root, "LC", "LC-1")
        .expect("the ticket reads")
        .content_hash;

    run(&root, &["ticket", "edit", "LC-1", "--priority", "p1"]);

    let error = storage::prepare_ticket_edit(
        &root,
        "LC",
        "LC-1",
        &longclaw_desktop_lib::core::ticket::TicketEdit {
            title: Some("Written from a stale read".to_owned()),
            ..Default::default()
        },
        &stale,
        "2026-08-05T10:00:00Z",
    )
    .expect_err("a stale hash should be refused");
    assert_eq!(error.code, longclaw_desktop_lib::core::ErrorCode::Conflict);

    // And the file still holds what the edit that was not stale wrote.
    let raw = read(&root, "LC-1");
    assert!(raw.contains("priority: p1"), "{raw}");
    assert!(raw.contains("title: Contended"), "{raw}");
}

/// A label a ticket carries that the project never defined renders as a bare
/// slug. The CLI refuses before it claims anything, so a typo costs no key.
#[test]
fn an_undefined_label_is_refused_before_a_key_is_spent() {
    let (_temp, root) = common::new_project("labels", "LC");
    defined_label(&root, "storage");

    let message = refuse(
        &root,
        &["ticket", "create", "--title", "Typo", "--label", "storgae"],
    );
    assert!(message.contains("storgae"), "{message}");
    assert!(message.contains("longclaw label add"), "{message}");
    assert!(!common::ticket_path(&root, "LC-1").exists());

    let created = run(
        &root,
        &[
            "ticket", "create", "--title", "Correct", "--label", "storage",
        ],
    );
    assert_eq!(created["key"], "LC-1");
}

/// A description holding a reserved heading would come back truncated, so the
/// create is refused and the claimed directory goes back.
///
/// The number goes back with it. `prepare_new_ticket` and
/// `discard_claimed_ticket_directory` both say in prose that a discarded key
/// "stays spent", and allocation is a scan of directory names, so removing the
/// directory frees the number — LC-1 here is claimed twice. Recorded rather
/// than changed: no ticket ever carried the first LC-1, nothing links to it,
/// and "never reused" is a rule about tickets that existed.
#[test]
fn a_reserved_heading_in_a_description_is_refused_and_hands_the_directory_back() {
    let (_temp, root) = common::new_project("reserved", "LC");

    let message = refuse(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Reserved",
            "--description",
            "Context.\n\n## Checklist\n\n- [ ] smuggled",
        ],
    );
    assert!(message.contains("reserved heading"), "{message}");
    assert!(!root.join(".longclaw/tickets/LC-1").exists());

    let next = run(&root, &["ticket", "create", "--title", "After the refusal"]);
    assert_eq!(next["key"], "LC-1");
    assert_eq!(next["ticket"]["title"], "After the refusal");
}

/// A description arrives whole, including the Markdown a backlog row is made
/// of. This is the import's own must-pass: 57 descriptions went through here.
#[test]
fn a_description_round_trips_through_the_file() {
    let (_temp, root) = common::new_project("description", "LC");
    let description = "**Why it exists:** FSEvents drops history over sleep.\n\n\
                       A closed lid is an ordinary event on a laptop; today it can\n\
                       leave the app confidently wrong.\n\n\
                       Source: `docs/backlog/v0-backlog.md` (V0-04).";

    let created = run(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Watcher recovery",
            "--description",
            description,
        ],
    );

    assert_eq!(created["ticket"]["description"], description);
    let reread = run(&root, &["ticket", "show", "LC-1"]);
    assert_eq!(reread["ticket"]["description"], description);
}

/// The projection half: every ticket, as the app's own row shape.
#[test]
fn list_reports_every_ticket_including_one_it_cannot_parse() {
    let (_temp, root) = common::new_project("list", "LC");
    run(&root, &["ticket", "create", "--title", "Readable"]);
    fs::create_dir_all(root.join(".longclaw/tickets/LC-2")).expect("a second ticket directory");
    fs::write(common::ticket_path(&root, "LC-2"), "not a ticket at all")
        .expect("the degraded ticket writes");

    let rows = run(&root, &["ticket", "list"]);
    let rows = rows.as_array().expect("list returns an array");

    assert_eq!(rows.len(), 2);
    assert!(rows
        .iter()
        .any(|row| row["key"] == "LC-1" && row["title"] == "Readable"));
    assert!(rows
        .iter()
        .any(|row| row["key"] == "LC-2" && row["diagnostic"].is_object()));
}

/// A folder that is not a project says so, rather than being turned into one by
/// a command that was only asked to read.
#[test]
fn a_folder_that_is_not_a_project_is_not_quietly_made_one() {
    let temp = tempfile::tempdir().expect("an empty folder");
    let message = refuse(temp.path(), &["ticket", "create", "--title", "Nowhere"]);
    assert!(!temp.path().join(".longclaw").exists(), "{message}");
}

#[test]
fn an_unknown_command_names_itself() {
    let error = dispatch(&words(&["ticket", "destroy"])).expect_err("there is no destroy");
    assert!(error.message.contains("ticket destroy"), "{error:?}");
    assert!(
        dispatch(&[])
            .expect("no command is not a failure")
            .is_none(),
        "an empty command line asks for usage"
    );
}
