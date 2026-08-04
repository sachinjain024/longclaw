---
title: "Final MVP acceptance — 2026-08-04"
product: LongClaw
status: record
milestone: "M6 — MVP release"
---

# Final MVP acceptance — 2026-08-04

Step 17's record: what was run against the release candidate, what passed, and
what is still open. It is evidence, not a checklist — the checks live in
[the release-candidate gate](release-candidate.md) and
[the round-trip scenario](agent-round-trip.md), and this says what happened when
they were run.

**The release is not cut.** Four things Step 16b carried are still carried, and
two of them are release blockers under this project's own rules. What changed
today is that the biggest of the four — the accessibility pass — is done, and
doing it found two release-blocking defects and one platform behaviour nobody had
looked at. § Where the release stands says exactly what remains and who can do
it.

## Build identity

| Field | Value |
|---|---|
| Source revision | this branch, `implement/step-17-final-acceptance` |
| Base | `8d261b7` — the Step 16b merge |
| Build command | `npm run build:app` |
| App bundle | `apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app` — **built** |
| DMG | **not produced on this machine.** See § The DMG |
| macOS build machine | Apple Silicon, macOS 24.3.0, WebKit `Version/26.5 Safari/605.1.15` |
| Oldest supported test Mac | not run — still open, as at the last candidate |

The product source changed after the bundle above was built: the accessibility
fixes in § What the audit found landed afterwards. **The bundle must be rebuilt
before release**, and the numbers below that came from the bundle — the agent
round trip — are marked where that matters.

## Automated results

| Command | Result |
|---|---|
| `npm run verify` | pass at the final tree, including the native watcher: `external_visibility_pipeline_ms=194.26`, `coalesced_events=6`. (At the branch point, before any change here: `187.29` / `5`) |
| `npm run build:app` | `.app` bundled; DMG step failed on a machine restriction, see § The DMG |
| `npm --prefix apps/desktop run release:audit` | pass — 70 files clean, narrow capabilities, no network or process call in shipped source |
| `npm run release:binary-audit` | pass — 325 imported symbols, 13 linked libraries, no HTTP client, socket import, or network framework |
| `npm run matrix` | pass — 8 axes (4 presets × 2 appearances) × 9 states clean |
| `npm run a11y:audit` | **new.** pass — A1–A5, see § The accessibility pass |
| `npm run a11y:audit -- --self-test` | pass — every row went red against its injected break |
| `npm run perf:rust` | pass |
| `npm run perf:board` / `perf:list` | pass, `frame_ms=17` |
| `npm run perf:startup` | **not obtained.** Blocked by this shell's environment, see § Startup |

## Performance

Every WebKit number below was taken at `frame_ms=17`, within 2 ms of the 16.7 ms
at 60 Hz the Step 4 budgets assume — so these are comparable, which the last
candidate's first pass was not.

| Area | Budget | Measured | Verdict |
|---|---|---|---|
| Board interaction, 5,000 tickets | p95 ≤ 50 ms, p50 ≤ 16 ms, median within 4 ms of the 600 floor | keyboard 14/15, scroll 17/18, filter 15/26, external write 15/17 (p50/p95) | pass |
| List interaction, 5,000 tickets | same | keyboard 14/16, scroll 17/18, filter 15/20, external write 14/16 | pass |
| 600-ticket floor, board | the control | 14/15, 17/18, 16/23, 15/16 | every median within 4 ms |
| 600-ticket floor, list | the control | 14/16, 17/18, 15/20, 15/16 | every median within 4 ms |
| Index build, 5,000 | ≤ 2,500 ms | `rebuild_ms=1131.29`, `open_ms=1657.25` | pass |
| Search, 5,000 | p95 ≤ 50 ms | `search_ms=3.95` | pass |
| Write / create, 5,000 | Step 4 write budget | `write_ms=51.76`, `create_ms=58.01`, `concurrent_request_ms=56.05` | pass |
| Detail read | — | `detail_ms=0.36` | pass |

### Small, medium, and large

`LONGCLAW_PERF_TICKETS=<n> npm run perf:rust`, all three sizes on the same
harness so the numbers are comparable:

| Tickets | Real or generated | open | rebuild | search | write | create | concurrent |
|---|---|---|---|---|---|---|---|
| 50 | generated | 243.82 | 14.17 | 0.04 | 13.46 | 9.02 | 0.52 |
| 1,000 | generated | 437.67 | 214.99 | 0.67 | 24.91 | 16.45 | 8.96 |
| 5,000 | generated | 1657.25 | 1131.29 | 3.95 | 51.76 | 58.01 | 56.05 |

All in ms. The 1,000-ticket index build has a budget of its own — ≤ 750 ms — and
`214.99` clears it with room; 5,000 clears its 2,500 ms budget at `1131.29`.

**All three are generated**: uniform titles, one label, no history. They prove
the app survives the size, not that it survives what a real project of that size
looks like. The only *real* project exercised here is the 6-ticket fixture used
for the agent round trip and the startup harness. **A medium real project is
still not covered** — that row of the gate is unmet, and it is unmet in the same
way it was at the last candidate.

### Startup

**Not obtained, and the reason is the shell rather than the app.** Five launches
of the packaged binary each reported `startup_to_rendered_ms` of **30,16x ms** —
30160.43, 30178.31, 30175.78, 30185.59, 30163.72. That is a constant, not a
distribution: five samples inside 25 ms of each other is a fixed stall, and no
amount of work varies that little. Nothing is printed in the gap.

The cause is that this shell has no foreground GUI session — the same restriction
that stops the DMG being built (§ The DMG) — so the window never becomes visible
and WebKit does not run an animation frame until a ~30 s fallback fires. The
board's `reportVisibleUi` probe is scheduled inside that callback, so the number
is the fallback timer, not the app.

**This needs one command from a human terminal**, where the previous candidate
measured warm p50 458.69 ms against a 750 ms budget:

```sh
npm run perf:startup
```

Do not file the number above as a regression. If it reproduces from a normal
terminal, it is a real defect and blocks; from this shell it is the environment.

## The accessibility pass

The Step 16b blocker, closed: [plan 41](../plans/completed/41-accessibility-audit.md).

Part A is now automated — `npm run a11y:audit` drives the real `App` in WebKit,
the engine the packaged app's WKWebView runs, with no pointer input anywhere in
the file, and every check cites the line of
[`keyboard-focus-map.md`](../design/prototype/keyboard-focus-map.md) it tests.

**Read the table with one qualification.** Plan 41 asked for Part A "against the
packaged bundle", and this ran against the same bundle served as a page rather
than inside `LongClaw.app`. It therefore says nothing about what the native
window contributes, and that pass rides with the clean-machine row below, where a
person is opening the bundle anyway. Plan 41's outcome argues the trade.

| Check | Result | Evidence |
|---|---|---|
| Keyboard-only create, select, edit, move, search, archive, undo, and retry | **pass** | A1, 20 checks, 600 tickets. Two defects fixed to get here |
| Focus order matches visible reading order in board, list, panel, menus, palette, settings, and toasts | **pass** | A2 — four focus-return rows plus 9 panel tab stops, 0 out of reading order |
| Visible focus is present and not hidden by panels, overlays, or scroll containers | **pass** | A3 — a card 25 rows into a scrolled column, the palette input over the scrim, and a control inside the panel; each on screen and each shown to change pixels when focused |
| Buttons, menus, form fields, tabs, alerts, and status regions have useful accessible names | **deferred to Part B** | Attributes exist and are asserted by component tests; whether they *say* anything useful needs VoiceOver. Owner Design, due 2026-09-04 |
| VoiceOver can identify the active row, ticket state, write status, conflict state, and degraded-file state | **deferred to Part B** | Same owner and date. The highest product risk in the deferral: these are the trust states |
| Contrast report has no failures | **pass** | `npm run matrix`, 8 axes × 9 states |
| Reduced motion preserves state changes without long or masking animation | **pass** | A4 — 1,652 computed durations all collapse, and an agent's external write is still marked by text and border with motion off |
| 200% zoom and larger text do not overlap or hide primary controls | **pass** | A5. **Mechanism: the CSS viewport halved to 720×450 against the same 1440×900 window**, which is what a 200% display scale or webview zoom does to layout. macOS larger text is a third mechanism and was not the one used |

### What the audit found

Three things, two of them release-blocking. Plan 41's outcome has the analysis;
in short:

1. **`C` did nothing on a freshly loaded board** — the global key handler read
   `project` from a closure that was never renewed, so the keyboard path to
   creating a ticket did not exist from a cold start. Fixed, with a regression
   test confirmed red first.
2. **Focus fell to `<body>`** whenever a focus request named a row outside the
   rendered window — creating a ticket into a long column, or closing the panel
   over a row scrolled out of sight. Fixed by routing through the roving focus
   both surfaces share. Regression test confirmed red first.
3. **On a default Mac, Tab does not reach a `<button>`.** WebKit follows the
   macOS *Keyboard navigation* setting, which is off by default —
   `AppleKeyboardUIMode` is unset on this machine — so the ticket panel's
   controls, the toast's **Retry**, and the conflict banner's two choices were
   pointer-only. Editing a description, ticking a checklist item, retrying a
   refused write and resolving a conflict all had no keyboard path. Every button
   now states its tab position and `scripts/tab-order-guard.mjs` fails the build
   on one that does not.

**All three are the release blocker `release-candidate.md` § Known issues defines
by name**, and all three were invisible to a jsdom suite: one needed a real
project load, one needed real virtualization, and one needed the real engine.

## The agent round trip

[The scenario](agent-round-trip.md) has a human half and an agent half. The agent
half was run for real; the human half needs the GUI and was not.

**What was run.** A clean copy of a project, a real external agent (Claude Code)
reading **only** `.longclaw/AGENTS.md` — not `file_format.md` — and executing
[`examples/agent-context/prompt.md`](../../examples/agent-context/prompt.md)
verbatim on `LC-2`: move to `in_progress`, add a paragraph to the description,
tick the first checklist item, append one `type: agent` activity record, write
atomically by rename. No correction was needed and no field outside the contract
was touched; `x_fixture_extension` came through byte-identical.

**How it was checked.** The **packaged release binary** was launched against the
edited project. It listed the ticket **by title** rather than as a path — a file
it cannot parse appears by path, as `LC-98` and `LC-99` do in the same output —
and the row had moved position, which is the status change being read:

```text
rowTitles: ["External changes update visible state","Load canonical ticket files",
            "Preserve unknown frontmatter during writes",
            ".longclaw/tickets/LC-98/ticket.md",".longclaw/tickets/LC-99/ticket.md"]
```

**What this does and does not prove.** It proves the instruction contract is
sufficient for a real agent with no other help, and that the shipped parser
accepts the result. It does not prove the *acknowledgement* — the agent-green
ring, the pulse, the `❯ updated by …` footer, the timeline badge — because that
needs eyes on the window. Those are covered by `src/Board.test.tsx`,
`src/TicketPanel.test.tsx`, `src/freshness.test.ts` and `src/attribution.test.ts`
as logic, and the scenario's § 4 remains a human pass.

## Documentation

Verified against the clean project rather than read. Every relative link in the
release-facing documents resolves (checked mechanically).

| Claim | Verdict |
|---|---|
| The `.longclaw/` layout in [user guide § 1](../user-guide.md) | matches the project on disk, including `attachments/` |
| The ticket example in § 2 | matches `LC-1`'s real frontmatter field for field |
| `~/Library/Application Support/io.longclaw.desktop/`, and `project-registry.backup.json` as the recovery file | correct — the app read a registry written to exactly that path, and `registry.rs:31` names the backup |
| [`examples/agent-context/`](../../examples/agent-context/) points an agent at the contract | correct, and sufficient: the round trip above used nothing else |
| § 5 recovery behaviours | consistent with the shipped failure copy and Step 14's tests |
| § 5 "launch it from a terminal: it prints local diagnostics" | **wrong, and corrected.** The engine's diagnostics are gated behind `LONGCLAW_LOCAL_DIAGNOSTIC=1` (`engine.rs:715`); without it a user gets only the startup probe. The guide now gives the command and says honestly how small the channel is |

The release notes carried the same overstatement in § The local-only boundary and
were corrected with it.

## Security, privacy, and filesystem

| Check | Evidence |
|---|---|
| Package audit | pass — `release:audit`, 70 files, no network-capable crate in the macOS host graph |
| Binary audit | pass — `release:binary-audit`, 325 symbols and 13 libraries on the shipped binary |
| Tauri capability audit | pass — one capability, three permissions, asserted exactly |
| Filesystem scope | the app wrote only inside `.longclaw/` in every run here, and app state only under the redirected `HOME`. Packaged-app manual pass still required |
| Crash diagnostics | pass — no crash reporter; guidance now in the user guide as a runnable command |
| Account boundary | pass by audit. Every run on this machine was made with no account and no network dependency, but a deliberate offline pass on a clean profile is still required |
| Runtime network audit | **not run.** Unchanged from the last candidate and still a blocker |

## The DMG

`npm run build:app` produced `LongClaw.app` and then failed bundling the DMG:

```text
execution error: Not authorised to send Apple events to Finder. (-1743)
```

`bundle_dmg.sh` drives Finder over AppleScript to lay out the disk-image window,
and this shell has no Automation permission — the same missing GUI-session
privilege behind the startup stall. **It is not a packaging defect**: the failure
is in the cosmetic layout step, after the image is created and the app is copied
in, and CI runs `npm run build:app` on `macos-latest` as a required job.

Two ways to produce the release DMG, both a human's:

```sh
npm run build:app        # from Terminal.app, granting Automation → Finder when asked
```

or take the artifact from a green CI run of the release commit.

## Where the release stands

The MVP acceptance scenario has ten steps. What is proven and what is not:

| Step | State |
|---|---|
| 1. Install and launch | **open** — needs a clean machine and a DMG |
| 2. Create/open a folder project | covered by Rust storage tests and the project-key grammar suite; packaged-app pass open |
| 3. Select a theme | covered by `npm run matrix` across 4 presets × 2 appearances × 9 states |
| 4. Create and enrich a ticket | **proven by keyboard**, A1 |
| 5. Navigate board, list, panel, search, palette | **proven by keyboard**, A1 and A2 |
| 6. Edit it with a real external agent | **proven** — § The agent round trip |
| 7. Observe and review the agent update | logic covered; the on-screen acknowledgement is a human pass, **open** |
| 8. Restart and rebuild the index | covered by storage/registry tests and `rebuild_index`; packaged-app pass open |
| 9. Invalid-file and concurrent-edit recovery | covered by Step 14's suites and by A1's refused-write path, which now has a keyboard Retry |
| 10. Offline and no account | proven by audit; the deliberate offline pass on a clean profile is **open** |

### The four carried items, restated

Step 16b named four. One is closed; three remain, and none may be waved through.

1. ~~**The accessibility pass.**~~ **Closed.** Part A automated and green; Part B
   deferred to 2026-09-04 with Design as owner, per plan 41's own split.
2. **The runtime network audit.** Still open, still a blocker. The static and
   binary audits cannot see the webview. Run the app offline, then online under
   `lsof -i -n -P` or Little Snitch, through launch, project open, create/edit/
   archive/search, and restart.
3. **The clean-machine packaged-app pass.** Still open, still a blocker. Fresh
   install, upgrade, restart, folder move, offline — on a profile that has never
   run LongClaw.
4. **A run on the oldest supported Mac.** Still open. Every number in this record
   is from a current Apple Silicon machine;
   `architecture-spike-report.md:72` sets the budgets on the oldest supported
   production Mac.

Plus one raised here: **the release build must be rebuilt** at the final commit,
because the accessibility fixes landed after the bundle these numbers came from.

### What a human has to run

Everything left needs a GUI session, a clean machine, or a person's judgement.
In the order that makes sense:

```sh
npm run verify && npm run build:app     # from Terminal.app — rebuilds, and produces the DMG
npm run perf:startup                    # the startup budget, unobtainable from an agent shell
npm run a11y:audit                      # confirm Part A against the rebuilt tree
```

Then, by hand: the clean-machine install/upgrade/restart/folder-move/offline
table, the runtime network audit, the oldest-Mac run, and the round-trip
scenario's human halves (§ 1, 2, 4, 5, 7).

## Known issues

| Severity | Issue | Impact | Workaround | Release decision |
|---|---|---|---|---|
| Release blocker | Clean-machine packaged-app pass is not complete | Fresh install, upgrade, restart, folder move, and offline behaviour unproven on a profile that has never run LongClaw | Run the install/upgrade/offline table | Do not release until complete |
| Release blocker | Runtime network audit is not complete | The webview is network-capable by construction; only the CSP bounds it, and no process monitor has watched it | Offline and online process-monitor passes | Do not release until complete |
| Release blocker | The release bundle predates the accessibility fixes | The measured `.app` is not the code that would ship | Rebuild at the final commit and re-run the automated gate | Do not release until rebuilt |
| Open, not blocking | Oldest supported Mac never exercised | Budgets are set on the oldest supported machine and measured on a current one | Run `perf:startup`, `perf:board`, `perf:list` there | Decide before release; a miss there is a real miss |
| Open, not blocking | Part B — VoiceOver semantics — deferred | A screen-reader user may not be told a write failed, a file changed underneath them, or a ticket will not parse | None in-app | Deferred to 2026-09-04, owner Design, per plan 41 |
| Accepted | Build is unsigned and not notarized | Gatekeeper warns on first launch | [Release notes](../release-notes/v0.1.0.md) carry the warning, the rationale, and the Open Anyway route | Accepted; the release-note condition is met |
| Accepted | `LONGCLAW_EXIT_AFTER_FIRST_PROBE` can report a startup time for an empty board | A measurement taken with the env var directly is silently wrong some fraction of the time | Use `npm run perf:startup`, which waits for a probe reporting rows | Diagnostics-only; accept for v0 |
| Open decision | The user guide is not reachable from inside the app | The app ships without a shell or URL-opening capability by design, so there is no in-app route to it | Read `docs/user-guide.md`; the release notes link it | Unchanged from the last candidate: ship the guide into new projects, render it in-app, or accept repository-only for v0 |
