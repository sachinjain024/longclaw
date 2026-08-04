---
title: "Release-candidate build"
product: LongClaw
status: active
milestone: "M6 — Release candidate"
---

# Release-candidate build

Step 16b promotes the pilot-build checklist into the release-candidate gate. A
release candidate is the exact source revision, app bundle, DMG, reports, and
known-issues list that Step 17 accepts or rejects.

## Candidate evidence captured 2026-08-04

This Step 16b pass produced a release-candidate bundle and DMG from this branch.
Step 17 must repeat the checks from a clean checkout at the final commit and
fill the remaining clean-machine manual rows before release.

| Field | Value |
|---|---|
| Source revision | the commit containing this record |
| Branch | `implement/step-16b-release-hardening` |
| Build command | `npm run build:app` |
| App bundle | `apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app` |
| DMG | `apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.1.0_aarch64.dmg` |
| macOS build machine | Apple Silicon Mac, WebKit `Version/26.5 Safari/605.1.15` |
| Oldest supported test Mac | not run; Step 17 blocker before release |

### Automated results

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

## Reusable build identity template

Record these before any manual checks:

| Field | Value |
|---|---|
| Source revision |  |
| Branch |  |
| Build command | `npm run build:app` |
| App bundle | `apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app` |
| DMG | `apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.1.0_<arch>.dmg` |
| macOS build machine |  |
| Oldest supported test Mac |  |

The release build is not valid unless `npm run verify` and
`npm run build:app` both pass from a clean checkout at the recorded revision.
When a surface, comparator, selector, row, lane, or theme token changed since the
last candidate, also run the relevant interaction trace and quote the p95
numbers below.

## Automated gate

Run from the repository root:

```sh
npm run verify
npm run build:app
npm run perf:rust
npm run perf:board
npm run perf:list
```

`npm run verify` now includes `npm --prefix apps/desktop run release:audit`,
which checks the v0 privacy and filesystem boundary that automation can hold:

- the shipped frontend source does not call browser network APIs;
- the shipped Rust source does not use direct HTTP clients or process launch;
- the app has no direct HTTP, filesystem, shell, updater, analytics, or crash
  reporting dependency;
- the single Tauri capability remains `main`;
- the only explicit permissions are `core:default`, `core:event:default`, and
  `dialog:allow-open`;
- the CSP limits `connect-src` to Tauri IPC;
- the macOS bundle metadata and v0 support floor are present.

## Performance report

| Area | Budget / expectation | Result | Evidence |
|---|---|---|---|
| Startup | Step 4 startup budget | not measured on a clean app launch; Step 17 blocker | clean-machine launch pass |
| Folder open | Step 4 folder-open budget | Rust 5,000-ticket open `2093.41 ms` | `npm run perf:rust` |
| Index build, 5,000 tickets | Step 4 Rust budget | rebuild `1858.35 ms`, concurrent request `82.73 ms` | `npm run perf:rust` |
| Board interaction, 5,000 tickets | p95 ≤ 50 ms and median within 4 ms of the 600-ticket floor | p95 keyboard `31 ms`, scroll `35 ms`, filter `38 ms`, external write `33 ms`; first paint `183 ms`; all medians matched the 600-ticket floor | `npm run perf:board` |
| List interaction, 5,000 tickets | p95 ≤ 50 ms and median within 4 ms of the 600-ticket floor | p95 keyboard `31 ms`, scroll `35 ms`, filter `39 ms`, external write `31 ms`; first paint `253 ms`; all medians within the floor | `npm run perf:list` |
| Search/filter | p95 ≤ 50 ms during the WebKit trace | board filter p95 `38 ms`; list filter p95 `39 ms`; Rust search `2.09 ms` | `npm run perf:board`, `npm run perf:list`, `npm run perf:rust` |
| External-change visibility | Step 4 external write → visible paint budget | watcher `188.58 ms` in full `verify`, `195.13 ms` standalone; board paint p95 `33 ms`; list paint p95 `31 ms` | `npm run verify`, `npm --prefix apps/desktop run test:watcher`, WebKit traces |

Test at least one small project, one medium real project, and one 5,000-ticket
fixture. If a number is not collected, the candidate must name why it is not a
release blocker.

## Accessibility report

Use [the accessibility foundations](../design/foundations/accessibility.md) for
the generated color and contrast baseline, then complete this manual pass against
the release app in light and dark appearance:

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

Meaningful motion should remain short: it may call attention to a write,
selection, or freshness change, but it must not delay the user's next action or
be the only carrier of state.

## Install, upgrade, restart, and offline

Run on a clean macOS user profile or machine:

| Scenario | Expected result | Result |
|---|---|---|
| Fresh install from DMG | App launches and reaches project selection without an account, key, or network | not run on a clean machine; Step 17 blocker |
| First project creation | Selected folder receives only `.longclaw/longclaw.yaml`, `.longclaw/AGENTS.md`, and `.longclaw/tickets/` | covered by Rust storage tests; clean-machine packaged-app pass still required |
| Upgrade over the previous candidate or pilot build | Known projects, star state, theme, and appearance preference survive | not run; Step 17 blocker |
| App restart | Last project state reloads from disk and the registry remains valid | covered by Rust registry/storage tests; packaged-app pass still required |
| Sleep/wake with the window focused | External edits appear without refresh or restart | native watcher pass `external_visibility_pipeline_ms=188.58` in full `verify`; packaged-app sleep/wake pass still required |
| Folder move | Project is marked unreachable, can be located again, and no unrelated folder is scanned | covered by watcher/registry tests; packaged-app pass still required |
| Offline launch and edit | Local use works with Wi-Fi disabled and no account prompt | not run on a clean machine; Step 17 blocker |

## Security, privacy, and filesystem checklist

| Check | Expected result | Evidence |
|---|---|---|
| Runtime network audit | No non-IPC network connection during launch, project open, create/edit/archive/search, restart, or offline operation | not run with a process monitor; Step 17 blocker |
| Binary/package audit | No analytics, telemetry, updater, crash-reporting, shell, HTTP, or filesystem plugin is directly configured | pass: `npm --prefix apps/desktop run release:audit` |
| Tauri capability audit | Webview can use typed IPC/events and one native folder picker only | pass: `apps/desktop/src-tauri/capabilities/main.json`; guarded by `release:audit` |
| Filesystem scope | App writes project data only under the user-selected `.longclaw/` tree and app state only in OS application support | covered by storage/registry tests and `release:audit`; packaged-app manual pass still required |
| Crash diagnostics | No automatic crash upload; user-facing guidance names local stdout diagnostics and manual issue reporting | pass: no crash reporter configured; docs in `apps/desktop/README.md` |
| Account boundary | No local feature requires signup, network, cloud sync, or waitlist state | pass by source/config audit and shipped dependency audit; clean-machine offline pass still required |

For runtime network auditing, run the app with the machine offline first, then
repeat online while watching process connections with a local tool such as Little
Snitch, LuLu, or `lsof -i -n -P`. Tauri IPC over `ipc:` and
`http://ipc.localhost` is expected; external hosts are not.

## macOS signing and packaging

The release candidate must make one of these two choices explicit:

| Choice | Release condition |
|---|---|
| Signed and notarized | Not selected for this candidate; no Developer ID identity or notarization request recorded |
| Unsigned | Selected for this candidate. Release notes must state the Gatekeeper warning, why it is accepted, and how to open the app without weakening system-wide security |

The v0 bundle metadata lives in
`apps/desktop/src-tauri/tauri.conf.json`: product name, identifier, category,
copyright, minimum macOS version, icon, and short/long descriptions.

Sandboxing is not enabled for the v0 direct-distribution candidate. If the
distribution channel changes to require sandboxing, Step 16b is not complete
until a dedicated adapter proves security-scoped bookmark creation, resolution,
and stale-bookmark refresh for user-selected project folders.

## User documentation

The release candidate must ship or link the following user-facing material:

| Topic | Source |
|---|---|
| Project folder layout and owned files | [File format](../file_format.md) |
| Backups and version control | [File format](../file_format.md), `apps/desktop/README.md` registry recovery |
| Agent editing contract | [Agent context example](../../examples/agent-context/README.md) |
| Recovery from degraded files, conflicts, unavailable folders, and corrupt registry | `apps/desktop/README.md`, [agent round trip](agent-round-trip.md) |
| Privacy boundary and local diagnostics | `apps/desktop/README.md`, this checklist |

## Known issues

Every known issue must have a severity, user impact, workaround, and release
decision.

| Severity | Issue | Impact | Workaround | Release decision |
|---|---|---|---|---|
| Release blocker | Clean-machine packaged-app pass is not complete | Fresh install, upgrade, restart, folder move, and offline behavior are not yet proven on a machine/profile that has never run LongClaw | Run the install/upgrade/offline table above in Step 17 before release | Do not release until complete |
| Release blocker | Manual accessibility pass is not complete | Keyboard-only and VoiceOver completion of the core ticket lifecycle is not yet proven against the packaged app | Run the accessibility table above in Step 17 before release | Do not release until complete |
| Release blocker | Runtime network audit is not complete | Static audit proves source/config boundaries, but runtime process connections were not observed during packaged-app use | Run offline and online process-monitor passes before release | Do not release until complete |
| Accepted for this candidate | Build is unsigned and not notarized | Gatekeeper will warn on first launch | Publish release-note opening instructions; prefer right-click Open for this candidate | Accept only if release notes include the warning |

Release blockers include data-integrity failure, silent overwrite, watcher loop,
incorrect actor attribution, account or network dependency for local use,
overbroad filesystem access, and an accessibility failure that prevents keyboard
completion of the core ticket lifecycle.
