---
title: "Clean-machine packaged-app pass — 2026-08-05"
product: LongClaw
status: record
milestone: "M6 — MVP release"
---

# Clean-machine packaged-app pass — 2026-08-05

The last of Step 17's release blockers, and the row
[the gate](release-candidate.md#install-upgrade-restart-and-offline) has carried
unmet since Step 16b.

**Every row passes. One finding, reported as non-blocking, and no release
blockers remain.** Getting here first required fixing a defect that made the
release unopenable for anyone who downloaded it — see
[the 2026-08-05 acceptance record](final-acceptance-2026-08-05.md#the-bundle-was-unopenable-and-every-candidate-before-this-one-shipped-it).

## Identity

| Field | Value |
|---|---|
| Date | 2026-08-05 |
| Machine | the build machine, Apple Silicon |
| macOS | 26.5.2 (build 25F84, Darwin 25.5.0) |
| Clean by | **reset of the build machine's own account**, not an untouched Mac |
| Previous build | `8d261b7`, signed and repacked so the upgrade row could run |
| Candidate | the branch at `82dac6b`, ad-hoc signed |

## How clean the machine actually was

This did not run on a Mac that had never seen LongClaw, and the record should not
be read as if it had. Both alternatives were unavailable: the second M2 rejects
the DMG under an install restriction, and the Intel MacBook cannot run an Apple
Silicon build — which is out of scope for this release rather than a gap, since
the release notes state there is no Intel or universal binary.

So the build machine's own account was reset: the application-support directory,
the preferences plist, the caches, the WebKit storage, any installed
`/Applications/LongClaw.app`, and the app's TCC grants via
`tccutil reset All io.longclaw.desktop`.

Four limits follow, recorded rather than implied:

| Limit | Standing |
|---|---|
| The app's privacy grants were reset, but this user had granted them before | Whether a folder-access prompt appeared exactly where a new user would see one was **not separately recorded**. Worth confirming on a genuinely fresh machine before the next release |
| Gatekeeper was **simulated** — a `com.apple.quarantine` attribute was written onto both DMGs, because a locally built file has never been downloaded and carries none | Faithful, and the reason the signing defect was found at all. Without it macOS runs no check and the whole first-launch path passes untested |
| Every developer tool on this machine is still installed | No step of the pass appeared to need one, but this machine cannot prove their absence the way a fresh one would |
| Not a cold-boot machine | Startup here is warm. The cold budget is unaffected by this record |

## Gatekeeper and first launch

Passes, **after** the signing fix and not before it. The first attempt produced
*"LongClaw is damaged and can't be opened"* with *Move to Bin* as the only
option — the defect fixed in `82dac6b`.

| Check | Result |
|---|---|
| First open is refused with the right message | pass — macOS 26 shows **"LongClaw" Not Opened**, *"Apple could not verify … is free of malware"*. That is the correct dialog for a valid, unnotarized bundle |
| **Open Anyway** appears in System Settings → Privacy & Security | pass |
| Open Anyway opens the app, and the decision sticks | pass |
| No `spctl` call or system-wide Gatekeeper change was needed | pass |

The release notes' § Opening the app the first time was corrected during this
pass (`c78d2ef`): it described pre-macOS-15 wording no current Mac shows, and it
never said which button to press — **Move to Bin** is the highlighted one.

## The gate's table

| Scenario | Result |
|---|---|
| Fresh install from DMG | **pass** — reaches project selection with no account, key, or network |
| First project creation | **pass** — the folder received only `longclaw.yaml`, `AGENTS.md`, and `tickets/`. The key-grammar check held: an invalid key was explained inline, **Choose folder** stayed disabled, the native picker never opened, and a refused creation left no `.longclaw/` behind |
| Upgrade over the previous build | **pass** — project list, star state, theme, and appearance all survived |
| App restart | **pass with a finding** — tickets reload from disk and the registry stays valid, but the previously selected project is not restored. See § Finding 1 |
| Sleep/wake with the window focused | **pass** — external edits appear without refresh or restart, and the watcher survives sleep/wake |
| Folder move | **pass** — marked unreachable, re-locatable, no unrelated folder scanned; both while running and while closed |
| Offline launch and edit | **pass** — create, edit, search and archive all work with Wi-Fi disabled, with no account prompt |

## Boundaries

| Check | Result |
|---|---|
| Project writes | **pass** — only inside the chosen folder's `.longclaw/` tree |
| App state | **pass** — only under `~/Library/Application Support/io.longclaw.desktop/` |
| Account, sign-in, licence, or waitlist prompt | **none, at any point, in any phase** |

Together with the driven runtime network audit in
[the acceptance record](final-acceptance-2026-08-05.md#the-runtime-network-audit),
the local-only boundary is now verified at three layers: the source and host
graph (`release:audit`), the shipped binary (`release:binary-audit`), and the
running app (`audit:network`), plus this packaged-install pass.

## Finding 1 — relaunch does not restore the project that was open

With two projects registered and the second open at quit, relaunching selects the
first. Reproduced on a plain restart as well as across the upgrade, so it belongs
to restart rather than to installing over a previous build.

**It was never implemented, rather than broken.** Startup takes the first
*reachable* project in registry order:

```
apps/desktop/src/App.tsx:573-575
    const reachable = projects.find((project) => project.reachable);
    if (reachable) await loadProject(reachable.id);
    else if (projects[0]) setActiveProjectId(projects[0].id);
```

`activeProjectId` lives only in the in-memory store (`src/state.ts:16`) and the
registry has no field to persist it in. Star, theme and appearance survive a
restart because they *are* persisted per project; the selection never was.
Nothing regressed, and nothing caught it because no test restarts the app with
two projects registered.

**Reported as a finding, not a blocker**, on the operator's judgement: nothing is
lost, nothing is corrupted, and the other project is one click away. Filed as
[P5a](../backlog/post-mvp-backlog.md) with the fix named.

One tension recorded rather than smoothed over: the gate's restart row reads
*"Last project state reloads from disk and the registry remains valid"*, and on a
strict reading of "last project" that row is met by its second half only. Whether
that phrase means "the project you had open" or "the project state, from disk" is
a sign-off judgement. Both readings are here so the release call is made
deliberately.

## Verdict

| | |
|---|---|
| Rows passed | all seven, one with a finding |
| **Release blockers found** | **none** |
| Non-blocking findings | 1 — Finding 1, filed as P5a |
| Blockers cleared by this pass | the clean-machine packaged-app pass, the last of the three |

**No release blocker remains open.** What is still open and non-blocking: the
oldest-supported-Mac run, accessibility Part B (VoiceOver, owner Design, due
2026-09-04), the round-trip scenario's human halves, and a medium *real* project
against the budgets.
