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

## Wave 0 — fix these; they need no pilot evidence

Every item is a recorded, open risk with a named failure mode. Work them in this
order. Each one is release-blocking unless stated otherwise.

### V0-01 — an external write can be silently overwritten

**The most severe untested path in the product.** It destroys a user's work with
no conflict, no error, and no trace.

**Mechanism, end to end.**

1. `ProjectEngine::edit_ticket` (`apps/desktop/src-tauri/src/engine.rs:239`) calls
   `prepare_ticket_edit`, then `commit`.
2. `prepare_ticket_edit`
   (`apps/desktop/src-tauri/src/core/storage.rs:471`) reads the file, compares
   `file.content_hash != expected_hash`, and returns `conflict_error` on
   mismatch. **This is the only check, and it happens before any write.**
3. `commit` (`engine.rs:259`) records a self-write receipt for
   `(path, hash-of-new-bytes)` _before_ writing, so the watcher can recognise the
   change as the app's own.
4. `atomic_write` (`storage.rs:428`) writes a sibling temporary file, fsyncs it,
   then `fs::rename(&temporary, path)` at `storage.rs:455`. **That rename replaces
   the destination unconditionally.**

So an external write landing between step 2's read and step 4's rename is
destroyed. Worse, it is destroyed _quietly_: the receipt from step 3 matches the
bytes the app wrote, so when the watcher reports the change, the receipt consumes
it and no external-change event reaches the UI. The user sees a successful save.

**Do not just add a second hash check.** The risk register says so explicitly, and
it is right: a second check narrows the window, it does not close it. Two
processes can still interleave between the check and the rename.

**The register's approach.** Evaluate `renamex_np(RENAME_SWAP)` on macOS after
checking volume support: swap the temporary and the destination, so the bytes that
were on disk end up at the temporary path where you can hash them. Compare that
hash to the one validation saw. If it differs, an external write happened inside
the window — preserve those bytes and return a typed conflict rather than
reporting success. Define an explicit no-silent-loss fallback for filesystems
without swap support (refusing the write is acceptable; losing it is not).

**Must pass.** A deterministic barrier-based race test — not a sleep, not a timing
race that passes by luck. Drive the interleaving with a barrier or channel so the
external write provably lands between validation and replacement, then assert:
the external bytes still exist somewhere recoverable, the caller got
`ErrorCode::Conflict`, and the UI would have been told.

**Where to put it.** `apps/desktop/src-tauri/tests/storage_integration.rs`.
Reusable helpers in `tests/common/mod.rs`: `copy_representative_project()`,
`start_engine()`, `ticket_path()`, `editor_atomic_replace()`, `replace_title()`,
and `serially()` for tests that must not run concurrently. The existing
`a_stale_write_is_a_conflict_that_names_who_changed_the_file` test shows the
conflict-assertion shape, including the `conflictingActorType` context key.

### V0-02 — a dropped event leaves the board silently stale

**Mechanism.** `applyEvent` in `apps/desktop/src/state.ts:119` starts with:

```ts
if (envelope.sequence <= state.lastSequence) return;
```

It correctly ignores an older or duplicate sequence. It then accepts _any_ later
sequence without asking whether it skipped one, and each branch
(`ticketChanged`, `ticketRemoved`, `indexRebuilt`, project-unavailable) sets
`lastSequence: envelope.sequence`. One lost event therefore leaves the board
missing that change permanently, while everything about the UI still says it is
live. Silent staleness is worse than a visible error in a product whose whole
claim is that external changes appear.

**The fix.** Detect `envelope.sequence > state.lastSequence + 1`. On a gap:
suspend incremental application, request one full snapshot, and resume from that
snapshot's generation and sequence boundary. Do not apply the event you were
handed and then reconcile — that reorders history.

`reconcileProject` (`apps/desktop/src/api.ts:124`) is the existing snapshot
request; `App.tsx:211-226` already calls it from `focus` and `visibilitychange`
handlers, which is the pattern to follow. `openProject` and `rebuildIndex` also
return a `ProjectSnapshot`.

**Must pass.** Loss and reordering tests in `apps/desktop/src/state.test.ts`: a
gap suspends application and asks for exactly one snapshot; a reordered event is
still ignored; state after recovery equals state as if no event had been lost.

### V0-03 — a foreign ticket key can be indexed as this project's

Step 10 made the key _grammar_ shared, so `valid_ticket_key`
(`apps/desktop/src-tauri/src/core/storage.rs:75`) and `is_project_key` agree.
Nothing yet checks that a ticket directory's prefix is _this project's_ key. A
stale or copied directory named `OTHER-3` therefore satisfies the grammar and gets
indexed as a ticket of this project.

**Where.** `scan_ticket_paths` (`storage.rs:315`) collects the paths;
`TicketIndex::rebuild` (`apps/desktop/src-tauri/src/core/index.rs:72`) and
`TicketIndex::ingest` (`index.rs:112`) turn them into records. The project's own
key is on `ProjectDocument::project().key`. Degrade a mismatch with a diagnostic —
per ADR 0009 and the format contract, never rewrite or delete the file.

**Must pass.** Prefix-mismatch and rename coverage: a mismatched directory
degrades rather than indexing, the file is untouched, and the rest of the project
still loads. `fixtures/format-contract/invalid-key-directory-mismatch/` is the
existing sibling case for directory/frontmatter disagreement.

### V0-04 — the watcher loses history over sleep, wake, and overflow

FSEvents drops events over sleep, wake, overflow, and a removed root. Tao 0.35.3
documents macOS lifecycle `Resumed` as unsupported, and a tagged 30-second release
session observed zero `RunEvent::Resumed` callbacks — so today the _only_ recovery
trigger is the frontend `focus`/`visibilitychange` handler at
`apps/desktop/src/App.tsx:211`. A laptop lid closing is an ordinary event, and it
can currently leave the app confidently wrong.

**The work.** Add `NSWorkspaceDidWakeNotification` behind a `platform/macos`
module, coalesce it with the existing focus recovery so a wake plus a focus does
not rebuild twice, add overflow diagnostics, and give the UI an explicit
watcher-unavailable state instead of a live-looking board.

**Where.** `WatcherAdapter` (`apps/desktop/src-tauri/src/engine.rs:61`) already
has `Native` and `Polling { interval_ms }` variants, and
`ProjectEngine::start_with_adapter` (`engine.rs:159`) is the seam — tests use the
polling adapter for determinism via `common::start_engine_with`.

**Must pass.** A real sleep/wake soak with the window focused, and an overflow
injection: both reconcile to disk state. Plus the unavailable state rendering.

### V0-05 — a large rebuild blocks the command it runs on

Orchestration is deliberately synchronous from the spike. Scans, parsing, and
fsync work should move onto bounded blocking workers, publishing one final
snapshot back on the Tauri handle. Never mutate webview state from a worker (ADR
0009). Must pass: a rebuild on a large project keeps commands responsive and the
Step 4 load budget still holds.

### V0-06 — the board is unproven above a few hundred cards

The spike proved data flow, not 5,000 rendered cards. Virtualize board and list
lanes, subscribe through selectors (ADR 0006), and enforce an input-to-paint
budget with a 5,000-ticket browser trace. Do this **before** the Wave 1 list
surface, which is the thing that renders them.

### V0-07 — attribution can credit the wrong actor

Attribution currently reports the newest explicit actor in the file
(`last_activity`, built at `apps/desktop/src-tauri/src/core/storage.rs:210`), which
can disagree with the change that actually triggered the watcher. Crediting an
agent for a human's edit, or the reverse, breaks the shared record the product
exists for.

**The fix.** Diff the stable before/after activity records and associate only
newly appended event IDs with the observed change. If nothing new is attributable,
report actor unknown — never guess. The frontend already refuses to guess:
`apps/desktop/src/attribution.ts` treats an unattributed change as `unknown`, and
`freshness.ts:35` reads the actor from `lastActivity` only. The Rust side is what
needs to stop handing it a stale actor.

**Must pass.** The actor assertions in
[the round-trip scenario](../../acceptance/agent-round-trip.md) step 4, plus unit
coverage for the diff.

---

## Then

**Verify CI on `6f838bc`.** `npm run verify` passed locally, but CI also runs
`npm run build:app`. That run is **unconfirmed** — `gh` was unauthenticated in the
session that pushed. `gh auth login`, then `gh run list`.

**Triage three dependabot advisories.** GitHub reports 1 high and 2 moderate on
the default branch. They are in neither the backlog nor the release risks, because
nobody has looked at what they are. Triage, then either add a ranked backlog item
or record why one is not needed. Step 16's audit is where they land otherwise.

**Wave 3 has cheap wins if you need them.** V0-19 (remove assignee from the
prototype specs, per ADR 0001) and V0-30 (index-loss recovery) are small and
independent of the pilot.

---

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
