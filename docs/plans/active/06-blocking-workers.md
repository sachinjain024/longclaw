---
title: "Move heavy work off the command thread"
product: LongClaw
status: ready
backlog_id: V0-05
order: 6
owner_area: Platform
release_blocking: false
depends_on: "01-atomic-replace-race, 03-attribution-from-new-records (both change the write and burst paths this moves)"
---

# Move heavy work off the command thread

Scans, parsing, and fsync run synchronously inside Tauri commands. On a large project
that blocks the command, and it will block focus recovery and the wake callback.

## Why this exists

The spike kept orchestration synchronous on purpose, to expose the state flow. That
choice is recorded, and so is its cost: a large rebuild blocks whatever invoked it.
Today 5,000 tickets rebuild in ~640–711 ms in a debug build, comfortably inside the
2,500 ms load budget — so this is not urgent correctness work. It becomes urgent the
moment recovery triggers (item 05) start firing rebuilds while the user is typing.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as _"A
large synchronous rebuild can block a Tauri command, focus recovery, or future native
wake callback."_

**Do items 01 and 03 first.** Both change the write and burst paths this item moves
around. Settling correctness before concurrency is cheaper than the reverse.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`. `npm --prefix apps/desktop ci`
  if `node_modules` is missing.
- `npm run verify` must pass before you commit.
- **Never mutate webview state from a worker.** Publish one final snapshot or event
  back on the Tauri handle (ADR 0009). This is the constraint that shapes the whole
  design.
- Commands, events, and channels have distinct jobs (ADR 0007). This work must not
  blur them.

## Current behaviour

Every Tauri command in `apps/desktop/src-tauri/src/lib.rs` is a synchronous `fn` that
calls straight into the engine — `open_project`, `rebuild_index`, `search_tickets`,
`read_ticket`, `edit_ticket`, `create_ticket`. The heavy paths underneath:

- **`TicketIndex::rebuild`** (`src/core/index.rs:72`) — `scan_ticket_paths` plus a
  `read_ticket_file` and parse per ticket, all inline.
- **`ProjectEngine::commit`** (`src/engine.rs:259`) — `atomic_write`, which does
  `sync_all` on the file _and_ on the parent directory (`storage.rs:428-458`). Two
  fsyncs per write, synchronously.
- **`process_burst`** (`src/engine.rs:303`) — reads, hashes, and parses every changed
  path on the watcher thread, then calls `(self.sink)(envelope)` via `emit`
  (`engine.rs:292`).

The watcher work is already off the main thread. The command work is not.

## What to change

1. **Bound the workers.** A bounded pool, not a thread per request. Two concurrent
   rebuilds of the same project should not both run — coalesce or queue them. The
   engine already has `self.creation` as a mutex-guarded claim, which is the shape to
   follow.
2. **Move scan, parse, and fsync onto it.** Leave the orchestration and the state
   transitions where they are; only the expensive I/O and CPU work relocates.
3. **Publish once, on the handle.** One final snapshot or event back through the
   existing `EventSink` (`engine.rs:131`), not incremental cross-thread updates. The
   frontend's contract (sequence numbers, ADR 0007) does not change.
4. **Keep commands answering.** A command that kicks off a rebuild should return
   promptly with something honest, and the completion should arrive as an event. Decide
   whether existing command signatures change; if they do, the IPC contract fixtures in
   `src-tauri/tests/fixtures/ipc-contract.json` and `tests/ipc_requests.rs` need
   updating in the same change.

## How to prove it

- **Responsiveness under a rebuild.** With a 5,000-ticket project rebuilding, another
  command must still answer inside its budget. `tests/performance.rs` already builds a
  5,000-ticket project (`TICKETS = 5_000`) and asserts `LOAD_BUDGET_MS = 2_500`,
  `SEARCH_BUDGET_MS = 50`, `WRITE_BUDGET_MS = 250`. Add the concurrent case there;
  it runs via `npm run perf:rust` and is `#[ignore]`d by default.
- **No duplicate rebuilds.** Two triggers close together produce one rebuild and one
  generation bump.
- **Rebuild equivalence still holds.** `rebuilding_the_index_reproduces_the_same_visible_state`
  in `storage_integration.rs` must pass unchanged. Moving work between threads must not
  change what the user sees — that is the whole point.
- **No cross-thread webview mutation.** Assert structurally where you can, and state in
  the `## Outcome` how you know.
- **The full watcher suite.** `npm run test:watcher` plus the ten cases in
  `watcher_integration.rs`, which cover suppression, coalescing, and rename handling.
  These are the tests most likely to break, and the ones that matter most.

## Done when

- The concurrent-command case is in `tests/performance.rs` and passes.
- `npm run verify` and `npm run test:watcher` pass; `npm run perf:rust` is run and its
  `PERF …` line recorded in the `## Outcome` section for comparison with the spike's
  numbers.
- The register row is updated.
- If any command signature or event shape changed, `tests/ipc_requests.rs` and the IPC
  contract fixture reflect it.

## Watch out for

- **This is a refactor with no user-visible feature.** Its only justification is that
  behaviour stays identical while blocking goes away. If you find yourself changing
  what the user sees, stop — that is a different plan.
- **Do not add SQLite.** The register is explicit: keep the in-memory index and move to
  SQLite only when a measured budget fails. It has not.
- **Do not widen the scope to a general async refactor.** Commands are synchronous by
  choice; this item moves specific heavy work, not the architecture.
- **Watch the receipt window.** Receipts expire five seconds after `remember`
  (`engine.rs:54`). If a write's fsync now happens on a worker and takes longer to
  land, the receipt can expire before the watcher event arrives — which is a
  duplicate-refresh risk, and the register asks for duplicate-rate diagnostics before
  anyone tunes the TTL.
