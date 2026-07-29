# Tauri v2 architecture spike — review report

**Status:** accepted at the M2 human-review gate on 2026-07-29.

**Branch:** `spike/tauri-v2-architecture`

**Target exercised:** macOS 26.5.2, Apple Silicon, Rust 1.93.1, Node 22.15.1, Tauri 2.11.5, notify 8.2.0.

## Question and verdict

This archived spike asks whether one small architecture can make project files authoritative while delivering external edits to visible Tauri state and app edits back to disk without watcher loops.

**Verdict:** yes for the exercised direct-distribution macOS path. The deep `ProjectEngine` module hides parsing, atomic replacement, content hashes, index rebuilds, FSEvents stabilization/coalescing, and self-write receipts behind a small interface. Thin Tauri and Zustand adapters translate that state across the IPC seam. M1 accepted the v1 file-format contract and M2 accepted this architecture. Focused real-file compatibility tests protect the v0 contract; a comprehensive canonical conformance-fixture corpus is deferred to the post-MVP product v1.

## Exit-gate evidence

| Gate | Result | Evidence |
|---|---|---|
| External file edit reaches visible Tauri UI state | Pass | The exact final-source release binary rendered five fixture rows. A real edit to `LC-1/ticket.md` produced `event 1 · ticketChanged`; the next animation-frame probe contained `EXACT SOURCE — watcher reached rendered state` in the rendered row. Automated polling-watcher coverage deletes a real `ticket.md`, asserts the exact camelCase `ticketRemoved` JSON, removes the indexed row, and produces no duplicate; the shared Rust-locked JSON fixture removes the Zustand row. The M2 review confirmed the native visible deletion and restoration path. |
| In-app edit reaches disk atomically without a watcher loop or duplicate activity | Pass | `filesystem_round_trip_covers_self_write_external_burst_deletion_and_reconcile`: sibling temp, file sync, rename, directory sync; one activity event; zero watcher echo; unknown extension retained. The release-window probe separately exercised native FSEvents. |
| Local index can be deleted and rebuilt entirely from project files | Pass | `index_is_disposable_and_rebuilds_degraded_records_from_files`: clear produced zero records; rescan reproduced all five records, including both degraded records. |
| Typed Phase 2 streaming extension exists | Pass | Real Tauri `Channel<StreamFrame>` sends ordered `started/chunk/finished` tagged frames with binary byte chunks. |
| Sleep/wake, removal, rapid edits, rename/write patterns exercised | Pass within the documented M2 rubric | Four rapid sibling-renames, stable parse delay, coalescing, external ticket deletion, explicit reconciliation, and a moved folder pass. The M2 review completed the physical sleep/wake scenario successfully. The accepted Phase 1 gap remains: tao does not provide a macOS wake trigger while focus stays unchanged, so production must add the documented native adapter. |
| Human review accepts the spike | Pass | The full M2 scenario was completed successfully on 2026-07-29, including picker click-through, native external deletion/restoration, physical sleep/wake, and the moved-folder banner path check. ADRs 0006–0010 are accepted. |

The attempted screenshot capture was blocked by macOS screen-recording permissions. No screenshot is claimed. The release-mode application launch and animation-frame DOM probes are retained as the deterministic visible-state evidence.

The native picker is implemented, capability-scoped, and release-compiled; project registration/restart persistence is automated. macOS denied assistive-access automation, so the M2 reviewer completed the picker click-through manually.

The committed lockfile resolves `serde` and `serde_derive` 1.0.229, which is newer than the 1.0.190 release that introduced `rename_all_fields`; the locked derive source contains the attribute implementation, so no additional pin is required. The IPC regression harness uses one checked-in JSON fixture: Rust exact-JSON tests lock every `ProjectEvent` and `StreamFrame` variant to it, and Vitest replays its deletion and unavailable envelopes through `store.applyEvent`.

## Architecture and trust

```text
selected folder
    │  native picker returns a candidate path
    ▼
Rust registry + canonical root
    │  projectId + ticketKey only
    ▼
ProjectEngine interface
    ├── parse/degrade
    ├── atomic write + expected hash
    ├── disposable index
    └── watcher + reconcile + write receipts
             │
             ├── command result ───────────────┐
             └── versioned project event       │
                                               ▼
                                      Zustand view cache
                                               │
                                               ▼
                                         rendered React
```

Trust rules:

- The webview has dialog-open plus core IPC/event capability; it has no filesystem, shell, process, or network capability.
- Rust resolves project IDs from its application-support registry and canonicalizes every filesystem target.
- Commands receive ticket identity and an expected content hash, not an authority-bearing path.
- Invalid/future files are visible and read-only. No parse failure triggers a repair write.
- Events are hints with sequence numbers. A full snapshot is the recovery mechanism.

Platform choices were checked against the current official Tauri v2 documentation:
[capabilities and security](https://v2.tauri.app/security/capabilities/),
[commands/events/channels](https://v2.tauri.app/develop/calling-frontend/),
[native dialog](https://v2.tauri.app/plugin/dialog/), and
[Vite integration](https://v2.tauri.app/start/frontend/vite/).

## Performance budgets

Budgets are p95 on the oldest supported production Mac unless stated otherwise.

| Path | Budget | Spike result / next measurement |
|---|---:|---|
| Cold process start → first interactive paint | ≤ 1,500 ms | **843.97 ms** and **1,367.64 ms** on two observed cold release launches, both to the first animation-frame `VISIBLE_UI_PROBE`. |
| Warm start → first interactive paint | ≤ 750 ms | **560.37–693.34 ms** across two observed warm instrumented launches. |
| Project load, 1,000 tickets | ≤ 750 ms | Covered by the stricter 5,000-ticket harness below. |
| Large project load, 5,000 tickets | ≤ 2,500 ms | **711.49 ms** latest; **640.66 ms** earlier, both in an unoptimized Rust test build. |
| Large-board keyboard/input → paint | ≤ 50 ms p95; ≤ 16 ms p50 | Phase 1 must add virtualization and a WebKit trace; the spike intentionally does not render 5,000 rows. |
| Search, 5,000 tickets | ≤ 50 ms | **2.35 ms** latest; **2.37 ms** earlier in the unoptimized Rust harness. |
| Stable external save → visible paint | ≤ 500 ms | **197.27 ms** in the latest `npm run verify` through coalescing, stable read, parse, index, and Rust event; the release probe confirmed the title on the next animation frame. Phase 1 adds percentile telemetry stored locally. |

Measured command:

```sh
npm run perf:rust
```

## Reproducible verification gate

The amended `npm run verify` passed once on 2026-07-29 with Node 22 and Cargo on `PATH`. Its output visibly included:

- TypeScript checking and the Vite production build: pass, 562 ms build.
- Vitest replay of the Rust-locked deletion and unavailable JSON envelopes: 2 passed.
- `cargo clippy --all-targets -- -D warnings`: pass.
- Rust unit/contract suite: 13 passed, 2 intentionally ignored.
- Explicit polling-watcher round trip: 1 passed, including external ticket deletion, exact JSON, index removal, and no duplicate; latest external pipeline measurement 197.27 ms.

Startup instrumentation for review hardware:

```sh
LONGCLAW_SPIKE_PROJECT="$PWD/fixtures/representative-project" \
LONGCLAW_SPIKE_EXIT_AFTER_FIRST_PROBE=1 \
./src-tauri/target/release/longclaw-tauri-spike
```

## Representative paths proved

- Native folder selection wired through `@tauri-apps/plugin-dialog`, with click-through reserved for the human review.
- Atomic persistence of the application-support project registry.
- Format-v1 project and ticket parsing against real Markdown/YAML files.
- Unknown frontmatter preservation through targeted text mutation.
- Content-hash conflicts before write.
- Sibling temporary file, `sync_all`, rename, and parent-directory sync.
- Recursive native watching, temporary-file filtering, quiet-period coalescing, stable-file confirmation, and exact-hash self-write suppression.
- Degraded records for malformed and unsupported-version tickets.
- Full index deletion/rebuild and case-insensitive search.
- Frontend visibility/focus reconciliation. A native macOS wake notification is explicitly deferred to Phase 1.
- Versioned low-volume events and an ordered binary-safe channel.

## Rejected approaches and observed failure modes

| Rejected approach | Failure mode |
|---|---|
| Frontend filesystem plugin with a broad selected-root scope | Spreads authority and validation into a compromise-prone webview; path-based calls can accidentally escape intended domain operations. |
| Pass absolute paths through IPC | Makes every caller understand canonicalization, symlinks, and project scope; weak locality. |
| Parse every raw watcher event | Common editor rename/write bursts expose temporary absence or partial content and create duplicate visible activity. |
| Suppress all events for N seconds after app writes | A real external edit inside the window can be lost. |
| Treat the index or watcher log as authoritative | Sleep/overflow/deletion can lose events; deleting device state would lose project truth. |
| Serialize a parsed YAML map for a title edit | Reorders or reformats unrelated/unknown fields and creates noisy agent conflicts. |
| Use global events for future PTY output | Events are not the ordered high-throughput path and force binary data into unsuitable payloads. |
| Persist Zustand/localStorage | Duplicates canonical and device-local state across two owners and makes restart reconciliation ambiguous. |
| Automatically fix malformed or newer files | Risks irreversible loss and violates forward compatibility. |
| Claim SQLite before scale evidence | Adds schema/migration/concurrency work before the in-memory disposable implementation misses a budget. |

## Recommended production project structure

The production seam should be the `ProjectEngine` module. Its interface is the test surface; Tauri, native watchers, and any future SQLite implementation are adapters or private implementation details.

```text
apps/desktop/
├── src/
│   ├── app/                  # React composition and routes
│   ├── state/                # thin Zustand cache and selectors
│   └── ipc/                  # generated DTOs, command client, listeners/channels
└── src-tauri/
    └── src/
        ├── ipc/              # Tauri command/event/channel adapters only
        ├── project/          # deep ProjectEngine module
        │   ├── model.rs
        │   ├── format.rs
        │   ├── storage.rs
        │   ├── index.rs
        │   └── watcher.rs
        ├── registry/         # application-support project references
        └── platform/macos/   # wake notification and future bookmark adapter
fixtures/
└── format-v1/                # post-MVP product-v1 conformance corpus (deferred)
```

Do not split the five `project/` files into public crates on day one. They are one deep module with one external interface. Extract `longclaw-format` only when a second real caller (for example, a CLI) exists. Introduce an index port only when both in-memory and SQLite adapters are justified.

## Human review scenario

**M2 result:** accepted on 2026-07-29. The reviewer reported that every step below completed correctly. The scenario remains here for future Tauri upgrades and regression reviews.

1. Ensure Node 22+ and Rust 1.93+ are active.
2. Run `cd spikes/tauri-v2-architecture && npm install && npm run verify && npm run spike`.
3. Choose `fixtures/representative-project`.
4. Edit `LC-1/ticket.md` in a normal editor and confirm the green trace and updated title appear without refresh.
5. Externally remove `LC-3/ticket.md` by renaming it to `ticket.md.m2-backup`. Confirm the `LC-3` row disappears, the trace reports `ticketRemoved`, and no duplicate event appears. Rename it back to `ticket.md` and confirm the row returns.
6. Select `LC-2`, change its title, and choose **Save atomically**. Confirm the file contains one new activity event and still contains `x_fixture_extension`.
7. Confirm no second green external trace appears for that in-app save.
8. Choose **Delete + rebuild index** and confirm all five rows return.
9. Choose **Probe ordered stream** and confirm `ordered binary-safe channel`.
10. Put the Mac to sleep for at least one minute with LongClaw focused and visible. Wake without deliberately focusing another application, then follow the sleep/wake criteria below.
11. Move `fixtures/representative-project` temporarily to `fixtures/representative-project.m2-moved`. Confirm the unavailable banner contains the original absolute project path—not `undefined`—then move it back and reopen.
12. Record **accept** or the required revisions. Do not merge the proposed ADRs or begin broad Phase 1 implementation before that decision.

### Sleep/wake M2 criteria

- **Expected while focus stays unchanged:** no automatic `indexRebuilt` event is promised. The spike has no native macOS wake notification, and WebKit may emit neither `focus` nor `visibilitychange` when the same window remains focused. Record that absence as the accepted Phase 1 wake-adapter gap; it does not by itself block M2.
- **Required after wake:** the app remains responsive. Make one external ticket edit, return to LongClaw if an editor took focus, and confirm the final title appears. Deliberately focus another application and return once; the focus recovery must complete without duplicate activity or a watcher loop.
- **Blocks M2:** a crash or hang; the post-wake edit is still stale after returning focus; deliberate focus/visibility recovery does not restore the disk snapshot; the watcher emits duplicate visible activity; or a removed project remains silently usable after focus recovery.
- **Phase 1 gap, not an M2 blocker:** the window stays focused across wake and no reconciliation happens until a later focus/visibility transition. Phase 1 must close that gap with `NSWorkspaceDidWakeNotification`, coalesced with the existing recovery path.
