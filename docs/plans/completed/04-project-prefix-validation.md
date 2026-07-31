---
title: "Validate the project prefix on rebuild and ingest"
product: LongClaw
status: done
completed: 2026-07-31
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

## Outcome

Closed on 2026-07-31.

### The key-allocation question, answered

**Key allocation was already honest, and nothing needed changing.**
`scan_ticket_directory_names` returns every directory name unfiltered, including
foreign ones, but `prepare_new_ticket` feeds each name through
`next_sequence_of(name, project_key)` (`storage.rs`), which begins with
`strip_prefix(project_key)?`. A name that does not start with this project's key
returns `None` and never reaches the `max()`. So a `ZZ-98` directory sitting in an
`LC` project cannot push `LC`'s next key to 99.

The filtering happens at the one place that cares rather than in the scan, which is
right: the scan's job is "every directory name, so a number is never reused", and
narrowing it there would weaken that guarantee for no gain. Both facts are now
written down — a comment on `scan_ticket_directory_names` explaining the division of
labour, and two tests that fail if it changes
(`a_foreign_prefix_directory_does_not_spend_a_key` in `core/storage.rs`, and
`a_foreign_prefix_directory_does_not_consume_this_project_s_next_key` in
`tests/storage_integration.rs`, which plants `ZZ-98` and asserts the next key is
`LC-100`). Both pass against the pre-fix code; they are regression guards, not
proof of a defect.

### Where the check went, and why there

**`storage::read_ticket_file(path, project_key)`** — one chokepoint, applied before
the contents are parsed. The plan asked for `rebuild` and `ingest`; putting it one
layer lower means the detail panel and the write path inherit it too, and no future
reader can be written that forgets to ask whose ticket it is reading.

Ownership is two small pure functions rather than a branch inside the reader:

- `belongs_to_project(project_key, ticket_key)` — the rule. `valid_ticket_key`
  proves a key's *shape*; this proves *whose* it is. They stay separate because
  grammar is a property of the string and ownership is a property of where the
  string sits.
- `foreign_project_diagnostic(project_key, ticket_key)` — the message.

Splitting them out is what lets the fixture corpus test the real rule rather than a
copy of it.

**The project key is passed per call, not held on the index.** The plan noted that
holding it would be safe because the key is immutable after the first ticket. It
would be, but it would also make the index cache an answer it does not own: the
project document is authoritative and `ProjectEngine::rebuild` re-reads it every
time. Passing it keeps one source of truth, and keeps the index what plan 03 left
it as — a store of rows that decides nothing.

That forced one ordering change, in `ProjectEngine::rebuild`: the project document
is now read *before* the tickets. It used to be read after, which was harmless when
nothing depended on the key; now a rebuild that read it afterwards would index the
new files against the previous key.

`process_burst` reads the key once per burst, so every path in one burst is judged
against the same project.

### Three things the write path already got right

1. **The refusal was inherited, not added.** `prepare_ticket_edit` already refuses
   to write when `file.parsed` is an error, so a foreign ticket became unwritable
   the moment it became degraded. Only the wording needed a third branch: "will not
   rewrite a ticket it cannot parse" is untrue of a file that parses perfectly and
   simply is not ours.
2. **`resolve_ticket_path` still resolves it.** `ZZ-1` satisfies the key grammar, so
   the detail panel opens a foreign ticket and shows its raw bytes. Degrading means
   showing it, and that only works if the path resolves.
3. **`atomic_replace` did not need the project key.** Its one internal read exists to
   name whoever wrote the bytes it displaced, and it can only be reached for a
   ticket the caller already proved is ours. It calls a private
   `read_ticket_file_unowned`; both it and the public reader delegate to one
   `read_ticket_file_owned_by(path, Option<&str>)`, so there is a single reader with
   one named exception rather than two parallel paths. The `Option` stays private —
   the public signature still requires a key.

A foreign directory is never parsed at all. Ownership is decided from the directory
name, and a file that is not ours does not get its contents read into a document
that would then be discarded.

### Ownership is checked before the contents

A directory renamed from `LC-3` to `ZZ-3` breaks two rules at once: the frontmatter
no longer agrees with the directory, and the directory names another project. The
ownership diagnostic wins, because ownership is settled from the directory name
before the bytes are parsed at all. That is the more useful answer — "this folder is
in the wrong project" tells the user what to do; "the key does not match the
directory" invites them to edit the frontmatter and make it worse. The watcher test
asserts the ownership wording specifically, since a message about the directory
alone is exactly what this defect looked like before the fix.

### The corpus needed one field

`expected.json` gained an optional `projectKey`. Absent, it defaults to the
directory's own prefix, so all 25 existing cases are read by their own project and
behave exactly as before. `invalid-key-foreign-project-prefix` sets it to `LC` while
its directory and frontmatter both say `ZZ-1`.

The harness's `read_case` composes `belongs_to_project` and
`foreign_project_diagnostic` ahead of `TicketDocument::parse`, mirroring
`read_ticket_file`. The alternative was giving `TicketDocument::parse` a project key,
which would have made ownership a document-level rule; it is not. A document does
not know where it lives.

`TicketDocument::parse` is untouched, and the README's promise holds: adding a
directory still adds a case.

### How it was proved

| Case | Test |
|---|---|
| The rule is about ownership, not grammar | `ownership_is_about_whose_key_it_is_and_not_about_the_grammar` (`core/storage.rs`) |
| The diagnostic names both keys and promises nothing was touched | `the_diagnostic_names_both_keys_and_promises_nothing_was_touched` |
| A foreign directory degrades with its bytes intact, and reads fine as its own project's ticket | `a_directory_from_another_project_degrades_with_its_bytes_intact` |
| It is visible, refuses a write, survives two rebuilds identically, and does not take the board down | `a_ticket_directory_from_another_project_is_shown_and_never_claimed` (`tests/storage_integration.rs`) |
| It does not spend a key | `a_foreign_prefix_directory_does_not_spend_a_key`, `a_foreign_prefix_directory_does_not_consume_this_project_s_next_key` |
| A rename into a foreign prefix degrades, and renaming back recovers | `renaming_a_ticket_directory_into_another_project_s_key_degrades_and_renaming_back_recovers` (`tests/watcher_integration.rs`) |
| The format contract fixes the rule | `invalid-key-foreign-project-prefix` |

**The red half was verified.** With `belongs_to_project` reduced to `true` — the old
behaviour — the tests that are about the defect fail and the rest pass:

```
core::storage::tests::ownership_is_about_whose_key_it_is_and_not_about_the_grammar ... FAILED
core::storage::tests::a_directory_from_another_project_degrades_with_its_bytes_intact ... FAILED
test result: FAILED. 78 passed; 2 failed

1 contract expectation(s) failed:
  - invalid-key-foreign-project-prefix: parsed successfully but should be degraded

test a_ticket_directory_from_another_project_is_shown_and_never_claimed ... FAILED
test result: FAILED. 16 passed; 1 failed

test renaming_..._degrades_and_renaming_back_recovers ... FAILED
expected an ownership diagnostic, got "Ticket key LC-3 does not match its directory
ZZ-3. A ticket's key and path never change after creation."
```

The representative fixture project is untouched: it still loads six tickets with
exactly two degraded rows, and `rebuilding_the_index_reproduces_the_same_visible_state`
passes unchanged.

`npm run verify` passes, including `npm run test:watcher`.

### Also written down

The ownership rule is now in [`docs/file_format.md`](../../file_format.md) — beside
the project-key grammar, and as a reader rule under "Write and conflict rules". It
was implied by "the project key is the prefix of every ticket key" and by nothing
else, which is how it went unenforced.

### Still open

Nothing this plan set out to do. Worth knowing for whoever picks up the next item:
the diagnostic tells the user to move or rename the folder by hand. There is no
surface that offers to do it for them, and per the format contract there should not
be one until someone decides what "adopt this ticket" means — it would have to
rewrite the frontmatter key, which is the one field the format says never changes.
