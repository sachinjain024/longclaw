---
title: "Confirm CI on main"
product: LongClaw
status: ready
backlog_id: "—"
order: 0
owner_area: Release
depends_on: none
---

# Confirm CI on main

`main` has been pushed three times without anyone confirming the CI run. Do this
before building on the tree.

## Why this exists

`npm run verify` passed locally on every commit, but the local gate stops at
`vite build`. CI runs one more step the local gate never does:

```yaml
- name: Build desktop application
  run: npm run build:app
```

That is `tauri build` — the full macOS bundle, in release profile. It compiles the
Rust tree with different flags than `cargo test` and it bundles the app. A release
build can fail where a debug test build passes.

The last session pushed `aae472d` and could not check, because `gh` was
unauthenticated on that machine. So the state of CI on `main` is unknown, not
green.

## Working rules

- Read-only task. Nothing to branch, nothing to commit.
- If it turns out CI is red, do **not** fix it inside this plan. Write the failure
  up as a new plan in `docs/plans/active/`, or fix it on a topic branch of its own.

## Do this

```sh
gh auth login          # the machine that pushed was unauthenticated
gh run list --limit 5
gh run view <id> --log-failed   # only if something failed
```

The workflow is `.github/workflows/ci.yml`: one `macos-latest` job that runs
`npm ci`, then `npm run verify`, then `npm run build:app`.

If `gh` is unavailable, the runs are at
`https://github.com/sachinjain024/longclaw/actions`.

## Done when

Either:

- **Green.** Record the run id and conclusion in the `## Outcome` section, then move
  this file to `docs/plans/completed/`. Note it against `aae472d` or later, since a
  green run on an older commit proves nothing about the current tip.
- **Red.** Capture the failing step and its log, write it up as its own plan with a
  reproduction, and say plainly in the handoff that `main` is not currently
  buildable. A red release build is release-blocking under the plan's quality
  strategy, so it takes priority over everything in Wave 0.

## Watch out for

- **A green run on the wrong commit.** `gh run list` shows the branch, not always
  the SHA you care about. Check the run's head SHA against `git rev-parse main`.
- **A skipped run.** The workflow triggers on `push` to `main` and on
  `pull_request`. A push that produced no run at all is itself a finding — it means
  the quality gate is not actually gating.
- **Locally-installed toolchain drift.** CI pins Node 22 (`actions/setup-node`) while
  this machine now runs Node 26. A failure that reproduces only in CI may be that
  gap, which is worth recording either way.

## Outcome

**Green, on the second look.** Run
[30624782219](https://github.com/sachinjain024/longclaw/actions/runs/30624782219),
head SHA `b773a7a`, conclusion **success**, all ten steps including
`Build desktop application` (8m12s). `tauri build` in release profile does pass on
`main`. That is the thing nobody had confirmed.

It was not clean, and the mess is the useful part of this outcome.

### The run before it was red, and the same commit is green now

Run 30620563822, head SHA `35d85df` — the tip when this session started — failed
at `Run quality gate` with exit code 101, so it never reached `build:app`. It
failed on a watcher rename test that received an `indexRebuilt` with
`reason: "overflow"` where it expected an incremental pair. The full step log and
the panic are quoted once, in
[item 09](09-rename-is-not-an-overflow.md#evidence); this outcome does
not repeat them.

**Cite the attempt, not just the run.** That run was retried during this
investigation, and a retry overwrites what the run id reports:

| Attempt                                                                                     | Head SHA  | Conclusion |
| ------------------------------------------------------------------------------------------- | --------- | ---------- |
| [1](https://github.com/sachinjain024/longclaw/actions/runs/30620563822/attempts/1)          | `35d85df` | failure    |
| [2](https://github.com/sachinjain024/longclaw/actions/runs/30620563822/attempts/2) (manual) | `35d85df` | success    |

`gh api .../runs/30620563822` and `gh run view 30620563822` both answer for the
*latest* attempt, so today they say `success`. Only
`gh api .../runs/30620563822/attempts/1` shows the failure. A reviewer checking
this outcome against the bare run id will conclude the red run never happened.

That retry is also the cleanest evidence there is: **the same commit, red and then
green, with nothing changed in between.** `main` separately moved to `b773a7a`
(three commits, two frontend and one docs — no Rust file touched), and that push
went green through `build:app`. Two independent demonstrations that the tree is
fine and the gate is not.

The cause is real and is now
[item 09](09-rename-is-not-an-overflow.md): `collect_event`
(`engine.rs:675-678`) escalates *every* watcher error to
`RebuildReason::Overflow`, and the polling adapter's content-comparing walk emits
a `NotFound` whenever a test renames a ticket directory mid-poll. A standalone
probe drew 16 such errors from 60 renames on this machine, so the race is not
CI-specific — CI just loses it more often. The full `watcher_integration` file
passed 14/14 locally, including 8 runs under saturated CPU, so this cannot be
chased from a fast machine.

Item 09 is filed as release-blocking. Not because the build is broken — it is not
— but because a gate that goes red at random cannot tell anyone that the next
failure is real.

### Corrections to this plan's premises

- **`gh` is authenticated on this machine.** The plan opens with `gh auth login`
  and says the state of CI is unknowable. It was one command away. Whoever writes
  the next handoff should check the tool before recording it as unavailable.
- **A green run on the wrong commit** was worth guarding against, and nearly
  happened in reverse: `main` moved from `35d85df` to `b773a7a` *during* this
  investigation. Both run SHAs above were checked with
  `gh api .../runs/<id> --jq .head_sha`.
- **No skipped runs.** Every push in the last ten runs produced one. `87bc9e1`
  looks missing from `gh run list` but was pushed together with `35d85df`; only
  the tip gets a run, which is the workflow behaving correctly.
- **Node 22 vs 26 was not the gap.** The failure is in the Rust test binary and
  has nothing to do with Node.
