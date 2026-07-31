---
title: "Close the atomic-replace race"
product: LongClaw
status: done
completed: 2026-07-31
backlog_id: V0-01
order: 1
owner_area: Storage
release_blocking: true
depends_on: none
---

# Close the atomic-replace race

An external write that lands while the app is saving is destroyed, and the app
reports success. This is the most severe untested path in the product.

## Why this exists

The product's whole claim is that files on disk are the source of truth and that an
agent and a human can both write them. This defect silently discards the agent's
work — or the human's editor's — and tells nobody. It is release-blocking, and it
is the reason nothing else is first in the order.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as _"An
external write between expected-hash validation and atomic replacement can be
silently overwritten and its watcher notification suppressed."_

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"` — rustup's shims are not on
  `PATH` by default. `npm --prefix apps/desktop ci` if `node_modules` is missing.
- `npm run verify` must pass before you commit.
- Rust owns every filesystem decision (ADR 0009). Errors cross IPC as a closed
  tagged shape (ADR 0010) — a conflict is `ErrorCode::Conflict`, recoverable.
- Never rewrite or delete a file the app cannot parse.

## Current behaviour

Four steps, in `apps/desktop/src-tauri/`:

1. **`ProjectEngine::edit_ticket`** (`src/engine.rs:239`) calls
   `prepare_ticket_edit`, then `commit`.
2. **`prepare_ticket_edit`** (`src/core/storage.rs:471`) reads the file and compares
   `file.content_hash != expected_hash`, returning `conflict_error`
   (`storage.rs:517`) on mismatch. **This is the only check, and it happens before
   any write.**
3. **`commit`** (`src/engine.rs:259`) hashes the new bytes and records a self-write
   receipt for `(path, hash)` _before_ writing, so the watcher can recognise the
   change as the app's own:
   ```rust
   let hash = content_hash(&write.bytes);
   self.receipts.lock().remember(write.path.clone(), hash.clone(), Instant::now());
   if let Err(error) = atomic_write(&write.path, &write.bytes) { … }
   ```
4. **`atomic_write`** (`src/core/storage.rs:428`) writes a sibling temporary file,
   `sync_all`s it, copies permissions, then at `storage.rs:455`:
   ```rust
   fs::rename(&temporary, path)
   ```
   **That rename replaces the destination unconditionally.**

So a write that lands between step 2's read and step 4's rename is overwritten. And
it is overwritten _quietly_: the receipt from step 3 matches the bytes the app
wrote, so when `process_burst` (`engine.rs:303`) sees the watcher event, it calls
`receipts.consume_if_match(…)` and skips — no `TicketChanged` event, no
acknowledgement, no conflict. The user sees a save that worked.

## Do not just add a second hash check

The register says so explicitly and it is right. A re-read immediately before the
rename narrows the window; it does not close it. Two processes can still interleave
between that check and the rename. A fix that only shrinks the race is not a fix
for silent data loss.

## What to change

The approach the register proposes, and the one to evaluate first:

1. **Swap instead of replace.** On macOS, `renamex_np` with `RENAME_SWAP` exchanges
   two paths atomically. After the swap, the bytes that were on disk are at the
   temporary path, where you can read and hash them.
2. **Check volume support before relying on it.** `RENAME_SWAP` is not available on
   every filesystem. Probe it, and record what you found.
3. **Compare the displaced hash to the one validation saw.** Equal means nothing
   external happened inside the window — remove the temporary file and report
   success as today. Different means an external write landed inside the window.
4. **On mismatch, preserve and report.** Keep the displaced bytes somewhere the user
   can recover them, restore the file to those bytes or surface both, and return
   `ErrorCode::Conflict` carrying the same context keys `conflict_error` already
   uses (`expectedHash`, `actualHash`, `conflictingActorType`,
   `conflictingActorName`) so the existing conflict banner works unchanged.
5. **Define the fallback explicitly.** Where swap is unsupported, refusing the write
   is acceptable. Losing it is not. Write down which you chose and why.

Also fix the suppression half: when the displaced hash does not match, the receipt
for the app's own bytes must not swallow the resulting watcher event, or the UI
still learns nothing. `Receipts::forget` (`engine.rs`, beside `remember`) is the
existing lever.

## How to prove it

**A deterministic barrier-based race test.** Not a sleep, not a timing race that
passes by luck. Drive the interleaving so the external write provably lands between
validation and replacement — a `std::sync::Barrier`, a channel, or a test-only hook
between the two steps. If the test can pass by scheduling accident, it is not
evidence.

Assert all four:

- the external bytes are still recoverable — not gone;
- the caller received `ErrorCode::Conflict`, `recoverable: true`;
- the conflict carries the actor context the banner reads;
- a `TicketChanged` event reaches the sink, so the UI is not left believing the save
  was clean.

**Where.** `apps/desktop/src-tauri/tests/storage_integration.rs`. Helpers in
`tests/common/mod.rs`: `copy_representative_project()`, `start_engine()`,
`start_engine_with()`, `ticket_path()`, `editor_atomic_replace()`,
`replace_title()`, and `serially()` for tests that must not run concurrently. The
existing `a_stale_write_is_a_conflict_that_names_who_changed_the_file` test is the
model for the conflict assertions.

Add the no-swap fallback path as its own case, even if it has to be exercised
through a seam rather than a real filesystem.

## Done when

- The barrier test exists, fails against today's `atomic_write`, and passes after
  the change. Verify the "fails before" half — a race test that never failed proves
  nothing.
- `npm run verify` passes, including `npm run test:watcher`.
- The register row is updated, and [the release risks](../../release-risks.md) row
  for this risk moves to retired with the test named.
- [The round-trip scenario](../../acceptance/agent-round-trip.md) § 7 still passes
  by hand — the conflict path is the one a human sees.

## Watch out for

- **`fs::rename` is used for more than ticket writes.** Check every `atomic_write`
  caller before changing its contract: project metadata (`initialize_project`,
  theme and name changes) and the agent contract file go through it too. A conflict
  return that callers do not expect will surface as an `internal` error.
- **The temporary file name is derived per write** (`.{name}.longclaw-{uuid}.tmp`,
  `storage.rs:440`). Anything you leave behind must not look like a ticket to
  `scan_ticket_paths`.
- **The receipt window is five seconds** (`engine.rs:54`). Do not shorten it to make
  this test easier; that trades one silent path for another.
- **Do not weaken the existing `expected_hash` check.** It catches the common case —
  a stale edit — long before this race matters.

## Outcome

Closed on 2026-07-31. The race is gone, and the test that proves it was confirmed
to fail against the old code first.

### What shipped

`core::storage::atomic_replace` — a second write primitive beside `atomic_write`,
used only for replacing a ticket the user and an agent can both write. It does not
check and then replace. It swaps:

1. Write the sibling temporary file and make it durable.
2. `renamex_np(temporary, path, RENAME_SWAP)`. After it returns, `path` holds the
   new bytes and `temporary` holds whatever `path` held a moment ago.
3. Hash the displaced bytes. Equal to the hash validation saw → remove the
   temporary, sync the directory, success.
4. Different → an external write landed inside the window. Swap back so the
   external bytes are the file again, and return `ErrorCode::Conflict` built by the
   existing `conflict_error`, so the conflict banner works unchanged. One extra
   context key, `racedInsideWrite`, distinguishes it from a stale-edit conflict for
   anyone reading logs.

`TicketWrite` now carries `expected_hash: Option<String>` — `Some` for an edit,
`None` for a create. `ProjectEngine::commit` dispatches on it: an edit goes through
`atomic_replace`, a create through `atomic_write`, because a create has claimed a
directory nobody else holds and has no predecessor to displace. This also means
`RENAME_SWAP`'s requirement that both paths exist is never violated.

The suppression half is fixed in the same place: `commit` already called
`receipts.forget` on a failed write, and that is now load-bearing rather than
incidental. Its comment says so. With the receipt gone and the external bytes on
disk, `process_burst` sees a hash matching neither the receipt nor the index row,
ingests, and emits `TicketChanged` — so the UI learns about the write it was just
told did not happen.

### The fallback, and what it costs

**Where the volume cannot swap, the write is refused.** `atomic_replace` returns a
recoverable `ErrorCode::Io` naming the volume and saying the ticket was left as it
was. `EINVAL` and `ENOTSUP` from `renamex_np` are both treated as unsupported, and
non-macOS builds take the same path unconditionally.

This is the plan's stated preference ("refusing the write is acceptable. Losing it
is not") and it is the right trade, but the cost should be recorded plainly rather
than discovered later: **a project on exFAT, SMB, or NFS cannot be edited in the
app at all.** APFS and HFS+ support `RENAME_SWAP`, so this does not affect an
ordinary repository on an internal disk — but a repository on a USB drive or a
network share is a real thing people have. If that turns out to matter, the answer
is a lock file or an advisory-lock adapter for those volumes, not a narrower race
window. Worth a backlog item if a pilot participant hits it.

### Decisions not in the plan

- **The displaced bytes are restored, not filed away.** The plan offered "restore
  the file to those bytes or surface both". Restoring is what makes them
  recoverable, and it matches what the pre-write conflict check already does: the
  file is left holding the newer version and the caller is told to reconcile. A
  `.bak` beside every raced write would be residue in the user's repository, which
  V0-32 is separately trying to avoid. A preserved copy is written **only** if the
  restoring swap itself fails, and the error then carries `preservedPath`.
- **The test seam is per-thread, not global.** `ReplaceSeams` lives in a
  `thread_local!`, so a test installing a hook cannot reach a test running beside
  it in the same binary. This is sound only because a write runs on the thread that
  asked for it — `edit_ticket` → `commit` → `atomic_replace`, all synchronous.
  **Plan 06 moves writes onto blocking workers and will break this.** The installer
  has to move with the write; the type carries a comment saying so.
- **`atomic_write` was refactored, not left alone.** Both primitives now share
  `write_durable_sibling` and `sync_directory`. Its doc comment now says which
  callers it is still right for (project metadata, the agent contract, the
  registry, a new ticket) and points edits at `atomic_replace`.
- **A file removed mid-save** — `renamex_np` returning `ENOENT` — returns a
  conflict saying so, and does not recreate the file. Reinstating a ticket the user
  or an agent just deleted would be its own kind of silent loss. V0-28 owns what
  the panel does about it.

### How it was proved

Two tests in `apps/desktop/src-tauri/tests/storage_integration.rs`:

- `an_external_write_inside_the_save_window_is_a_conflict_and_survives_it` — the
  `before_swap` seam performs an editor-style atomic replace after the temporary
  file is durable and immediately before the swap, so the external write provably
  lands inside the window. It asserts all four things the plan asked for: the
  external bytes are still on disk, the caller got a recoverable
  `ErrorCode::Conflict`, the conflict carries `conflictingActorType` and
  `conflictingActorName`, and a `TicketChanged` event carrying the external title
  reaches the sink. It also asserts the ticket directory is left with no debris.
- `a_volume_without_an_atomic_swap_refuses_the_write_rather_than_risking_it` —
  drives `force_swap_unsupported`, asserts the refusal is typed and recoverable,
  the file is byte-identical, nothing is left behind, and the *next* write on a
  swap-capable volume still succeeds, so the refusal is about the volume rather
  than a latch the app gets stuck behind.

**The red half was verified.** With `commit` temporarily pointed back at
`atomic_write`, the race test fails on its first assertion — and it fails in the
worst possible way, which is the point:

```
a write that displaced someone else's bytes is not a success:
WriteResult { ticket: Indexed(IndexedRow { key: "LC-2",
  title: "A local edit built on the version validation saw", … }), generation: 2, … }
```

The external edit is gone, and the app returned a clean `WriteResult`.

`npm run verify` passes, including `npm run test:watcher`. `npm run build:app` — the
release bundle CI runs and the local gate skips — also passes.

### Still open

- [The round-trip scenario](../../acceptance/agent-round-trip.md) § 7 has **not**
  been re-walked by hand. It needs a person driving the app. The automated conflict
  coverage is green, but the plan asks for the human path too.
- One new dependency: `libc`, macOS-only, for `renamex_np`.
