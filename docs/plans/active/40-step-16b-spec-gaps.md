---
title: "Step 16b: close the eight spec gaps in the release candidate"
product: LongClaw
status: active
backlog_id: "none — Step 16b is a plan step, not a backlog row"
order: 40
owner_area: Release
release_blocking: true
written: 2026-08-04
applies_to: "implement/step-16b-release-hardening @ 27ec329"
depends_on: "nothing — 1ff010b built the gate, 27ec329 fixed its standards findings"
---

# Step 16b: close the eight spec gaps in the release candidate

> **Goal:** Meet the Linear-grade quality bar on supported macOS hardware and
> realistic projects, and prepare a release candidate.
> — `docs/mvp_plan_order.md` § Step 16b (line 713)

## Must-pass

> - The release candidate is fast, keyboard-usable, accessible, and stable
>   against realistic project sizes.
> - It works locally without an account or network connection.
> - Filesystem access is limited to the user-selected project scope and required
>   app state.
> - No release-blocking data-integrity, privacy, onboarding, or core-round-trip
>   defect remains.

## Where this came from

Commit `1ff010b` built the Step 16b gate: `scripts/release-audit.mjs`, the
`docs/acceptance/release-candidate.md` checklist, and a candidate record. A
two-axis review of that commit passed it on Standards (fixed in `27ec329`) and
found **eight gaps on Spec**. This plan closes all eight.

The gate itself is sound and is not re-litigated here. What is missing is
evidence: seven of the eight are things the spec asked to be *measured, tested,
or written* that were recorded as "not run" or asserted without the measurement
behind them.

## Working rules

- **Do not green the gate.** Every number below is either measured or recorded
  as not measured with a named reason. Widening a budget to fit a result is the
  failure mode `AGENTS.md` § Toolchain already names once, about the CI
  interaction gate; do not repeat it here.
- **The record is append-only per candidate.** Results go in
  `docs/acceptance/release-candidate-2026-08-04.md`, or a new dated record if
  the bundle is rebuilt. The checklist in `release-candidate.md` changes only
  when a *check* changes, never to hold a result.
- **Quote numbers in the commit message** for any task that re-runs a trace, per
  `AGENTS.md` § Toolchain.
- `npm run verify` must pass before each commit. It needs to run **outside the
  sandbox** — sandboxed macOS packaging, preview-server startup, and watcher
  delivery all fail for environmental reasons, which is already recorded in the
  candidate record.

---

## Task 1 — Explain the interaction and storage regressions (findings 6 and 7)

> **Done — and this section's premise was wrong. Read
> [§ Outcome](#task-1--done-and-the-plans-premise-was-wrong) before acting on
> anything below.** There was no regression to bisect: the candidate was measured
> with macOS Low Power Mode on. The bisect steps are left as written because the
> reasoning that led to the answer started here.

**Release-blocking.** This is first because it may invalidate every other
number, and because it is the only finding where the recorded result contradicts
an earlier recorded result.

### What the spec says

> Measure **and tune** against the Step 4 budgets for startup, folder open,
> index build, board/list interaction, search, and external-change visibility.

### What exists today

Three numbers for the same measurement, all in this repo:

| Measurement | Step 4 spike | Step 16a (plan 37) | This candidate |
|---|---|---|---|
| Board p95 keyboard / scroll / external write | 18 / 22 / 20 ms | 15 / — / 16 ms | **31 / 35 / 33 ms** |
| List p95 keyboard / scroll / external write | — | 22 / 19 / 16 ms | **31 / 35 / 31 ms** |
| Rust 5,000-ticket open | 711.49 ms (640.66 earlier) | — | **2093.41 ms** |

Sources: `docs/architecture-spike-report.md:76-82`,
`docs/plans/completed/37-step-16a-ui-polish.md` § Outcome,
`docs/acceptance/release-candidate-2026-08-04.md` § Performance.

Both perf runs use the same harness as the runs they regressed against —
`perf/board-trace.mjs` and `cargo test performance_budgets` in an unoptimized
test build — so the comparison is like-for-like. Interaction roughly **doubled**
since Step 16a, three days earlier. Storage open is **2.9×** the spike number
and sits 16% under its 2,500 ms budget (`src-tauri/tests/performance.rs:17`).

Everything still passes its ceiling, which is why the candidate recorded "pass".
A number that doubles and stays under budget is still a regression, and the spec
asked for tuning, not only measurement.

Two further problems in the same rows:

- **The p50 budget was dropped.** Step 4 sets `≤ 50 ms p95; ≤ 16 ms p50`
  (`docs/architecture-spike-report.md:80`). The candidate restates it as "median
  within 4 ms of the 600-ticket floor" and records **no p50 at all** — even
  though `perf/board-trace.mjs:132` already reports one. A restated budget is a
  changed budget.
- **The hardware is wrong.** "Budgets are p95 on the oldest supported production
  Mac unless stated otherwise" (`docs/architecture-spike-report.md:72`). Every
  number here is from a current Apple Silicon Mac; the record's own
  "Oldest supported test Mac" row says "not run".

### What to change

1. **Bisect the interaction regression.** The suspects are Step 16a's own
   changes (`37-step-16a-ui-polish.md` touched card and row lanes, added an
   interaction axis, and changed control sizing) and V0-29's write-failure
   states (`39-v0-29-write-failure-states.md`). Run `perf:board` at
   `1ff010b`, at Step 16a's merge, and at the commit before it. `board-trace.mjs`
   takes `--tickets=N`, so confirm at 600 as well as 5,000 — a cost that scales
   with the board is a different defect from a constant one.
2. **Bisect the storage regression** the same way against the spike's 711.49 ms.
   Check first whether the fixture changed shape: `performance.rs:38-60` writes
   a checklist item and a description per ticket that the spike's fixture may not
   have had. A heavier fixture is an explanation, not an excuse — but it means
   the two numbers were never comparable and the *record* must say so.
3. **Tune what the bisect names, or record why not.** If the cost is the price
   of a Step 16a correctness fix, that is a legitimate answer; write it down with
   the measurement, and do not leave it implied.
4. **Record p50 for both surfaces** in the candidate record, against the ≤16 ms
   budget, and restore the real budget wording in
   `release-candidate.md` § Performance report. Keep the 600-ticket floor
   comparison as an additional note — it is useful, it is just not the budget.
5. **Run both traces on the oldest supported Mac** (macOS 13.0 floor per
   `tauri.conf.json` `minimumSystemVersion`). If no such machine is available,
   that is a *known issue with a severity*, not a silent omission.

### Proof

- `perf:board` and `perf:list` p50 **and** p95 recorded for 600 and 5,000
  tickets, on both machines, in the candidate record.
- `perf:rust` open/rebuild/search recorded with the fixture shape named.
- Each regression has a named cause, or an explicit "not explained" row in
  § Known issues with a release decision.

---

## Task 2 — Measure startup (finding 1)

> **Done — and step 1 below was wrong.** The probe was never missing. It has been
> in the shipped app since Step 4 under different names (`report_visible_ui`,
> `startup_to_rendered_ms`); this plan searched for the spike's literal
> `VISIBLE_UI_PROBE` string and concluded absence. Nothing needed porting. See
> [§ Outcome](#task-2--done-the-probe-was-already-there).

**Release-blocking.** Startup is the first Step 4 budget and the only one with
no harness at all.

### What the spec says

> Measure and tune against the Step 4 budgets for **startup**, folder open, …

Budgets (`docs/architecture-spike-report.md:76-77`):

| Path | Budget | Spike result |
|---|---:|---|
| Cold process start → first interactive paint | ≤ 1,500 ms | 843.97 ms, 1,367.64 ms |
| Warm start → first interactive paint | ≤ 750 ms | 560.37–693.34 ms |

### What exists today

Nothing. The candidate records "not measured on a clean app launch". The spike
measured it with a `VISIBLE_UI_PROBE` printed on the first animation frame —
`spikes/tauri-v2-architecture/src-tauri/src/lib.rs:137` — and
[plan 07](../completed/07-board-virtualization.md) line 63 said explicitly:
"Reuse it rather than inventing a measurement." **It was never ported into the
shipped app.** Grep confirms `VISIBLE_UI_PROBE` appears only in the archived
spike and in prose.

The startup gap is also missing from § Known issues, so the spec's
"Known-issues list with severity and workarounds" deliverable is incomplete
regardless of whether the measurement lands.

### What to change

1. **Port the probe.** Emit process start → first-animation-frame on the
   existing `LONGCLAW_LOCAL_DIAGNOSTIC` stdout channel (`README.md` and
   `CONTRIBUTING.md` § Diagnostics and privacy already document that channel as
   stdout-only and untransmitted, so this adds no privacy surface). Do not
   invent a second diagnostic mechanism.
2. **Gate it behind the existing diagnostic path**, not a new env var, unless a
   measurement run genuinely needs one — in which case document it.
3. **Measure cold and warm** against the packaged `LongClaw.app`, not `npm run
   dev`: the budget is on the release bundle. Take at least three launches of
   each and record the spread, as the spike did.
4. **Record both in the candidate record**, and add a § Performance row.
5. If it cannot be measured before Step 17, **add a Known issues row** with
   severity, impact, and workaround. Do not leave it recorded only as a table
   cell.

### Proof

- Cold and warm startup numbers in the candidate record with launch counts.
- `npm run verify` green — the probe must not add a test-visible side effect.
- The probe writes nothing to disk and nothing to the network.

---

## Task 3 — Test the project sizes the spec names (finding 4)

> **Done.** See [§ Outcome](#task-3--done-three-sizes-and-a-budget-that-had-never-been-measured).
> The step below is right that the harnesses were already parameterised — except
> the Rust one, which was fixed at 5,000 and hid an unmeasured Step 4 budget.

### What the spec says

> Test representative **small, medium, and large** local projects.

### What exists today

Only large. `perf/fixture.ts:18` is `TICKETS = 5_000`;
`src-tauri/tests/performance.rs:16` is the same. The repo has
`fixtures/representative-project/` with **6 tickets** (small), and no medium
fixture at all.

`docs/acceptance/README.md:60` already concedes this in the acceptance matrix:
"Still required for each release candidate: a medium real project and a run on
the oldest supported Mac."

### What to change

1. **Small** — run the packaged app against `fixtures/representative-project/`
   and record open time and interaction feel. This doubles as the `dev:fixture`
   project, so it is already conformant and round-trip asserted.
2. **Medium** — `board-trace.mjs` already accepts `--tickets=N`
   (`perf/board-trace.mjs:64`), so a 500-ticket trace needs no new harness. Use a
   **real** project if one is available, as the spec asks; a generated
   500-ticket fixture is the fallback and must be recorded as such.
3. **Record all three sizes** in § Performance of the candidate record, so the
   "small, medium, large" line can be checked rather than assumed.

### Proof

Three sizes, three sets of numbers, each naming whether the project was real or
generated.

---

## Task 4 — Make the binary audit audit the binary (finding 8)

### What the spec says

> Audit the **binary** and runtime for accidental telemetry, unnecessary network
> calls, and overbroad filesystem permissions.

### What exists today — and an important correction

The review's finding was that `release-audit.mjs` reads only direct
`Cargo.toml`/`package.json` dependencies while `src-tauri/Cargo.lock` carries
`reqwest` (line 2488) and `hyper` (line 1273) transitively — "exactly the
accidental case" — with the checklist row still marked pass.

**The structural half of that is right; the specific alarm is not.** Measured on
the current release binary at `27ec329`:

```
cargo tree -i reqwest --target aarch64-apple-darwin   → nothing to print
cargo tree -i hyper   --target aarch64-apple-darwin   → nothing to print
cargo tree -i hyper   --target all  → hyper ← hyper-util ← reqwest ← tauri v2.11.5
```

`reqwest` and `hyper` enter under `tauri` but are **gated to non-macOS targets**,
so they are not in the macOS graph. The shipped binary confirms it —
`src-tauri/target/release/longclaw-desktop`, 10.2 MB:

| Probe | Result |
|---|---|
| `reqwest` / `hyper_util` / `h2::` / `rustls` / `native_tls` symbols | **0** each |
| Undefined `_connect` / `_socket` / `_sendto` / `_getaddrinfo` | **0** |
| `CFNetwork` / `Security` / `Network.framework` linked | **none** |
| Total undefined symbols (control) | 325, incl. `_open`, `_stat`, `_FSEventStreamCreate` |

The control row matters: a probe that returns zero because it is broken proves
nothing. This one sees the symbols it should.

So the boundary genuinely holds — but nothing in the gate *proved* it, and the
row was marked pass on a check that never opened the binary. The finding is real
as a gap in evidence.

One caveat this does not clear: the app embeds **WKWebView**, which is
network-capable regardless of what the Rust binary links. That is precisely what
the CSP `connect-src ipc: http://ipc.localhost` restriction is for, and it is
why the runtime process-monitor pass stays required.

### What to change

1. **Extend `release-audit.mjs` to read `Cargo.lock`**, not to fail on presence
   — that would fail today for a dependency macOS never builds — but to assert
   that anything network-capable in the lockfile is **absent from the
   host-target graph**. Shell out to `cargo tree --target aarch64-apple-darwin`,
   or bound the check to what a lockfile alone can prove and say so.
2. **Add a binary probe** to the gate or to the RC procedure: the symbol and
   `otool -L` checks above, *including the positive control*, so a probe that
   stops working is visible.
3. **Correct the candidate record's Binary/package audit row** to state what was
   actually verified — the row currently says "for *directly* configured
   dependencies", which is honest but is no longer the strongest claim available.
4. **Keep the docblock caveat** in `release-audit.mjs:11-16` accurate to whatever
   the script ends up checking.

### Proof

- The audit fails if a network-capable crate enters the **macOS** graph. Prove
  it by temporarily adding one, as `27ec329` proved the capability check.
- The binary probe's positive control is asserted, not just its negative.
- `npm run verify` green.

---

## Task 5 — Run the accessibility pass (finding 2)

**Release-blocking.** This is the largest remaining manual gap.

### What the spec says

> Audit keyboard access, focus order, labels, screen-reader semantics, contrast,
> reduced motion, and zoom/text scaling.

Deliverable: "Performance and **accessibility reports**." And
`docs/release-risks.md:65` requires the audit "against the criteria fixed in
Step 1".

### What exists today

**Seven of eight rows read "not run."** Only the contrast row passes, via
`docs/design/foundations/accessibility.md`, which is a generated colour report —
it covers text contrast, non-text contrast, and human/agent distinction under
colour-vision deficiency, and nothing else.

The Step 1 criteria the risk register points at are
`docs/mvp_plan_order.md` § Step 1: "Test WCAG AA contrast and human/agent
distinction, including common colour-vision deficiencies" (line 81), delivering
"Accessibility/contrast results" (line 95). The candidate never references them.

### What to change

1. **Cite Step 1 explicitly** in `release-candidate.md` § Accessibility report,
   so the risk-register criterion is checkable.
2. **Run the eight-row manual pass against the packaged app** in light and dark,
   with VoiceOver, at 200% zoom. This needs the built `LongClaw.app`, not the
   dev server.
3. **Record findings as defects**, not as checklist ticks. An accessibility
   failure that prevents keyboard completion of the core ticket lifecycle is
   already listed as release-blocking in `release-candidate.md` § Known issues.
4. **Where a component test already covers a row**, name the test rather than
   writing "covered by existing component tests where present" — that phrase
   appears twice in the record and is not checkable.

### Proof

Eight rows, each pass/fail with evidence, in the candidate record. Any failure
carries severity and a release decision.

---

## Task 6 — Write the user documentation (finding 3)

### What the spec says

> **Write** user documentation for project folders, file format,
> backups/version control, agent use, and recovery.

Deliverable: "User and agent documentation."

### What exists today

`release-candidate.md` § User documentation is a five-row link table pointing at
material that already existed before Step 16b: `docs/file_format.md`,
`apps/desktop/README.md`, `examples/agent-context/README.md`,
`docs/acceptance/agent-round-trip.md`. Every link resolves. **Nothing
user-facing was written.**

These are developer and contributor documents. `docs/file_format.md` is a format
specification; `apps/desktop/README.md` is a build-and-test README. A user who
installed the DMG has no document addressed to them.

### What to change

1. **Write one user-facing document** covering the five named topics — project
   folders, file format, backups/version control, agent use, recovery — pitched
   at someone who has installed the app and opened a folder, not someone who has
   cloned the repo.
2. **Ship or link it from the app**, since the deliverable is documentation the
   *release candidate* ships. A doc no user can reach from the product does not
   meet it.
3. **Keep the link table** in `release-candidate.md` as the gate's mapping from
   topic to source, pointing at the new document.

### Proof

The five spec topics each resolve to user-facing prose. Verified against a clean
project, per Step 17's "Verify documentation and example agent instructions
against a clean project."

---

## Task 7 — Write the release notes and the signing rationale (finding 5)

### What the spec says

`docs/release-risks.md:51` must-pass:

> Signing and notarization complete, **or the prompt is documented in the release
> notes with an explicit rationale.**

### What exists today

Unsigned was chosen and recorded
(`release-candidate-2026-08-04.md` § Signing choice), and the record itself says
the release notes "do not exist yet". A repo-wide search for a release-notes file
finds **nothing**. The unsigned branch of that must-pass is therefore not met —
the choice is made, the required artefact is absent.

`release-candidate.md` § Known issues already accepts the unsigned build only
"if release notes include the warning".

### What to change

1. **Write the release notes.** Step 17 requires them anyway: "Publish release
   notes that state the local-only boundary and explicitly separate Phase 2
   terminals and Phase 3 sync/teams" (`mvp_plan_order.md` § Step 17).
2. **They must carry**: the Gatekeeper warning a user will see, why an unsigned
   build is acceptable for v0, and how to open the app without weakening
   system-wide security — right-click → Open, not disabling Gatekeeper.
3. **State the local-only boundary** and the Phase 2 / Phase 3 separation, so the
   Step 17 requirement is met by the same document.

### Proof

A release-notes file exists, carries all three signing points and the boundary
statement, and `docs/release-risks.md:51` can be marked met.

---

## Task 8 — Decide the `release:audit` placement (scope creep)

The review's only scope-creep finding, and it called it "minor and defensible".

`apps/desktop/package.json` wires `release:audit` into `npm run check`, so a
release-only gate runs on every pre-commit. The spec asked for an audit and a
checklist deliverable, not a permanent gate.

**Recommendation: keep it.** It is fast (70 files, no network, no build), and a
privacy boundary that is only checked at release time is a boundary that breaks
between releases and is discovered late. The cost is a few hundred milliseconds
per `check`.

**What to change:** nothing in code. Record the decision — one line in the plan
outcome — so the next reader sees a choice rather than an accident.

---

## Order of execution

1. **Task 1** first: it can invalidate the candidate's headline numbers.
2. **Tasks 2, 3, 4** next — all code, all runnable without a clean machine.
3. **Task 5** once a fresh bundle exists from tasks 1–4.
4. **Tasks 6, 7** any time; they block Step 17, not each other.
5. **Task 8** is a one-line record.

Tasks 1–4 change the shipped tree, so they invalidate the
`1ff010b` bundle recorded in `release-candidate-2026-08-04.md`. Rebuild and open
a **new dated record** rather than editing that one — the split in `27ec329`
exists so that a second candidate does not overwrite the first.

## Must-pass checks

- `npm run verify` green outside the sandbox, including the native watcher.
- `npm run build:app` produces `LongClaw.app` and the DMG.
- `perf:rust`, `perf:board`, `perf:list` re-run and **p50 and p95 both quoted**,
  at 600 and 5,000 tickets, per `AGENTS.md` § Toolchain.
- `release:audit` fails on a network-capable crate in the macOS graph, proven by
  temporarily introducing one.
- A new dated candidate record with no "not run" cell that lacks either a
  measurement or a § Known issues row carrying severity, impact, workaround, and
  release decision.
- Release notes exist and carry the Gatekeeper rationale.

## Out of scope

- **Sandboxing and security-scoped bookmarks.** `release-candidate.md` already
  states v0 ships direct-distribution unsandboxed, and `docs/release-risks.md:50`
  makes the bookmark adapter conditional on the distribution channel changing.
  It has not changed.
- **Signing and notarization themselves.** Unsigned is a recorded decision for
  this candidate; task 7 documents it rather than reversing it. Acquiring a
  Developer ID is a separate call.
- **V0-42**, the CI-runner interaction-budget gate. Named open in
  `AGENTS.md` § Toolchain and `mvp_plan_order.md:623`, and the reason the
  interaction budgets are local-only. Task 1 runs them locally, as the current
  rule requires.
- **Step 17's clean-machine acceptance run.** The install/upgrade/restart/offline
  rows stay Step 17's; this plan does not move that boundary, it only makes sure
  each one carries a severity here.

## Outcome

### Task 1 — done, and the plan's premise was wrong

**Findings 6 and 7 were one environmental cause, not a code regression.** This
task was written as a bisect: find the commit that doubled interaction latency.
There was none to find. macOS **Low Power Mode was on** for the candidate's
measurement session, and it halves the animation-frame cadence every WebKit
sample is quantized to — 33 ms rather than 16.7 ms at 60 Hz — as well as
throttling the CPU the Rust harness runs on.

Re-measured with Low Power Mode off (`frame_ms=17`, 58.8 Hz):

| Surface, p95 keyboard/scroll/filter/write | Step 16a | Candidate (throttled) | Re-measured |
|---|---|---|---|
| Board | 15/18/26/16 | 31/35/38/33 | **15/18/26/17** |
| List | 22/19/21/16 | 31/35/39/31 | **15/18/23/17** |

The board is exactly where Step 16a left it; the list improved on keyboard,
22 → 15 ms. Corroborating evidence gathered before the re-measurement: no
render-path file changed between `389b551` and `1ff010b`; the 600- and
5,000-ticket results were byte-identical; and the sample distribution was
quantized (p50 30, p95 31, max 32) rather than workload-shaped.

Storage decomposed to Low Power Mode (~22%), a fixture that was never comparable
to the spike's (~21%), and a **~1.6× residual that is real and unexplained** —
1153.23 ms against the spike's 711.49 ms on a like-for-like fixture, both inside
the ≤ 2,500 ms budget. The full table is in
[the candidate record](../../acceptance/release-candidate-2026-08-04.md#the-low-power-mode-correction).
That residual is the one piece of finding 7 that survives, and it is carried
forward as an open question rather than closed.

**What changed, beyond the numbers.** `perf/board-trace.mjs` now measures the
frame cadence, reports it as `frame_ms`, and exits non-zero with `NOT COMPARABLE`
instead of printing "within budget" when the cadence is not the 60 Hz the
budgets assume. The 600-ticket floor could never have caught this: when the frame
moves, the floor and the full board move together and the comparison stays green.
The gate now also requires p50 and `frame_ms` to be quoted, and
`release-candidate.md` carries the real `≤ 16 ms p50` budget again instead of the
floor-relative paraphrase that replaced it.

**Still open from this task:** the run on the oldest supported Mac (macOS 13.0
floor). No such machine is available here, so it stays a Step 17 blocker, and the
candidate record says so rather than implying the current-Mac numbers cover it.

**Worth carrying forward:** every number in the candidate record was taken in the
same throttled session, so the correction is not limited to the two findings the
review raised. Any measurement in that record predating this task should be
treated as void until re-taken.

### Task 2 — done; the probe was already there

**The plan's premise was wrong twice over.** It claimed the spike's startup probe
"was never ported into the shipped app", on the strength of a grep for
`VISIBLE_UI_PROBE`. The app has carried it since Step 4 under different names:
`run()` stamps `PROCESS_STARTED`, the board calls `reportVisibleUi` from inside a
`requestAnimationFrame` callback, and `report_visible_ui` prints
`LONGCLAW_LOCAL_DIAGNOSTIC startup_to_rendered_ms` (`src-tauri/src/lib.rs`).
There was even an env var, `LONGCLAW_EXIT_AFTER_FIRST_PROBE`, built to make the
app quit as soon as it had reported. **No instrumentation was needed. Step 16b's
actual gap was that nobody ran it.**

`npm run perf:startup` (`perf/startup-trace.mjs`) now does, against the packaged
bundle — `LONGCLAW_DEV_PROJECT` is `#[cfg(debug_assertions)]` and useless for a
release build, so it stages a throwaway `HOME` with a one-row registry and a copy
of the fixture project, which also keeps it away from the real registry.

**Warm: p50 458.69 ms, p95 481.13 ms, min 447.57, max 481.13 over 9 launches**,
against the ≤ 750 ms budget — faster than the Step 4 spike's own 560–693 ms.

**Cold: 1090.98 ms**, against the ≤ 1,500 ms budget, taken as the first launch
after `sudo purge`; the next launch was `488.08 ms`, so the split is real rather
than noise, and the number sits between the spike's own two cold observations
(843.97 and 1367.64 ms). Both startup budgets now have a number against them,
which is what finding 1 asked for.

Only one cold sample exists per cache drop, so there is no cold percentile — a
single observation is all this measurement can be without repeated privileged
purges. `--cold` labels the sample and nothing more: the harness cannot verify
the cache was dropped, and the output says the claim is the operator's.

**A defect found while measuring.** `LONGCLAW_EXIT_AFTER_FIRST_PROBE` — the
affordance built for this exact job — can report a startup time for an empty
board. `loadProject` sets the active project id before awaiting `openProject`
(`src/App.tsx:353`), so the app can paint with a project selected and no tickets;
the probe fires on that frame with `rowCount: 0` and the env var exits on it. It
is a race, so a run of five can look clean with one bad number in it. The harness
ignores the affordance and waits for a probe reporting rows, and refuses the run
if none arrives — a guard proved by pointing it at a zero-ticket project. The
underlying probe order is left alone (the board trace depends on when it fires)
and recorded as a known issue instead.

**Also:** arguments do not survive the repo-root perf wrappers —
`npm run perf:startup -- --launches=9` at the root is silently ignored, because
npm swallows flags passed through `npm --prefix apps/desktop run …`. This is true
of the existing `perf:board` flags too. The usage docblock says so.

### Task 3 — done; three sizes, and a budget that had never been measured

All three sizes are measured and recorded in
[the candidate record](../../acceptance/release-candidate-2026-08-04.md#small-medium-and-large).
**Interaction is flat across them** — board and list p95 sit at 15–18 ms for
keyboard, scroll and external write at 100, 1,000 and 5,000 tickets alike. Only
filter and the storage load scale, which are the two operations that read every
ticket, and both stay far inside budget.

`perf:board`/`perf:list` already took `--tickets`, and `perf:startup` already
took `--project`, so those needed nothing. The Rust harness was fixed at 5,000,
so `LONGCLAW_PERF_TICKETS` now picks the size and `load_budget_ms()` selects the
Step 4 ceiling for it. The default is unchanged, so a bare `npm run perf:rust`
measures exactly what it always did.

**That surfaced a second gap the review had not named.** Step 4 states two load
budgets — 1,000 tickets in 750 ms, 5,000 in 2,500 ms — and the spike recorded the
1,000 row as *"Covered by the stricter 5,000-ticket harness below."* That is an
argument, not a measurement, and it had stood since Step 4. Measured:
**225.49 ms against ≤ 750 ms.** The assertion was confirmed to bind by forcing
the ceiling to 100 ms and watching it fail at 235.35 ms.

**What this task could not do honestly.** The spec asks for a *real* medium
project and there is none: only `fixtures/representative-project` (6 tickets) is
real, and the repo does not track its own work in LongClaw, so 100/1,000/5,000
are generated. The record says so per size rather than letting "tested at three
sizes" imply more than it should — a generated fixture has uniform titles, one
label and no history, so it exercises size but not shape.

**One limit found by measuring.** The board cannot be scroll-traced at 100
tickets: across six columns that is about a viewport of content, and the trace
stops at four scroll frames. The small board run is therefore
`--only=keyboard,filter,write`, and the record states it — a board with nothing
to scroll is the honest answer, not a gap.

**Run-to-run spread, now visible.** The 5,000-ticket storage numbers came out
about 11% apart between the Task 1 session and this sweep (open 1464.80 vs
1632.65 ms), both far inside budget. Every perf number in the record is a single
unrepeated sample, and that is roughly what one is worth.
