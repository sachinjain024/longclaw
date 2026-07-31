---
title: "Pending work after Step 10"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted"
written: 2026-07-30
updated: 2026-07-31
applies_to: "main @ 6230240"
---

# Pending work after Step 10

A handoff for a session starting with no memory of the last one. It is
self-contained on purpose: read the linked documents for context, but you should
not need them to start work.

**The one thing to get right:** `docs/plans/active/` no longer contains a single
open plan, and that is not permission to start Step 11. Every code-level item that
needed no pilot evidence is closed. What remains is the M4 gate, and on 2026-07-31
the founder decided to close it the long way — by running the Step 9 pilot rather
than proceeding without it. So the honest state is *blocked on evidence that does
not exist yet*, not *ready for the next step*. An empty plan directory is what
finishing Wave 0 looks like, nothing more.

If you are here to write code, [§ Work that does not need the pilot](#work-that-does-not-need-the-pilot)
is the only section that will give you any.

## Before you touch anything

This repository has rules that are easy to trip over.

- **Always work on a topic branch.** Run `git status --short --branch`, preserve
  unrelated local changes, update `main` from `origin/main`, then branch from it.
  Commit only on topic branches. Never commit to `main`. Never merge into `main`
  unless the user explicitly asks. (`AGENTS.md`)
- **Never mint a ticket key.** LongClaw owns key allocation, and an agent must not
  create `.longclaw/tickets/<KEY>/` or guess a key
  (`docs/agents/issue-tracker.md`). This repository has no `.longclaw/` store, so
  work you find gets written here in `docs/plans/active/` and moved to
  `docs/plans/completed/` when it is done.
- **Token discipline.** `rg` and targeted line ranges over whole-file dumps; no
  poking around build, cache, or dependency directories.
- **Domain language matters.** Ticket, actor, activity event, external change,
  acknowledgement — `CONTEXT.md` defines them, and the words appear in code and
  in tests. An "issue" or a "task" in new code is a review finding.

### Toolchain

The machine that did Step 10 started with a Node too old to run the project and
no Rust at all. Both are installed now, but the shims are not all on `PATH`:

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"   # rustup is Homebrew's

node -v   # v26.5.0 (Homebrew). An old /usr/local/bin/node v10 is still present.
cargo -V  # 1.97.1; stable is the default toolchain
```

Two traps: Homebrew runs under Rosetta on this Mac, so installs need
`arch -arm64 brew install …`, and `apps/desktop/node_modules` may be missing —
run `npm --prefix apps/desktop ci` first.

### The gate

```sh
npm run verify   # tokens, format, lint, typecheck, tests, vite build, native watcher
npm run dev      # launch the app
npm --prefix apps/desktop run test:rust     # cargo test alone
npm --prefix apps/desktop run test:frontend # vitest alone
npm --prefix apps/desktop run test:watcher  # the native watcher round trip alone
npm --prefix apps/desktop run perf:rust     # performance budgets, ignored by default
npm run perf:board                          # board interaction budgets in WebKit
```

`npm run verify` must pass before you commit. CI additionally runs
`npm run build:app` (the full macOS bundle), which the local gate skips.

**The gate is trustworthy as of 2026-07-31.** It has not always been. Item 10
recorded `npm run verify` going red on an npm-launched native watcher timeout that
the same test passed under direct Cargo; it closed as *not reproducing*, on the
same tree, without a fix or an explanation. If it returns, read
[10's outcome](../completed/10-npm-native-watcher-timeout.md) before you touch the
watcher — the cause is most likely outside this repository, and two obvious
workarounds are already recorded as failures. The rule that must survive:
`test:watcher` stays on the native adapter. Greening the gate by swapping in the
polling adapter would leave the production watcher uncovered.

### Where the architecture is written down

- [The spike report](../../architecture-spike-report.md) and
  [its risk register](../../architecture-spike-risk-register.md) — the register is
  the source for every Wave 0 item, all of which are now closed.
- `docs/adr/0006`–`0010` — frontend state, IPC shape, watcher/index behaviour,
  filesystem authority, error shape.
- [The file format](../../file_format.md) — the on-disk contract.

## Where things stand

`main` is at `6230240`. Steps 1–8 of [the plan](../../mvp_plan_order.md) are done, and
**Step 10 was marked complete on 2026-07-31 for its re-plan pass** — it produced
[the v0 backlog](../../backlog/v0-backlog.md) (39 items in four waves),
[the pilot response memo](../../pilot/response-memo.md),
[the release risks](../../release-risks.md), and
[the acceptance index](../../acceptance/README.md), and it fixed the one reported
onboarding blocker ([report](../completed/project-key-derivation-bug.md)).

Read that completion precisely, because the step numbers are out of order here.
**Step 9 has not run, and Step 10 owes a second pass.** Step 10's actual goal is
absorbing pilot evidence; with none in hand, its re-ranking record and scope
decisions are empty and the Waves 1–3 order is derived from dependency and risk
alone. That ordering is a baseline, not a finding, and it returns to Step 10 for
revision once the pilot delivers.

**Wave 0 is closed.** All seven of its items — V0-01 through V0-07 — are done, which
satisfies the backlog's own precondition for breadth: *clear before any more
breadth*. CI run `30629158530` on `6230240` is green through `npm run build:app`.

**M4 is still open, by decision.** Step 9's pilot has not run and
`docs/pilot/sessions/` is empty. No findings were invented to stand in for it, and
none may be. On 2026-07-31 the founder chose to run the pilot rather than record a
decision to proceed without it, so the guardrail below holds with full force and
the memo correctly still reads *awaiting evidence*.

---

## ~~The work itself~~ — closed 2026-07-31

~~Every pending item now has its own plan in this directory.~~ **All ten plans are
closed and `docs/plans/active/` holds no open work.**
[The plan index](README.md) keeps the full record, including the dependencies
between the closed items, which still matter when you touch the code they changed.

| #      | Plan                                                                            | Backlog | Outcome                                                                                          |
| ------ | ------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| ~~00~~ | ~~Confirm CI on main~~                                                          | —       | Closed. `main` does build. It also caught a red run, which produced 09.                          |
| ~~01~~ | ~~[Close the atomic-replace race](../completed/01-atomic-replace-race.md)~~      | V0-01   | Closed. `renamex_np(RENAME_SWAP)`, with the displaced bytes hashed and restored on mismatch.      |
| ~~02~~ | ~~[Recover from an event-sequence gap](../completed/02-event-sequence-gap.md)~~  | V0-02   | Closed. A gap raises `reconciling` and resumes from `ProjectSnapshot.sequence`.                   |
| ~~03~~ | ~~[Attribute a change from new records only](../completed/03-attribution-from-new-records.md)~~ | V0-07 | Closed. Attribution comes only from records the file did not have before.        |
| ~~04~~ | ~~[Validate the project prefix on ingest](../completed/04-project-prefix-validation.md)~~ | V0-03 | Closed. Ownership is decided from the key's prefix before the contents are parsed.     |
| ~~05~~ | ~~[Recover the watcher over sleep and wake](../completed/05-watcher-recovery.md)~~ | V0-04 | Closed. Native wake recovery, overflow recovery, coalescing, and unavailable reporting.  |
| ~~06~~ | ~~[Move heavy work off the command thread](../completed/06-blocking-workers.md)~~ | V0-05  | Closed. Scans, parsing, and fsync run on a bounded two-worker pool.                              |
| ~~07~~ | ~~[Virtualize the board and list](../completed/07-board-virtualization.md)~~     | V0-06   | Closed for the board. 5,000 tickets at 18–22 ms p95 against a 50 ms budget. V0-14 inherits it.   |
| ~~08~~ | ~~[Triage the dependabot advisories](../completed/08-dependabot-triage.md)~~     | V0-40   | Closed. All three unreachable. It produced V0-40: the alert list is the problem.                 |
| ~~09~~ | ~~[Stop treating a vanished path as an overflow](../completed/09-rename-is-not-an-overflow.md)~~ | — | Closed. `collect_event` drops only transient `Io(NotFound)` watcher errors.       |
| ~~10~~ | ~~[Stop npm breaking the native watcher check](../completed/10-npm-native-watcher-timeout.md)~~ | — | Closed as *not reproducing*, without a fix. See § The gate above.                 |

Waves 1–3 — the other 32 backlog items — deliberately have no plans. The plan's
guardrail forbids starting Wave 1 breadth before M4 is decided, and their internal
order is a pre-pilot baseline the pilot is expected to reshuffle. Planning them now
would be work the evidence may invalidate.

## Work that does not need the pilot

Wave 0 is empty, so this is what is left for an agent. Each of these is marked
`fixed` in [the backlog](../../backlog/v0-backlog.md)'s Pilot column, meaning its
position is risk-based and evidence does not move it. None has a plan yet; write
one in this directory before starting, following
[§ When a plan is done](README.md#when-a-plan-is-done).

| Backlog | Item                                                                | Why it is safe to do now                                                                                                                                 |
| ------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0-19   | Remove assignee from the prototype specs and the data requirements  | ADR 0001 already removed assignee from local mode and its consequences section requires this. It is Wave 1 by step, but it is spec cleanup, not breadth — and a spec that still shows the field will get built during Step 11. |
| V0-30   | Corrupt or deleted index recovery; idempotent rebuild               | The index is disposable by design, and that promise is only real if losing it is a non-event. Pure risk work, unaffected by anything a participant might say. |
| V0-40   | Scope Dependabot to what actually ships                             | Produced by item 08's own triage: the alert list is the defect, not any advisory in it.                                                                     |

Two cautions. V0-19 is the only one of the three that sits inside Step 11's wave —
do the spec deletion, not the surfaces around it. And none of these three is a
substitute for the pilot; doing all of them leaves M4 exactly where it is.

## Not an agent's work

| Waiting on                                  | Why it cannot be delegated                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Running the Step 9 pilot**                | Five completed real-repository sessions with recruited participants, consent, and observation. An agent cannot do any of it. **This is now the critical path**, by the 2026-07-31 decision. |
| ~~Proceeding without the pilot~~            | ~~A founder decision to record in the memo.~~ Decided 2026-07-31: the pilot runs. Revisit only as a new, recorded decision.                                                     |
| **Waves 1–3 internal order**                | Currently a pre-pilot baseline from dependency, not observed value. The pilot's evidence replaces it.                                                                           |
| **V0-38 waitlist endpoint**                 | A privacy and data-collection decision. The plan says omit the feature rather than ship a form that silently fails.                                                             |
| **A ticket-creation surface for this repo** | The CLI caveat in the backlog. It is why this file exists instead of a ticket.                                                                                                  |

[§ What closing M4 requires](../../pilot/response-memo.md#what-closing-m4-requires)
in the memo is the ordered checklist. Item 1 — the Step 9 exit artifacts — is the
only one that can move next.

## Do not

- **Do not start Step 11.** It is Wave 1 in full
  ([the backlog](../../backlog/v0-backlog.md) says so: every V0-08 through V0-19 row
  is `Step 11`). The guardrail is explicit and M4 is open. Clearing Wave 0 removed
  the engineering blocker, not the gate.
- **Do not read an empty `active/` directory as a green light.** It means Wave 0 is
  finished. It does not mean the next step is unblocked.
- **Do not write pilot findings that did not happen.** The memo's empty tables are
  the honest state. Fabricated evidence would corrupt the one gate the plan built
  to stop the team shipping on internal preference.
- **Do not rewrite or delete a file the app cannot parse.** It is the format
  contract's hardest rule.
- **Do not delete this file when part of it is done.** Strike the finished section,
  leave the rest, and move the file to `docs/plans/completed/` only when everything
  here is closed — which now means when M4 closes.
