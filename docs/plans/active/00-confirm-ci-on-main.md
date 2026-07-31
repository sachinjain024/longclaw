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
