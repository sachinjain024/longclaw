---
title: "Complete Step 14 recovery behavior"
status: completed
backlog: "V0-27, V0-28, V0-29, V0-30, V0-31, V0-32, V0-33, V0-40"
step: 14
owner: Storage / Frontend / Persistence / Platform
---

# Complete Step 14 recovery behavior

This branch starts from latest `main` after V0-26 and Step 16a. The purpose is
to close the remaining Step 14 rows without expanding into Step 16 polish. Most
of the backend recovery mechanics already exist; the work here is to fill the
remaining user-visible gap, record the proof for rows that are already true, and
leave verification evidence in one place.

## Remaining Rows

- V0-27 — partial files settle, later events recover final content.
- V0-28 — deleted or renamed ticket while it is open.
- V0-29 — permission and disk-write failures as typed actionable states.
- V0-30 — corrupt/deleted index recovery and idempotent rebuild.
- V0-31 — recoverable project registry copy before schema changes.
- V0-32 — cleanup after project creation I/O failure.
- V0-33 — fault-injection and concurrency suite.
- V0-40 — Dependabot alert scope for what ships.

## Implementation Plan

1. Add the missing open-panel recovery for an external delete/rename:
   the panel must stop pretending stale content is current, preserve unsaved
   drafts visibly, and offer explicit next actions.
2. Pin the behavior with frontend tests.
3. Audit existing backend tests against V0-27, V0-30, V0-32, and V0-33 before
   adding new machinery.
4. Add or document registry recovery proof for V0-31.
5. Record the V0-40 Dependabot scope decision against the current shipping app.
6. Update the backlog and release risks only after the verification evidence is
   in hand.

## Non-Goals

- No Step 16 visual polish changes.
- No broad redesign of the global error banner.
- No new authoritative index store; the in-memory index remains disposable.
- No ticket hard-delete or recreate-from-panel operation.

## Outcome

Completed 2026-08-02 on branch `step-14-complete-recovery`.

What changed:

- V0-28: `App` now turns an external `ticketRemoved` event for the open ticket
  into a `removedSignal` for `TicketPanel`.
- V0-28: `TicketPanel` now has a missing-file state for deleted or renamed
  tickets. It stops rendering stale ticket content as current, keeps unsaved
  draft text visible in memory, and offers `Try reading again` or `Close panel`.
- V0-31: `RegistryStore` now maintains `project-registry.backup.json`, still
  fails closed on invalid registry JSON, and reports both `path` and
  `backupPath` in the typed error.
- V0-32: `initialize_project` now cleans up only the `.longclaw` files and
  directories it claimed when a later project-initialization write fails and the
  chosen folder did not already contain `.longclaw`.
- V0-40: `.github/dependabot.yml` now monitors only the root npm wrapper, the
  shipping desktop npm package, and the shipping desktop Cargo package. The
  archived Tauri spike is intentionally not monitored as a shipping surface.

What was already true and is now recorded:

- V0-27: partial writes and save bursts already settle through the watcher
  stability check and retry on later events.
- V0-29: write failures already cross IPC as ADR-0010 tagged errors; retryable
  I/O/permission failures keep Retry, while conflicts offer review and never
  retry a stale hash.
- V0-30: the production index is in-memory and disposable; clearing/rebuilding
  it reproduces the visible project state from files.
- V0-33: the fault matrix is covered by focused frontend tests, Rust unit fault
  injection, storage race tests, and watcher integration tests.

Verification evidence:

- Frontend: `npm --prefix apps/desktop run test:frontend`
- Rust: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- New V0-28 tests:
  - `TicketPanel.test.tsx` — preserves an unsaved draft after removal, retries
    when the file reappears.
  - `App.test.tsx` — event-stream `ticketRemoved` reaches the open panel.
- New V0-31 test:
  - `registry::tests::a_corrupt_registry_fails_closed_and_can_be_restored_from_backup`
- New V0-32 test:
  - `core::storage::tests::a_late_project_creation_failure_removes_the_directory_it_claimed`

Step 14 is complete after this plan. Step 16's CI-runner interaction-budget gate
V0-42 remains separate and open.
