//! Performance budgets from the Step 4 architecture spike, measured against the
//! real storage path. Ignored by default because building the fixture takes a
//! moment; `npm run perf:rust` runs it.

mod common;

use std::fs;
use std::path::Path;
use std::time::Instant;

use longclaw_desktop_lib::core::storage::NewTicket;
use longclaw_desktop_lib::core::ticket::TicketEdit;
use longclaw_desktop_lib::core::{RebuildReason, TicketRow};

/// A project size well past what a solo builder is likely to reach.
const TICKETS: usize = 5_000;
const LOAD_BUDGET_MS: f64 = 2_500.0;
const SEARCH_BUDGET_MS: f64 = 50.0;
const WRITE_BUDGET_MS: f64 = 250.0;

fn write_large_project(root: &Path) {
    let tickets = root.join(".longclaw/tickets");
    fs::create_dir_all(&tickets).expect("create the tickets folder");
    fs::write(
        root.join(".longclaw/longclaw.yaml"),
        concat!(
            "format: longclaw.project/v1\n",
            "id: 019c8ca0-0000-7000-8000-0000000000ff\n",
            "name: Performance Fixture\n",
            "key: PF\n",
            "theme: indigo\n",
            "created_at: 2026-07-29T00:00:00Z\n",
        ),
    )
    .expect("write the project file");

    for sequence in 1..=TICKETS {
        let directory = tickets.join(format!("PF-{sequence}"));
        fs::create_dir(&directory).expect("create a ticket directory");
        fs::write(
            directory.join("ticket.md"),
            format!(
                "---\n\
                 format: longclaw.ticket/v1\n\
                 id: perf-{sequence}\n\
                 key: PF-{sequence}\n\
                 title: Searchable storage ticket {sequence}\n\
                 status: todo\n\
                 priority: none\n\
                 labels:\n  - storage\n\
                 created_at: 2026-07-29T00:00:00Z\n\
                 updated_at: 2026-07-29T00:00:00Z\n\
                 ---\n\
                 \n\
                 A description long enough to exercise the search text the index\n\
                 keeps for ticket {sequence}.\n\
                 \n\
                 ## Checklist\n\
                 \n\
                 - [ ] Measure it <!-- longclaw:item=ck_{sequence} -->\n\
                 \n\
                 ## Activity\n\
                 \n\
                 <!-- longclaw:event\n\
                 id: evt_{sequence}\n\
                 kind: create\n\
                 occurred_at: 2026-07-29T00:00:00Z\n\
                 actor:\n\
                 \x20 type: human\n\
                 \x20 id: local\n\
                 -->\n\
                 ### You created this ticket\n\
                 <!-- /longclaw:event -->\n"
            ),
        )
        .expect("write a ticket");
    }
}

#[test]
#[ignore = "explicit performance harness; run through npm run perf:rust"]
fn performance_budgets_for_project_load_search_and_write() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path().join("large-project");
    write_large_project(&root);

    let started = Instant::now();
    let (engine, _events) =
        common::start_engine_with(&root, longclaw_desktop_lib::engine::WatcherAdapter::Native);
    let open_ms = started.elapsed().as_secs_f64() * 1_000.0;

    let rebuilt = engine
        .rebuild(RebuildReason::Manual, false)
        .expect("the index should rebuild");
    let search = engine.search("ticket 4999");
    let detail_started = Instant::now();
    let detail = engine.detail("PF-4999").expect("a ticket should read");
    let detail_ms = detail_started.elapsed().as_secs_f64() * 1_000.0;

    let hash = match rebuilt
        .tickets
        .iter()
        .find(|row| row.key() == "PF-4999")
        .expect("PF-4999")
    {
        TicketRow::Indexed(row) => row.content_hash.clone(),
        TicketRow::Degraded(row) => panic!("unreadable: {}", row.diagnostic.message),
    };
    let write_started = Instant::now();
    engine
        .edit_ticket(
            "PF-4999",
            &TicketEdit {
                title: Some("Measured write".to_owned()),
                ..TicketEdit::default()
            },
            &hash,
        )
        .expect("the write should be accepted");
    let write_ms = write_started.elapsed().as_secs_f64() * 1_000.0;

    let create_started = Instant::now();
    let created = engine
        .create_ticket(&NewTicket {
            title: "Measured creation".to_owned(),
            ..NewTicket::default()
        })
        .expect("creation should be accepted");
    let create_ms = create_started.elapsed().as_secs_f64() * 1_000.0;

    println!(
        "PERF tickets={TICKETS} open_ms={open_ms:.2} rebuild_ms={:.2} search_ms={:.2} \
         detail_ms={detail_ms:.2} write_ms={write_ms:.2} create_ms={create_ms:.2}",
        rebuilt.rebuilt_in_ms, search.elapsed_ms
    );

    assert_eq!(rebuilt.tickets.len(), TICKETS);
    assert_eq!(created.ticket.key(), format!("PF-{}", TICKETS + 1));
    assert_eq!(search.tickets.len(), 1);
    assert!(detail.ticket.is_some());
    assert!(
        rebuilt.rebuilt_in_ms <= LOAD_BUDGET_MS,
        "index rebuild budget exceeded: {:.2}ms",
        rebuilt.rebuilt_in_ms
    );
    assert!(
        search.elapsed_ms <= SEARCH_BUDGET_MS,
        "search budget exceeded: {:.2}ms",
        search.elapsed_ms
    );
    assert!(
        write_ms <= WRITE_BUDGET_MS,
        "single write budget exceeded: {write_ms:.2}ms"
    );
}
