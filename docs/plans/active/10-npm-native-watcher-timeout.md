---
title: "Stop npm from breaking the native watcher check"
product: LongClaw
status: ready
backlog_id: "—"
order: 10
owner_area: Platform
release_blocking: true
depends_on: none
---

# Stop npm from breaking the native watcher check

During item 09 validation, the product watcher fix passed its focused tests, the
polling watcher integration suite, and the native watcher when Cargo was invoked
directly. The same native watcher test timed out when launched through npm.

This keeps `npm run verify` red locally even though the item 09 product fix is
working. Treat it as a gate defect: if `verify` can go red because of how the
native watcher test is launched, it cannot be trusted as the local release gate.

## Evidence

Green direct Cargo run from `apps/desktop/src-tauri`:

```sh
cargo test --test watcher_integration filesystem_round_trip -- --ignored --nocapture
```

Result:

```text
PERF external_visibility_pipeline_ms=192.23 coalesced_events=6
test filesystem_round_trip_covers_self_writes_bursts_deletion_and_reconcile ... ok
```

Red npm-launched runs:

```sh
npm --prefix apps/desktop run test:watcher
npm --prefix apps/desktop run verify
npm run verify
```

The failure is always the same native watcher timeout:

```text
thread 'filesystem_round_trip_covers_self_writes_bursts_deletion_and_reconcile' panicked at tests/watcher_integration.rs:30:10:
an external change should become visible without a manual refresh: Timeout
```

Two failed experiments are worth not repeating:

- Waiting longer after `ProjectEngine::start_with_adapter(..., WatcherAdapter::Native)`
  did not make `npm run verify` reliable.
- Reordering the desktop `verify` script to run `test:watcher` before `check` did
  not make the npm-launched watcher reliable.

Scrubbing a few npm lifecycle variables also did not fix the top-level run.

## Do this

Find the actual difference between the direct Cargo process and the npm-launched
Cargo process on macOS. Useful starting points:

- Capture and diff the environment for the direct and npm-launched Cargo process.
- Check whether npm changes process group, session, cwd, stdio, or launch services
  state in a way that affects FSEvents.
- Keep the native watcher check native. Do not silently replace it with the
  polling adapter in `test:watcher`; the point of this target is to cover the
  production adapter.

The fix can be in the npm script, the test harness, or the macOS watcher setup,
but it must preserve a real native watcher round trip.

## Done when

- The direct Cargo native watcher command still passes.
- `npm --prefix apps/desktop run test:watcher` passes repeatedly.
- `npm run verify` passes locally.
- The item 09 branch can use `npm run verify` as a trustworthy validator again.
