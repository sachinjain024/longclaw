---
title: "Final MVP acceptance — 2026-08-05"
product: LongClaw
status: record
milestone: "M6 — MVP release"
---

# Final MVP acceptance — 2026-08-05

The second Step 17 pass over [the gate](release-candidate.md), a day after
[the first](final-acceptance-2026-08-04.md). It exists because two of that
record's conclusions were about the machine rather than the product, and both
turned out to be wrong.

**The release is still not cut, but one of the three blockers is gone and a
second now has a harness.** What remains needs a clean machine and a person.

## What the 2026-08-04 record got wrong

That record reported `perf:startup` as unobtainable and the DMG as unbuildable
from this shell, and attributed both to the absence of a foreground GUI session.
The diagnosis was right. The prescription — that only a human at Terminal.app
could run either — was too strong: with a GUI session present on the machine,
**both run from the same agent shell that failed before.**

| Claim, 2026-08-04 | 2026-08-05 |
|---|---|
| `perf:startup` reports a fixed ~30,16x ms stall; "needs one command from a human terminal" | Runs. `startup_to_rendered_ms` **539.69** on the first probe of a direct launch, and a full five-launch run completes |
| `npm run build:app` fails bundling the DMG: "Not authorised to send Apple events to Finder. (-1743)" | Builds both bundles, DMG included, exit 0 |

Nothing in the app changed to make that true. The lesson is the one the startup
harness already writes down about Low Power Mode: **an environment-shaped number
is not a product finding, and it is worth re-running once the environment
changes** rather than escalating it to a person.

## Build identity

| Field | Value |
|---|---|
| Source revision | `implement/step-17-final-acceptance`, at the accessibility fixes plus this pass's harness |
| Build command | `npm run build:app` |
| App bundle | `…/release/bundle/macos/LongClaw.app` — **rebuilt 2026-08-05 10:17 IST** |
| DMG | `…/release/bundle/dmg/LongClaw_0.1.0_aarch64.dmg` — **produced**, 3,624,257 bytes |
| Bundle timestamp read back by the harness | `2026-08-05T04:47:59.056Z` |
| macOS build machine | Apple Silicon, macOS 24.3.0 |
| Oldest supported test Mac | not run — still open |

**This clears the blocker the last record raised.** The measured bundle is now
the code that would ship: the accessibility fixes are in it, and every number
below was taken against it.

## Automated results

| Command | Result |
|---|---|
| `npm run verify` | pass at the final tree |
| `npm run build:app` | pass — `.app` **and** DMG |
| `npm run release:binary-audit` | pass — 325 imported symbols, 13 linked libraries, controls held |
| `npm run matrix` | pass — 8 axes × 9 states clean |
| `npm run a11y:audit` | pass — A1–A5 against the rebuilt tree |
| `npm run perf:startup` | pass — see below |
| `npm run audit:network` | **new.** Controls green, no connection observed; **not the release pass**, see § The runtime network audit |

`perf:rust`, `perf:board` and `perf:list` were **not re-run**, and should not be
read as fresh here. Nothing under `src/` or `src-tauri/` changed between the
2026-08-04 record and this one — this pass added a harness under `perf/`, two
ESLint globals, and documentation — so that record's numbers still describe this
tree. Quote them from there, not from here.

### Startup

Against the rebuilt bundle, five launches:

| | ms |
|---|---|
| Samples | 611.39, 480.88, 459.63, 446.95, 420.03 |
| First launch of the run | 611.39 — **not** a cold-boot number |
| Warm | p50 **459.63**, p95 480.88, min 420.03, max 480.88 |
| Budget | warm ≤ 750, cold ≤ 1,500 |

Within budget, and consistent with the 458.69 ms the pilot candidate measured.
The pre-rebuild bundle measured p50 415.11 ms in the same shell an hour earlier;
the difference is a rebuild and ordinary run-to-run variance, not a regression.

A true cold number still needs `sudo purge && npm run perf:startup -- --cold`,
which this shell cannot assert.

## The runtime network audit

The gate has asked for a process-monitor pass since Step 16b and never had one.
It is now `npm run audit:network` — see
[the gate](release-candidate.md#security-privacy-and-filesystem-checklist).

**Why a naive version of this would have passed while proving nothing.** On
macOS a WKWebView's traffic does not belong to the app's process: WebKit runs
GPU, WebContent and Networking as XPC services, and all three are reparented to
launchd. `lsof -i -p <app-pid>` therefore watches the one process that was never
going to open the connection, finds nothing, exits 1, and reads as a clean audit.
Measured here: one launch spawns exactly three helpers, all `PPID 1`.

So the harness attributes helpers by launch window and **proves the attribution
at both ends** — they must appear with the app and die with it — then reads two
probes with different blind spots: `lsof` names peers but samples on an interval,
`nettop` byte counters cannot miss traffic but never name a peer. Counters that
moved with no peer sampled **fail** the run rather than passing it.

Five controls decide whether a silent result is evidence at all: a Networking
helper was attributed (C1), a deliberate control connection was seen (C2), the
byte counters read real traffic (C3), the helpers died with the app (C4), and the
app actually painted a board (C5). `--self-test` injects an external peer and
fails if the run stays green.

**What was run, and what it is worth.** An unattended run against the rebuilt
bundle: C1–C5 green, zero external, zero loopback, zero listening sockets, zero
bytes on every monitored process, repeated three times for stability.

Three of the harness's own probes were found blind or wrong while it was being
written, which is the argument for `--self-test` and for controls generally:

1. the byte-counter control was asserted against the *app* rather than the
   control connection, so a correctly silent app read as a broken probe;
2. the summary line named all seven gate steps when none had been driven — the
   exact overstatement the harness exists to prevent;
3. C5 read one regex match per stdout chunk, and the app reports `rowCount: 0`
   before the probe that matters, so a rendered app intermittently failed the
   control. It looked like an environment fault for two runs before it was
   traced to the harness.

**It is not the release pass and the harness says so in its own output.** Nobody
drove the app, and the offline half was not run. What is proven is launch and
idle; what the blocker asks for is the step list, offline and online, with a
person at the keyboard.

## Where the release stands

| Blocker, as at 2026-08-04 | Now |
|---|---|
| The release bundle predates the accessibility fixes | **Cleared.** Rebuilt at the final commit, DMG produced, full automated gate re-run against it |
| Runtime network audit not complete | **Harnessed, not complete.** `npm run audit:network` exists and is proven against an injected peer; the offline and online driven runs are still owed |
| Clean-machine packaged-app pass not complete | **Unchanged.** Fresh install, upgrade, restart, folder move, offline, on a profile that has never run LongClaw |

Open and not blocking, all unchanged: the oldest supported Mac, Part B of the
accessibility pass (VoiceOver semantics, owner Design, due 2026-09-04), and the
round-trip scenario's human halves (§ 1, 2, 4, 5, 7).

### What a human still has to run

```sh
npm run audit:network -- -- --phase=offline   # Wi-Fi off, drive the step list
npm run audit:network -- -- --phase=online    # then again, online
```

The doubled `--` is required from the repository root: the wrapper delegates with
`npm --prefix apps/desktop`, npm eats the first one, and a dropped `--phase`
silently labels the run `unlabelled` so the second overwrites the first.

Then, by hand: the clean-machine install/upgrade/restart/folder-move/offline
table on a fresh profile, the oldest-Mac run, and the round-trip scenario's human
halves. The DMG for the clean-machine pass is built and waiting.
