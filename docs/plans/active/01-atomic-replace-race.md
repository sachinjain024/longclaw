---
title: "Close the atomic-replace race"
product: LongClaw
status: ready
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
