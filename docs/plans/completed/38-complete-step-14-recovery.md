---
title: "Step 14 recovery behavior follow-up"
status: completed
backlog: "V0-27, V0-28, V0-30, V0-31, V0-32, V0-33, V0-40"
step: 14
owner: Storage / Frontend / Persistence / Platform
---

# Step 14 recovery behavior follow-up

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

Completed 2026-08-02 on branch `step-14-complete-recovery`, then corrected on
`fix/step-14-review-followup` after review.

What changed:

- V0-28: `App` now turns an external `ticketRemoved` event for the open ticket
  into a `removedSignal` for `TicketPanel`.
- V0-28: `TicketPanel` now has a missing-file state for deleted or renamed
  tickets. It stops rendering stale ticket content as current, keeps unsaved
  title, description, checklist, unsent comment, and in-flight comment text
  visible in memory, and offers `Try reading again` or `Close panel`.
- V0-31: `RegistryStore` now writes `project-registry.backup.json` from the
  current live registry before each later save, still fails closed on invalid
  registry JSON, and reports both `path` and `backupPath` in the typed error.
  Recovery is documented in `apps/desktop/README.md`.
- V0-32: `initialize_project` now cleans up only the `.longclaw` files and
  directories it claimed when a later project-initialization write fails; if the
  chosen folder already had `.longclaw`, cleanup is skipped and the error names
  the left-behind paths and why.
- V0-33: `npm --prefix apps/desktop run test:stress` repeats rapid external
  bursts and the app/external write race.
- V0-40: the archived Tauri spike no longer exposes live npm or Cargo manifests
  on `main`; `.github/dependabot.yml` still scopes version updates to shipping
  package roots, and `archived-spikes:check` fails if spike manifests reappear.

What was already true and is now recorded:

- V0-27: partial writes and save bursts already settle through the watcher
  stability check and retry on later events.
- V0-30: the production index is in-memory and disposable; clearing/rebuilding
  it reproduces the visible project state from files.

Verification evidence:

- Frontend: `npm --prefix apps/desktop run test:frontend`
- Rust: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- Stress: `npm --prefix apps/desktop run test:stress`
- Shipping dependency surface: `npm --prefix apps/desktop run archived-spikes:check`
- New V0-28 tests:
  - `TicketPanel.test.tsx` — preserves an unsaved draft after removal, retries
    when the file reappears.
  - `App.test.tsx` — event-stream `ticketRemoved` reaches the open panel.
- New V0-31 test:
  - `registry::tests::a_corrupt_registry_fails_closed_and_can_be_restored_from_backup`
  - `registry::tests::a_registry_backup_holds_the_state_before_the_latest_save`
- New V0-32 test:
  - `core::storage::tests::a_late_project_creation_failure_removes_the_directory_it_claimed`
  - `core::storage::tests::a_late_project_creation_failure_names_pre_existing_residue`

## Review Correction

The first 2026-08-02 closeout incorrectly marked V0-29 done. It was not done:
plan 23 explicitly left board-raised two-way conflicts, shared conflict copy,
file-named permission/I/O recovery, and panel Undo conflicts to V0-29. The
backlog row is reopened and Step 14 is not complete until that work lands.

Step 16's CI-runner interaction-budget gate V0-42 remains separate and open.
