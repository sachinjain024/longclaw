---
title: "Release candidate 2026-08-04"
product: LongClaw
status: record
milestone: "M6 — Release candidate"
---

# Release candidate 2026-08-04

One candidate's evidence against
[the release-candidate gate](release-candidate.md). This file records what was
measured on this date and nothing else — the checks themselves, and what counts
as a blocker, live in the gate. A later candidate gets its own dated file rather
than overwriting this one.

Step 17 must repeat the checks from a clean checkout at the final commit and
fill the remaining clean-machine manual rows before release.

## Build identity

| Field | Value |
|---|---|
| Source revision | `1ff010b` — the Step 16b implementation commit |
| Branch | `implement/step-16b-release-hardening` |
| Build command | `npm run build:app` |
| App bundle | `apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app` |
| DMG | `apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.1.0_aarch64.dmg` |
| macOS build machine | Apple Silicon Mac, WebKit `Version/26.5 Safari/605.1.15` |
| Oldest supported test Mac | not run; Step 17 blocker before release |

Commits after `1ff010b` on this branch changed `scripts/release-audit.mjs` and
these documents, so the bundle above predates them. The numbers below still
describe the shipped code — no product source changed — but Step 17 rebuilds
from its own revision regardless.

## Automated results

| Command | Result |
|---|---|
| `npm --prefix apps/desktop run check` | pass |
| `npm --prefix apps/desktop run test:watcher` | pass standalone, `external_visibility_pipeline_ms=195.13`, `coalesced_events=6` |
| `npm run verify` | pass outside the sandbox, including native watcher `external_visibility_pipeline_ms=188.58`, `coalesced_events=6` |
| `npm run build:app` | pass outside the sandbox; produced `LongClaw.app` and `LongClaw_0.1.0_aarch64.dmg` |
| `npm run perf:rust` | pass |
| `npm run perf:board` | pass outside the sandbox |
| `npm run perf:list` | pass outside the sandbox |

The first `npm run verify`, `build:app`, `perf:board`, and `perf:list` attempts
reached their app builds or native watcher step but failed inside sandboxed
macOS packaging, local preview server startup, or watcher delivery. The same
commands passed outside the sandbox without code changes.

## Performance

**The numbers first recorded here were void, and are replaced below.** Every one
of them was measured with macOS **Low Power Mode on**, which halves the
animation-frame cadence the WebKit traces are quantized to — 33 ms rather than
the 16.7 ms at 60 Hz the Step 4 budgets were set at — and throttles the CPU the
Rust harness runs on. They were recorded as a pass because they were under the
≤50 ms ceiling, and they were: they were also meaningless. The measurements
below were re-taken at `52565d1` with Low Power Mode off, verified at
`frame_ms=17` (58.8 Hz). See § The Low Power Mode correction.

| Area | Result | Evidence |
|---|---|---|
| Startup | not measured on a clean app launch; Step 17 blocker | clean-machine launch pass |
| Folder open | Rust 5,000-ticket open `1464.80 ms`, budget ≤ 2,500 ms | `npm run perf:rust` |
| Index build, 5,000 tickets | rebuild `1172.13 ms`, concurrent request `60.61 ms` | `npm run perf:rust` |
| Board interaction, 5,000 tickets | p95 keyboard `15 ms`, scroll `18 ms`, filter `26 ms`, external write `17 ms`; p50 `14`/`17`/`16`/`16 ms`; first paint `146 ms`; `frame_ms=17` | `npm run perf:board` |
| List interaction, 5,000 tickets | p95 keyboard `15 ms`, scroll `18 ms`, filter `23 ms`, external write `17 ms`; p50 `14`/`17`/`15`/`16 ms`; first paint `224 ms`; `frame_ms=17` | `npm run perf:list` |
| Search/filter | board filter p95 `26 ms`; list filter p95 `23 ms`; Rust search `1.46 ms` | `npm run perf:board`, `npm run perf:list`, `npm run perf:rust` |
| External-change visibility | watcher `188.58 ms` in full `verify`, `195.13 ms` standalone; board paint p95 `17 ms`; list paint p95 `17 ms` | `npm run verify`, `npm --prefix apps/desktop run test:watcher`, WebKit traces |

Against the Step 4 budgets (`docs/architecture-spike-report.md:76-82`): every p95
is inside ≤ 50 ms with room to spare. The **≤ 16 ms p50** budget reads as met at
14–17 ms, with the same caveat the spike report attaches to its own 17–20 ms
p50s — 16.7 ms is the one-frame floor at 60 Hz, so a p50 of 17 is the frame, not
the surface. It cannot go lower and should not be read as headroom.

Both traces are single runs. The board and list p50/p95 land within 1 ms of each
other across all four interactions, and each matches its own 600-ticket floor,
which is the harness's evidence that 5,000 tickets cost nothing the small board
does not.

Only the 5,000-ticket fixture was run. The small and medium real projects the
gate asks for were not.

### The Low Power Mode correction

Two of the review's spec findings — interaction p95 roughly doubled since Step
16a, and Rust folder open at 2.9× the Step 4 spike — were investigated together
and are largely one cause.

**Interaction was never slower.** No render-path file changed between the Step
16a merge (`389b551`) and `1ff010b`: `Board.tsx`, `boardGeometry.ts`,
`IssueList.tsx`, `grouping.ts` and `filtering.ts` are untouched. The traces end
in a timer scheduled inside a `requestAnimationFrame` callback, so every sample
is quantized to the frame interval, and that interval was 33 ms rather than
16.7 ms. Re-measured with the cadence restored, board p95 is `15/18/26/17`
against Step 16a's `15/18/26/16` — the same board. The list improved on
keyboard, `22 → 15 ms`.

`perf/board-trace.mjs` now measures the cadence, reports it as `frame_ms`, and
**exits non-zero with NOT COMPARABLE** rather than certifying a throttled run.
The 600-ticket floor comparison could not catch this on its own: when the frame
moves, the floor and the full board move together and still agree, so the check
stayed green while every number under it shifted.

**Storage is two causes and a residual.** Isolated by re-running each condition:

| Condition | open | rebuild |
|---|---|---|
| Low Power on, current fixture — *as first recorded* | 1884.63 ms | 1528.32 ms |
| Low Power off, current fixture — *the corrected number* | 1464.80 ms | 1172.13 ms |
| Low Power on, Step 4 spike's fixture | 1432.47 ms | 976.54 ms |
| Low Power off, Step 4 spike's fixture | 1153.23 ms | 747.87 ms |
| Step 4 spike, as recorded | 711.49 ms | — |

Low Power Mode accounts for ~22% and fixture weight for ~21%. The fixtures were
never comparable: the spike's (`spikes/tauri-v2-architecture/src-tauri/src/engine.rs:656`)
has no `labels:`, no description body and no `## Activity` event record, all of
which `src-tauri/tests/performance.rs:41-71` writes for every one of 5,000
tickets.

That leaves **~1.6× unexplained on a like-for-like fixture** — 1153.23 ms
against 711.49 ms — which is recorded as an open question rather than resolved.
The comparison is also not exact: the spike measured a different codebase
through its own harness, before the index carried labels, timeline
reconstruction, or attribution. Both numbers are well inside the ≤ 2,500 ms
budget, so this is not a release blocker; it is an unaudited 1.6×.

## Accessibility

| Check | Result | Notes |
|---|---|---|
| Keyboard-only create, select, edit, move, search, archive, undo, and retry | not run on the packaged app | Step 17 blocker |
| Focus order matches visible reading order in board, list, panel, menus, palette, settings, and toasts | not run on the packaged app | Step 17 blocker |
| Visible focus is present and not hidden by panels, overlays, or scroll containers | covered by existing component tests where present; not manually audited on the packaged app | Step 17 blocker |
| Buttons, menus, form fields, tabs, alerts, and status regions have useful accessible names | covered by existing component tests where present; not manually audited with VoiceOver | Step 17 blocker |
| VoiceOver can identify the active row, ticket state, write status, conflict state, and degraded-file state | not run | Step 17 blocker |
| Contrast report has no failures | pass | `docs/design/foundations/accessibility.md` |
| Reduced motion preserves state changes without long or masking animation | not run on the packaged app | Step 17 blocker |
| 200% zoom and larger text do not overlap or hide primary controls | not run on the packaged app | Step 17 blocker |

## Install, upgrade, restart, and offline

| Scenario | Result |
|---|---|
| Fresh install from DMG | not run on a clean machine; Step 17 blocker |
| First project creation | covered by Rust storage tests; clean-machine packaged-app pass still required |
| Upgrade over the previous candidate or pilot build | not run; Step 17 blocker |
| App restart | covered by Rust registry/storage tests; packaged-app pass still required |
| Sleep/wake with the window focused | native watcher pass `external_visibility_pipeline_ms=188.58` in full `verify`; packaged-app sleep/wake pass still required |
| Folder move | covered by watcher/registry tests; packaged-app pass still required |
| Offline launch and edit | not run on a clean machine; Step 17 blocker |

## Security, privacy, and filesystem

| Check | Evidence |
|---|---|
| Runtime network audit | not run with a process monitor; Step 17 blocker |
| Binary/package audit | pass: `npm --prefix apps/desktop run release:audit`, for _directly_ configured dependencies; transitive ones are what the runtime pass above covers |
| Tauri capability audit | pass: `apps/desktop/src-tauri/capabilities/main.json`; guarded by `release:audit` |
| Filesystem scope | covered by storage/registry tests and `release:audit`; packaged-app manual pass still required |
| Crash diagnostics | pass: no crash reporter configured; docs in `apps/desktop/README.md` |
| Account boundary | pass by source/config audit and shipped dependency audit; clean-machine offline pass still required |

## Signing choice

Unsigned. No Developer ID identity or notarization request was recorded for this
candidate. Release notes must state the Gatekeeper warning, why it is accepted,
and how to open the app without weakening system-wide security; those release
notes do not exist yet.

## Known issues

| Severity | Issue | Impact | Workaround | Release decision |
|---|---|---|---|---|
| Release blocker | Clean-machine packaged-app pass is not complete | Fresh install, upgrade, restart, folder move, and offline behavior are not yet proven on a machine/profile that has never run LongClaw | Run the install/upgrade/offline table in Step 17 before release | Do not release until complete |
| Release blocker | Manual accessibility pass is not complete | Keyboard-only and VoiceOver completion of the core ticket lifecycle is not yet proven against the packaged app | Run the accessibility table in Step 17 before release | Do not release until complete |
| Release blocker | Runtime network audit is not complete | Static audit proves source/config boundaries, but runtime process connections were not observed during packaged-app use | Run offline and online process-monitor passes before release | Do not release until complete |
| Accepted for this candidate | Build is unsigned and not notarized | Gatekeeper will warn on first launch | Publish release-note opening instructions; prefer right-click Open for this candidate | Accept only if release notes include the warning |
