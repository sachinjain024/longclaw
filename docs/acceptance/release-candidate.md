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

This document is the gate: what every candidate must record and prove. What a
particular candidate actually measured goes in its own dated record beside this
file, so the checklist and the evidence stop changing for each other's reasons.

| Candidate | Record |
|---|---|
| 2026-08-04, `implement/step-16b-release-hardening` | [release-candidate-2026-08-04.md](release-candidate-2026-08-04.md) |
| 2026-08-04, `implement/step-17-final-acceptance` — the Step 17 pass over the same gate | [final-acceptance-2026-08-04.md](final-acceptance-2026-08-04.md) |
| 2026-08-05, the same branch rebuilt at the final commit — DMG produced, startup measured, the network audit harnessed | [final-acceptance-2026-08-05.md](final-acceptance-2026-08-05.md) |

The § Accessibility report below is no longer entirely a manual pass. Its first,
second, third, seventh and eighth rows are automated by `npm run a11y:audit`
against the real `App` in WebKit — see
[plan 41](../plans/completed/41-accessibility-audit.md) for what that does and
does not prove. The two VoiceOver rows stay manual, because they are about what a
screen reader says.

## Build identity

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
numbers.

## Automated gate

Run from the repository root:

```sh
npm run verify
npm run build:app
npm run release:binary-audit
npm run matrix
npm run a11y:audit
npm run perf:rust
npm run perf:board
npm run perf:list
npm run perf:startup
npm run audit:network -- -- --phase=offline   # then again with --phase=online
```

`audit:network` is in this list but is not unattended: it samples while a person
drives the app through § Security, privacy, and filesystem's step list, and it
records which steps were actually driven rather than assuming the list. A run
given `--duration` instead says in its own output that it covers launch and idle
only and is not the release pass.

`npm run verify` includes `npm --prefix apps/desktop run release:audit`, which
checks the part of the v0 privacy and filesystem boundary that automation can
hold:

- the shipped frontend source does not call browser network APIs;
- the shipped Rust source does not use direct HTTP clients or process launch;
- the app has no direct HTTP, filesystem, shell, updater, analytics, or crash
  reporting dependency;
- the single Tauri capability remains `main`;
- the only explicit permissions are `core:default`, `core:event:default`, and
  `dialog:allow-open`;
- the CSP limits `connect-src` to Tauri IPC;
- the macOS bundle metadata and v0 support floor are present.

It also reads the **macOS host dependency graph** via `cargo tree`, so a
network-capable crate arriving transitively fails the gate. `Cargo.lock` is not
the right file for this: it is target-agnostic and lists crates macOS never
compiles, `reqwest` and `hyper` among them.

`npm run release:binary-audit` is the other half and needs a bundle, so it runs
after `build:app` rather than in `verify`. It reads the shipped binary's symbols
and linked libraries, and asserts controls — symbols that must be *present* —
before believing any absence, so a probe that reads the wrong file fails instead
of passing.

Neither can see the **webview**, which is network-capable by construction. The
CSP bounds it and the runtime network audit below verifies it, and a green audit
here is not a substitute for that one.

**That audit is now a run rather than a memory: `npm run audit:network`.** It
exists because the naive version of it is worthless — on macOS a WKWebView's
traffic belongs to WebKit XPC services that are reparented to launchd, so
`lsof -i -p <app-pid>` watches the one process that was never going to make the
call, finds nothing, and passes. The harness attributes those helpers by launch
window, proves the attribution by requiring them to die with the app, and reads
two probes whose blind spots differ: `lsof` names peers but can miss a connection
between samples, and `nettop` byte counters cannot miss traffic but never name a
peer. Counters that moved with no peer sampled fail the run rather than passing
it. Five controls decide whether a silent result is evidence at all, and
`--self-test` injects a peer the run is required to catch.

What stays with a person: driving the app, and the offline half. The harness
samples; it does not click, and it says which steps it was actually driven
through.

One dependency deserves naming: **`tauri-plugin-fs` is compiled into the binary**
and cannot be removed, because `tauri-plugin-dialog` — the native folder picker —
depends on it. Nothing grants it a permission, so no `fs:` command is reachable
from the webview. The capability set below is therefore the filesystem boundary,
not the dependency list, which is why it is pinned exactly rather than loosely.

## Performance report

| Area | Budget / expectation | Evidence |
|---|---|---|
| Startup | cold ≤ 1,500 ms, warm ≤ 750 ms, process start → first painted board | `npm run perf:startup`, plus a clean-machine cold launch |
| Folder open | Step 4 folder-open budget | `npm run perf:rust` |
| Index build, 1,000 tickets | ≤ 750 ms | `LONGCLAW_PERF_TICKETS=1000 npm run perf:rust` |
| Index build, 5,000 tickets | ≤ 2,500 ms | `npm run perf:rust` |
| Board interaction, 5,000 tickets | p95 ≤ 50 ms **and** p50 ≤ 16 ms, and median within 4 ms of the 600-ticket floor | `npm run perf:board` |
| List interaction, 5,000 tickets | p95 ≤ 50 ms **and** p50 ≤ 16 ms, and median within 4 ms of the 600-ticket floor | `npm run perf:list` |
| Search/filter | p95 ≤ 50 ms during the WebKit trace | `npm run perf:board`, `npm run perf:list`, `npm run perf:rust` |
| External-change visibility | Step 4 external write → visible paint budget | `npm run verify`, `npm --prefix apps/desktop run test:watcher`, WebKit traces |

Record **p50 as well as p95**. The p50 line is a Step 4 budget in its own right
(`docs/architecture-spike-report.md:80`) and it is the one that says whether an
interaction costs more than a frame; a candidate that quotes only p95 has not
reported against the budget.

**Quote `frame_ms` with any WebKit trace.** Both traces end in a timer scheduled
inside a `requestAnimationFrame` callback, so every number is quantized to the
animation-frame interval, and the budgets assume 16.7 ms at 60 Hz. A machine
that throttles the cadence — macOS Low Power Mode halves it — doubles every
number without a line of product code changing, and the 600-ticket floor
comparison will not catch it, because the floor moves with it. The harness
refuses to certify such a run, but read the number rather than trusting the
exit code.

Test at least one small project, one medium real project, and one 5,000-ticket
fixture. If a number is not collected, the candidate must name why it is not a
release blocker.

Every harness takes the size, so all three are one flag rather than a new
fixture: `LONGCLAW_PERF_TICKETS=<n> npm run perf:rust`,
`npm run perf:board -- --tickets=<n>` (and `perf:list`), and
`npm run perf:startup -- --project=<path>`. **State for each size whether the
project was real or generated.** A generated fixture has uniform titles, one
label and no history; it proves the app survives the size, not that it survives
what a real project of that size looks like.

## Accessibility report

Use [the accessibility foundations](../design/foundations/accessibility.md) for
the generated color and contrast baseline, then complete this manual pass against
the release app in light and dark appearance:

| Check |
|---|
| Keyboard-only create, select, edit, move, search, archive, undo, and retry |
| Focus order matches visible reading order in board, list, panel, menus, palette, settings, and toasts |
| Visible focus is present and not hidden by panels, overlays, or scroll containers |
| Buttons, menus, form fields, tabs, alerts, and status regions have useful accessible names |
| VoiceOver can identify the active row, ticket state, write status, conflict state, and degraded-file state |
| Contrast report has no failures |
| Reduced motion preserves state changes without long or masking animation |
| 200% zoom and larger text do not overlap or hide primary controls |

Meaningful motion should remain short: it may call attention to a write,
selection, or freshness change, but it must not delay the user's next action or
be the only carrier of state.

## Install, upgrade, restart, and offline

Run on a clean macOS user profile or machine:

| Scenario | Expected result |
|---|---|
| Fresh install from DMG | App launches and reaches project selection without an account, key, or network |
| First project creation | Selected folder receives only `.longclaw/longclaw.yaml`, `.longclaw/AGENTS.md`, and `.longclaw/tickets/` |
| Upgrade over the previous candidate or pilot build | Known projects, star state, theme, and appearance preference survive |
| App restart | Last project state reloads from disk and the registry remains valid |
| Sleep/wake with the window focused | External edits appear without refresh or restart |
| Folder move | Project is marked unreachable, can be located again, and no unrelated folder is scanned |
| Offline launch and edit | Local use works with Wi-Fi disabled and no account prompt |

## Security, privacy, and filesystem checklist

| Check | Expected result |
|---|---|
| Runtime network audit | No non-IPC network connection during launch, project open, create/edit/archive/search, restart, or offline operation. `npm run audit:network`, offline and online, driven by a person |
| Binary/package audit | No analytics, telemetry, updater, crash-reporting, shell, HTTP, or filesystem plugin is directly configured |
| Tauri capability audit | Webview can use typed IPC/events and one native folder picker only |
| Filesystem scope | App writes project data only under the user-selected `.longclaw/` tree and app state only in OS application support |
| Crash diagnostics | No automatic crash upload; user-facing guidance names local stdout diagnostics and manual issue reporting |
| Account boundary | No local feature requires signup, network, cloud sync, or waitlist state |

For runtime network auditing, run the app with the machine offline first, then
repeat online. Tauri IPC over `ipc:` and `http://ipc.localhost` is expected;
external hosts are not.

```sh
npm run audit:network -- -- --phase=offline    # Wi-Fi disabled, then
npm run audit:network -- -- --phase=online
```

**The doubled `--` is not a typo.** These wrappers delegate with
`npm --prefix apps/desktop`, which eats the first one, and a `--phase` that never
arrives is not an error: the run labels itself `unlabelled`, and the second run
overwrites the first one's record. `startup-trace.mjs` carries the same warning
for the same reason.

Each run prints its controls, its findings, and the steps it was actually driven
through, and writes the same as JSON under `apps/desktop/dist-network-audit/`.
Drive the app through the step list above while it samples; it does not click.
Run it on a quiet machine — it attributes WebKit processes by launch window, so
a browser started alongside it lands in the record.

Little Snitch or LuLu remain a legitimate second opinion, and a bare
`lsof -i -n -P` is the manual form. Neither is required if the harness run is
recorded, and the harness is preferred for one reason: run by hand against the
app's own PID, `lsof` reports nothing, because the webview's traffic belongs to
WebKit XPC services reparented to launchd rather than to the app.

## macOS signing and packaging

The release candidate must make one of these two choices explicit:

| Choice | Release condition |
|---|---|
| Signed and notarized | A Developer ID identity and a notarization request are recorded |
| Unsigned | Release notes must state the Gatekeeper warning, why it is accepted, and how to open the app without weakening system-wide security |

The v0 bundle metadata lives in
`apps/desktop/src-tauri/tauri.conf.json`: product name, identifier, category,
copyright, minimum macOS version, icon, and short/long descriptions.

Sandboxing is not enabled for the v0 direct-distribution candidate. If the
distribution channel changes to require sandboxing, Step 16b is not complete
until a dedicated adapter proves security-scoped bookmark creation, resolution,
and stale-bookmark refresh for user-selected project folders.

## User documentation

The release candidate must ship or link the following user-facing material:

[**The user guide**](../user-guide.md) is the user-facing document and covers all
five topics. The rows below name where each is specified in full, for a reader
who needs the detail behind it.

| Topic | User-facing | Specified in |
|---|---|---|
| Project folder layout and owned files | [User guide § 1](../user-guide.md) | [File format](../file_format.md) |
| The ticket file | [User guide § 2](../user-guide.md) | [File format](../file_format.md) |
| Backups and version control | [User guide § 3](../user-guide.md) | `apps/desktop/README.md` registry recovery |
| Agent editing contract | [User guide § 4](../user-guide.md) | [Agent context example](../../examples/agent-context/README.md) |
| Recovery from degraded files, conflicts, unavailable folders, and corrupt registry | [User guide § 5](../user-guide.md) | `apps/desktop/README.md`, [agent round trip](agent-round-trip.md) |
| Privacy boundary and local diagnostics | [User guide](../user-guide.md), [release notes](../release-notes/v0.1.0.md) | `apps/desktop/README.md`, this checklist |

The release notes carry the local-only boundary, the Phase 2 / Phase 3
separation, and the Gatekeeper rationale the unsigned branch below requires.
**A user-facing document is prose addressed to someone who installed the DMG.**
A link table pointing at specifications does not satisfy this row, which is what
the first Step 16b pass shipped.

## Known issues

Every known issue must have a severity, user impact, workaround, and release
decision, recorded in the candidate's own file.

Release blockers include data-integrity failure, silent overwrite, watcher loop,
incorrect actor attribution, account or network dependency for local use,
overbroad filesystem access, and an accessibility failure that prevents keyboard
completion of the core ticket lifecycle.
