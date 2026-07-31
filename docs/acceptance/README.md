---
title: "Acceptance scenarios"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted (Step 10)"
---

# Acceptance scenarios

What has to pass, where it is written down, and what is still missing. Step 10
updates this index alongside [the revised backlog](../backlog/v0-backlog.md) and
[the release risks](../release-risks.md), because a re-ranked backlog with
unchanged acceptance criteria is a re-ranked backlog nobody can check.

## Scenarios that exist

| Scenario | Proves | When to run |
|---|---|---|
| [The real agent round trip](agent-round-trip.md) | The central claim: a human plans, a real external agent executes against the same files, and the result returns to the board and panel without a refresh | Before every pilot session and every release build |
| [The pilot macOS build](pilot-build.md) | A build a participant can install and run, with its limitations stated up front so feedback separates missing breadth from a broken thesis | Before handing a build to anyone |

The round-trip document also carries the current map of what the automated suite
covers and what only a human can prove. That table is the authority on the
automated/manual boundary; this index does not duplicate it.

## Running the checks

```sh
npm run check         # tokens, format, lint, typecheck, tests, build
npm run test:watcher  # the native FSEvents test, ignored by default
npm run verify        # both of the above
npm run perf:rust     # the performance budgets, ignored by default
```

## Acceptance changes accepted in Step 10

| Change | Why | State |
|---|---|---|
| The project-key grammar is now a documented contract with a shared fixture, and a refused key must leave the chosen folder untouched | The reported create-project dead end passed every existing check: no test exercised project creation from the UI, and the two key validators were free to disagree. The [resolved report](../plans/completed/project-key-derivation-bug.md) records the analysis | Landed. Covered by `src/projectKey.test.ts`, `src/CreateProjectForm.test.tsx`, `src-tauri/tests/project_key_grammar.rs`, and two refusal tests in `src-tauri/tests/storage_integration.rs` |
| Step 1 of [the round-trip scenario](agent-round-trip.md) now walks a refused create form before a valid one, and asserts the native picker never opens on a key the app would refuse | The bug's worst part was ordering: the user answered a native dialog before learning the form was invalid. The scenario started at a valid form and so never exercised the refusal | Landed, release-blocking |
| The project name is held to one rule at creation and at rename | Creation accepted a name the rename surface refuses. Two rules for one concept is the same drift that produced the key bug, one field over | Landed. Covered by the name cases in `every_refused_create_field_leaves_the_folder_untouched` and the form's own cap |
| Watcher recovery now covers focused-window sleep/wake, event overflow, and removed/restored roots | FSEvents is an invalidation stream, and macOS does not deliver a useful Tauri `Resumed` callback while the window stays focused | Landed. Covered by watcher integration tests plus a 2026-07-31 focused-window manual soak on macOS 26.5.2 |

## Scenarios still required before M6

Each one covers a release risk that no current scenario checks. The backlog item
that implements the behaviour is named, because the scenario and the behaviour
should land together.

| Required scenario | Covers | Backlog item |
|---|---|---|
| Concurrency and race stress: interleaved app and external writes at the validation/replace boundary, plus rapid external bursts | The silent-overwrite risk and the watcher's behaviour under bursts. Currently the most severe untested path in the product | V0-01, V0-33 |
| Event-loss recovery: a dropped project event and a reordered one | Silent staleness — the board looking live while being wrong | V0-02 |
| Index loss: delete the index, corrupt the index, reopen, rebuild twice | The "index is disposable" promise, including that rebuild is idempotent | V0-30 |
| Keyboard-only ticket lifecycle: create, find, open, update, and navigate without a pointer | The product's speed claim, and that focus is never lost behind a panel, modal, menu, or the palette | V0-20 – V0-25 |
| Theme × appearance visual matrix across the core screens and states | Contrast and human/agent distinction in every preset, in both appearances | V0-37 |
| Large-project performance: small, medium, and a 5,000-ticket project against the Step 4 budgets | Board and list interaction at a size where the product should start paying off | V0-06, V0-05 |
| Offline and no-account audit on a clean machine | The local-first claim, and that nothing in the binary phones home | Step 16 |
| Clean install, upgrade, restart, and folder-move on a machine that has never run the app | The first-run path, which every participant hits and no automated test can reach | Step 17 |

## What acceptance still cannot tell us

The automated suite proves the pipeline and what each surface does with what it is
given. It cannot prove that a real agent finds the instructions and follows them,
or that the result reads well on screen. That is what the round-trip scenario is
for, and it is why the Step 9 pilot is a gate rather than a formality.

The pilot has not run. Until it does, every acceptance criterion here is one the
team wrote for itself, and
[the pilot response memo](../pilot/response-memo.md) records which ones are
waiting on evidence to confirm or replace them.
