---
format: longclaw.ticket/v1
id: 6104bd9d-a449-418c-bf93-f508586515c9
key: LC-228
title: "Clear the Dependabot backlog: dismiss the unreachable glib alert, land eight version PRs"
status: todo
priority: p2
labels:
  - platform
created_at: 2026-08-22T06:21:09.112Z
updated_at: 2026-08-22T06:21:57.647Z
---

Dependabot is reporting two different kinds of thing, and they need different treatment. Filed 2026-08-22 out of the LC-217 repo audit.

## The security alert: one, and it is not reachable

`glib` 0.18.5 — moderate, "Unsoundness in `Iterator` and `DoubleEndedIterator` impls for `glib::VariantStrIter`", alert #2, against `apps/desktop/src-tauri/Cargo.lock`.

**It is not in the shipping binary.** Verified 2026-08-22:

```sh
cargo tree -i glib --target aarch64-apple-darwin   # warning: nothing to print
cargo tree -i glib --target all                    # glib 0.18.5 <- atk/gtk 0.18.2 <- muda/tao <- tauri 2.11.5
```

It arrives through the GTK branch of the Tauri tree, which is Linux. Apple Silicon macOS is the only target this app builds for, so the vulnerable code is never compiled. GitHub computes reachability from a target-agnostic graph and cannot see that.

**It also cannot be fixed here.** The patch is `glib` 0.20.0, but `gtk` 0.18.2 requires `glib ^0.18`, so nothing in this repository can move it. It clears when Tauri upgrades its GTK stack, and not before.

This matches the analysis already recorded in `docs/plans/completed/08-dependabot-triage.md` and the V0-40 backlog row — this ticket exists to decide what to *do* about a permanently-open alert, not to re-derive that it is benign.

One thing did improve: LC-217 removed `spikes/`, which plan 08 named as the clearest source of alerts "indistinguishable from the real app's". The list is now one alert instead of several, and that one is the known-unreachable one.

**The decision to make:** dismiss it in GitHub as `tolerable_risk` with the reasoning above, so the alert list returns to zero and a genuinely reachable advisory is visible when it arrives. Plan 08's actual finding was that a standing list of never-clearing alerts trains everyone to ignore the list. Leaving it open re-creates exactly that.

## The version-update PRs: eight open, five of them majors

None is a security fix; these are ordinary version updates. The risk is not the packages, it is that five majors touch the toolchain the gate itself runs on — the
build, the type checker, the linter and the test environment.

**Safe — patch bumps, land together:**

| PR | Package | Change |
|---|---|---|
| #11 | `uuid` | 1.24.0 → 1.24.1 |
| #10 | `thiserror` | 2.0.19 → 2.0.20 |

**Majors, each needs the gate run against it:**

| PR | Package | Change | What it puts at risk |
|---|---|---|---|
| #12 | `vite` | 7.3.6 → 8.2.1 | `npm run build`, and every perf/probe harness with its own vite config |
| #6 | `@vitejs/plugin-react` | 5.2.0 → 6.0.5 | Peers with vite — **land with #12, not separately** |
| #2 | `typescript` | 5.9.3 → 7.0.2 | `typecheck`, and eslint's TS parsing |
| #13 | `eslint` | 9.39.5 → 10.8.1 | `lint`; a major here usually means rule and config changes |
| #3 | `jsdom` | 29.1.1 → 30.0.1 | The vitest environment for 1024 frontend tests |

**Cargo, 0.x so breaking by semver:**

| PR | Package | Change |
|---|---|---|
| #1 | `sha2` | 0.10.9 → 0.11.0 |

`sha2` is worth care rather than speed: content hashing is how this app decides a file changed underneath it, so a behaviour change there is a conflict-detection change. Confirm the digest output is identical before and after on a fixture rather than trusting the version number.

## Approach

Take them in risk order, not PR order, and run `npm run verify` on each group before merging it — the gate is the whole point of having one. The two patch bumps can share a branch; every major gets its own, so a failure names its own cause.

`vite` and `@vitejs/plugin-react` are one unit of work. `typescript` before `eslint`, because the eslint upgrade will be read through whatever TS version is in place.

## Checklist

- [ ] Dismiss glib alert #2 in GitHub as tolerable_risk, citing that cargo tree -i glib --target aarch64-apple-darwin is empty and gtk 0.18.2 pins glib ^0.18 <!-- longclaw:item=ck_c6bdc741 -->
- [ ] Re-check the alert list is zero afterwards, so a reachable advisory is visible when one arrives <!-- longclaw:item=ck_d703d91b -->
- [ ] Land the two Rust patch bumps together: uuid #11 and thiserror #10, one verify run <!-- longclaw:item=ck_1bab945e -->
- [ ] sha2 #1 (0.10.9 -> 0.11.0): confirm the digest output is byte-identical on a fixture before merging — content hashing is how conflict detection works <!-- longclaw:item=ck_71e90393 -->
- [ ] vite #12 and @vitejs/plugin-react #6 as one branch; check the perf and probe vite configs, not just the app build <!-- longclaw:item=ck_bb344d0b -->
- [ ] typescript #2 (5.9.3 -> 7.0.2) on its own branch, before the eslint bump <!-- longclaw:item=ck_275fb081 -->
- [ ] eslint #13 (9.39.5 -> 10.8.1); expect rule and flat-config changes <!-- longclaw:item=ck_b74eb9ef -->
- [ ] jsdom #3 (29.1.1 -> 30.0.1); the vitest environment for 1024 frontend tests <!-- longclaw:item=ck_38c44053 -->
- [ ] Run npm run verify against each group before merging it, not once at the end <!-- longclaw:item=ck_15d7c3f7 -->

## Activity

<!-- longclaw:event
id: evt_30bfd95e
kind: create
occurred_at: 2026-08-22T06:21:09.112Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_08cb7064
kind: update
occurred_at: 2026-08-22T06:21:32.719Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fac1a41e
kind: update
occurred_at: 2026-08-22T06:21:57.647Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Corrected two things in the description after filing: a relative link that was one directory level too shallow to resolve from .longclaw/tickets/LC-228/ (now a plain repo-relative path, which cannot rot with depth), and a reference to an '18-check gate' — LC-217 removed archived-spikes:check, so the chain is 16 steps plus test:watcher. Replaced the count with what the majors actually put at risk, since a hard-coded number in prose is the exact failure mode LC-217 was filed about.
<!-- /longclaw:event -->
