//! Contract tests driven by the fixture corpus.
//!
//! Every directory in `fixtures/format-contract` and every ticket in
//! `fixtures/representative-project` is a case. Adding a fixture adds a test; no
//! code here needs to change. See `fixtures/format-contract/README.md` for the
//! `expected.json` shape.

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::core::ticket::{TicketDocument, TicketEdit};
use serde::{Deserialize, Deserializer};

const NOW: &str = "2026-07-30T10:00:00.000Z";

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum Outcome {
    Valid,
    Degraded,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Expectation {
    #[allow(dead_code)]
    summary: String,
    key: String,
    outcome: Outcome,
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    diagnostic_contains: Option<String>,
    #[serde(default)]
    read_only: Option<bool>,
    #[serde(default)]
    ticket: Option<ExpectedTicket>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExpectedTicket {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    assignee: Option<Option<String>>,
    #[serde(default)]
    labels: Option<Vec<String>>,
    #[serde(default, deserialize_with = "nullable")]
    rank: Option<Option<String>>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    archived_at: Option<Option<String>>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    checklist: Option<Vec<ExpectedItem>>,
    #[serde(default)]
    attachments: Option<Vec<ExpectedAttachment>>,
    #[serde(default)]
    activity: Option<Vec<ExpectedEvent>>,
    #[serde(default)]
    unknown_keys: Option<Vec<String>>,
    #[serde(default)]
    record_diagnostics: Option<Vec<String>>,
    #[serde(default)]
    history_incomplete: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExpectedItem {
    id: Option<String>,
    text: String,
    checked: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExpectedAttachment {
    id: String,
    file: String,
    name: String,
    media_type: String,
    size: u64,
    added_by_type: String,
    added_by_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExpectedEvent {
    id: String,
    kind: String,
    #[serde(default)]
    occurred_at: Option<String>,
    actor_type: String,
    #[serde(default)]
    actor_id: Option<String>,
    #[serde(default)]
    actor_name: Option<String>,
    #[serde(default)]
    changed_fields: Option<Vec<String>>,
    #[serde(default)]
    body: Option<String>,
}

/// Distinguishes an absent JSON key from an explicit `null`.
fn nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("repository root")
        .to_path_buf()
}

/// Collects failures instead of panicking on the first one, so one run reports
/// every case that drifted from the contract.
#[derive(Default)]
struct Report {
    failures: Vec<String>,
}

impl Report {
    fn check(&mut self, case: &str, condition: bool, detail: impl FnOnce() -> String) {
        if !condition {
            self.failures.push(format!("{case}: {}", detail()));
        }
    }

    fn equal<T: PartialEq + std::fmt::Debug>(
        &mut self,
        case: &str,
        field: &str,
        actual: T,
        expected: T,
    ) {
        self.check(case, actual == expected, || {
            format!("{field} is {actual:?}, expected {expected:?}")
        });
    }

    fn finish(self) {
        if self.failures.is_empty() {
            return;
        }
        let mut message = format!("{} contract expectation(s) failed:\n", self.failures.len());
        for failure in &self.failures {
            let _ = writeln!(message, "  - {failure}");
        }
        panic!("{message}");
    }
}

#[test]
fn every_format_contract_case_matches_its_expectation() {
    let corpus = repository_root().join("fixtures/format-contract");
    let mut cases: Vec<PathBuf> = fs::read_dir(&corpus)
        .expect("the format-contract corpus should be readable")
        .map(|entry| entry.expect("corpus entry").path())
        .filter(|path| path.is_dir())
        .collect();
    cases.sort();
    assert!(
        cases.len() >= 20,
        "the corpus should cover the documented cases, found {}",
        cases.len()
    );

    let mut report = Report::default();
    for case in cases {
        let name = case
            .file_name()
            .and_then(|value| value.to_str())
            .expect("case name")
            .to_owned();
        let raw = fs::read_to_string(case.join("ticket.md"))
            .unwrap_or_else(|error| panic!("{name}: ticket.md should be readable: {error}"));
        let expectation: Expectation = serde_json::from_str(
            &fs::read_to_string(case.join("expected.json")).unwrap_or_else(|error| {
                panic!("{name}: expected.json should be readable: {error}")
            }),
        )
        .unwrap_or_else(|error| panic!("{name}: expected.json is invalid: {error}"));

        check_case(&mut report, &name, &raw, &expectation);
    }
    report.finish();
}

fn check_case(report: &mut Report, name: &str, raw: &str, expectation: &Expectation) {
    match (
        TicketDocument::parse(raw, &expectation.key),
        &expectation.outcome,
    ) {
        (Ok(document), Outcome::Valid) => {
            report.check(name, document.render() == raw, || {
                "an unmodified document did not render its own bytes".to_owned()
            });
            check_ticket(report, name, &document, expectation.ticket.as_ref());
            check_edit_preserves_everything_else(report, name, &document, raw);
        }
        (Ok(_), Outcome::Degraded) => report.failures.push(format!(
            "{name}: parsed successfully but should be degraded"
        )),
        (Err(diagnostic), Outcome::Degraded) => {
            if let Some(code) = &expectation.code {
                let actual = serde_json::to_value(diagnostic.code)
                    .ok()
                    .and_then(|value| value.as_str().map(str::to_owned))
                    .unwrap_or_default();
                report.equal(name, "code", actual, code.clone());
            }
            if let Some(fragment) = &expectation.diagnostic_contains {
                report.check(name, diagnostic.message.contains(fragment), || {
                    format!(
                        "diagnostic {:?} does not mention {fragment:?}",
                        diagnostic.message
                    )
                });
            }
            if let Some(read_only) = expectation.read_only {
                report.equal(name, "readOnly", diagnostic.is_read_only(), read_only);
            }
        }
        (Err(diagnostic), Outcome::Valid) => report.failures.push(format!(
            "{name}: should parse but was rejected: {diagnostic}"
        )),
    }
}

fn check_ticket(
    report: &mut Report,
    name: &str,
    document: &TicketDocument,
    expected: Option<&ExpectedTicket>,
) {
    let Some(expected) = expected else { return };
    let ticket = document.ticket();
    if let Some(id) = &expected.id {
        report.equal(name, "id", &ticket.id, id);
    }
    if let Some(title) = &expected.title {
        report.equal(name, "title", &ticket.title, title);
    }
    if let Some(status) = &expected.status {
        report.equal(name, "status", ticket.status.as_str(), status.as_str());
    }
    if let Some(priority) = &expected.priority {
        report.equal(
            name,
            "priority",
            ticket.priority.as_str(),
            priority.as_str(),
        );
    }
    if let Some(assignee) = &expected.assignee {
        report.equal(name, "assignee", &ticket.assignee, assignee);
    }
    if let Some(labels) = &expected.labels {
        report.equal(name, "labels", &ticket.labels, labels);
    }
    if let Some(rank) = &expected.rank {
        report.equal(name, "rank", &ticket.rank, rank);
    }
    if let Some(created_at) = &expected.created_at {
        report.equal(name, "createdAt", &ticket.created_at, created_at);
    }
    if let Some(updated_at) = &expected.updated_at {
        report.equal(name, "updatedAt", &ticket.updated_at, updated_at);
    }
    if let Some(archived_at) = &expected.archived_at {
        report.equal(name, "archivedAt", &ticket.archived_at, archived_at);
    }
    if let Some(description) = &expected.description {
        report.equal(name, "description", &ticket.description, description);
    }
    if let Some(items) = &expected.checklist {
        report.equal(
            name,
            "checklist length",
            ticket.checklist.len(),
            items.len(),
        );
        for (actual, expected) in ticket.checklist.iter().zip(items) {
            report.equal(name, "checklist id", &actual.id, &expected.id);
            report.equal(name, "checklist text", &actual.text, &expected.text);
            report.equal(name, "checklist checked", actual.checked, expected.checked);
        }
    }
    if let Some(attachments) = &expected.attachments {
        report.equal(
            name,
            "attachment count",
            ticket.attachments.len(),
            attachments.len(),
        );
        for (actual, expected) in ticket.attachments.iter().zip(attachments) {
            report.equal(name, "attachment id", &actual.id, &expected.id);
            report.equal(name, "attachment file", &actual.file, &expected.file);
            report.equal(name, "attachment name", &actual.name, &expected.name);
            report.equal(
                name,
                "attachment mediaType",
                &actual.media_type,
                &expected.media_type,
            );
            report.equal(name, "attachment size", actual.size, expected.size);
            report.equal(
                name,
                "attachment addedByType",
                actor_type_name(&actual.added_by),
                expected.added_by_type.clone(),
            );
            report.equal(
                name,
                "attachment addedById",
                &actual.added_by.id,
                &expected.added_by_id,
            );
        }
    }
    if let Some(events) = &expected.activity {
        report.equal(name, "activity count", ticket.activity.len(), events.len());
        for (actual, expected) in ticket.activity.iter().zip(events) {
            report.equal(name, "event id", &actual.id, &expected.id);
            report.equal(
                name,
                "event kind",
                actual.kind.as_str(),
                expected.kind.as_str(),
            );
            if let Some(occurred_at) = &expected.occurred_at {
                report.equal(name, "event occurredAt", &actual.occurred_at, occurred_at);
            }
            report.equal(
                name,
                "event actorType",
                actor_type_name(&actual.actor),
                expected.actor_type.clone(),
            );
            if expected.actor_id.is_some() {
                report.equal(name, "event actorId", &actual.actor.id, &expected.actor_id);
            }
            if expected.actor_name.is_some() {
                report.equal(
                    name,
                    "event actorName",
                    &actual.actor.name,
                    &expected.actor_name,
                );
            }
            if let Some(fields) = &expected.changed_fields {
                let actual_fields: Vec<String> = actual
                    .changes
                    .iter()
                    .map(|change| change.field.clone())
                    .collect();
                report.equal(name, "event changedFields", &actual_fields, fields);
            }
            if let Some(body) = &expected.body {
                report.equal(name, "event body", &actual.body, body);
            }
        }
    }
    if let Some(keys) = &expected.unknown_keys {
        report.equal(name, "unknownKeys", &ticket.unknown_keys, keys);
    }
    if let Some(incomplete) = expected.history_incomplete {
        report.equal(
            name,
            "historyIncomplete",
            ticket.history_incomplete,
            incomplete,
        );
    }
    if let Some(fragments) = &expected.record_diagnostics {
        report.equal(
            name,
            "recordDiagnostics count",
            ticket.record_diagnostics.len(),
            fragments.len(),
        );
        for fragment in fragments {
            report.check(
                name,
                ticket
                    .record_diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.message.contains(fragment)),
                || {
                    format!(
                        "no record diagnostic mentions {fragment:?}; got {:?}",
                        ticket
                            .record_diagnostics
                            .iter()
                            .map(|diagnostic| diagnostic.message.as_str())
                            .collect::<Vec<_>>()
                    )
                },
            );
        }
    }
}

fn actor_type_name(actor: &longclaw_desktop_lib::core::ticket::Actor) -> String {
    serde_json::to_value(actor.actor_type)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_default()
}

/// A title-only edit must not disturb anything else in the file: unknown keys,
/// attachment and activity records, the description, and checklist ids all stay.
fn check_edit_preserves_everything_else(
    report: &mut Report,
    name: &str,
    document: &TicketDocument,
    raw: &str,
) {
    let edit = TicketEdit {
        title: Some("A title the app wrote".to_owned()),
        ..TicketEdit::default()
    };
    let applied = match document.apply(&edit, NOW) {
        Ok(applied) => applied,
        Err(diagnostic) => {
            report
                .failures
                .push(format!("{name}: a title edit was refused: {diagnostic}"));
            return;
        }
    };
    let next = String::from_utf8(applied.bytes.clone()).expect("app output should be UTF-8");
    let before = document.ticket();
    let after = applied.document.ticket();

    report.equal(
        name,
        "edited title",
        &after.title,
        &"A title the app wrote".to_owned(),
    );
    report.equal(name, "id after edit", &after.id, &before.id);
    report.equal(name, "status after edit", after.status, before.status);
    report.equal(name, "labels after edit", &after.labels, &before.labels);
    report.equal(name, "rank after edit", &after.rank, &before.rank);
    report.equal(
        name,
        "assignee after edit",
        &after.assignee,
        &before.assignee,
    );
    report.equal(
        name,
        "archivedAt after edit",
        &after.archived_at,
        &before.archived_at,
    );
    report.equal(
        name,
        "description after edit",
        &after.description,
        &before.description,
    );
    report.equal(
        name,
        "attachments after edit",
        &after.attachments,
        &before.attachments,
    );
    report.equal(
        name,
        "unknownKeys after edit",
        &after.unknown_keys,
        &before.unknown_keys,
    );
    report.check(name, after.updated_at == NOW, || {
        format!("updatedAt is {}, expected the write time", after.updated_at)
    });
    for key in &before.unknown_keys {
        report.check(name, next.contains(key.as_str()), || {
            format!("unknown key {key} disappeared from the written file")
        });
    }
    for event in &before.activity {
        report.check(
            name,
            after.activity.iter().any(|kept| kept.id == event.id),
            || {
                format!(
                    "activity record {} disappeared from the written file",
                    event.id
                )
            },
        );
    }
    report.check(
        name,
        after.activity.len() == before.activity.len() + 1,
        || {
            format!(
                "one app write should append exactly one event, activity went from {} to {}",
                before.activity.len(),
                after.activity.len()
            )
        },
    );
    for item in &before.checklist {
        if let Some(id) = &item.id {
            report.check(
                name,
                after
                    .checklist
                    .iter()
                    .any(|kept| kept.id.as_ref() == Some(id)),
                || format!("checklist item {id} lost its stable id"),
            );
        }
    }
    // Every checklist item is addressable after an app write, including ones an
    // agent appended without an id.
    report.check(
        name,
        after.checklist.iter().all(|item| item.id.is_some()),
        || "an app write left a checklist item without a stable id".to_owned(),
    );
    report.check(name, next != raw, || {
        "a title edit produced no change at all".to_owned()
    });
}

#[test]
fn every_representative_project_ticket_behaves_as_documented() {
    let tickets = repository_root().join("fixtures/representative-project/.longclaw/tickets");
    let mut directories: Vec<PathBuf> = fs::read_dir(&tickets)
        .expect("the representative project should be readable")
        .map(|entry| entry.expect("ticket entry").path())
        .filter(|path| path.is_dir())
        .collect();
    directories.sort();
    assert_eq!(
        directories.len(),
        6,
        "the representative project should keep four valid and two broken tickets"
    );

    let mut report = Report::default();
    for directory in directories {
        let key = directory
            .file_name()
            .and_then(|value| value.to_str())
            .expect("ticket key")
            .to_owned();
        let raw = fs::read_to_string(directory.join("ticket.md")).expect("ticket.md");
        match (TicketDocument::parse(&raw, &key), key.as_str()) {
            (Ok(document), "LC-98" | "LC-99") => report.failures.push(format!(
                "{key}: is meant to stay degraded but parsed as {}",
                document.ticket().title
            )),
            (Ok(document), _) => {
                report.check(&key, document.render() == raw, || {
                    "an unmodified document did not render its own bytes".to_owned()
                });
                report.check(
                    &key,
                    document.ticket().record_diagnostics.is_empty(),
                    || {
                        format!(
                            "the canonical example project should have no degraded records: {:?}",
                            document.ticket().record_diagnostics
                        )
                    },
                );
                check_edit_preserves_everything_else(&mut report, &key, &document, &raw);
            }
            (Err(diagnostic), "LC-98") => report.equal(
                &key,
                "code",
                format!("{:?}", diagnostic.code),
                "ParseFailed".to_owned(),
            ),
            (Err(diagnostic), "LC-99") => report.equal(
                &key,
                "code",
                format!("{:?}", diagnostic.code),
                "UnsupportedVersion".to_owned(),
            ),
            (Err(diagnostic), _) => report.failures.push(format!(
                "{key}: should parse but was rejected: {diagnostic}"
            )),
        }
    }
    report.finish();
}
