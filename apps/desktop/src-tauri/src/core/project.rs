//! `.longclaw/longclaw.yaml`: project identity, the people registry, and label
//! definitions.
//!
//! Small and infrequently changed, but it is the file that decides whether a
//! folder is a LongClaw project at all. Invalid metadata is therefore a
//! project-level failure that is reported rather than repaired (ADR 0010), and
//! like a ticket, the document keeps its bytes so a theme change does not
//! reformat a registry the app did not touch.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::error::Diagnostic;
use super::ticket::render_new_ticket;
use super::yaml::{encode_scalar, Mapping};

pub const PROJECT_FORMAT: &str = "longclaw.project/v1";
const FORMAT_FAMILY: &str = "longclaw.project/v";
pub const DEFAULT_THEME: &str = "indigo";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub name: String,
    pub color: String,
}

/// A project as its file describes it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    /// Immutable after the first ticket exists: changing it would rename every
    /// human-facing ticket key and directory.
    pub key: String,
    /// A fixed preset id. The frontend owns the preset list and falls back to its
    /// default for a value it does not recognize, without rewriting the file.
    pub theme: String,
    pub created_at: String,
    pub people: BTreeMap<String, Person>,
    pub labels: BTreeMap<String, Label>,
    pub unknown_keys: Vec<String>,
}

/// `longclaw.yaml`, parsed but never rewritten wholesale.
#[derive(Debug, Clone)]
pub struct ProjectDocument {
    mapping: Mapping,
    project: Project,
}

impl ProjectDocument {
    pub fn parse(raw: &str) -> Result<Self, Diagnostic> {
        let mapping = Mapping::parse(raw)?;
        let fields: ProjectFields = serde_yaml::from_str(raw).map_err(|error| {
            let diagnostic = Diagnostic::parse(format!("Project metadata is invalid: {error}"));
            match error.location() {
                Some(location) => diagnostic.at_line(location.line() as u32),
                None => diagnostic,
            }
        })?;

        if fields.format != PROJECT_FORMAT {
            return Err(if fields.format.starts_with(FORMAT_FAMILY) {
                Diagnostic::unsupported_version(format!(
                    "This project declares {}. This build reads {PROJECT_FORMAT}, so the \
                     project is shown read-only instead of being migrated.",
                    fields.format
                ))
            } else {
                Diagnostic::parse(format!(
                    "format must be {PROJECT_FORMAT}; found {}",
                    fields.format
                ))
            });
        }
        for (field, value) in [("id", &fields.id), ("name", &fields.name)] {
            if value.trim().is_empty() {
                return Err(Diagnostic::parse(format!("{field} must not be empty")));
            }
        }
        if !is_project_key(&fields.key) {
            return Err(Diagnostic::parse(format!(
                "key is the immutable prefix of every ticket key, so it must be uppercase \
                 letters and digits starting with a letter; found {:?}",
                fields.key
            )));
        }
        validate_theme(&fields.theme)?;
        if chrono::DateTime::parse_from_rfc3339(&fields.created_at)
            .is_ok_and(|parsed| parsed.offset().local_minus_utc() == 0)
        {
            // Accepted.
        } else {
            return Err(Diagnostic::parse(format!(
                "created_at must be a UTC RFC 3339 timestamp such as 2026-07-29T00:00:00Z; \
                 found {}",
                fields.created_at
            )));
        }

        let unknown_keys = mapping
            .keys()
            .filter(|key| !KNOWN_KEYS.contains(key))
            .map(str::to_owned)
            .collect();

        Ok(Self {
            mapping,
            project: Project {
                id: fields.id,
                name: fields.name,
                key: fields.key,
                theme: fields.theme,
                created_at: fields.created_at,
                people: fields.people,
                labels: fields.labels,
                unknown_keys,
            },
        })
    }

    pub fn project(&self) -> &Project {
        &self.project
    }

    pub fn render(&self) -> String {
        self.mapping.render()
    }

    /// Rewrites the theme line and nothing else.
    pub fn set_theme(&mut self, theme: &str) -> Result<Vec<u8>, Diagnostic> {
        validate_theme(theme)?;
        self.mapping.set_scalar("theme", theme);
        self.project.theme = theme.to_owned();
        Ok(self.render().into_bytes())
    }

    /// Rewrites the display name and nothing else. The key stays immutable.
    pub fn set_name(&mut self, name: &str) -> Result<Vec<u8>, Diagnostic> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 120 || name.contains('\n') {
            return Err(Diagnostic::parse(
                "A project name is a single line of 1 to 120 characters",
            ));
        }
        self.mapping.set_scalar("name", name);
        self.project.name = name.to_owned();
        Ok(self.render().into_bytes())
    }
}

const KNOWN_KEYS: [&str; 8] = [
    "format",
    "id",
    "name",
    "key",
    "theme",
    "created_at",
    "people",
    "labels",
];

#[derive(Debug, Deserialize)]
struct ProjectFields {
    format: String,
    id: String,
    name: String,
    key: String,
    #[serde(default = "default_theme")]
    theme: String,
    created_at: String,
    #[serde(default)]
    people: BTreeMap<String, Person>,
    #[serde(default)]
    labels: BTreeMap<String, Label>,
}

fn default_theme() -> String {
    DEFAULT_THEME.to_owned()
}

impl<'de> Deserialize<'de> for Person {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Fields {
            name: String,
        }
        Fields::deserialize(deserializer).map(|fields| Self { name: fields.name })
    }
}

impl<'de> Deserialize<'de> for Label {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Fields {
            name: String,
            #[serde(default = "default_label_color")]
            color: String,
        }
        Fields::deserialize(deserializer).map(|fields| Self {
            name: fields.name,
            color: fields.color,
        })
    }
}

fn default_label_color() -> String {
    "slate".to_owned()
}

/// A preset id. The frontend owns the preset list, so an unfamiliar-but-well-formed
/// value is accepted here and falls back to the default when rendered, rather than
/// making the project unopenable.
pub fn is_theme_id(theme: &str) -> bool {
    !theme.is_empty() && !theme.chars().any(char::is_whitespace)
}

fn validate_theme(theme: &str) -> Result<(), Diagnostic> {
    if !is_theme_id(theme) {
        return Err(Diagnostic::parse(format!(
            "theme is a preset id without whitespace; found {theme:?}"
        )));
    }
    Ok(())
}

/// The one project-key grammar: uppercase ASCII letters and digits, starting
/// with a letter.
///
/// The key is the immutable prefix of every ticket key and of every ticket
/// directory name, so `storage::valid_ticket_key` enforces this same rule on a
/// prefix rather than a second, looser one. Length is deliberately not part of
/// the grammar: an existing project keeps whatever key it was created with, and
/// the creation surfaces cap a new key instead. The shared case table is
/// `fixtures/project-key-grammar.json`.
pub fn is_project_key(key: &str) -> bool {
    let mut characters = key.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_uppercase())
        && characters.all(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
}

/// Renders a new project file. The one place `longclaw.yaml` is written from
/// nothing; every later change edits the lines it owns.
pub fn render_new_project(id: &str, name: &str, key: &str, theme: &str, now: &str) -> String {
    let mut rendered = String::new();
    rendered.push_str(&format!("format: {PROJECT_FORMAT}\n"));
    rendered.push_str(&format!("id: {}\n", encode_scalar(id)));
    rendered.push_str(&format!("name: {}\n", encode_scalar(name)));
    rendered.push_str(&format!("key: {}\n", encode_scalar(key)));
    rendered.push_str(&format!("theme: {}\n", encode_scalar(theme)));
    rendered.push_str(&format!("created_at: {}\n", encode_scalar(now)));
    rendered.push_str("people: {}\n");
    rendered.push_str("labels: {}\n");
    rendered
}

/// The generated agent-facing editing contract for a project.
///
/// LongClaw owns `.longclaw/AGENTS.md` and never touches an unrelated `AGENTS.md`
/// at the repository root.
pub fn render_agent_contract(project: &Project) -> String {
    let example_key = format!("{}-1", project.key);
    format!(
        "# Editing {name} with an agent\n\
         \n\
         LongClaw generated this file. It describes how to read and change this\n\
         project's canonical files without losing data.\n\
         \n\
         ## Canonical files\n\
         \n\
         - `.longclaw/longclaw.yaml` — project identity, people, and label definitions.\n\
         - `.longclaw/tickets/<KEY>/ticket.md` — the complete structured record for one ticket.\n\
         - `.longclaw/tickets/<KEY>/attachments/` — that ticket's attachment bytes.\n\
         \n\
         Read a ticket's `ticket.md` first. Open files under `attachments/` only when\n\
         the ticket references one and you need it. This file is documentation, not\n\
         project data.\n\
         \n\
         ## What you may change\n\
         \n\
         | Field | Rule |\n\
         |---|---|\n\
         | `title` | one line |\n\
         | `status` | one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled` |\n\
         | `priority` | one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none` |\n\
         | `labels` | slugs defined in `longclaw.yaml` |\n\
         | description | any CommonMark outside the reserved sections |\n\
         | checklist | flip `[ ]` to `[x]`, or append a task |\n\
         | activity | append a bounded record; never edit or delete an existing one |\n\
         \n\
         Do not change `format`, `id`, `key`, `created_at`, or `rank`. LongClaw owns\n\
         `rank`; preserve any value you find and do not invent one. Keep every key you\n\
         do not understand exactly as it is.\n\
         \n\
         ## Timestamps and attribution\n\
         \n\
         Timestamps are UTC RFC 3339 strings such as `2026-07-29T09:12:31Z`. Set\n\
         `updated_at` when you change ticket state. Attribute yourself explicitly:\n\
         \n\
         ```yaml\n\
         actor:\n\
         \x20 type: agent\n\
         \x20 id: your-tool-id\n\
         \x20 name: Your Tool\n\
         ```\n\
         \n\
         `type` is `human`, `agent`, or `unknown` — never guess. An agent is never an\n\
         assignee.\n\
         \n\
         ## Checking off a checklist item\n\
         \n\
         Before:\n\
         \n\
         ```md\n\
         - [ ] Add retry policy <!-- longclaw:item=ck_7d2a -->\n\
         ```\n\
         \n\
         After:\n\
         \n\
         ```md\n\
         - [x] Add retry policy <!-- longclaw:item=ck_7d2a -->\n\
         ```\n\
         \n\
         Keep the `longclaw:item` marker. It is how a change is attributed to that\n\
         item. A task you append without a marker still works; LongClaw adopts it and\n\
         mints an id on its next write.\n\
         \n\
         ## Appending an activity entry\n\
         \n\
         Add to the end of the `## Activity` section, inside the markers:\n\
         \n\
         ```md\n\
         <!-- longclaw:event\n\
         id: evt_4b91c07a\n\
         kind: update\n\
         occurred_at: 2026-07-29T09:12:31Z\n\
         actor:\n\
         \x20 type: agent\n\
         \x20 id: your-tool-id\n\
         \x20 name: Your Tool\n\
         changes:\n\
         \x20 - field: status\n\
         \x20   from: todo\n\
         \x20   to: in_progress\n\
         -->\n\
         ### Your Tool updated this ticket\n\
         \n\
         What you did and what is left.\n\
         <!-- /longclaw:event -->\n\
         ```\n\
         \n\
         Activity is append-only: correct a mistake by appending another entry. Use\n\
         `kind: comment` with no `changes` for a plain comment. Every `id` must be\n\
         unique within the ticket. If you change state without appending an entry, the\n\
         state still stands and the history is merely incomplete — LongClaw never rolls\n\
         state back to match history.\n\
         \n\
         ## Attachments\n\
         \n\
         Copy the file into the ticket's `attachments/` directory as\n\
         `<attachment-id>-<sanitized-name>`, then register it under `## Attachments`\n\
         with its id, relative `file` path, original `name`, `media_type`, `size`,\n\
         `added_at`, and `added_by`. Copy the bytes first and register second, so an\n\
         interruption leaves a recoverable file rather than an entry pointing at\n\
         nothing. Treat registered files as immutable: replacement means a new id.\n\
         \n\
         ## Writing safely\n\
         \n\
         - Write atomically: write a sibling temporary file, then rename it over\n\
         \x20 `ticket.md`. LongClaw's watcher expects that pattern and will not mistake\n\
         \x20 your write for its own.\n\
         - The YAML subset allows mappings, lists, strings, booleans, nulls, and\n\
         \x20 numbers. No anchors, aliases, tags, merge keys, multiple documents, or\n\
         \x20 duplicate keys. Files are UTF-8 with LF line endings.\n\
         - The frontmatter `key` and the ticket's directory name are one identity. Never\n\
         \x20 change either.\n\
         - If a file will not parse, leave it alone and say so. LongClaw shows an\n\
         \x20 unreadable ticket with its raw contents and a diagnostic rather than\n\
         \x20 repairing it, and so should you.\n\
         \n\
         ## This project\n\
         \n\
         - Name: {name}\n\
         - Ticket keys: `{example_key}`, `{key}-2`, and so on\n\
         - Ticket format: `longclaw.ticket/v1`\n\
         \n\
         {example}\n",
        name = project.name,
        key = project.key,
        example_key = example_key,
        example = example_ticket(&example_key),
    )
}

fn example_ticket(key: &str) -> String {
    let rendered = render_new_ticket(
        key,
        "An example of the shape you are editing",
        super::ticket::Status::Todo,
        super::ticket::Priority::P2,
        "The description is ordinary CommonMark.",
        &["An example task".to_owned()],
        "2026-07-29T00:00:00Z",
    );
    format!("## A complete example\n\n```md\n{rendered}```")
}

#[cfg(test)]
mod tests {
    use super::{render_new_project, ProjectDocument, DEFAULT_THEME, PROJECT_FORMAT};
    use crate::core::ErrorCode;

    const PROJECT: &str = concat!(
        "format: longclaw.project/v1\n",
        "id: 019c8c31-4d7e-71ad-8997-e67700962b55\n",
        "name: Representative Project\n",
        "key: LC\n",
        "theme: indigo\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "people:\n",
        "  sachin:\n",
        "    name: Sachin Jain\n",
        "labels:\n",
        "  storage:\n",
        "    name: Storage\n",
        "    color: blue\n",
        "x_extension: kept\n",
    );

    #[test]
    fn a_project_file_round_trips_and_exposes_its_registries() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let project = document.project();
        assert_eq!(document.render(), PROJECT);
        assert_eq!(project.key, "LC");
        assert_eq!(project.theme, "indigo");
        assert_eq!(project.people["sachin"].name, "Sachin Jain");
        assert_eq!(project.labels["storage"].name, "Storage");
        assert_eq!(project.labels["storage"].color, "blue");
        assert_eq!(project.unknown_keys, vec!["x_extension".to_owned()]);
    }

    #[test]
    fn changing_the_theme_rewrites_one_line() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document.set_theme("clay").expect("clay is a preset id");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(rendered, PROJECT.replace("theme: indigo", "theme: clay"));
        assert_eq!(document.project().theme, "clay");
    }

    #[test]
    fn changing_the_name_leaves_the_immutable_key_alone() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document.set_name("Renamed Project").expect("a valid name");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert!(rendered.contains("name: Renamed Project\n"));
        assert!(rendered.contains("key: LC\n"));
        assert_eq!(document.project().key, "LC");
    }

    #[test]
    fn a_missing_registry_is_an_empty_registry() {
        let raw = concat!(
            "format: longclaw.project/v1\n",
            "id: minimal\n",
            "name: Minimal\n",
            "key: MIN\n",
            "created_at: 2026-07-29T00:00:00Z\n",
        );
        let document = ProjectDocument::parse(raw).expect("the project should parse");
        assert!(document.project().people.is_empty());
        assert!(document.project().labels.is_empty());
        assert_eq!(document.project().theme, DEFAULT_THEME);
    }

    #[test]
    fn invalid_project_metadata_is_reported_and_never_replaced() {
        let cases = [
            (
                &PROJECT.replace("format: longclaw.project/v1", "format: someone-else/v1"),
                ErrorCode::ParseFailed,
                "format",
            ),
            (
                &PROJECT.replace("format: longclaw.project/v1", "format: longclaw.project/v9"),
                ErrorCode::UnsupportedVersion,
                "longclaw.project/v9",
            ),
            (
                &PROJECT.replace("key: LC", "key: lower"),
                ErrorCode::ParseFailed,
                "key",
            ),
            (
                &PROJECT.replace("name: Representative Project", "name: \"\""),
                ErrorCode::ParseFailed,
                "name",
            ),
            (
                &PROJECT.replace(
                    "created_at: 2026-07-29T00:00:00Z",
                    "created_at: 2026-07-29T05:30:00+05:30",
                ),
                ErrorCode::ParseFailed,
                "UTC",
            ),
            (
                &PROJECT.replace("id: 019c8c31-4d7e-71ad-8997-e67700962b55\n", ""),
                ErrorCode::ParseFailed,
                "id",
            ),
        ];
        for (raw, code, fragment) in cases {
            let diagnostic = ProjectDocument::parse(raw)
                .err()
                .unwrap_or_else(|| panic!("{raw:?} should be rejected"));
            assert_eq!(diagnostic.code, code, "for {raw:?}");
            assert!(
                diagnostic.message.contains(fragment),
                "{:?} should mention {fragment}",
                diagnostic.message
            );
        }
    }

    #[test]
    fn a_new_project_file_parses_back() {
        let rendered = render_new_project(
            "019c8c31-4d7e-71ad-8997-e67700962b55",
            "Fresh Project",
            "FP",
            DEFAULT_THEME,
            "2026-07-29T00:00:00Z",
        );
        let document = ProjectDocument::parse(&rendered).expect("a new project should be readable");
        assert!(rendered.starts_with(&format!("format: {PROJECT_FORMAT}\n")));
        assert_eq!(document.render(), rendered);
        assert_eq!(document.project().name, "Fresh Project");
        assert_eq!(document.project().key, "FP");
        assert!(document.project().unknown_keys.is_empty());
    }

    #[test]
    fn the_generated_agent_contract_carries_a_readable_example() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        assert!(contract.contains("Representative Project"));
        assert!(contract.contains("`LC-1`"));
        assert!(contract.contains("longclaw:item=ck_7d2a"));
        assert!(contract.contains("<!-- /longclaw:event -->"));
        assert!(contract.contains("atomically"));
    }
}
