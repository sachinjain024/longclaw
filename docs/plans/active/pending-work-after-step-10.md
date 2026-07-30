---
title: "Pending work after Step 10"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted"
written: 2026-07-30
written_by: sachin.j@browserstack.com
applies_to: "main @ eec088e"
---

# Pending work after Step 10

A handoff for a session starting with no memory of the last one. It says where
the work stopped, what to pick up first, and what not to do. It is not a second
backlog — [the v0 backlog](../../backlog/v0-backlog.md) is the ranked list, and
this file points into it.

Read this, then read the backlog's § What this backlog is ranked on. That section
is the one thing most likely to be misunderstood.

## Where things stand

`main` is at `eec088e`. Steps 1–10 of
[the execution plan](../../mvp_plan_order.md) are done. Step 10 produced:

| Artifact                                                | What it is                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [The v0 backlog](../../backlog/v0-backlog.md)           | 39 items in four waves, each with a reason to exist and a must-pass check                       |
| [The pilot response memo](../../pilot/response-memo.md) | Decision rules fixed in advance, plus the empty evidence tables the pilot will fill             |
| [The release risks](../../release-risks.md)             | Every release-blocking risk with an owner area, the backlog item that retires it, and its check |
| [The acceptance index](../../acceptance/README.md)      | What is proven today, and the nine scenarios still missing before M6                            |

It also fixed the one onboarding blocker that had been reported —
[the resolved report](../completed/project-key-derivation-bug.md) — and the
project-key grammar now has a shared fixture both languages assert against.

**M4 is open.** Step 9's pilot has not run. `docs/pilot/sessions/` is empty, and
no findings were invented to stand in for it.

## Start here

### 1. V0-01 — close the atomic-replace race

The most severe untested path in the product, and the reason to start here rather
than anywhere else: it loses a user's work silently, with no conflict and no trace.

The failure, concretely. `prepare_ticket_edit`
(`apps/desktop/src-tauri/src/core/storage.rs:471`) compares the file's hash to
`expected_hash` and refuses a mismatch. That check happens once. The write that
follows goes through `atomic_write` (`storage.rs:428`), whose final rename
replaces the destination **unconditionally**. An external write landing between
those two moments is overwritten — and because the app recorded a self-write
receipt before writing (see the receipt store in `apps/desktop/src-tauri/src/engine.rs`),
the watcher event for the app's own bytes is consumed, so nothing surfaces.

What the [risk register](../../architecture-spike-risk-register.md) says about
fixing it, and it is worth reading before writing code: **a second hash check
alone is insufficient.** The register's proposal is to evaluate
`renamex_np(RENAME_SWAP)` after checking volume support, hash the displaced bytes
retained at the temporary path, preserve them, and emit a typed conflict on
mismatch — with a defined no-silent-loss fallback where swap is unsupported.

Must pass: a deterministic barrier-based race test. An external write interleaved
at the validation/replace boundary is never lost, and reaches the user as a
conflict rather than a success. Do not settle for a timing-based test that passes
by luck.

### 2. The rest of Wave 0

In the backlog's order. Two worth flagging because their diagnosis is already done:

- **V0-02** — `applyEvent` in `apps/desktop/src/state.ts:120` drops an older
  sequence (`envelope.sequence <= state.lastSequence`) but accepts any later one
  without asking whether it skipped. One dropped event therefore leaves the board
  silently stale while still looking live. The fix is to detect
  `sequence > lastSequence + 1`, suspend incremental application, request one full
  snapshot, and resume from its generation boundary.
- **V0-03** — the key _grammar_ is now shared, but nothing checks that a ticket
  directory's prefix is _this project's_ key. `valid_ticket_key`
  (`storage.rs:75`) proves the shape, not the ownership.

Wave 0 needs no pilot evidence. It is open risk, and it is runnable now.

### 3. Verify CI on `eec088e`

`npm run verify` passed locally on this tree, but the local gate stops at
`vite build`. CI (`.github/workflows/ci.yml`) additionally runs `npm run build:app`,
which builds the full macOS bundle. That run has **not been confirmed** — `gh` was
unauthenticated in the session that pushed. Check it before assuming the tree is
releasable.

### 4. Three dependabot advisories

GitHub reports 1 high and 2 moderate vulnerabilities on the default branch. They
are in neither the backlog nor the release risks yet, because nobody has looked at
what they are. Triage them, then either add a ranked backlog item or record why
they do not need one. Step 16's audit is where they land if they are not urgent.

## Not an agent's work

These need the founder, not a session.

| Waiting on                                  | Why it cannot be delegated                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Running the Step 9 pilot**                | Five completed real-repository sessions with recruited participants. An agent cannot recruit, observe, or consent-manage. Do not simulate it.           |
| **Whether to proceed without the pilot**    | If the pilot is not going to happen, that is an explicit decision to record in the memo, and it changes what the backlog's Waves 1–3 ordering is worth. |
| **Waves 1–3 internal order**                | Currently a pre-pilot baseline from dependency, not observed value. Pilot evidence or a founder decision replaces it.                                   |
| **V0-38 waitlist endpoint**                 | A privacy and data-collection decision. The plan says omit the feature rather than ship a form that silently fails.                                     |
| **A ticket-creation surface for this repo** | Recorded as the CLI caveat in the backlog. It is why this file exists at all — see below.                                                               |

## Rules this repository enforces

Read [AGENTS.md](../../../AGENTS.md) in full. The parts most easily tripped over:

- **Always work on a topic branch.** Update `main` from `origin/main` first, branch
  from it, and never commit to `main`. Do not merge into `main` unless the user
  explicitly asks.
- **Never mint a ticket key.** Per
  [the issue-tracker rules](../../agents/issue-tracker.md), LongClaw owns key
  allocation and an agent must not create `.longclaw/tickets/<KEY>/`. This
  repository has no `.longclaw/` store, which is exactly why pending work lives in
  `docs/plans/active/` and finished reports move to `docs/plans/completed/`.
- **Token discipline.** Prefer `rg` and targeted ranges over whole-file dumps.

## Toolchain, because it is not obvious

The machine that did Step 10 had neither a usable Node nor Rust. Both are
installed now:

```sh
# rustup is Homebrew's; its shims are not on PATH by default
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"

node -v   # v26.5.0 from Homebrew, ahead of the /usr/local/bin/node v10 still present
cargo -V  # 1.97.1, stable is the default toolchain
```

Two traps: this Mac runs Homebrew under Rosetta by default, so an install needs
`arch -arm64 brew install …`, and `apps/desktop/node_modules` may be absent —
`npm --prefix apps/desktop ci` first.

Gate commands, from the repository root:

```sh
npm run verify   # tokens, format, lint, types, tests, build, native watcher
npm run dev      # launch the app
```

The first `cargo` build of a clean checkout compiles the whole Tauri tree.

## Do not

- **Do not write pilot findings that did not happen.** The memo's empty tables are
  the honest state. Fabricated evidence would corrupt the one gate the plan built
  to stop the team shipping on internal preference.
- **Do not start Wave 1 breadth** before M4 is decided one way or the other. The
  plan's guardrail is explicit, and the waves exist so that late evidence
  re-ranks rather than rewrites.
- **Do not delete this file when part of it is done.** Strike the finished section,
  leave the rest. When everything here is closed, move it to
  `docs/plans/completed/`.
