---
title: "Recover the watcher over sleep, wake, and overflow"
product: LongClaw
status: ready
backlog_id: V0-04
order: 5
owner_area: Platform
release_blocking: true
depends_on: "02-event-sequence-gap (reuses its snapshot recovery path)"
---

# Recover the watcher over sleep, wake, and overflow

FSEvents drops history over sleep, wake, overflow, and a removed root. Today the only
recovery trigger is a frontend focus handler, so closing a laptop lid can leave the
app confidently wrong.

## Why this exists

A closed lid is not an edge case; it is how laptops are used. The watcher is an
invalidation stream, not a durable log, and the app currently has one recovery path
that only fires if the window loses and regains focus. A wake with the window still
focused fires nothing.

Recorded in [the risk register](../../architecture-spike-risk-register.md) twice:
_"FSEvents can drop history over sleep, wake, overflow, or removed roots"_ and
_"macOS wake while the window remains focused has no native reconciliation
trigger."_ The second carries hard evidence: Tao 0.35.3 documents lifecycle
`Resumed` as unsupported on macOS, and a tagged 30-second release session observed
**zero** `RunEvent::Resumed` callbacks.

**Do item 02 first.** It builds the "reconcile from a snapshot" path this item needs;
doing this one first means building it twice.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`. `npm --prefix apps/desktop ci`
  if `node_modules` is missing.
- `npm run verify` must pass before you commit, and this item is the reason
  `npm run test:watcher` exists — run it.
- Rust owns filesystem authority (ADR 0009). Never mutate webview state off the main
  thread.

## Current behaviour

- **`WatcherAdapter`** (`apps/desktop/src-tauri/src/engine.rs:61`) has two variants,
  `Native` and `Polling { interval_ms }`. `ProjectEngine::start` (`engine.rs:152`)
  uses `Native`; `start_with_adapter` (`engine.rs:159`) is the test seam, and
  `common::start_engine_with` drives it with polling for determinism.
- **`process_burst`** (`engine.rs:303`) turns one settled burst into events. Its first
  act is `if !self.root.is_dir() { self.report_unavailable(); return; }`, so a removed
  root is noticed — but only if an event arrives at all.
- **The only wake-adjacent recovery is in the frontend.** `App.tsx:211-226`:
  ```ts
  const reconcile = () => { … void reconcileProject(activeProjectId) … };
  document.addEventListener("visibilitychange", reconcile);
  window.addEventListener("focus", reconcile);
  ```
  Neither fires on a wake where the window kept focus.
- **A full scan happens on open**, which is why a restart always looks correct and
  hides this class of bug during ordinary testing.

## What to change

1. **A native wake notification.** Observe `NSWorkspaceDidWakeNotification` behind a
   `platform/macos` module, and use it to trigger the same reconciliation the focus
   handler does. Keep it behind a platform boundary so the rest of the engine does not
   grow macOS specifics.
2. **Coalesce it with focus recovery.** A wake usually _also_ produces a focus event.
   One reconciliation, not two — and not two overlapping full scans on a large
   project. This is where item 02's recovery path earns its keep.
3. **Overflow diagnostics.** `notify` can report that it dropped events. Surface that
   as a reason for a full rescan and record it in the local diagnostics
   (`LONGCLAW_LOCAL_DIAGNOSTIC`, stdout only, no telemetry) so a pilot session can be
   read afterwards.
4. **An explicit watcher-unavailable state.** `report_unavailable` (`engine.rs:279`)
   exists; make sure the UI has a state that says the app is no longer watching,
   rather than presenting a board that looks live. A stale board that admits it is
   stale is acceptable; one that does not is the whole problem.

## How to prove it

**Automated**, in `apps/desktop/src-tauri/tests/watcher_integration.rs` — use
`serially()`, since these assert on timing:

- **Overflow injection reconciles.** Simulate or force a dropped-event condition and
  assert the index converges on disk state without a manual rebuild.
- **A removed and restored root recovers.** `a_missing_project_folder_is_reported_and_its_files_are_left_alone`
  in `storage_integration.rs` covers the reporting half; the restore half is what to
  add.
- **Coalescing holds.** Two recovery triggers close together produce one rescan. Assert
  the generation advances once, not twice.
- **No regression in the existing burst tests.** `one_burst_of_saves_produces_one_update_holding_the_final_content`
  and the self-write-suppression tests must still pass — they are what stops this work
  from creating a watcher loop.

**Manual, and unavoidable.** A real sleep/wake soak on a real Mac, with the window
focused the whole time:

1. Open a project, note the board.
2. Externally edit a ticket, confirm it appears.
3. Sleep the machine. Wake it, **without clicking away from the window**.
4. Externally edit a different ticket.
5. The board must show it, with no click, no refresh, no restart.

Repeat across several cycles, and once with the machine asleep long enough for
FSEvents history to be genuinely lost. Record the macOS version and the observed
behaviour, and add the run to
[the acceptance index](../../acceptance/README.md)'s watcher-recovery scenario.

## Done when

- The automated cases above are in the suite and `npm run verify` plus
  `npm run test:watcher` pass.
- The manual soak is recorded — date, macOS version, number of cycles, result. Without
  it this item is not done, because the automated tests cannot exercise a real wake.
- Both register rows are updated, and the two matching
  [release-risk](../../release-risks.md) rows move to retired.
- The watcher-recovery scenario in [the acceptance index](../../acceptance/README.md)
  moves from required to written.

## Watch out for

- **Do not create a watcher loop.** Every recovery path rescans; every rescan can
  produce events. The self-write receipt (`engine.rs:54`, five seconds) and the
  same-hash short-circuit in `process_burst` are what prevent a loop. Understand both
  before adding a third trigger.
- **Do not lose acknowledgements.** `setSnapshot` (`state.ts:113`) deliberately keeps
  `externalMarks` across a rebuild: _"the index is disposable, but what an agent just
  did to the files is not."_ A wake-triggered rescan must not wipe the ring off a card
  the human has not looked at yet.
- **Polling is not a fix.** The `Polling` adapter exists for deterministic tests. Do
  not reach for it in production to paper over FSEvents.
- **Sandboxing interacts with this.** The register's open distribution question
  (security-scoped bookmarks) affects whether a path is still accessible after a wake.
  Out of scope here, but note anything you observe.

## Outcome

Completed 2026-07-31 on branch `fix/05-watcher-recovery`.

What shipped:

- The production watcher now installs a macOS `NSWorkspaceDidWakeNotification`
  observer behind `platform/macos`, owned by the project watcher and removed on
  watcher teardown.
- Wake and overflow signals flow through the watcher worker and call
  `ProjectEngine::rebuild`, reusing the snapshot recovery boundary from item 02.
- Resume and overflow recoveries are coalesced across the debounce window, while a
  missing project root still reports `ProjectUnavailable` immediately rather than
  returning a stale live-looking snapshot.
- `notify` errors are treated as overflow/dropped-event recovery triggers, and
  `LONGCLAW_LOCAL_DIAGNOSTIC` emits a local stdout diagnostic when enabled.
- The frontend already had the stale-board affordance through
  `ProjectUnavailable`; the store now marks the project unreachable and surfaces
  the unavailable-folder error when the watcher reports it.

Automated proof:

- `an_overflow_recovery_converges_on_disk_state`
- `a_removed_root_can_be_restored_and_reconciled`
- `recovery_triggers_close_together_emit_one_rebuild`
- `coalescing_does_not_mask_a_root_that_vanished`
- Existing burst and self-write watcher tests still pass.
- `npm run verify` passed, including `npm run test:watcher`.

Manual proof:

- 2026-07-31 on macOS 26.5.2 (build 25F84), a real focused-window sleep/wake soak
  was run. External ticket edits before wake, after several wake cycles, and after
  a longer sleep all appeared on the board without clicking away, refreshing, or
  restarting.

What remains:

- Large synchronous rebuild work is still open as V0-05 / plan 06. This plan makes
  wake recovery correct; plan 06 is what keeps large rebuilds from blocking command
  handling.
