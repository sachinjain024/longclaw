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

| Area | Result | Evidence |
|---|---|---|
| Startup | not measured on a clean app launch; Step 17 blocker | clean-machine launch pass |
| Folder open | Rust 5,000-ticket open `2093.41 ms` | `npm run perf:rust` |
| Index build, 5,000 tickets | rebuild `1858.35 ms`, concurrent request `82.73 ms` | `npm run perf:rust` |
| Board interaction, 5,000 tickets | p95 keyboard `31 ms`, scroll `35 ms`, filter `38 ms`, external write `33 ms`; first paint `183 ms`; all medians matched the 600-ticket floor | `npm run perf:board` |
| List interaction, 5,000 tickets | p95 keyboard `31 ms`, scroll `35 ms`, filter `39 ms`, external write `31 ms`; first paint `253 ms`; all medians within the floor | `npm run perf:list` |
| Search/filter | board filter p95 `38 ms`; list filter p95 `39 ms`; Rust search `2.09 ms` | `npm run perf:board`, `npm run perf:list`, `npm run perf:rust` |
| External-change visibility | watcher `188.58 ms` in full `verify`, `195.13 ms` standalone; board paint p95 `33 ms`; list paint p95 `31 ms` | `npm run verify`, `npm --prefix apps/desktop run test:watcher`, WebKit traces |

Only the 5,000-ticket fixture was run. The small and medium real projects the
gate asks for were not.

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
