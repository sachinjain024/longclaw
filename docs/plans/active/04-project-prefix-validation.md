---
title: "Validate the project prefix on rebuild and ingest"
product: LongClaw
status: ready
backlog_id: V0-03
order: 4
owner_area: Format
release_blocking: true
depends_on: none
---

# Validate the project prefix on rebuild and ingest

A ticket directory whose key belongs to a different project is indexed as if it
belonged to this one.

## Why this exists

Step 10 settled the key _grammar_ and made the two validators agree on it. Nothing
yet checks _ownership_: that a ticket key's prefix is this project's key. So a
directory copied from another project, or left behind by a renamed one, is presented
as a ticket of this project — with a key that does not match the project it appears
in.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as _"A
ticket key can still use a prefix that does not match the project key"_, with the
instruction to _"validate the project prefix during rebuild and ingest, degrading
mismatches rather than indexing them."_

Small and isolated. It finishes the work Step 10 started.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`. `npm --prefix apps/desktop ci`
  if `node_modules` is missing.
- `npm run verify` must pass before you commit.
- **Never rewrite, move, or delete the offending file.** Degrading means showing it
  with a diagnostic. This is the format contract's hardest rule (ADR 0009,
  `docs/file_format.md`).

## Current behaviour

In `apps/desktop/src-tauri/src/core/`:

- **`valid_ticket_key`** (`storage.rs:75`) proves the _shape_: a prefix satisfying
  `is_project_key`, a hyphen, then digits with no leading zero. It knows nothing
  about which project it is validating for.
- **`scan_ticket_paths`** (`storage.rs:315`) walks `.longclaw/tickets/*/ticket.md` at
  exactly depth 2 and returns the paths. No key check at all.
- **`TicketIndex::rebuild`** (`index.rs:72`) reads each path and builds a record from
  `file.row()`.
- **`TicketIndex::ingest`** (`index.rs:112`) does the same for one path, and is what
  the watcher calls from `process_burst` (`engine.rs:303`).

There is already a related check to model this on: a ticket whose directory name and
frontmatter `key` disagree is refused, with
`fixtures/format-contract/invalid-key-directory-mismatch/` as its fixture. This is
the same class of defect one level up — directory and frontmatter can agree with each
other while both disagree with the project.

The project's own key is available as `ProjectDocument::project().key`, and the engine
holds it (`engine.rs:250` uses `self.project().key` for ticket creation).

## What to change

1. **Thread the project key into the read path.** `rebuild` and `ingest` both need to
   know it. The engine has it; decide whether to pass it per call or hold it on the
   index, and note that a project key is immutable after the first ticket
   (`docs/file_format.md`), so holding it is safe.
2. **Degrade a mismatch.** A ticket whose prefix is not this project's key becomes a
   `TicketRow::Degraded` with a diagnostic that says what was found and what was
   expected. It stays visible, it stays on disk untouched, and it is never counted as
   a readable ticket.
3. **Refuse to write it.** Confirm the existing degraded-write refusal covers this —
   `edit_ticket` on a degraded row already errors, and a mismatched-prefix ticket must
   inherit that protection rather than being rewritten into conformity.
4. **Keep key allocation honest.** `scan_ticket_directory_names` (`storage.rs`, used
   for allocating the next key) reads directory names so a number is never reused. A
   foreign-prefix directory must not consume a number from _this_ project's sequence
   — check what it does today before changing anything, and record the answer either
   way.

## How to prove it

**A fixture, following the existing convention.** Add a case under
`fixtures/format-contract/` — `invalid-key-foreign-project-prefix/` — with a
`ticket.md` whose directory name and frontmatter key agree with each other and
disagree with the project. `file_format_contract.rs` turns every directory in that
corpus into a test case automatically: _"Adding a fixture adds a test; no code here
needs to change."_ Read `fixtures/format-contract/README.md` first for the expected
`expected.json` shape.

**Integration coverage** in `apps/desktop/src-tauri/tests/storage_integration.rs`:

- a foreign-prefix directory degrades, with a diagnostic naming both keys;
- the file's bytes are identical before and after a rebuild, an ingest, and a refused
  write;
- the rest of the project still loads — one bad directory does not take the board
  down;
- rebuilding twice produces the same visible state, degraded row included
  (`rebuilding_the_index_reproduces_the_same_visible_state` is the model).

**Rename coverage** in `tests/watcher_integration.rs`: renaming a directory _into_ a
foreign prefix degrades the row rather than silently keeping the old one, and renaming
back recovers. `renaming_a_ticket_directory_removes_one_row_and_adds_another` is the
existing model.

## Done when

- The fixture and tests exist and fail against today's behaviour.
- `npm run verify` passes.
- The register row and [the release risks](../../release-risks.md) row are updated.
- The key-allocation question in step 4 above is answered in the `## Outcome` section,
  not left open.

## Watch out for

- **The representative fixture project must stay valid.** `fixtures/representative-project`
  uses `LC` throughout; a stricter check must not degrade any of its six tickets.
  `rebuilding_the_index_reproduces_the_same_visible_state` asserts exactly two
  degraded rows — if that number changes, you have broken something.
- **Case and grammar are already handled.** `is_project_key` covers those. This check
  is only about _whose_ key it is.
- **Do not conflate it with the archived state.** An archived ticket is a valid ticket
  with `archived_at` set (ADR 0004). It is not degraded.
- **Diagnostics are user-facing.** Per ADR 0010 and the create-form lesson in
  [the resolved key report](../completed/project-key-derivation-bug.md), write the
  message for someone looking at a folder, not for a format implementer.
