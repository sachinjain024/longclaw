//! Contract tests driven by the fixture corpus.
//!
//! Every directory in `fixtures/format-contract` and every ticket in
//! `fixtures/representative-project` is a case. Adding a fixture adds a test; no
//! code here needs to change. See `fixtures/format-contract/README.md` for the
//! `expected.json` shape.

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::core::error::Diagnostic;
use longclaw_desktop_lib::core::storage::{
    belongs_to_project, foreign_project_diagnostic, prepare_new_ticket, NewTicket,
};
use longclaw_desktop_lib::core::ticket::{
    ChecklistToggle, Priority, Status, TicketDocument, TicketEdit,
};
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
    /// The project the case is read as belonging to. Absent means the directory's
    /// own prefix, so a case that is not about ownership is read by its own project
    /// and behaves exactly as it did before this field existed.
    #[serde(default)]
    project_key: Option<String>,
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

/// Reads a case the way `storage::read_ticket_file` does: ownership of the
/// directory is settled before the contents are believed, so a folder belonging to
/// another project degrades whether or not its bytes would parse.
fn read_case(raw: &str, expectation: &Expectation) -> Result<TicketDocument, Diagnostic> {
    let project_key = expectation.project_key.clone().unwrap_or_else(|| {
        expectation
            .key
            .split_once('-')
            .map_or_else(|| expectation.key.clone(), |(prefix, _)| prefix.to_owned())
    });
    if !belongs_to_project(&project_key, &expectation.key) {
        return Err(foreign_project_diagnostic(&project_key, &expectation.key));
    }
    TicketDocument::parse(raw, &expectation.key)
}

fn check_case(report: &mut Report, name: &str, raw: &str, expectation: &Expectation) {
    match (read_case(raw, expectation), &expectation.outcome) {
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

/// The exact bytes of the `## Attachments` section, heading included, up to the
/// next reserved heading.
///
/// Comparing the region rather than the parsed `Vec<Attachment>` is the whole
/// point of V0-18: records that parse the same have still lost a field this build
/// does not read, or a line break their author chose.
fn attachment_region(raw: &str) -> &str {
    let start = raw
        .find("\n## Attachments\n")
        .expect("the fixture has an attachments section");
    let region = &raw[start..];
    match region[1..].find("\n## Activity\n") {
        Some(offset) => &region[..offset + 1],
        None => region,
    }
}

/// V0-18's must-pass, stated as it is written: a ticket carrying attachment
/// records survives every app mutation byte-identically in those records.
///
/// The app renders no attachment UI and creates no registry entries (ADR 0005),
/// so nothing here should touch them — but "should" is what this test replaces.
/// It runs every mutation a `TicketEdit` can make against a registry holding a
/// media type outside the v0 `image/*`, `text/*`, `video/*` set and a record with
/// fields this build never reads.
#[test]
fn attachment_records_survive_every_mutation_byte_identically() {
    let case =
        repository_root().join("fixtures/format-contract/valid-attachment-records-preserved");
    let raw = fs::read_to_string(case.join("ticket.md")).expect("the fixture should be readable");
    let document = TicketDocument::parse(&raw, "LC-77").expect("the fixture should parse");
    let before = attachment_region(&raw);
    assert!(
        before.contains("media_type: application/x-longclaw-archive"),
        "the fixture must carry a media type outside the v0 supported set"
    );
    assert!(
        before.contains("checksum: sha256:") && before.contains("capture_mode: lossless"),
        "the fixture must carry attachment fields this build does not interpret"
    );

    let mut report = Report::default();
    let mutations = [
        (
            "title",
            TicketEdit {
                title: Some("A title the app wrote".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "status",
            TicketEdit {
                status: Some(Status::InProgress),
                ..TicketEdit::default()
            },
        ),
        (
            "priority",
            TicketEdit {
                priority: Some(Priority::Urgent),
                ..TicketEdit::default()
            },
        ),
        (
            "labels replace",
            TicketEdit {
                labels: Some(vec!["reliability".to_owned(), "backend".to_owned()]),
                ..TicketEdit::default()
            },
        ),
        (
            "rank set",
            TicketEdit {
                rank: Some(Some("a0V".to_owned())),
                ..TicketEdit::default()
            },
        ),
        (
            "archive",
            TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
        ),
        (
            "description",
            TicketEdit {
                description: Some("Rewritten in the panel.".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "checklist toggle",
            TicketEdit {
                checklist: vec![ChecklistToggle {
                    item_id: "ck_5501".to_owned(),
                    checked: true,
                }],
                ..TicketEdit::default()
            },
        ),
        (
            "checklist append",
            TicketEdit {
                add_checklist_items: vec!["One more task".to_owned()],
                ..TicketEdit::default()
            },
        ),
        (
            "comment",
            TicketEdit {
                comment: Some("Leaving a note.".to_owned()),
                ..TicketEdit::default()
            },
        ),
    ];

    for (name, edit) in mutations {
        check_attachments_survive(&mut report, name, &document, &edit, before);
    }
    // Clearing a rank needs a ranked ticket, so — like unarchive below — it runs
    // against the result of the set above. `rank: Some(None)` is its own arm of
    // `apply` and its own wire value, and it is a live path rather than a
    // hypothetical one: it is what undoing the drop that gave a card its first
    // rank sends (V0-09). "Every app mutation" has to include it.
    let ranked = document
        .apply(
            &TicketEdit {
                rank: Some(Some("a0V".to_owned())),
                ..TicketEdit::default()
            },
            NOW,
        )
        .expect("setting a rank should be accepted");
    check_attachments_survive(
        &mut report,
        "rank clear",
        &ranked.document,
        &TicketEdit {
            rank: Some(None),
            ..TicketEdit::default()
        },
        before,
    );
    // Unarchiving needs an archived ticket, so it runs against the result of the
    // archive above rather than against the fixture.
    let archived = document
        .apply(
            &TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
            NOW,
        )
        .expect("archiving should be accepted");
    check_attachments_survive(
        &mut report,
        "unarchive",
        &archived.document,
        &TicketEdit {
            archived: Some(false),
            ..TicketEdit::default()
        },
        before,
    );
    report.finish();
}

fn check_attachments_survive(
    report: &mut Report,
    name: &str,
    document: &TicketDocument,
    edit: &TicketEdit,
    before: &str,
) {
    let applied = match document.apply(edit, NOW) {
        Ok(applied) => applied,
        Err(diagnostic) => {
            report
                .failures
                .push(format!("{name}: the edit was refused: {diagnostic}"));
            return;
        }
    };
    let next = String::from_utf8(applied.bytes).expect("app output should be UTF-8");
    let after = attachment_region(&next);
    report.check(name, after == before, || {
        format!("the attachment records changed:\n--- before\n{before}\n--- after\n{after}")
    });
    // The app registers nothing of its own either (ADR 0005).
    report.equal(
        name,
        "attachment count",
        applied.document.ticket().attachments.len(),
        document.ticket().attachments.len(),
    );
}

/// The `priority:` line exactly as it stands in the file, newline included.
fn priority_line(raw: &str) -> &str {
    let start = raw
        .find("\npriority:")
        .expect("the fixture has a priority key");
    let region = &raw[start + 1..];
    let end = region.find('\n').expect("the line is terminated");
    &region[..end]
}

/// V0-08's third must-pass clause: an agent-written priority is read without the
/// app rewriting the field.
///
/// The fixture writes `priority: "p1"` — legal YAML that LongClaw itself never
/// emits, so a reformat is a changed byte rather than an argument. Every mutation
/// a `TicketEdit` can make runs against it, including a priority edit that sets
/// the value already there, and none of them may touch the line.
#[test]
fn an_agent_written_priority_is_never_rewritten_by_an_unrelated_edit() {
    let case = repository_root().join("fixtures/format-contract/valid-agent-written-priority");
    let raw = fs::read_to_string(case.join("ticket.md")).expect("the fixture should be readable");
    let document = TicketDocument::parse(&raw, "LC-88").expect("the fixture should parse");
    let before = priority_line(&raw);
    assert_eq!(
        before, "priority: \"p1\"",
        "the fixture must carry a priority in a style the app never writes"
    );
    assert_eq!(
        document.ticket().priority,
        Priority::P1,
        "the quoted form must still read as p1"
    );

    let mut report = Report::default();
    let mutations = [
        (
            "title",
            TicketEdit {
                title: Some("A title the app wrote".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "status",
            TicketEdit {
                status: Some(Status::InProgress),
                ..TicketEdit::default()
            },
        ),
        (
            "labels replace",
            TicketEdit {
                labels: Some(vec!["backend".to_owned()]),
                ..TicketEdit::default()
            },
        ),
        (
            "rank set",
            TicketEdit {
                rank: Some(Some("a0V".to_owned())),
                ..TicketEdit::default()
            },
        ),
        (
            "archive",
            TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
        ),
        (
            "description",
            TicketEdit {
                description: Some("Rewritten in the panel.".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "checklist toggle",
            TicketEdit {
                checklist: vec![ChecklistToggle {
                    item_id: "ck_8801".to_owned(),
                    checked: true,
                }],
                ..TicketEdit::default()
            },
        ),
        (
            "checklist append",
            TicketEdit {
                add_checklist_items: vec!["One more task".to_owned()],
                ..TicketEdit::default()
            },
        ),
        (
            "comment",
            TicketEdit {
                comment: Some("Leaving a note.".to_owned()),
                ..TicketEdit::default()
            },
        ),
    ];

    for (name, edit) in mutations {
        let applied = match document.apply(&edit, NOW) {
            Ok(applied) => applied,
            Err(diagnostic) => {
                report
                    .failures
                    .push(format!("{name}: the edit was refused: {diagnostic}"));
                continue;
            }
        };
        let next = String::from_utf8(applied.bytes).expect("app output should be UTF-8");
        let after = priority_line(&next);
        report.check(name, after == before, || {
            format!("the priority line changed: {before:?} became {after:?}")
        });
        report.equal(
            name,
            "priority",
            applied.document.ticket().priority,
            Priority::P1,
        );
    }

    // Setting the value that is already there is refused outright rather than
    // rewritten in the app's own style. That is the strongest form of the claim:
    // a file the app never opens for writing.
    let no_op = document.apply(
        &TicketEdit {
            priority: Some(Priority::P1),
            ..TicketEdit::default()
        },
        NOW,
    );
    report.check(
        "priority set to the value already there",
        no_op.is_err(),
        || "an edit that changes nothing still rewrote the file".to_owned(),
    );

    // The other half of the claim: the field is preserved because nothing asked
    // for it, not because the writer cannot write it.
    let raised = document
        .apply(
            &TicketEdit {
                priority: Some(Priority::Urgent),
                ..TicketEdit::default()
            },
            NOW,
        )
        .expect("raising the priority should be accepted");
    let raised = String::from_utf8(raised.bytes).expect("app output should be UTF-8");
    report.check("priority raised", priority_line(&raised) != before, || {
        "a real priority change left the line alone".to_owned()
    });
    report.finish();
}

/// The description exactly as it stands between the frontmatter and the first
/// reserved heading, newlines included.
///
/// Comparing the region rather than `Ticket::description` is the point: two
/// descriptions that parse the same have still lost a trailing space, a tab, or
/// a bullet marker their author chose.
fn description_region(raw: &str) -> &str {
    let close = raw[4..]
        .find("\n---\n")
        .expect("the fixture has closing frontmatter");
    let body = &raw[4 + close + 5..];
    let end = ["\n## Checklist\n", "\n## Attachments\n", "\n## Activity\n"]
        .iter()
        .filter_map(|heading| body.find(heading))
        .min()
        .unwrap_or(body.len());
    &body[..end]
}

/// Every markdown construct `docs/file_format.md` documents for a ticket body,
/// plus the ones V0-12's six-button toolbar writes.
///
/// Each is written whole, so a construct that needs more than one line — a
/// fence, a list, a hard break — is exercised as its author would type it.
const DOCUMENTED_CONSTRUCTS: &[(&str, &str)] = &[
    ("paragraph", "The worker fails after a transient error."),
    (
        "atx headings",
        "## Acceptance criteria\n\n### Claude Code updated this ticket\n\n###### deep",
    ),
    (
        "bullet list",
        "- Retries use exponential backoff.\n- Permanent failures remain visible.",
    ),
    ("star and plus bullets", "* one\n+ two"),
    (
        "task list",
        "- [x] Add retry policy\n- [ ] Add failure metrics",
    ),
    (
        "fenced code",
        "```js\nconst spacing = '  load   bearing  ';\n```",
    ),
    ("tilde fence", "~~~\nliteral   spacing\n~~~"),
    ("strong and emphasis", "A **bold** and *emphatic* claim."),
    ("code span", "Run `cargo test --all` first."),
    (
        "relative attachment link",
        "See [debug-log.txt](./attachments/att_7d2a-debug-log.txt).",
    ),
    (
        "image",
        "![Failure state](./attachments/att_8e31-failure-state.png)",
    ),
    ("absolute link", "See [the docs](https://example.com/x)."),
    (
        "hard line break",
        "A line with two trailing spaces  \nis a hard break.",
    ),
    (
        "an ordinary heading beside prose",
        "Plan:\n\n## Approach\n\nRewrite the worker.\n\n## Discoveries\n\nIt was the retry policy.",
    ),
    (
        "a reserved heading quoted in a fence",
        "The description, with a fence:\n\n```md\n## Activity\n```",
    ),
    ("html that is not rendered", "<!-- a note -->\n\n<b>x</b>"),
    (
        "the constructs the preview does not render",
        "1. an ordered item\n\n> a block quote\n\nSetext\n======\n\n| a | b |\n| - | - |",
    ),
];

/// V0-12's first must-pass clause, stated as it is written: every markdown
/// construct the format documents survives a round trip through the app.
///
/// The frontend half of the claim is that the textarea's bytes are the bytes
/// handed to `edit_ticket`. This is the durable half: those bytes go to disk and
/// come back identical. The one transformation the writer is allowed is trimming
/// the outer edges (`ticket.rs:761`), so every construct here is written without
/// leading or trailing whitespace.
#[test]
fn a_description_round_trips_every_construct_the_format_documents() {
    let case = repository_root().join("fixtures/format-contract/valid-non-canonical-description");
    let raw = fs::read_to_string(case.join("ticket.md")).expect("the fixture should be readable");
    let document = TicketDocument::parse(&raw, "LC-99").expect("the fixture should parse");

    let mut report = Report::default();
    for (name, construct) in DOCUMENTED_CONSTRUCTS {
        let applied = match document.apply(
            &TicketEdit {
                description: Some((*construct).to_owned()),
                ..TicketEdit::default()
            },
            NOW,
        ) {
            Ok(applied) => applied,
            Err(diagnostic) => {
                report
                    .failures
                    .push(format!("{name}: the description was refused: {diagnostic}"));
                continue;
            }
        };
        let written = applied.document.ticket().description.as_str();
        report.check(name, written == *construct, || {
            format!("wrote {construct:?} and read back {written:?}")
        });
        // And again from the bytes, not from the document the writer handed
        // back, because the file is the record.
        let next = String::from_utf8(applied.bytes).expect("app output should be UTF-8");
        let reread = TicketDocument::parse(&next, "LC-99")
            .expect("the app must be able to read back what it wrote");
        let reread = reread.ticket().description.as_str();
        report.check(name, reread == *construct, || {
            format!("re-reading the file gave {reread:?}, not {construct:?}")
        });
    }
    report.finish();
}

/// V0-12's second must-pass clause, on the durable side: an edit the human did
/// not make to the description never reformats it.
///
/// The fixture's description is deliberately non-canonical — setext, three
/// bullet markers in one list, a four-space indent, trailing-space hard breaks,
/// a tab, a table, an HTML comment — so a writer that normalized anything would
/// show up as a changed byte rather than as an argument.
#[test]
fn an_unrelated_edit_never_reformats_the_description() {
    let case = repository_root().join("fixtures/format-contract/valid-non-canonical-description");
    let raw = fs::read_to_string(case.join("ticket.md")).expect("the fixture should be readable");
    let document = TicketDocument::parse(&raw, "LC-99").expect("the fixture should parse");
    let before = description_region(&raw);
    assert!(
        before.contains("*   a star bullet") && before.contains("\n\tA tab-indented line."),
        "the fixture must carry markdown in a style the app never writes"
    );
    assert!(
        before.contains("trailing spaces  \n"),
        "the fixture must carry a hard break made of trailing whitespace"
    );

    let mut report = Report::default();
    let mutations = [
        (
            "title",
            TicketEdit {
                title: Some("A title the app wrote".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "status",
            TicketEdit {
                status: Some(Status::InProgress),
                ..TicketEdit::default()
            },
        ),
        (
            "priority",
            TicketEdit {
                priority: Some(Priority::Urgent),
                ..TicketEdit::default()
            },
        ),
        (
            "labels replace",
            TicketEdit {
                labels: Some(vec!["backend".to_owned()]),
                ..TicketEdit::default()
            },
        ),
        (
            "rank set",
            TicketEdit {
                rank: Some(Some("a0V".to_owned())),
                ..TicketEdit::default()
            },
        ),
        (
            "archive",
            TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
        ),
        (
            "checklist toggle",
            TicketEdit {
                checklist: vec![ChecklistToggle {
                    item_id: "ck_9901".to_owned(),
                    checked: true,
                }],
                ..TicketEdit::default()
            },
        ),
        (
            "checklist append",
            TicketEdit {
                add_checklist_items: vec!["One more task".to_owned()],
                ..TicketEdit::default()
            },
        ),
        (
            "comment",
            TicketEdit {
                comment: Some("Leaving a note.".to_owned()),
                ..TicketEdit::default()
            },
        ),
    ];

    for (name, edit) in mutations {
        let applied = match document.apply(&edit, NOW) {
            Ok(applied) => applied,
            Err(diagnostic) => {
                report
                    .failures
                    .push(format!("{name}: the edit was refused: {diagnostic}"));
                continue;
            }
        };
        let next = String::from_utf8(applied.bytes).expect("app output should be UTF-8");
        let after = description_region(&next);
        report.check(name, after == before, || {
            format!("the description was rewritten: {before:?} became {after:?}")
        });
    }

    // Setting the description the file already has is refused outright rather
    // than rewritten in the app's own style — the strongest form of the claim.
    let no_op = document.apply(
        &TicketEdit {
            description: Some(document.ticket().description.clone()),
            ..TicketEdit::default()
        },
        NOW,
    );
    report.check(
        "description set to the value already there",
        no_op.is_err(),
        || "an edit that changes nothing still rewrote the file".to_owned(),
    );

    // The other half: the description is preserved because nothing asked for it,
    // not because the writer cannot write one.
    let rewritten = document
        .apply(
            &TicketEdit {
                description: Some("Rewritten in the panel.".to_owned()),
                ..TicketEdit::default()
            },
            NOW,
        )
        .expect("a real description change should be accepted");
    let rewritten = String::from_utf8(rewritten.bytes).expect("app output should be UTF-8");
    report.check(
        "description rewritten",
        description_region(&rewritten) != before,
        || "a real description change left the region alone".to_owned(),
    );
    report.finish();
}

/// The ticket state the two creation paths were both asked to produce, and the
/// state neither of them was asked to touch.
///
/// Everything left out of this struct is left out because it *must* differ, and
/// the doc comment on the test says why for each one. Comparing what remains is
/// the strongest honest form of "identically": every field the surface can set,
/// plus every field it cannot, so a create that quietly wrote a rank or an
/// assignee would fail here as loudly as one that dropped a label.
#[derive(Debug, PartialEq, Eq)]
struct CreatedState {
    title: String,
    status: Status,
    priority: Priority,
    labels: Vec<String>,
    description: String,
    /// Text and checked, in order. The ids are minted per item and cannot match.
    checklist: Vec<(String, bool)>,
    assignee: Option<String>,
    rank: Option<String>,
    archived_at: Option<String>,
    attachments: usize,
    unknown_keys: Vec<String>,
    history_incomplete: bool,
    record_diagnostics: usize,
}

impl CreatedState {
    fn of(document: &TicketDocument) -> Self {
        let ticket = document.ticket();
        Self {
            title: ticket.title.clone(),
            status: ticket.status,
            priority: ticket.priority,
            labels: ticket.labels.clone(),
            description: ticket.description.clone(),
            checklist: ticket
                .checklist
                .iter()
                .map(|item| (item.text.clone(), item.checked))
                .collect(),
            assignee: ticket.assignee.clone(),
            rank: ticket.rank.clone(),
            archived_at: ticket.archived_at.clone(),
            attachments: ticket.attachments.len(),
            unknown_keys: ticket.unknown_keys.clone(),
            history_incomplete: ticket.history_incomplete,
            record_diagnostics: ticket.record_diagnostics.len(),
        }
    }
}

/// Reads a `TicketWrite`'s own bytes back the way the app will read the file it
/// is about to become, so nothing downstream trusts an in-memory document.
fn parse_written(bytes: &[u8], key: &str) -> TicketDocument {
    let raw = std::str::from_utf8(bytes).expect("app output should be UTF-8");
    TicketDocument::parse(raw, key)
        .unwrap_or_else(|error| panic!("{key}: the app wrote a file it cannot read: {error}"))
}

/// V0-16's must-pass: **a ticket created with every field parses identically to
/// the same ticket assembled by edits.**
///
/// The full create surface can set six things — title, status, priority, labels,
/// description, and a checklist — and the same six can be reached one at a time
/// through the panel. Two routes to one ticket is two chances to disagree about
/// what a field means, so this pins that they do not.
///
/// `CreatedState` is what is compared, and it deliberately leaves out the things
/// that *cannot* match between two files written minutes apart:
///
/// - `id` is a fresh UUID per create, and `key` is the directory each one claimed.
/// - `created_at` and `updated_at` differ because the second path is asked for its
///   changes *after* its create, which is the whole point of it.
/// - Checklist item ids are minted per item; the text and the checked flag are the
///   claim, and they are compared in order.
/// - The activity histories differ by construction — one create event against a
///   create plus one update per field. That is the difference between the two
///   paths, not a defect in either.
#[test]
fn a_ticket_created_with_every_field_matches_one_assembled_by_edits() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path();
    let later = "2026-07-30T10:05:00.000Z";

    let title = "Prove the agent round trip";
    let description = "Check whether the round trip holds.\n\n- read the file\n- write it back";
    let labels = ["backend".to_owned(), "reliability".to_owned()];
    let checklist = [
        "Let an agent read this ticket".to_owned(),
        "Review what it changed".to_owned(),
    ];

    // Path one: the full create surface, with every field it can set.
    let everything = NewTicket {
        title: title.to_owned(),
        description: description.to_owned(),
        status: Some(Status::InReview),
        priority: Some(Priority::P1),
        labels: labels.to_vec(),
        checklist: checklist.to_vec(),
    };
    let created = prepare_new_ticket(root, "LC", &everything, NOW).expect("the create should land");
    let created = parse_written(&created.bytes, &created.key);

    // Path two: quick create's minimum, then one edit per field.
    let minimum = NewTicket {
        title: title.to_owned(),
        description: String::new(),
        status: None,
        priority: None,
        labels: Vec::new(),
        checklist: Vec::new(),
    };
    let seed = prepare_new_ticket(root, "LC", &minimum, NOW).expect("the create should land");
    let mut assembled = parse_written(&seed.bytes, &seed.key);
    let key = seed.key.clone();
    for (name, edit) in [
        (
            "status",
            TicketEdit {
                status: Some(Status::InReview),
                ..TicketEdit::default()
            },
        ),
        (
            "priority",
            TicketEdit {
                priority: Some(Priority::P1),
                ..TicketEdit::default()
            },
        ),
        (
            "labels",
            TicketEdit {
                labels: Some(labels.to_vec()),
                ..TicketEdit::default()
            },
        ),
        (
            "description",
            TicketEdit {
                description: Some(description.to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "checklist",
            TicketEdit {
                add_checklist_items: checklist.to_vec(),
                ..TicketEdit::default()
            },
        ),
    ] {
        let applied = assembled
            .apply(&edit, later)
            .unwrap_or_else(|error| panic!("the {name} edit was refused: {error}"));
        assembled = parse_written(&applied.bytes, &key);
    }

    let mut report = Report::default();
    let created_state = CreatedState::of(&created);
    let assembled_state = CreatedState::of(&assembled);

    // Nothing here may be a default, or two blank tickets would agree about
    // nothing and the comparison below would prove nothing.
    report.equal("created", "status", created_state.status, Status::InReview);
    report.equal("created", "priority", created_state.priority, Priority::P1);
    report.equal("created", "labels", created_state.labels.len(), 2);
    report.equal("created", "checklist", created_state.checklist.len(), 2);
    report.check("created", !created_state.description.is_empty(), || {
        "the create wrote no description".to_owned()
    });

    report.check("both paths", created_state == assembled_state, || {
        format!("created {created_state:#?}\nassembled {assembled_state:#?}")
    });

    // The excluded fields are excluded because they must differ, so say so here
    // rather than only in the comment: a create that reused an id or a key would
    // be a far worse defect than one that dropped a label.
    report.check(
        "identity",
        created.ticket().id != assembled.ticket().id
            && created.ticket().key != assembled.ticket().key,
        || "two creations claimed the same id or the same key".to_owned(),
    );
    report.check(
        "history",
        created.ticket().activity.len() == 1 && assembled.ticket().activity.len() == 6,
        || {
            format!(
                "expected one create event against a create plus five updates, got {} and {}",
                created.ticket().activity.len(),
                assembled.ticket().activity.len()
            )
        },
    );
    report.finish();
}

/// V0-09's negative clause: **`rank` is written only by manual reordering.**
///
/// `CreatedState` above compares the two creation paths' ranks, but both are
/// `None`, so that comparison holds no matter how wrong they are — a create that
/// started allocating a rank would agree with an edit path that did too. This is
/// the side that does not pass by accident.
///
/// It matters because a rank is the one field on a ticket that means "a human
/// dragged this here". ADR 0003 keeps board order out of ticket data except when
/// a person put it there, so a create, a panel save, or a comment that quietly
/// wrote one would put an ordering nobody chose into a file an agent also reads.
#[test]
fn nothing_but_a_manual_reordering_ever_writes_a_rank() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path();
    let later = "2026-07-30T10:05:00.000Z";
    let mut report = Report::default();

    // Both create surfaces, each with every field it can set. `NewTicket` has no
    // rank field, so what is pinned here is that the writer invents none.
    let creates = [
        (
            "quick create",
            NewTicket {
                title: "A title and nothing else".to_owned(),
                description: String::new(),
                status: None,
                priority: None,
                labels: Vec::new(),
                checklist: Vec::new(),
            },
        ),
        (
            "full create",
            NewTicket {
                title: "Every field the create surface can set".to_owned(),
                description: "Written in the create panel.".to_owned(),
                status: Some(Status::InReview),
                priority: Some(Priority::P1),
                labels: vec!["backend".to_owned()],
                checklist: vec!["Read the file".to_owned()],
            },
        ),
    ];
    let mut base = None;
    for (name, new) in &creates {
        let written = prepare_new_ticket(root, "LC", new, NOW).expect("the create should land");
        let raw = std::str::from_utf8(&written.bytes).expect("app output should be UTF-8");
        report.check(name, !raw.contains("\nrank:"), || {
            format!("the create wrote a rank nobody dragged:\n{raw}")
        });
        let document = parse_written(&written.bytes, &written.key);
        report.check(name, document.ticket().rank.is_none(), || {
            format!("the created ticket has rank {:?}", document.ticket().rank)
        });
        base = Some((written.key.clone(), document));
    }
    let (key, base) = base.expect("the creates should have produced a document");
    let item = base.ticket().checklist[0]
        .id
        .clone()
        .expect("the create should have marked its checklist item");

    // And every other mutation a `TicketEdit` can carry. Any of these reaching a
    // rank would be the panel writing board order on the human's behalf.
    let mutations = [
        (
            "title",
            TicketEdit {
                title: Some("Renamed in the panel".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "status",
            TicketEdit {
                status: Some(Status::Done),
                ..TicketEdit::default()
            },
        ),
        (
            "priority",
            TicketEdit {
                priority: Some(Priority::Urgent),
                ..TicketEdit::default()
            },
        ),
        (
            "labels",
            TicketEdit {
                labels: Some(vec!["storage".to_owned()]),
                ..TicketEdit::default()
            },
        ),
        (
            "archive",
            TicketEdit {
                archived: Some(true),
                ..TicketEdit::default()
            },
        ),
        (
            "description",
            TicketEdit {
                description: Some("Rewritten in the panel.".to_owned()),
                ..TicketEdit::default()
            },
        ),
        (
            "checklist toggle",
            TicketEdit {
                checklist: vec![ChecklistToggle {
                    item_id: item.clone(),
                    checked: true,
                }],
                ..TicketEdit::default()
            },
        ),
        (
            "checklist append",
            TicketEdit {
                add_checklist_items: vec!["One more task".to_owned()],
                ..TicketEdit::default()
            },
        ),
        (
            "comment",
            TicketEdit {
                comment: Some("Leaving a note.".to_owned()),
                ..TicketEdit::default()
            },
        ),
    ];
    for (name, edit) in &mutations {
        let applied = match base.apply(edit, later) {
            Ok(applied) => applied,
            Err(diagnostic) => {
                report
                    .failures
                    .push(format!("{name}: the edit was refused: {diagnostic}"));
                continue;
            }
        };
        let raw = std::str::from_utf8(&applied.bytes).expect("app output should be UTF-8");
        report.check(name, !raw.contains("\nrank:"), || {
            format!("this edit wrote a rank into the file:\n{raw}")
        });
        report.check(
            name,
            !applied.changes.iter().any(|change| change.field == "rank"),
            || "this edit recorded a rank change in the activity history".to_owned(),
        );
        // Read back the way the app will read it, so an in-memory `None` over a
        // rank the bytes do carry cannot hide the write.
        report.check(
            name,
            parse_written(&applied.bytes, &key).ticket().rank.is_none(),
            || "the re-read ticket carries a rank".to_owned(),
        );
    }

    // The control. Without it every claim above would also hold for a build in
    // which nothing whatsoever can write a rank. It reports rather than panics,
    // so an injected regression shows up beside the claims it broke.
    match base.apply(
        &TicketEdit {
            rank: Some(Some("a0V".to_owned())),
            ..TicketEdit::default()
        },
        later,
    ) {
        Ok(reordered) => report.equal(
            "manual reorder",
            "rank",
            parse_written(&reordered.bytes, &key)
                .ticket()
                .rank
                .as_deref(),
            Some("a0V"),
        ),
        Err(diagnostic) => report
            .failures
            .push(format!("manual reorder: was refused: {diagnostic}")),
    }
    report.finish();
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
