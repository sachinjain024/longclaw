---
title: "Unsupported schema versions are read-only"
status: completed
backlog: V0-26
step: 14
owner: Frontend
---

# Unsupported schema versions are read-only

Step 14 starts here, with the first remaining Wave 3 recovery row. The parser
already degrades a ticket whose format version is newer than this build supports,
and the write path refuses to rewrite a degraded ticket. What is missing is the
user-facing contract: a future file should read as a protected record, not as a
broken file awaiting repair.

This plan deliberately avoids Step 16 polish work. It only changes state copy,
affordances, and tests for the newer-version recovery path.

## Must Pass

- A newer-version ticket row remains visible on the board and list, labelled as a
  newer format rather than a repair task.
- Opening that ticket shows the raw file content, the diagnostic, and a read-only
  explanation that says LongClaw will not rewrite it.
- Editable ticket actions are absent because there is no trustworthy parsed
  document to mutate.
- A regression test proves the panel does not offer archive or edit controls for
  a newer-version ticket.
- Existing degraded parse failures still say they are shown without repair, not
  read-only future files.

## Notes

- V0-27 owns transient partial-write recovery. Do not add timers, retries, or
  watcher changes here.
- V0-29 owns broad permission and disk-write failure copy. Do not redesign the
  global error banner here.
- V0-28 owns the open-panel behavior when a ticket is deleted or renamed while
  being edited.

## Outcome

Completed 2026-08-01 on branch `step-14-trust-conflict-recovery`.

Newer-version tickets now have their own frontend state:

- Board cards already carried `newer format`; a regression test now pins that it
  never falls back to `needs repair`.
- Issue-list degraded rows now say `Newer format` for read-only unsupported
  tickets while ordinary parse failures still say `View raw file`.
- The ticket panel now says `Newer format, shown read-only`, shows the raw file
  and diagnostic, and states that this build will not rewrite it.
- Ordinary parse failures still say `Shown without repair` and tell the user to
  fix the file in an editor or wait for the watcher to reload it.
- Panel tests prove a newer-version ticket exposes no title, archive, status, or
  edit controls and does not call the write path.

No storage or watcher behavior changed. The parser and write path already made
unsupported versions non-mutating; this plan made that contract visible and
tested.

Verification:

- `npm --prefix apps/desktop run test:frontend`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `npm --prefix apps/desktop run verify` passed through tokens, format, lint,
  typecheck, frontend tests, Rust tests, and build; its final native watcher test
  failed once with the known timeout shape.
- `npm --prefix apps/desktop run test:watcher` passed immediately afterward
  (`external_visibility_pipeline_ms=182.99`).
