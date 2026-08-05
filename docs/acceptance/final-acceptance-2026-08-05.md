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

**The release is still not cut, but two of the three blockers are closed and the
third is the only one left.** What remains needs a machine that has never run
LongClaw.

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
| `npm run audit:network` | **new.** pass — driven offline and online, 7/7 steps, C1–C5 green, zero connections and zero bytes in both. See § The runtime network audit |

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

**The blocker's own pass was run, offline and online, driven by a person.** Both
against the rebuilt bundle, both with all seven of the gate's steps confirmed
driven rather than assumed:

| | offline | online |
|---|---|---|
| Steps driven, of 7 | **7** | **7** |
| Samples (lsof / nettop, every 500 ms) | 27 / 27 | 43 / 43 |
| External connections | **0** | **0** |
| Loopback connections | 0 | 0 |
| Listening sockets | 0 | 0 |
| Byte counters, all monitored processes | **0** | **0** |
| Control bytes proving the counter reads | 2,961,408 | 4,763,648 |
| WebKit helpers attributed, and reaped | 3 → 0 survived | 3 → 0 survived |
| Controls | C1–C5 pass | C1–C5 pass |
| Record | `dist-network-audit/network-audit-offline.json` | `…-online.json` |

Zero sockets of any kind, including loopback: Tauri's IPC is a custom scheme
handled inside the webview, so the expected number of connections was never one —
it was none, and that is what both runs found. The counters agreeing with the
peer list at zero is what makes the absence a reading rather than a gap between
samples.

Earlier, unattended runs against the same bundle were clean and repeated three
times for stability; they are superseded by the driven runs above.

**One thing the harness does not check: that the machine was actually offline.**
`--phase` is a label, not a measurement, and it rests on the operator in the same
way `perf:startup --cold` does. Read the offline row as: *with the operator
asserting the network was down*, the app completed all seven steps and opened
nothing — which is what § Offline launch and edit asks for, on that assertion.

The two runs are worth having separately even so. The finding that carries
without any assertion about the network is the **online** one: with connectivity
definitely available, the app still opened nothing.

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

## The bundle was unopenable, and every candidate before this one shipped it

Found by trying to install the DMG rather than by running it: **macOS refused the
app outright — "LongClaw is damaged and can't be opened", with *Move to Bin* as
the only button.** No *Open Anyway*, so the route the release notes document did
not exist, and a user following the release's own instructions could not open it.

The cause is one missing line. `tauri.conf.json` set no
`bundle.macOS.signingIdentity`, so Tauri never signed the **bundle**:

| | before | after `signingIdentity: "-"` |
|---|---|---|
| `codesign --verify --deep --strict` | *code has no resources but signature indicates they must be present* | **valid on disk**, satisfies its Designated Requirement |
| `Sealed Resources` | **none** | version=2, 13 rules |
| `Contents/_CodeSignature` | **absent** | present |
| Signature | adhoc, **linker-signed** — the linker's mark on the Mach-O, not a signed bundle | adhoc, hardened runtime |
| `spctl` | invalid signature → **damaged, Move to Bin** | `rejected` → the ordinary unidentified-developer dialog, **with Open Anyway** |

An unsigned release is a recorded decision here; an *unsealed* one was not, and
the two fail completely differently. `spctl` rejecting an unnotarized app is
expected and is the case that offers Open Anyway. A broken seal is not.

**Why no earlier candidate caught it, including this record's own automated
gate.** Gatekeeper only runs on a file carrying `com.apple.quarantine`, which is
written by whatever downloaded it. A locally built DMG has never been downloaded,
so on the build machine the app opens with no check at all. Every prior pass ran
the app from a terminal or a locally built bundle, and the packaged-install path
was the one row nobody had exercised. The 8d261b7 bundle has the identical
defect, so this shipped through Step 16b and Step 17 alike.

Reproducing it needs one command — the attribute a browser would set:

```sh
xattr -w com.apple.quarantine "0081;$(printf '%x' $(date +%s));Safari;$(uuidgen)" <dmg>
```

**Fixed, and now guarded.** `release:binary-audit` fails on a signature that does
not verify and on a bundle that seals no resources, confirmed red against a
bundle with `_CodeSignature` removed and green again on restore. The signed
bundle was re-measured rather than assumed: `perf:startup` warm p50 498.52 ms
against the 750 ms budget across five launches, so the hardened runtime that
comes with signing does not cost the webview its JIT.

## Where the release stands

**No release blocker remains open.** All three are closed, and a fourth — found
while closing the third — is fixed.

| Blocker, as at 2026-08-04 | Now |
|---|---|
| The release bundle predates the accessibility fixes | **Cleared.** Rebuilt at the final commit, DMG produced, full automated gate re-run against it |
| Runtime network audit not complete | **Cleared.** Driven offline and online against the rebuilt bundle, all seven steps, C1–C5 green, zero connections and zero bytes in both |
| Clean-machine packaged-app pass not complete | **Cleared.** [The record](clean-machine-2026-08-05.md): all seven rows pass, one non-blocking finding, no blockers |
| *Raised and fixed during that pass:* the bundle was unopenable | **Cleared.** `signingIdentity: "-"`, guarded by `release:binary-audit`. See § The bundle was unopenable |

The clean-machine pass ran on the build machine's own reset account rather than
an untouched Mac — the second M2 rejects the DMG under an install restriction and
the Intel MacBook is out of scope for an Apple Silicon build. That substitution
and its four limits are stated in the record rather than implied.

Open and not blocking, all unchanged: the oldest supported Mac, Part B of the
accessibility pass (VoiceOver semantics, owner Design, due 2026-09-04), and the
round-trip scenario's human halves (§ 1, 2, 4, 5, 7).

### What is still open, none of it blocking

- **The oldest supported Mac.** Every number in this record is from one current
  Apple Silicon machine, and `architecture-spike-report.md:72` sets the budgets
  on the oldest supported production Mac.
- **Accessibility Part B** — VoiceOver semantics, owner Design, due 2026-09-04.
- **The round-trip scenario's human halves** (§ 1, 2, 4, 5, 7). The agent half
  was run for real on 2026-08-04.
- **A medium *real* project against the budgets.** Every size measured is
  generated.
- **One question this pass left unanswered:** whether a first-launch folder-access
  prompt appears exactly where a genuinely new user would see one. The app's TCC
  grants were reset, so it should, but it was not separately recorded — and a
  reset account cannot prove it the way an untouched Mac would.
