//! App write → disk → reload, and the refusals that protect a file the app
//! should not touch.

mod common;

use std::fs;
use std::path::Path;
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::{Duration, Instant};

use common::{copy_representative_project, project_reference, start_engine, ticket_path};
use longclaw_desktop_lib::core::storage::{self, NewTicket};
use longclaw_desktop_lib::core::ticket::{ChecklistToggle, Priority, Status, TicketEdit};
use longclaw_desktop_lib::core::{
    ErrorCode, ProjectEvent, RebuildReason, StreamEnvelope, TicketRow,
};

fn indexed<'a>(tickets: &'a [TicketRow], key: &str) -> &'a longclaw_desktop_lib::core::IndexedRow {
    match tickets
        .iter()
        .find(|row| row.key() == key)
        .unwrap_or_else(|| panic!("{key} should be in the index"))
    {
        TicketRow::Indexed(row) => row,
        TicketRow::Degraded(row) => panic!("{key} should be readable: {}", row.diagnostic.message),
    }
}

#[test]
fn an_app_write_reaches_disk_and_survives_a_restart() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let before = indexed(&engine.snapshot().tickets, "LC-1").clone();

    let result = engine
        .edit_ticket(
            "LC-1",
            &TicketEdit {
                status: Some(Status::InReview),
                checklist: vec![ChecklistToggle {
                    item_id: "ck_8e31".to_owned(),
                    checked: true,
                }],
                comment: Some("Handing this over for review.".to_owned()),
                ..TicketEdit::default()
            },
            &before.content_hash,
        )
        .expect("the write should be accepted");
    assert_eq!(result.changes.len(), 2);

    // The file on disk is what the write claimed.
    let raw = fs::read_to_string(ticket_path(&root, "LC-1")).expect("ticket.md");
    assert!(raw.contains("status: in_review\n"));
    assert!(raw
        .contains("- [x] Render the ticket in the desktop shell <!-- longclaw:item=ck_8e31 -->\n"));
    assert_eq!(raw.matches("## Activity").count(), 1);
    // One write appended one event, carrying the note with the change it explains.
    assert_eq!(raw.matches("kind: create").count(), 1);
    assert_eq!(raw.matches("kind: update").count(), 2);
    assert_eq!(raw.matches("kind: comment").count(), 0);
    assert!(raw.contains("### You updated this ticket\n\nHanding this over for review.\n"));

    // A second engine reading the same folder sees the same row.
    let after = indexed(&engine.snapshot().tickets, "LC-1").clone();
    let (restarted, _events) = start_engine(&root);
    let reloaded = indexed(&restarted.snapshot().tickets, "LC-1").clone();
    assert_eq!(reloaded, after);
    assert_eq!(reloaded.status, Status::InReview);
    assert_eq!(reloaded.checked_count, 2);
    let newest = reloaded.last_activity.expect("an appended event");
    assert_eq!(newest.kind, "update");
    assert_eq!(newest.actor.id.as_deref(), Some("local"));
}

#[test]
fn rebuilding_the_index_reproduces_the_same_visible_state() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let first = engine.snapshot();
    assert_eq!(first.tickets.len(), 6);
    assert_eq!(
        first.tickets.iter().filter(|row| row.is_degraded()).count(),
        2
    );

    let rebuilt = engine
        .rebuild(RebuildReason::Manual, false)
        .expect("the index should rebuild");
    assert_eq!(rebuilt.tickets, first.tickets);
    assert!(rebuilt.generation > first.generation);
    assert_eq!(rebuilt.project, first.project);
}

#[test]
fn a_degraded_ticket_stays_visible_and_is_never_rewritten() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);

    for (key, expects_read_only, fragment) in [
        ("LC-98", false, "status"),
        ("LC-99", true, "longclaw.ticket/v99"),
    ] {
        let path = ticket_path(&root, key);
        let original = fs::read(&path).expect("the broken fixture should be readable");
        let row = engine
            .snapshot()
            .tickets
            .into_iter()
            .find(|row| row.key() == key)
            .unwrap_or_else(|| panic!("{key} should still be listed"));
        let TicketRow::Degraded(row) = row else {
            panic!("{key} should be degraded");
        };
        assert_eq!(row.read_only, expects_read_only);
        assert!(row.diagnostic.message.contains(fragment));
        assert_eq!(row.byte_length, original.len());

        // The raw file is available for the raw-file view, byte for byte.
        let detail = engine.detail(key).expect("a degraded ticket still reads");
        assert!(detail.ticket.is_none());
        assert_eq!(detail.raw.as_bytes(), original.as_slice());
        assert!(detail.diagnostic.is_some());

        // A write is refused rather than attempted.
        let error = engine
            .edit_ticket(
                key,
                &TicketEdit {
                    status: Some(Status::Done),
                    ..TicketEdit::default()
                },
                &row.content_hash,
            )
            .expect_err("an unreadable ticket must not be rewritten");
        assert_eq!(
            error.code,
            if expects_read_only {
                ErrorCode::UnsupportedVersion
            } else {
                ErrorCode::ParseFailed
            }
        );
        assert_eq!(fs::read(&path).expect("still there"), original);
    }
}

#[test]
fn a_stale_write_is_a_conflict_that_names_who_changed_the_file() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let stale_hash = indexed(&engine.snapshot().tickets, "LC-2")
        .content_hash
        .clone();

    // Someone else saves first.
    let path = ticket_path(&root, "LC-2");
    let external = common::replace_title(
        &fs::read_to_string(&path).expect("ticket.md"),
        "An external edit landed first",
    );
    common::editor_atomic_replace(&path, &external, 1);
    let before = fs::read(&path).expect("the external version");

    let error = engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("A stale local edit".to_owned()),
                ..TicketEdit::default()
            },
            &stale_hash,
        )
        .expect_err("a stale write must not overwrite a newer file");
    assert_eq!(error.code, ErrorCode::Conflict);
    assert!(error.recoverable);
    assert_eq!(error.context["expectedHash"], stale_hash);
    assert_ne!(error.context["actualHash"], stale_hash);
    assert_eq!(error.context["conflictingActorType"], "agent");
    assert_eq!(error.context["conflictingActorName"], "Fixture Agent");
    assert_eq!(fs::read(&path).expect("untouched"), before);
}

/// The race the pre-write hash check cannot see.
///
/// Validation reads the file and approves the edit; the replacement happens some
/// microseconds later. A write that lands in between is displaced by a plain
/// `fs::rename` with nothing left to report, and the app's own self-write receipt
/// then swallows the watcher event, so the save looks clean.
///
/// The interleaving is driven, not waited for: `before_swap` runs after the
/// temporary file is durable and immediately before the replacement, so the
/// external write provably lands inside the window. A version of this test that
/// could pass by scheduling accident would be no evidence at all.
#[test]
fn an_external_write_inside_the_save_window_is_a_conflict_and_survives_it() {
    let _serial = common::serially();
    let (_temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let validated_hash = indexed(&engine.snapshot().tickets, "LC-2")
        .content_hash
        .clone();

    let path = ticket_path(&root, "LC-2");
    let external = common::replace_title(
        &fs::read_to_string(&path).expect("ticket.md"),
        "An external edit landed inside the window",
    );

    let interleaved = external.clone();
    storage::install_replace_seams(storage::ReplaceSeams {
        before_swap: Some(Arc::new(move |target: &Path| {
            common::editor_atomic_replace(target, &interleaved, 1);
        })),
        ..storage::ReplaceSeams::default()
    });
    let outcome = engine.edit_ticket(
        "LC-2",
        &TicketEdit {
            title: Some("A local edit built on the version validation saw".to_owned()),
            ..TicketEdit::default()
        },
        &validated_hash,
    );
    storage::clear_replace_seams();

    let error = outcome.expect_err("a write that displaced someone else's bytes is not a success");
    assert_eq!(error.code, ErrorCode::Conflict);
    assert!(error.recoverable);
    assert_eq!(error.context["expectedHash"], validated_hash);
    assert_ne!(error.context["actualHash"], validated_hash);
    assert_eq!(error.context["conflictingActorType"], "agent");
    assert_eq!(error.context["conflictingActorName"], "Fixture Agent");

    // The external write is still there. This is the assertion the whole plan is
    // for: before the fix, these bytes were gone and nothing said so.
    assert_eq!(
        fs::read_to_string(&path).expect("the external version"),
        external,
    );
    assert!(
        !fs::read_to_string(&path)
            .expect("ticket.md")
            .contains("built on the version validation saw"),
        "the refused local edit must not be on disk",
    );
    assert_eq!(
        leftover_temporaries(&path),
        Vec::<String>::new(),
        "a refused write leaves no debris in the user's repository",
    );

    // And the UI is not left believing the save was clean: the receipt for the
    // app's own bytes must not swallow the event carrying the external change.
    let changed = expect_ticket_changed(&events, "LC-2");
    assert_eq!(changed.title, "An external edit landed inside the window");
}

/// Where the volume cannot exchange two paths atomically there is no way to learn
/// what a replacement displaced, so LongClaw refuses the write. Refusing costs the
/// user a save they can retry elsewhere; guessing costs them someone else's work.
#[test]
fn a_volume_without_an_atomic_swap_refuses_the_write_rather_than_risking_it() {
    let _serial = common::serially();
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);
    let validated_hash = indexed(&engine.snapshot().tickets, "LC-2")
        .content_hash
        .clone();
    let path = ticket_path(&root, "LC-2");
    let before = fs::read(&path).expect("ticket.md");

    storage::install_replace_seams(storage::ReplaceSeams {
        force_swap_unsupported: true,
        ..storage::ReplaceSeams::default()
    });
    let outcome = engine.edit_ticket(
        "LC-2",
        &TicketEdit {
            title: Some("A save this volume cannot make safely".to_owned()),
            ..TicketEdit::default()
        },
        &validated_hash,
    );
    storage::clear_replace_seams();

    let error = outcome.expect_err("an unsafe replace is refused, not attempted");
    assert_eq!(error.code, ErrorCode::Io);
    assert!(error.recoverable, "moving the project is a way out");
    assert!(
        error.message.contains("left as it was"),
        "the message has to say the ticket is intact: {}",
        error.message,
    );
    assert_eq!(fs::read(&path).expect("untouched"), before);
    assert_eq!(leftover_temporaries(&path), Vec::<String>::new());

    // The next write on a volume that can swap still works, so the refusal is about
    // the volume and not a latch the app gets stuck behind.
    engine
        .edit_ticket(
            "LC-2",
            &TicketEdit {
                title: Some("A save on a volume that can swap".to_owned()),
                ..TicketEdit::default()
            },
            &validated_hash,
        )
        .expect("the refusal must not outlive the condition that caused it");
}

/// Every file left in a ticket directory that is not the ticket itself.
fn leftover_temporaries(ticket: &Path) -> Vec<String> {
    let directory = ticket.parent().expect("a ticket lives in a directory");
    let mut names: Vec<String> = fs::read_dir(directory)
        .expect("the ticket directory")
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name != "ticket.md")
        .collect();
    names.sort();
    names
}

/// Waits for the watcher to report `key` changing, ignoring anything else the
/// engine says on the way.
fn expect_ticket_changed(
    events: &Receiver<StreamEnvelope>,
    key: &str,
) -> longclaw_desktop_lib::core::IndexedRow {
    let deadline = Instant::now() + Duration::from_secs(10);
    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        let Ok(envelope) = events.recv_timeout(remaining) else {
            break;
        };
        if let ProjectEvent::TicketChanged { ticket, .. } = envelope.event {
            if ticket.key() == key {
                match *ticket {
                    TicketRow::Indexed(row) => return row,
                    TicketRow::Degraded(row) => {
                        panic!("{key} should be readable: {}", row.diagnostic.message)
                    }
                }
            }
        }
    }
    panic!("the external change to {key} never reached the UI");
}

#[test]
fn creating_tickets_allocates_keys_from_the_files_and_never_reuses_one() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);

    // LC-99 is the highest existing directory, so the next key follows it.
    let created = engine
        .create_ticket(&NewTicket {
            title: "Ship the storage engine".to_owned(),
            description: "Written by the app.".to_owned(),
            status: Some(Status::Todo),
            priority: Some(Priority::P1),
            checklist: vec!["Parse".to_owned(), "Write".to_owned()],
        })
        .expect("creation should be accepted");
    assert_eq!(created.ticket.key(), "LC-100");

    let raw = fs::read_to_string(ticket_path(&root, "LC-100")).expect("the new ticket.md");
    assert!(raw.starts_with("---\nformat: longclaw.ticket/v1\n"));
    assert!(raw.contains("key: LC-100\n"));
    assert!(raw.contains("kind: create\n"));
    let snapshot = engine.snapshot();
    let row = indexed(&snapshot.tickets, "LC-100");
    assert_eq!(row.title, "Ship the storage engine");
    assert_eq!(row.checklist_count, 2);
    assert_eq!(row.priority, Priority::P1);

    // Allocation reads the canonical directories, so the app never reuses a number
    // it issued: v0 has no delete operation. A directory removed outside the app is
    // no longer canonical state, and its number becomes available again — the honest
    // consequence of trusting the files rather than a device-local counter.
    fs::remove_dir_all(root.join(".longclaw/tickets/LC-100")).expect("remove the directory");
    let after_external_removal = engine
        .create_ticket(&NewTicket {
            title: "After a directory was removed outside the app".to_owned(),
            ..NewTicket::default()
        })
        .expect("creation should be accepted");
    assert_eq!(after_external_removal.ticket.key(), "LC-100");

    // Archiving is the app's own way of retiring a ticket, and it never frees a key.
    let archived = indexed(&engine.snapshot().tickets, "LC-100")
        .content_hash
        .clone();
    engine
        .edit_ticket(
            "LC-100",
            &TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
            &archived,
        )
        .expect("archiving should be accepted");
    let next = engine
        .create_ticket(&NewTicket {
            title: "After an archive".to_owned(),
            ..NewTicket::default()
        })
        .expect("creation should be accepted");
    assert_eq!(next.ticket.key(), "LC-101");
}

#[test]
fn creation_scans_the_files_rather_than_trusting_the_index() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);

    // A directory that appears without the index noticing still spends its key.
    let unseen = root.join(".longclaw/tickets/LC-500");
    fs::create_dir_all(&unseen).expect("create the directory");
    fs::write(unseen.join("ticket.md"), "not a readable ticket").expect("write it");

    let created = engine
        .create_ticket(&NewTicket {
            title: "After an unindexed directory".to_owned(),
            ..NewTicket::default()
        })
        .expect("creation should be accepted");
    assert_eq!(created.ticket.key(), "LC-501");
}

/// The project-settings surface is Step 7's. What Step 6 owes it is a write that
/// touches one line and a reload that sees the result.
#[test]
fn a_theme_change_rewrites_one_line_of_the_project_file() {
    let (_temp, root) = copy_representative_project();
    let path = root.join(".longclaw/longclaw.yaml");
    let before = fs::read_to_string(&path).expect("longclaw.yaml");

    let mut document = storage::read_project(&root).expect("the project should be readable");
    let bytes = document.set_theme("clay").expect("clay is a preset id");
    storage::atomic_write(&path, &bytes).expect("the project file should be written");

    let after = fs::read_to_string(&path).expect("longclaw.yaml");
    assert_eq!(after, before.replace("theme: indigo", "theme: clay"));
    assert_eq!(project_reference(&root).theme, "clay");

    // An opened project reports the theme its file holds.
    let (engine, _events) = start_engine(&root);
    assert_eq!(engine.snapshot().project.theme, "clay");
}

#[test]
fn initializing_a_folder_writes_a_project_and_its_agent_contract() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path().join("fresh");
    fs::create_dir_all(&root).expect("create the folder");

    let document =
        storage::initialize_project(&root, "Fresh Project", "FP", None, "2026-07-29T00:00:00Z")
            .expect("a new project should be created");
    assert_eq!(document.project().key, "FP");
    assert_eq!(document.project().theme, "indigo");

    let reference = project_reference(&root);
    assert_eq!(reference.name, "Fresh Project");
    assert!(reference.reachable);

    let contract = fs::read_to_string(storage::agent_contract_path(&root)).expect("AGENTS.md");
    assert!(contract.contains("Fresh Project"));
    assert!(contract.contains("longclaw:item="));
    assert!(
        !root.join("AGENTS.md").exists(),
        "the repository root AGENTS.md is not ours"
    );

    let error = storage::initialize_project(&root, "Again", "FP", None, "2026-07-29T00:00:00Z")
        .expect_err("an existing project must not be overwritten");
    assert_eq!(error.code, ErrorCode::InvalidProject);
}

/// A refused key must be refused before anything is created. The reported
/// onboarding bug left an empty `.longclaw/tickets/` in the user's own
/// repository and reported the refusal as an internal fault, so a user who hit a
/// validation rule was told the app had broken.
#[test]
fn a_refused_project_key_writes_nothing_and_reads_as_a_project_problem() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path().join("repo");
    fs::create_dir_all(&root).expect("create the folder");

    let error =
        storage::initialize_project(&root, "30 July 4PM", "3J4", None, "2026-07-29T00:00:00Z")
            .expect_err("a digit-leading key must be refused");

    assert_eq!(error.code, ErrorCode::InvalidProject);
    assert!(
        error.recoverable,
        "the user can fix the key and try again, so the banner must say the files were left alone"
    );
    assert!(
        error.message.contains("start with a letter"),
        "the message is read in a create form, not by a format implementer: {}",
        error.message
    );

    assert!(
        !storage::tickets_root(&root).exists(),
        "a refusal must not leave a .longclaw/tickets/ behind in the chosen folder"
    );
    assert!(!storage::project_file_path(&root).exists());
    assert_eq!(
        fs::read_dir(&root).expect("the chosen folder").count(),
        0,
        "the chosen folder must be exactly as the user left it"
    );
}

/// Every field the create form collects is validated on the same pass, for the
/// same reason: whichever one the user got wrong, the folder they chose has to
/// look untouched while they fix it.
#[test]
fn every_refused_create_field_leaves_the_folder_untouched() {
    // One character past what renaming accepts.
    let too_long = "a".repeat(121);

    for (case, name, key, theme) in [
        ("a digit-leading key", "30 July 4PM", "3J4", None),
        ("a lowercase key", "My Project", "mp", None),
        ("an empty name", "   ", "MP", None),
        // A name creation accepts but renaming would refuse is the same drift as
        // the two key validators disagreeing.
        (
            "a name past the project file's limit",
            too_long.as_str(),
            "MP",
            None,
        ),
        (
            "a theme that is not a preset id",
            "Spaced Theme",
            "ST",
            Some("indigo dark"),
        ),
    ] {
        let temp = tempfile::tempdir().expect("temporary folder");
        let root = temp.path().join("repo");
        fs::create_dir_all(&root).expect("create the folder");

        let Err(error) =
            storage::initialize_project(&root, name, key, theme, "2026-07-29T00:00:00Z")
        else {
            panic!("{case} must be refused");
        };

        assert_eq!(error.code, ErrorCode::InvalidProject, "{case}");
        assert!(error.recoverable, "{case}");
        assert_eq!(
            fs::read_dir(&root).expect("the chosen folder").count(),
            0,
            "{case} left something behind"
        );
    }
}

/// The contract's worked example carries freshly minted ids on every render, so a
/// comparison of two renders has to ignore them and nothing else.
fn without_minted_ids(contract: &str) -> String {
    contract
        .lines()
        .map(|line| match line.split_once("longclaw:item=") {
            Some((prefix, rest)) => {
                let tail = rest.split_once(' ').map(|(_, tail)| tail).unwrap_or("");
                format!("{prefix}longclaw:item=<minted> {tail}")
            }
            None => match line.split_once("id: ") {
                Some((prefix, _)) => format!("{prefix}id: <minted>"),
                None => line.to_owned(),
            },
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// The example project committed for pilots and manual runs carries the same
/// contract a created project gets, so what a real agent reads there is not a
/// stale copy of what the app generates.
#[test]
fn the_example_projects_agent_contract_matches_the_generator() {
    let (_temp, root) = copy_representative_project();
    let document = storage::read_project(&root).expect("the fixture project");

    let committed = fs::read_to_string(storage::agent_contract_path(&root))
        .expect("the fixture should carry .longclaw/AGENTS.md");
    let generated = longclaw_desktop_lib::core::project::render_agent_contract(document.project());

    assert_eq!(
        without_minted_ids(&committed),
        without_minted_ids(&generated)
    );
}

#[test]
fn search_matches_keys_titles_labels_and_descriptions() {
    let (_temp, root) = copy_representative_project();
    let (engine, _events) = start_engine(&root);

    let by_key = engine.search("lc-2");
    assert_eq!(by_key.tickets.len(), 1);
    assert_eq!(by_key.tickets[0].key(), "LC-2");

    let by_title = engine.search("unknown frontmatter");
    assert_eq!(by_title.tickets.len(), 1);
    assert_eq!(by_title.tickets[0].key(), "LC-2");

    let by_label = engine.search("reliability");
    assert_eq!(
        by_label
            .tickets
            .iter()
            .map(TicketRow::key)
            .collect::<Vec<_>>(),
        vec!["LC-2", "LC-3", "LC-4"]
    );

    let by_description = engine.search("watcher coalescing");
    assert_eq!(by_description.tickets.len(), 1);
    assert_eq!(by_description.tickets[0].key(), "LC-3");

    // A degraded row has no trustworthy text, so only its key matches.
    let degraded = engine.search("LC-98");
    assert_eq!(degraded.tickets.len(), 1);
    assert!(degraded.tickets[0].is_degraded());
    assert!(engine.search("Broken fixture").tickets.is_empty());

    assert_eq!(engine.search("").tickets.len(), 6);
    assert!(engine.search("nothing here matches").tickets.is_empty());
}

#[test]
fn a_missing_project_folder_is_reported_and_its_files_are_left_alone() {
    let (temp, root) = copy_representative_project();
    let (engine, events) = start_engine(&root);
    let moved = temp.path().join("moved-elsewhere");
    fs::rename(&root, &moved).expect("move the project folder");

    let error = engine
        .rebuild(RebuildReason::Resume, true)
        .expect_err("a missing folder cannot be rebuilt");
    assert_eq!(error.code, ErrorCode::ProjectUnavailable);
    let event = events
        .recv_timeout(std::time::Duration::from_secs(2))
        .expect("an unavailable event");
    assert_eq!(
        serde_json::to_value(&event.event).expect("serializable")["type"],
        "projectUnavailable"
    );
    assert!(moved.join(".longclaw/longclaw.yaml").is_file());
}
