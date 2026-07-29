# Tauri v2 architecture spike — review report

**Status:** implementation and automated proof complete; human M2 acceptance pending.

**Branch:** `spike/tauri-v2-architecture`

**Target exercised:** macOS 26.5.2, Apple Silicon, Rust 1.93.1, Node 22.15.1, Tauri 2.11.5, notify 8.2.0.

## Question and verdict

This throwaway spike asks whether one small architecture can make project files authoritative while delivering external edits to visible Tauri state and app edits back to disk without watcher loops.

**Verdict:** yes for the exercised direct-distribution macOS path. The deep `ProjectEngine` module hides parsing, atomic replacement, content hashes, index rebuilds, FSEvents stabilization/coalescing, and self-write receipts behind a small interface. Thin Tauri and Zustand adapters translate that state across the IPC seam. Phase 1 can extend this shape after a human accepts M2 and the still-draft M1 format is formally approved.

## Exit-gate evidence

| Gate | Result | Evidence |
|---|---|---|
| External file edit reaches visible Tauri UI state | Pass | The exact final-source release binary rendered five fixture rows. A real edit to `LC-1/ticket.md` produced `event 1 · ticketChanged`; the next animation-frame probe contained `EXACT SOURCE — watcher reached rendered state` in the rendered row. Restoring the file produced `event 2 · ticketChanged` with the original title. |
| In-app edit reaches disk atomically without a watcher loop or duplicate activity | Pass | `filesystem_round_trip_covers_self_write_external_burst_resume_and_removal`: sibling temp, file sync, rename, directory sync; one activity event; zero watcher echo; unknown extension retained. The release-window probe separately exercised native FSEvents. |
| Local index can be deleted and rebuilt entirely from project files | Pass | `index_is_disposable_and_rebuilds_degraded_records_from_files`: clear produced zero records; rescan reproduced all five records, including both degraded records. |
| Typed Phase 2 streaming extension exists | Pass | Real Tauri `Channel<StreamFrame>` sends ordered `started/chunk/finished` tagged frames with binary byte chunks. |
| Sleep/wake, removal, rapid edits, rename/write patterns exercised | Pass with human soak remaining | Resume reconciliation, moved folder, four rapid sibling-renames, stable parse delay, and watcher coalescing pass. A physical overnight sleep/wake soak remains on the human checklist. |
| Human review accepts the spike | Pending | Run the review scenario below and record accept/revise before merging any durable ADRs or starting broad implementation. |

The attempted screenshot capture was blocked by macOS screen-recording permissions. No screenshot is claimed. The release-mode application launch and animation-frame DOM probes are retained as the deterministic visible-state evidence.

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
| Stable external save → visible paint | ≤ 500 ms | **186.96 ms** through coalescing, stable read, parse, index, and Rust event for a six-notification burst; the release probe confirmed the title on the next animation frame. Phase 1 adds percentile telemetry stored locally. |

Measured command:

```sh
npm run perf:rust
```

Startup instrumentation for review hardware:

```sh
LONGCLAW_SPIKE_PROJECT="$PWD/fixtures/representative-project" \
LONGCLAW_SPIKE_EXIT_AFTER_FIRST_PROBE=1 \
./src-tauri/target/release/longclaw-tauri-spike
```

## Representative paths proved

- Native folder selection through `@tauri-apps/plugin-dialog`.
- Atomic persistence of the application-support project registry.
- Format-v1 project and ticket parsing against real Markdown/YAML files.
- Unknown frontmatter preservation through targeted text mutation.
- Content-hash conflicts before write.
- Sibling temporary file, `sync_all`, rename, and parent-directory sync.
- Recursive native watching, temporary-file filtering, quiet-period coalescing, stable-file confirmation, and exact-hash self-write suppression.
- Degraded records for malformed and unsupported-version tickets.
- Full index deletion/rebuild and case-insensitive search.
- Rust `RunEvent::Resumed` plus frontend visibility/focus reconciliation.
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
        └── platform/macos/   # resume and future bookmark adapter
fixtures/
└── format-v1/                # Step 3 canonical compatibility suite
```

Do not split the five `project/` files into public crates on day one. They are one deep module with one external interface. Extract `longclaw-format` only when a second real caller (for example, a CLI) exists. Introduce an index port only when both in-memory and SQLite adapters are justified.

## Human review scenario

1. Ensure Node 22+ and Rust 1.93+ are active.
2. Run `cd spikes/tauri-v2-architecture && npm install && npm run spike`.
3. Choose `fixtures/representative-project`.
4. Edit `LC-1/ticket.md` in a normal editor and confirm the green trace and updated title appear without refresh.
5. Select `LC-2`, change its title, and choose **Save atomically**. Confirm the file contains one new activity event and still contains `x_fixture_extension`.
6. Confirm no second green external trace appears for that in-app save.
7. Choose **Delete + rebuild index** and confirm all five rows return.
8. Choose **Probe ordered stream** and confirm `ordered binary-safe channel`.
9. Put the Mac to sleep for at least one minute, wake it, edit again, and confirm reconciliation.
10. Move the fixture folder temporarily and confirm the unavailable state; move it back and reopen.
11. Record **accept** or the required revisions. Do not merge the proposed ADRs or begin broad Phase 1 implementation before that decision.
