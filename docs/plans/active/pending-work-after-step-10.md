---
title: "Pending work after Step 10"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted"
written: 2026-07-30
applies_to: "main @ 6f838bc"
---

# Pending work after Step 10

A handoff for a session starting with no memory of the last one. It is
self-contained on purpose: every fix below carries the file, the line, the
mechanism, the approach, and how to prove it. Read the linked documents for
context, but you should not need them to start work.

**The one distinction to get right:** part of the remaining v0 work is waiting on
pilot evidence that does not exist yet, and part is open risk you can fix today.
Confusing the two either stalls everything or ploughs into work the plan forbids.
[The v0 backlog](../../backlog/v0-backlog.md) is the ranked list; § Wave 0 below
is the part that needs no evidence.

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
npm --prefix apps/desktop run perf:rust     # performance budgets, ignored by default
```

`npm run verify` must pass before you commit. CI additionally runs
`npm run build:app` (the full macOS bundle), which the local gate skips.

### Where the architecture is written down

- [The spike report](../../architecture-spike-report.md) and
  [its risk register](../../architecture-spike-risk-register.md) — the register is
  the source for every Wave 0 item below.
- `docs/adr/0006`–`0010` — frontend state, IPC shape, watcher/index behaviour,
  filesystem authority, error shape. ADR 0009 and 0010 constrain most of this work.
- [The file format](../../file_format.md) — the on-disk contract.

## Where things stand

`main` is at `6f838bc`. Steps 1–10 of [the plan](../../mvp_plan_order.md) are
done. Step 10 produced [the v0 backlog](../../backlog/v0-backlog.md) (39 items in
four waves), [the pilot response memo](../../pilot/response-memo.md),
[the release risks](../../release-risks.md), and
[the acceptance index](../../acceptance/README.md). It also fixed the one reported
onboarding blocker ([report](../completed/project-key-derivation-bug.md)).

**M4 is open.** Step 9's pilot has not run; `docs/pilot/sessions/` is empty. No
findings were invented to stand in for it, and none may be.

---

## The work itself

Every pending item now has its own plan in this directory. Each one is
self-contained — its own working rules, the current behaviour with file and line,
what to change, and what has to pass — so you can pick one up without reading the
others or re-deriving anything.

**Start with [the plan index](README.md).** It carries the recommended order and
the few real dependencies between items.

| #   | Plan                                                                           | Backlog | What it fixes                                                              |
| --- | ------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------- |
| 00  | [Confirm CI on main](00-confirm-ci-on-main.md)                                 | —       | Nobody has checked whether the tree is green. Five minutes.                |
| ~~01~~ | ~~Close the atomic-replace race~~ — **done 2026-07-31**, [outcome](../completed/01-atomic-replace-race.md) | V0-01 | ~~An external write during a save is destroyed, and the app reports success.~~ Closed. |
| ~~02~~ | ~~Recover from an event-sequence gap~~ — **done 2026-07-31**, [outcome](../completed/02-event-sequence-gap.md) | V0-02 | ~~One dropped event leaves the board silently stale.~~ Closed. |
| ~~03~~ | ~~Attribute a change from new records only~~ — **done 2026-07-31**, [outcome](../completed/03-attribution-from-new-records.md) | V0-07 | ~~The app can credit an agent for a person's edit, or the reverse.~~ Closed. |
| ~~04~~ | ~~Validate the project prefix on ingest~~ — **done 2026-07-31**, [outcome](../completed/04-project-prefix-validation.md) | V0-03 | ~~A foreign ticket key is indexed as this project's.~~ Closed. |
| 05  | [Recover the watcher over sleep and wake](../completed/05-watcher-recovery.md) | V0-04   | Closed 2026-07-31: native wake recovery, overflow recovery, and unavailable reporting landed. |
| ~~06~~ | ~~Move heavy work off the command thread~~ — **done 2026-07-31**, [outcome](../completed/06-blocking-workers.md) | V0-05 | ~~A large rebuild blocks the command it runs on.~~ Closed. |
| 07  | [Virtualize the board and list](07-board-virtualization.md)                    | V0-06   | The one Step 4 budget with no measurement behind it.                       |
| 08  | [Triage the dependabot advisories](08-dependabot-triage.md)                    | —       | 1 high and 2 moderate, unread.                                             |

Items 01–07 are Wave 0 of [the backlog](../../backlog/v0-backlog.md): recorded,
open risk. **None of them needs pilot evidence**, and all of them should be cleared
whatever the pilot finds. Items 01, 02, 03, 04, 05, and 06 are closed; 07 is open.

Waves 1–3 — the other 32 backlog items — deliberately have no plans yet. The plan's
guardrail forbids starting Wave 1 breadth before M4 is decided, and their internal
order is a pre-pilot baseline the pilot is expected to reshuffle. Planning them now
would be work the evidence may invalidate. [The index](README.md) says the same, and
names the two pilot-independent Wave 3 items if you want extra work before then.

## Not an agent's work

| Waiting on                                  | Why it cannot be delegated                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Running the Step 9 pilot**                | Five completed real-repository sessions with recruited participants, consent, and observation. An agent cannot do any of it.         |
| **Proceeding without the pilot**            | If it is not going to happen, that is a founder decision to record in the memo, and it changes what the backlog's ordering is worth. |
| **Waves 1–3 internal order**                | Currently a pre-pilot baseline from dependency, not observed value. Evidence or an explicit decision replaces it.                    |
| **V0-38 waitlist endpoint**                 | A privacy and data-collection decision. The plan says omit the feature rather than ship a form that silently fails.                  |
| **A ticket-creation surface for this repo** | The CLI caveat in the backlog. It is why this file exists instead of a ticket.                                                       |

## Do not

- **Do not write pilot findings that did not happen.** The memo's empty tables are
  the honest state. Fabricated evidence would corrupt the one gate the plan built
  to stop the team shipping on internal preference.
- **Do not start Wave 1 breadth** before M4 is decided either way. The plan's
  guardrail is explicit, and the waves exist so late evidence re-ranks rather than
  rewrites.
- **Do not rewrite or delete a file the app cannot parse.** It is the format
  contract's hardest rule and it applies to every fix above.
- **Do not delete this file when part of it is done.** Strike the finished
  section, leave the rest, and move the file to `docs/plans/completed/` only when
  everything here is closed.
