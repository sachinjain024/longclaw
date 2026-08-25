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

/// The key a create returned. Nothing below composes one: a minted key carries
/// a trailing character drawn at random (LC-232), so the caller learns its key
/// from the surface that allocated it — which is the point of the surface.
fn key_of(created: &Value) -> String {
    created["key"]
        .as_str()
        .unwrap_or_else(|| panic!("a create returns a key, got {created:?}"))
        .to_owned()
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

    common::assert_minted(&key_of(&first), 1);
    common::assert_minted(&key_of(&second), 2);
    assert!(common::ticket_path(&root, &key_of(&first)).is_file());
    assert!(common::ticket_path(&root, &key_of(&second)).is_file());
    // The two keys differ in more than their number, which is the collision
    // this suffix exists to survive when the numbers agree.
    assert_ne!(key_of(&first), key_of(&second));
}

/// The format contract's rule, held at the surface that made it reachable: an
/// actor is declared. The agent flags are the declaration, and their absence
/// declares the person who typed the command.
#[test]
fn an_agent_is_recorded_as_an_agent_and_a_person_as_themselves() {
    let (_temp, root) = common::new_project("actors", "LC");

    let agent_ticket = run(
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
    let human_ticket = run(
        &root,
        &["ticket", "create", "--title", "Written by a person"],
    );

    let agent = read(&root, &key_of(&agent_ticket));
    assert!(agent.contains("actor:\n  type: agent\n"), "{agent}");
    assert!(agent.contains("  id: claude-code\n"), "{agent}");
    assert!(agent.contains("  name: Claude Code\n"), "{agent}");
    assert!(
        agent.contains("### Claude Code created this ticket"),
        "{agent}"
    );

    let person = read(&root, &key_of(&human_ticket));
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
    let key = key_of(&created);
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
            key.as_str(),
            "--move-item",
            &ids[2],
            "--after",
            &ids[0],
        ],
    );
    assert_eq!(texts(&moved), ["first", "third", "second"]);

    let promoted = run(
        &root,
        &["ticket", "edit", key.as_str(), "--move-item", &ids[1]],
    );
    assert_eq!(texts(&promoted), ["second", "first", "third"]);

    let raw = read(&root, &key);
    assert!(
        raw.contains(&format!("field: checklist.{}.moved", ids[1])),
        "{raw}"
    );

    assert_eq!(
        refuse(&root, &["ticket", "edit", key.as_str(), "--after", &ids[0]]),
        "--after needs --move-item"
    );
}

/// Rewording and removing a row are the same kind of thing as reordering one:
/// the line carries an id, and a hand-edit that retyped it would carry the id
/// away with the words (LC-215).
#[test]
fn an_item_can_be_reworded_and_removed_by_id() {
    let (_temp, root) = common::new_project("edit-items", "LC");
    let created = run(
        &root,
        &[
            "ticket",
            "create",
            "--title",
            "Editable work",
            "--checklist",
            "first",
            "--checklist",
            "second",
        ],
    );
    let key = key_of(&created);
    let ids: Vec<String> = created["ticket"]["checklist"]
        .as_array()
        .expect("a created checklist")
        .iter()
        .map(|item| item["id"].as_str().expect("an id").to_owned())
        .collect();

    let reworded = run(
        &root,
        &[
            "ticket",
            "edit",
            key.as_str(),
            "--edit-item",
            &ids[0],
            "--item-text",
            "first, reworded",
        ],
    );
    let items = reworded["ticket"]["checklist"]
        .as_array()
        .expect("a checklist");
    assert_eq!(items[0]["text"], "first, reworded");
    // The id survives the rewording, which is the whole reason this is a
    // command rather than an edit to the line.
    assert_eq!(items[0]["id"], ids[0].as_str());

    let removed = run(
        &root,
        &["ticket", "edit", key.as_str(), "--remove-item", &ids[0]],
    );
    let left = removed["ticket"]["checklist"]
        .as_array()
        .expect("a checklist");
    assert_eq!(left.len(), 1);
    assert_eq!(left[0]["id"], ids[1].as_str());

    let raw = read(&root, &key);
    assert!(
        raw.contains(&format!("field: checklist.{}.removed", ids[0])),
        "{raw}"
    );
    assert!(!raw.contains(&format!("longclaw:item={}", ids[0])), "{raw}");

    assert_eq!(
        refuse(
            &root,
            &["ticket", "edit", key.as_str(), "--edit-item", &ids[1]]
        ),
        "--edit-item needs --item-text"
    );
    assert_eq!(
        refuse(
            &root,
            &["ticket", "edit", key.as_str(), "--item-text", "orphaned"]
        ),
        "--item-text needs --edit-item"
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
    let key = key_of(&created);
    let item = created["ticket"]["checklist"][0]["id"]
        .as_str()
        .expect("a created checklist item carries an id")
        .to_owned();

    let edited = run(
        &root,
        &[
            "ticket",
            "edit",
            key.as_str(),
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
    let raw = read(&root, &key);
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
    let key = key_of(&run(&root, &["ticket", "create", "--title", "Contended"]));
    let stale = storage::read_ticket_detail(&root, "LC", &key)
        .expect("the ticket reads")
        .content_hash;

    run(&root, &["ticket", "edit", key.as_str(), "--priority", "p1"]);

    let error = storage::prepare_ticket_edit(
        &root,
        "LC",
        &key,
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
    let raw = read(&root, &key);
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
    assert!(storage::scan_ticket_paths(&root)
        .expect("the tickets folder reads")
        .is_empty());

    let created = run(
        &root,
        &[
            "ticket", "create", "--title", "Correct", "--label", "storage",
        ],
    );
    common::assert_minted(&key_of(&created), 1);
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
    assert!(storage::scan_ticket_paths(&root)
        .expect("the tickets folder reads")
        .is_empty());

    let next = run(&root, &["ticket", "create", "--title", "After the refusal"]);
    common::assert_minted(&key_of(&next), 1);
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
    // `ticket show` takes the key the create handed back, suffix and all.
    let reread = run(&root, &["ticket", "show", key_of(&created).as_str()]);
    assert_eq!(reread["ticket"]["description"], description);
}

/// The projection half: every ticket, as the app's own row shape.
#[test]
fn list_reports_every_ticket_including_one_it_cannot_parse() {
    let (_temp, root) = common::new_project("list", "LC");
    let readable = key_of(&run(&root, &["ticket", "create", "--title", "Readable"]));
    // An unsuffixed directory alongside a suffixed one: both forms are keys, and
    // the older shape has to keep reading (LC-232).
    fs::create_dir_all(root.join(".longclaw/tickets/LC-2")).expect("a second ticket directory");
    fs::write(common::ticket_path(&root, "LC-2"), "not a ticket at all")
        .expect("the degraded ticket writes");

    let rows = run(&root, &["ticket", "list"]);
    let rows = rows.as_array().expect("list returns an array");

    assert_eq!(rows.len(), 2);
    assert!(rows
        .iter()
        .any(|row| row["key"] == readable.as_str() && row["title"] == "Readable"));
    assert!(rows
        .iter()
        .any(|row| row["key"] == "LC-2" && row["diagnostic"].is_object()));
}

/// The fallback the suffix leaves behind (LC-232). One character makes two
/// branches agree about 4% of the time; this is what a person runs when they do.
#[test]
fn renumber_rekeys_one_of_a_pair_and_reports_what_still_names_the_old_key() {
    let (_temp, root) = common::new_project("renumber", "LC");
    let created = run(&root, &["ticket", "create", "--title", "The survivor"]);
    let key = key_of(&created);
    let id = created["ticket"]["id"]
        .as_str()
        .expect("a ticket carries an id")
        .to_owned();

    // A file that quotes the key, a file that quotes a key the old one is a
    // prefix of, and a file that quotes neither.
    fs::write(root.join("plan.md"), format!("See {key} for the rest.\n"))
        .expect("a referencing file");
    fs::write(
        root.join("longer.md"),
        format!("{key}9 and {key}z are other keys.\n"),
    )
    .expect("a near-miss file");
    fs::write(root.join("unrelated.md"), "Nothing to do with it.\n").expect("a quiet file");

    let renumbered = run(
        &root,
        &["ticket", "renumber", key.as_str(), "--id", id.as_str()],
    );
    let new_key = renumbered["to"].as_str().expect("a new key").to_owned();

    assert_eq!(renumbered["from"], key.as_str());
    assert_ne!(new_key, key);
    // The number is kept and only the trailing character moves, so a reference
    // that names the number is still pointing at the right work.
    assert_eq!(common::number_of(&new_key), common::number_of(&key));
    common::assert_minted(&new_key, common::number_of(&key));

    // The directory moved rather than being copied.
    assert!(!root.join(".longclaw/tickets").join(&key).exists());
    let raw = read(&root, &new_key);
    assert!(raw.contains(&format!("key: {new_key}\n")), "{raw}");
    assert!(raw.contains(&format!("id: {id}\n")), "{raw}");
    // The history names the key it used to carry, so someone following a link to
    // the old one lands in a file that says what happened.
    assert!(
        raw.contains(&format!("### You renumbered this ticket from {key}")),
        "{raw}"
    );
    assert!(raw.contains(&format!("    from: {key}\n")), "{raw}");
    assert!(raw.contains(&format!("    to: {new_key}\n")), "{raw}");

    // The references are reported, not rewritten: they are not this app's files.
    let references: Vec<&str> = renumbered["references"]
        .as_array()
        .expect("a reference list")
        .iter()
        .map(|path| path.as_str().expect("a path"))
        .collect();
    assert!(references.contains(&"plan.md"), "{references:?}");
    assert!(!references.contains(&"longer.md"), "{references:?}");
    assert!(!references.contains(&"unrelated.md"), "{references:?}");
    assert_eq!(
        fs::read_to_string(root.join("plan.md")).unwrap(),
        format!("See {key} for the rest.\n")
    );
    assert_eq!(renumbered["referencesTruncated"], false);

    // The renumbered ticket's own file names the old key on purpose, so it is not
    // reported as a reference that needs following.
    assert!(
        !references.iter().any(|path| path.contains(&new_key)),
        "{references:?}"
    );

    // And the key it left behind is free again, which is the whole point: the
    // other half of the collision keeps the key every reference already names.
    fs::create_dir_all(root.join(".longclaw/tickets").join(&key))
        .expect("the freed key is available");
}

/// The id is what says *which* of the two, and a mismatch is refused rather than
/// resolved. Two collided tickets share a key and a path; the id is the only
/// thing that tells them apart.
#[test]
fn renumber_refuses_a_ticket_whose_id_is_not_the_one_named() {
    let (_temp, root) = common::new_project("renumber-id", "LC");
    let created = run(&root, &["ticket", "create", "--title", "Not this one"]);
    let key = key_of(&created);

    let message = refuse(
        &root,
        &[
            "ticket",
            "renumber",
            key.as_str(),
            "--id",
            "00000000-0000-4000-8000-000000000000",
        ],
    );
    assert!(message.contains(&key), "{message}");
    assert!(
        message.contains("00000000-0000-4000-8000-000000000000"),
        "{message}"
    );
    // Nothing moved.
    assert!(common::ticket_path(&root, &key).is_file());

    assert_eq!(
        refuse(&root, &["ticket", "renumber", key.as_str()]),
        "--id is required"
    );
}

/// Both forms are keys, so the command takes the ones minted before the suffix
/// existed as readily as the ones minted after it (LC-232).
#[test]
fn renumber_takes_a_key_that_was_minted_before_the_suffix() {
    let (_temp, root) = common::new_project("renumber-old", "LC");
    let created = run(&root, &["ticket", "create", "--title", "Older shape"]);
    let minted = key_of(&created);

    // The shape `LC-1` … `LC-233` are in: a directory and a frontmatter key with
    // no trailing character.
    let unsuffixed = "LC-1";
    let raw = read(&root, &minted).replace(&format!("key: {minted}"), "key: LC-1");
    fs::create_dir_all(root.join(".longclaw/tickets").join(unsuffixed)).expect("the old shape");
    fs::write(common::ticket_path(&root, unsuffixed), &raw).expect("the old ticket writes");
    fs::remove_dir_all(root.join(".longclaw/tickets").join(&minted)).expect("only one of them");

    let id = created["ticket"]["id"].as_str().expect("an id").to_owned();
    let renumbered = run(
        &root,
        &["ticket", "renumber", unsuffixed, "--id", id.as_str()],
    );
    let new_key = renumbered["to"].as_str().expect("a new key");
    common::assert_minted(new_key, 1);
    assert!(common::ticket_path(&root, new_key).is_file());
    assert!(!common::ticket_path(&root, unsuffixed).exists());
}

/// A key with nowhere to go is refused rather than silently reused. Every
/// trailing character on the number is taken, so the answer is to renumber one of
/// the others first.
#[test]
fn renumber_refuses_when_the_whole_number_is_taken() {
    let (_temp, root) = common::new_project("renumber-full", "LC");
    let created = run(&root, &["ticket", "create", "--title", "Crowded"]);
    let key = key_of(&created);
    let id = created["ticket"]["id"].as_str().expect("an id").to_owned();

    for character in "abcdefghijklmnopqrstuvwxyz".chars() {
        let taken = root
            .join(".longclaw/tickets")
            .join(format!("LC-1{character}"));
        if !taken.exists() {
            fs::create_dir_all(&taken).expect("a taken key");
        }
    }

    let message = refuse(
        &root,
        &["ticket", "renumber", key.as_str(), "--id", id.as_str()],
    );
    assert!(message.contains("already taken"), "{message}");
    assert!(common::ticket_path(&root, &key).is_file(), "nothing moved");
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
