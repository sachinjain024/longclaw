//! `longclaw`, the command-line creation surface.
//!
//! Until this existed, the only way to create a project or a ticket was the
//! app's own window. That was a deliberate v0 boundary — LongClaw owns key
//! allocation, and an agent forbidden from minting a key had no other door — but
//! it also meant that a defect found while building LongClaw was written into
//! `docs/plans/` instead of into a ticket, and that this repository could not
//! track its own work. This is that door.
//!
//! Three things keep it from being a second implementation of the format:
//!
//! - **It allocates nothing itself.** `storage::prepare_new_ticket_as` scans the
//!   canonical directory names and claims the next key with `create_new`
//!   semantics, which is the same call the app makes and the reason two racing
//!   creations cannot land on one key. This module never composes a key.
//! - **It writes through the same seam.** A create goes out through
//!   `atomic_write`, an edit through `atomic_replace` carrying the hash of the
//!   bytes it read, so a stale command is refused rather than written — the same
//!   protection the app's conflict banner rests on.
//! - **It does not start an engine.** No watcher, no index, no event stream. A
//!   short-lived process has nothing to keep in sync, and the running app treats
//!   these writes as exactly what they are: an external edit, which is a case it
//!   is already built to notice and absorb.
//!
//! The one thing it adds is attribution. `render_event` used to hardcode the
//! local human actor, which is right for the person at the keyboard and wrong
//! for an agent — and the format contract is explicit that actor type is
//! declared rather than inferred. So an agent passes `--agent-id`, and the
//! activity record says so. Without it, a command is what it looks like: you, at
//! a terminal, editing your own project.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use chrono::{SecondsFormat, Utc};
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::core::project::{ProjectDocument, DEFAULT_LABEL_COLOR};
use crate::core::storage::{self, NewTicket};
use crate::core::ticket::{
    Actor, ChecklistMove, ChecklistTextEdit, ChecklistToggle, Priority, Status, TicketEdit,
};
use crate::core::{AppError, AppResult, ErrorCode, ProjectReference};

/// The bundle identifier, which is also the folder the app keeps its project
/// registry in. `identifier_matches_the_bundle` holds this against
/// `tauri.conf.json` so the CLI and the app cannot drift onto two registries.
const APP_IDENTIFIER: &str = "io.longclaw.desktop";

const USAGE: &str = "\
longclaw — the LongClaw command line

USAGE
  longclaw <command> [options]

PROJECT
  project init      --name <name> --key <KEY> [--theme <id>] [--path <dir>]
  project show      [--path <dir>]
  project register  [--path <dir>]
  label add         --slug <slug> --name <name> [--color <color>] [--path <dir>]

TICKETS
  ticket create     --title <title> [--description <text> | --description-file <file>]
                    [--status <status>] [--priority <priority>]
                    [--label <slug>]... [--checklist <item>]... [--path <dir>]
  ticket edit <KEY> [--title <title>] [--status <status>] [--priority <priority>]
                    [--label <slug>]... [--clear-labels]
                    [--description <text> | --description-file <file>]
                    [--check <item-id>]... [--uncheck <item-id>]...
                    [--add-checklist <item>]... [--comment <text>]
                    [--move-item <item-id> [--after <item-id>]]
                    [--edit-item <item-id> --item-text <text>]
                    [--remove-item <item-id>]
                    [--archive | --unarchive] [--path <dir>]
  ticket list       [--path <dir>]
  ticket show <KEY> [--path <dir>]
  ticket renumber <KEY> --id <uuid> [--path <dir>]
                    Give one of two tickets that were minted with the same key
                    a different trailing character. --id names which of them,
                    because a collided pair shares everything else. Prints the
                    new key and every path that still mentions the old one.

  status    backlog | todo | in_progress | in_review | done | canceled
  priority  urgent | p1 | p2 | p3 | p4 | none

ATTRIBUTION
  --agent-id <id> [--agent-name <name>]
                    Record the activity entry as an agent rather than as you.
                    An agent must pass it: the file format declares an actor
                    and never infers one.

Commands print JSON on stdout. A failure prints the typed error on stderr and
exits non-zero. --path defaults to the current directory.
";

/// The entry point `src/bin/longclaw.rs` calls.
pub fn run() -> ExitCode {
    let arguments: Vec<String> = env::args().skip(1).collect();
    match dispatch(&arguments) {
        Ok(Some(value)) => {
            println!("{}", render(&value));
            ExitCode::SUCCESS
        }
        Ok(None) => {
            print!("{USAGE}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("{}", render(&json!({ "error": error })));
            ExitCode::FAILURE
        }
    }
}

fn render(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|error| {
        format!("{{\"error\":{{\"message\":\"could not serialize output: {error}\"}}}}")
    })
}

/// `Ok(None)` means the caller asked for usage rather than for work.
pub fn dispatch(arguments: &[String]) -> AppResult<Option<Value>> {
    let words: Vec<&str> = arguments
        .iter()
        .take_while(|argument| !argument.starts_with("--"))
        .map(String::as_str)
        .collect();
    let command = words.first().copied().unwrap_or("");
    let subcommand = words.get(1).copied().unwrap_or("");

    if command.is_empty() || command == "help" {
        return Ok(None);
    }
    let rest = &arguments[words.len().min(2).min(arguments.len())..];

    match (command, subcommand) {
        ("project", "init") => project_init(rest).map(Some),
        ("project", "show") => project_show(rest).map(Some),
        ("project", "register") => project_register(rest).map(Some),
        ("label", "add") => label_add(rest).map(Some),
        ("ticket", "create") => ticket_create(rest).map(Some),
        ("ticket", "edit") => ticket_edit(rest).map(Some),
        ("ticket", "list") => ticket_list(rest).map(Some),
        ("ticket", "show") => ticket_show(rest).map(Some),
        ("ticket", "renumber") => ticket_renumber(rest).map(Some),
        _ => Err(usage_error(format!(
            "Unknown command {:?}",
            words.join(" ").trim()
        ))),
    }
}

// ------------------------------------------------------------------- commands

fn project_init(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path", "name", "key", "theme"], &[])?;
    let root = existing_directory(&options)?;
    let name = options.require("name")?;
    let key = options.require("key")?;
    let theme = options.one("theme")?.unwrap_or("indigo");
    // Through the registry, not around it: creating a project the app cannot see
    // in its project list is a worse answer than not creating one.
    let project = state()?.create_project(root, name, key, theme)?;
    Ok(json!(project))
}

fn project_show(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path"], &[])?;
    let (root, document) = open_project(&options)?;
    Ok(json!(reference(&document, &root)))
}

fn project_register(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path"], &[])?;
    let root = existing_directory(&options)?;
    Ok(json!(state()?.register_project(root)?))
}

fn label_add(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path", "slug", "name", "color"], &[])?;
    let (root, mut document) = open_project(&options)?;
    let slug = options.require("slug")?;
    let name = options.require("name")?;
    let color = options.one("color")?.unwrap_or(DEFAULT_LABEL_COLOR);
    let bytes = document
        .add_label(slug, name, color)
        .map_err(AppError::from)?;
    storage::atomic_write(
        "Saving project settings",
        &storage::project_file_path(&root),
        &bytes,
    )?;
    // The contract names the project, so a rename or a label change reprints it.
    storage::write_agent_contract(&root, &document)?;
    Ok(json!(reference(&document, &root)))
}

fn ticket_create(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(
        arguments,
        &[
            "path",
            "title",
            "description",
            "description-file",
            "status",
            "priority",
            "label",
            "checklist",
            "agent-id",
            "agent-name",
        ],
        &[],
    )?;
    let (root, document) = open_project(&options)?;
    let labels = options.many("label");
    known_labels(&document, &labels)?;
    let request = NewTicket {
        title: options.require("title")?.to_owned(),
        description: description(&options)?.unwrap_or_default(),
        status: status(&options)?,
        priority: priority(&options)?,
        labels,
        checklist: options.many("checklist"),
    };
    let project_key = document.project().key.clone();
    let write =
        storage::prepare_new_ticket_as(&root, &project_key, &request, &now(), &author(&options)?)?;
    // The directory is claimed before the bytes are rendered, so a write that
    // fails has to hand it back. The key stays spent either way: numbers are
    // never reused, which is the rule the whole allocation scheme rests on.
    if let Err(error) = storage::atomic_write("Creating the ticket", &write.path, &write.bytes) {
        storage::discard_claimed_ticket_directory(&write.path);
        return Err(error);
    }
    Ok(json!(storage::read_ticket_detail(
        &root,
        &project_key,
        &write.key
    )?))
}

fn ticket_edit(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(
        arguments,
        &[
            "path",
            "title",
            "description",
            "description-file",
            "status",
            "priority",
            "label",
            "check",
            "uncheck",
            "add-checklist",
            "move-item",
            "after",
            "edit-item",
            "item-text",
            "remove-item",
            "comment",
            "agent-id",
            "agent-name",
        ],
        &["clear-labels", "archive", "unarchive"],
    )?;
    let key = options.subject()?;
    let (root, document) = open_project(&options)?;
    let project_key = document.project().key.clone();

    let labels = options.many("label");
    let labels = match (labels.is_empty(), options.has("clear-labels")) {
        (_, true) if !labels.is_empty() => {
            return Err(usage_error("--clear-labels and --label disagree"))
        }
        (_, true) => Some(Vec::new()),
        (true, false) => None,
        (false, false) => {
            known_labels(&document, &labels)?;
            Some(labels)
        }
    };
    let archived = match (options.has("archive"), options.has("unarchive")) {
        (true, true) => return Err(usage_error("--archive and --unarchive disagree")),
        (true, false) => Some(true),
        (false, true) => Some(false),
        (false, false) => None,
    };
    let edit = TicketEdit {
        title: options.one("title")?.map(str::to_owned),
        status: status(&options)?,
        priority: priority(&options)?,
        labels,
        rank: None,
        archived,
        description: description(&options)?,
        checklist: toggles(&options),
        move_checklist_item: moved_item(&options)?,
        edit_checklist_item: edited_item(&options)?,
        remove_checklist_item: options.one("remove-item")?.map(str::to_owned),
        // Not offered: it exists so the app can undo a removal, and an agent
        // that wants a row back can add one.
        restore_checklist_item: None,
        add_checklist_items: options.many("add-checklist"),
        comment: options.one("comment")?.map(str::to_owned),
        // Not offered, for the reason `restore_checklist_item` is not: these
        // three exist so the app's own gestures — the pencil, the cross, and
        // the undo that takes it back — can be written (LC-241q). An agent
        // that wants to say something else can say it in a new comment, which
        // is what an append-only history is for; the core would refuse it any
        // comment but its own in any case.
        edit_comment: None,
        remove_comment: None,
        restore_comment: None,
    };

    // Read, then write against the hash that read saw. The gap between them is
    // real, and `atomic_replace` is what closes it: it confirms the bytes it
    // displaced were still the ones this edit was built from, so a change that
    // landed in between is a typed conflict rather than a silent overwrite.
    let current = storage::read_ticket_detail(&root, &project_key, &key)?;
    let write = storage::prepare_ticket_edit_as(
        &root,
        &project_key,
        &key,
        &edit,
        &current.content_hash,
        &now(),
        &author(&options)?,
    )?;
    storage::atomic_replace(
        &write.path,
        &write.bytes,
        write.expected_hash.as_deref().unwrap_or_default(),
    )?;
    Ok(json!(storage::read_ticket_detail(
        &root,
        &project_key,
        &key
    )?))
}

fn ticket_list(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path"], &[])?;
    let (root, document) = open_project(&options)?;
    let project_key = document.project().key.clone();
    let mut rows = Vec::new();
    for path in storage::scan_ticket_paths(&root)? {
        rows.push(storage::read_ticket_file(&path, &project_key)?.row());
    }
    Ok(json!(rows))
}

fn ticket_show(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path"], &[])?;
    let key = options.subject()?;
    let (root, document) = open_project(&options)?;
    Ok(json!(storage::read_ticket_detail(
        &root,
        &document.project().key,
        &key
    )?))
}

/// The other half of the suffix (LC-232): one character makes two branches agree
/// about 4% of the time, and this is what a person runs when they do.
///
/// It is a command rather than an instruction to move the folder because a ticket
/// key and its directory are one identity — renaming the folder alone leaves a
/// file the parser refuses, and rewriting the frontmatter alone leaves the same.
fn ticket_renumber(arguments: &[String]) -> AppResult<Value> {
    let options = Options::parse(arguments, &["path", "id", "agent-id", "agent-name"], &[])?;
    let key = options.subject()?;
    let (root, document) = open_project(&options)?;
    let id = options.require("id")?;
    Ok(json!(storage::renumber_ticket_as(
        &root,
        &document.project().key,
        &key,
        id,
        &now(),
        &author(&options)?,
    )?))
}

// -------------------------------------------------------------------- helpers

fn state() -> AppResult<AppState> {
    AppState::new(&app_data_dir()?)
}

/// Where the app keeps its project registry. Tauri resolves this from the bundle
/// identifier; the CLI has no Tauri context, so it composes the same path. The
/// environment override exists for the tests, which must not touch a real one.
fn app_data_dir() -> AppResult<PathBuf> {
    if let Some(directory) = env::var_os("LONGCLAW_DATA_DIR") {
        return Ok(PathBuf::from(directory));
    }
    let home = env::var_os("HOME").ok_or_else(|| {
        AppError::new(
            ErrorCode::Io,
            "HOME is not set, so the project registry cannot be located",
            false,
        )
    })?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join(APP_IDENTIFIER))
}

fn existing_directory(options: &Options) -> AppResult<PathBuf> {
    let raw = options.one("path")?.unwrap_or(".");
    let path = Path::new(raw);
    path.canonicalize()
        .map_err(|error| AppError::io("Resolving the project folder", path, error))
}

fn open_project(options: &Options) -> AppResult<(PathBuf, ProjectDocument)> {
    let root = existing_directory(options)?;
    let document = storage::read_project(&root)?;
    Ok((root, document))
}

fn reference(document: &ProjectDocument, root: &Path) -> ProjectReference {
    ProjectReference::from_project(document.project(), root.display().to_string())
}

/// A label a ticket carries but the project never defined renders as its own
/// slug, with no name and no colour. Refusing here keeps that state to files
/// LongClaw did not write.
fn known_labels(document: &ProjectDocument, labels: &[String]) -> AppResult<()> {
    for label in labels {
        if !document.project().labels.contains_key(label) {
            return Err(AppError::new(
                ErrorCode::ParseFailed,
                format!(
                    "The label {label:?} is not defined in this project. \
                     Define it first with: longclaw label add --slug {label} --name <name>"
                ),
                true,
            ));
        }
    }
    Ok(())
}

fn description(options: &Options) -> AppResult<Option<String>> {
    match (
        options.one("description")?,
        options.one("description-file")?,
    ) {
        (Some(_), Some(_)) => Err(usage_error("--description and --description-file disagree")),
        (Some(text), None) => Ok(Some(text.to_owned())),
        (None, Some(file)) => {
            let path = Path::new(file);
            let text = fs::read_to_string(path)
                .map_err(|error| AppError::io("Reading the description", path, error))?;
            Ok(Some(text))
        }
        (None, None) => Ok(None),
    }
}

fn status(options: &Options) -> AppResult<Option<Status>> {
    let Some(value) = options.one("status")? else {
        return Ok(None);
    };
    Status::ALL
        .into_iter()
        .find(|candidate| candidate.as_str() == value)
        .map(Some)
        .ok_or_else(|| {
            usage_error(format!(
                "status is one of {}; found {value:?}",
                joined(Status::ALL.map(Status::as_str))
            ))
        })
}

fn priority(options: &Options) -> AppResult<Option<Priority>> {
    let Some(value) = options.one("priority")? else {
        return Ok(None);
    };
    Priority::ALL
        .into_iter()
        .find(|candidate| candidate.as_str() == value)
        .map(Some)
        .ok_or_else(|| {
            usage_error(format!(
                "priority is one of {}; found {value:?}",
                joined(Priority::ALL.map(Priority::as_str))
            ))
        })
}

fn toggles(options: &Options) -> Vec<ChecklistToggle> {
    let checked = options.many("check").into_iter().map(|id| (id, true));
    let cleared = options.many("uncheck").into_iter().map(|id| (id, false));
    checked
        .chain(cleared)
        .map(|(item_id, checked)| ChecklistToggle { item_id, checked })
        .collect()
}

/// The reorder an edit carries, if it carries one. `--after` names the item the
/// moved one now follows; without it the item goes to the top, which is the one
/// landing no other item can name.
fn moved_item(options: &Options) -> AppResult<Option<ChecklistMove>> {
    let after = options.one("after")?.map(str::to_owned);
    match options.one("move-item")? {
        Some(item_id) => Ok(Some(ChecklistMove {
            item_id: item_id.to_owned(),
            after,
        })),
        None if after.is_some() => Err(usage_error("--after needs --move-item")),
        None => Ok(None),
    }
}

/// The retyped item an edit carries, if it carries one. Two flags rather than
/// one `id=text` pair, because an item's text is prose and would have to be
/// escaped around whatever separator was chosen.
fn edited_item(options: &Options) -> AppResult<Option<ChecklistTextEdit>> {
    let text = options.one("item-text")?.map(str::to_owned);
    match (options.one("edit-item")?, text) {
        (Some(item_id), Some(text)) => Ok(Some(ChecklistTextEdit {
            item_id: item_id.to_owned(),
            text,
        })),
        (Some(_), None) => Err(usage_error("--edit-item needs --item-text")),
        (None, Some(_)) => Err(usage_error("--item-text needs --edit-item")),
        (None, None) => Ok(None),
    }
}

/// The actor to record. Absent agent flags mean the person who typed the
/// command, which is the local human actor the app itself writes (ADR 0001).
fn author(options: &Options) -> AppResult<Actor> {
    match (options.one("agent-id")?, options.one("agent-name")?) {
        (Some(id), name) => {
            single_line("--agent-id", id)?;
            if let Some(name) = name {
                single_line("--agent-name", name)?;
            }
            Ok(Actor::agent(id, name))
        }
        (None, Some(_)) => Err(usage_error("--agent-name needs --agent-id")),
        (None, None) => Ok(Actor::local_human()),
    }
}

fn single_line(option: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() || value.contains('\n') {
        return Err(usage_error(format!("{option} is a single non-empty line")));
    }
    Ok(())
}

/// Milliseconds, because `engine::now` writes milliseconds.
///
/// The timeline sorts by instant and breaks a tie on the event id, which is
/// random. At second precision two writes a moment apart tie, so their order
/// comes out of the id rather than out of what happened — the import that
/// seeded this repository rendered "updated this ticket" above "created this
/// ticket" on 15 of 33 tickets before this was found. The app never had the
/// problem; matching it is the whole fix.
fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn joined<const N: usize>(values: [&str; N]) -> String {
    values.join(", ")
}

fn usage_error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::ParseFailed, message, true)
}

// ------------------------------------------------------------------- options

/// The parsed tail of a command line.
///
/// Unknown options are refused rather than ignored. A silently dropped
/// `--descriptoin` writes an empty description into every ticket of an import
/// run and says nothing, which is the failure this guard exists for.
#[derive(Debug)]
struct Options {
    values: BTreeMap<String, Vec<String>>,
    positional: Vec<String>,
}

impl Options {
    fn parse(arguments: &[String], flags: &[&str], switches: &[&str]) -> AppResult<Self> {
        let mut values: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut positional = Vec::new();
        let mut index = 0;
        while index < arguments.len() {
            let argument = &arguments[index];
            index += 1;
            let Some(rest) = argument.strip_prefix("--") else {
                positional.push(argument.clone());
                continue;
            };
            let (name, inline) = match rest.split_once('=') {
                Some((name, value)) => (name, Some(value.to_owned())),
                None => (rest, None),
            };
            if switches.contains(&name) {
                if inline.is_some() {
                    return Err(usage_error(format!("--{name} takes no value")));
                }
                values
                    .entry(name.to_owned())
                    .or_default()
                    .push(String::new());
                continue;
            }
            if !flags.contains(&name) {
                let mut known: Vec<String> = flags
                    .iter()
                    .chain(switches.iter())
                    .map(|known| format!("--{known}"))
                    .collect();
                known.sort();
                return Err(usage_error(format!(
                    "Unknown option --{name}. This command takes {}",
                    known.join(", ")
                )));
            }
            let value = match inline {
                Some(value) => value,
                None => {
                    let Some(value) = arguments.get(index) else {
                        return Err(usage_error(format!("--{name} needs a value")));
                    };
                    index += 1;
                    value.clone()
                }
            };
            values.entry(name.to_owned()).or_default().push(value);
        }
        Ok(Self { values, positional })
    }

    /// A single occurrence. Repeating an option that means one thing is a
    /// mistake worth naming, not a last-one-wins.
    fn one(&self, name: &str) -> AppResult<Option<&str>> {
        match self.values.get(name).map(Vec::as_slice) {
            None => Ok(None),
            Some([only]) => Ok(Some(only.as_str())),
            Some(_) => Err(usage_error(format!("--{name} was given more than once"))),
        }
    }

    fn require(&self, name: &str) -> AppResult<&str> {
        self.one(name)?
            .ok_or_else(|| usage_error(format!("--{name} is required")))
    }

    fn many(&self, name: &str) -> Vec<String> {
        self.values.get(name).cloned().unwrap_or_default()
    }

    fn has(&self, name: &str) -> bool {
        self.values.contains_key(name)
    }

    /// The ticket key a command acts on.
    fn subject(&self) -> AppResult<String> {
        match self.positional.as_slice() {
            [key] => Ok(key.clone()),
            [] => Err(usage_error("This command needs a ticket key, such as LC-1")),
            _ => Err(usage_error(format!(
                "This command takes one ticket key; found {}",
                self.positional.join(", ")
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| (*word).to_owned()).collect()
    }

    /// The CLI writes to the same registry the app reads. It composes that path
    /// from a constant, and a constant is exactly the kind of thing that drifts
    /// silently when a bundle is renamed, so it is held against the source.
    #[test]
    fn identifier_matches_the_bundle() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("config parses");
        assert_eq!(config["identifier"], APP_IDENTIFIER);
    }

    #[test]
    fn an_unknown_option_is_refused_rather_than_ignored() {
        let error = Options::parse(&arguments(&["--descriptoin", "x"]), &["description"], &[])
            .expect_err("the typo should be refused");
        assert!(error.message.contains("--descriptoin"), "{error:?}");
        assert!(error.message.contains("--description"), "{error:?}");
    }

    #[test]
    fn a_repeated_single_option_is_refused() {
        let options = Options::parse(
            &arguments(&["--title", "one", "--title", "two"]),
            &["title"],
            &[],
        )
        .expect("parsing accepts the repeat");
        assert!(options.one("title").is_err());
    }

    #[test]
    fn repeatable_options_keep_their_order() {
        let options = Options::parse(
            &arguments(&["--label", "storage", "--label=frontend"]),
            &["label"],
            &[],
        )
        .expect("both forms parse");
        assert_eq!(options.many("label"), vec!["storage", "frontend"]);
    }

    #[test]
    fn a_switch_takes_no_value() {
        let options = Options::parse(&arguments(&["--archive"]), &[], &["archive"])
            .expect("the switch parses");
        assert!(options.has("archive"));
        assert!(!options.has("unarchive"));
        assert!(Options::parse(&arguments(&["--archive=yes"]), &[], &["archive"]).is_err());
    }

    #[test]
    fn agent_flags_declare_an_agent_and_their_absence_declares_you() {
        let agent = Options::parse(
            &arguments(&["--agent-id", "claude-code", "--agent-name", "Claude Code"]),
            &["agent-id", "agent-name"],
            &[],
        )
        .expect("the flags parse");
        let actor = author(&agent).expect("an agent actor");
        assert_eq!(actor, Actor::agent("claude-code", Some("Claude Code")));

        let human = Options::parse(&[], &["agent-id", "agent-name"], &[]).expect("nothing parses");
        assert_eq!(author(&human).expect("you"), Actor::local_human());

        let nameless = Options::parse(
            &arguments(&["--agent-name", "Claude Code"]),
            &["agent-id", "agent-name"],
            &[],
        )
        .expect("the flag parses");
        assert!(author(&nameless).is_err(), "a name alone declares nothing");
    }

    /// One writer at second precision beside one at millisecond precision is
    /// two writers whose events tie, and a tie is decided by a random id. The
    /// app has always written milliseconds; this pins the CLI to it.
    #[test]
    fn a_timestamp_carries_the_precision_the_app_writes() {
        let stamp = now();
        assert!(
            regex_like(&stamp),
            "{stamp} should be RFC 3339 UTC with milliseconds"
        );
    }

    /// `2026-08-05T14:44:30.610Z`, without taking a dependency to say so.
    fn regex_like(stamp: &str) -> bool {
        let bytes = stamp.as_bytes();
        stamp.len() == 24
            && stamp.ends_with('Z')
            && bytes[10] == b'T'
            && bytes[19] == b'.'
            && stamp[20..23].chars().all(|digit| digit.is_ascii_digit())
    }

    #[test]
    fn an_unknown_status_names_the_ones_that_exist() {
        let options =
            Options::parse(&arguments(&["--status", "shipped"]), &["status"], &[]).expect("parses");
        let error = status(&options).expect_err("shipped is not a status");
        assert!(error.message.contains("in_progress"), "{error:?}");
    }

    #[test]
    fn no_command_asks_for_usage() {
        assert!(dispatch(&[]).expect("usage is not a failure").is_none());
        assert!(dispatch(&arguments(&["help"]))
            .expect("usage is not a failure")
            .is_none());
        assert!(dispatch(&arguments(&["ticket", "destroy"])).is_err());
    }
}
