---
format: longclaw.ticket/v1
id: 7bf8159f-d43c-465a-8df8-f5374ac3242b
key: LC-41
title: Scope Dependabot to what actually ships, so its alert list means something
status: done
priority: p3
labels:
  - platform
  - v0-backlog
created_at: 2026-08-05T14:23:16Z
updated_at: 2026-08-05T14:23:17Z
---

~~Scope Dependabot to what actually ships, so its alert list means something~~ **Done 2026-08-02** — the archived Tauri spike no longer exposes live npm or Cargo manifests on `main`; Dependabot version updates are scoped to shipping package roots, and `archived-spikes:check` fails if spike manifests reappear. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md) **Read this before reading an alert count, 2026-08-04:** *in a shipping root* and *ships* are not the same predicate, and the first two alerts after this row closed were both the second kind. `brace-expansion` (high) reached the lockfile through `eslint → minimatch`, which is dev tooling and is in neither the binary nor the Vite bundle — bumped anyway, because the patch satisfied the existing range and cost nothing. `glib` (medium) is labelled **runtime** by GitHub and is not in the shipping binary at all: it arrives via `gtk ← muda/tao ← tauri`, which is the Linux branch of the tree, and `cargo tree -i glib --target aarch64-apple-darwin` prints *nothing to print* on the only platform this app builds for. GitHub's scope is computed from a target-agnostic graph and cannot see that. `glib` is also not locally fixable — `gtk 0.18.2` requires `glib ^0.18` and the patch is `0.20.0` — so it waits on a Tauri upgrade.

## Source

`docs/backlog/v0-backlog.md` — **V0-40**, Wave 3, step 14, owner Platform.

## Checklist

- [x] Passed: only shipping package roots keep package-manager manifests, so archived spike advisories no longer mix with reachable app alerts. The row does not claim every alert in a shipping root is reachable code, and the note above says why <!-- longclaw:item=ck_9aabb75d -->

## Activity

<!-- longclaw:event
id: evt_2a4b37ac
kind: create
occurred_at: 2026-08-05T14:23:16Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8896fba7
kind: update
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9aabb75d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-40 is recorded there as passed.
<!-- /longclaw:event -->
