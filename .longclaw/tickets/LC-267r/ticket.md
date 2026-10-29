---
format: longclaw.ticket/v1
id: c12e7fae-3aa6-4510-adad-696713db067d
key: LC-267r
title: A failed update can delete the installed app
status: in_progress
priority: urgent
labels:
  - platform
  - ready-for-agent
type: bug
created_at: 2026-09-22T11:48:28.542Z
updated_at: 2026-10-29T08:25:40.292Z
---

A failed update can delete the installed app. `tauri-plugin-updater` 2.11.0 replaces the bundle by moving the current one into a `TempDir` and then moving the new one into place, and nothing puts the old one back: if the second move fails, or the administrator path's `rm -rf … && mv …` fails partway, or the process dies between the two, the machine is left with no LongClaw at all. The ticket originally named cross-volume `TMPDIR` and a full disk as the doors; both actually fail before the bundle moves and are safe. The real windows are the three above, the administrator path the widest.

**Spec:** `docs/specs/LC-267r-update-never-deletes-the-app.md`, recorded under References. Route chosen on 2026-10-29: LongClaw replaces its own bundle by an atomic swap (`renamex_np` + `RENAME_SWAP`) beside the installed one; the plugin keeps the check, download and signature verification. The step-two restore is offered upstream as a courtesy, not a dependency.

## Checklist

- [x] Decide between upstreaming the restore, pinning a patched build, and taking our own backup before install <!-- longclaw:item=ck_7955bd12 -->
- [x] Merge PR #103 so the spec and the ready-for-agent label are on main <!-- longclaw:item=ck_385266e3 -->
- [x] Write the ADR amending LC-256a D2: the replacement is ours, check/download/verification stay the plugin's <!-- longclaw:item=ck_f4fd6bf2 -->
- [x] Check whether declaring osakit or the archive crates directly trips a dependency or symbol guard; if so, the ADR names the gate change <!-- longclaw:item=ck_0a19f574 -->
- [ ] Settle how the probe gets a signed archive (release key locally, or a probe-only test key) before writing it <!-- longclaw:item=ck_5224a9e9 -->
- [ ] Build the replacement module test-first over a fake .app in a temp dir, with a fault injected at each step <!-- longclaw:item=ck_d40e33b8 -->
- [ ] Build the launch-time sweep over a temp dir: removes only its own staging and backup names <!-- longclaw:item=ck_986393aa -->
- [ ] Switch the updater adapter's install to the replacement module; install_keeping_bytes tests pass unchanged <!-- longclaw:item=ck_09e4816b -->
- [ ] Build the built-bundle probe: a failed swap leaves the original app launching, a good one launches the new version, and --self-test (delete-first order) goes red <!-- longclaw:item=ck_12548d17 -->
- [ ] Record a manual run of the administrator path on a standard account, quoted in the ticket <!-- longclaw:item=ck_c23f5561 -->

## Ticket References

<!-- longclaw:reference
id: ref_a3c982c0
path: docs/specs/LC-267r-update-never-deletes-the-app.md
added_at: 2026-10-29T08:06:39.231Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-267r-update-never-deletes-the-app.md](../../../docs/specs/LC-267r-update-never-deletes-the-app.md)
<!-- /longclaw:reference -->

<!-- longclaw:reference
id: ref_99666974
path: docs/adr/0018-the-app-replaces-its-own-bundle.md
added_at: 2026-10-29T08:25:40.292Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[0018-the-app-replaces-its-own-bundle.md](../../../docs/adr/0018-the-app-replaces-its-own-bundle.md)
<!-- /longclaw:reference -->

## Activity

<!-- longclaw:event
id: evt_700ed969
kind: create
occurred_at: 2026-09-22T11:48:28.542Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4b6569c7
kind: update
occurred_at: 2026-10-23T22:34:34.055Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p1
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1e485943
kind: update
occurred_at: 2026-10-29T08:06:39.206Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: platform
    to: platform, ready-for-agent
  - field: description
  - field: checklist.ck_7955bd12.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_85460103
kind: update
occurred_at: 2026-10-29T08:06:39.231Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_a3c982c0.added
    to: LC-267r-update-never-deletes-the-app.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e4394407
kind: update
occurred_at: 2026-10-29T08:07:49.662Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9e0073d5
kind: update
occurred_at: 2026-10-29T08:11:43.017Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_385266e3.added
    to: "Merge PR #103 so the spec and the ready-for-agent label are on main"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_865bb1f3
kind: update
occurred_at: 2026-10-29T08:11:43.038Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f4fd6bf2.added
    to: "Write the ADR amending LC-256a D2: the replacement is ours, check/download/verification stay the plugin's"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c10f1d38
kind: update
occurred_at: 2026-10-29T08:11:43.059Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0a19f574.added
    to: Check whether declaring osakit or the archive crates directly trips a dependency or symbol guard; if so, the ADR names the gate change
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_572a1d50
kind: update
occurred_at: 2026-10-29T08:11:43.078Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5224a9e9.added
    to: Settle how the probe gets a signed archive (release key locally, or a probe-only test key) before writing it
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fa1bd2f1
kind: update
occurred_at: 2026-10-29T08:11:43.096Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d40e33b8.added
    to: Build the replacement module test-first over a fake .app in a temp dir, with a fault injected at each step
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ae1f6036
kind: update
occurred_at: 2026-10-29T08:11:43.118Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_986393aa.added
    to: "Build the launch-time sweep over a temp dir: removes only its own staging and backup names"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e0ecf72a
kind: update
occurred_at: 2026-10-29T08:11:43.144Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e4816b.added
    to: Switch the updater adapter's install to the replacement module; install_keeping_bytes tests pass unchanged
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2fca9660
kind: update
occurred_at: 2026-10-29T08:11:43.165Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c23f5561.added
    to: Record a manual run of the administrator path on a standard account, quoted in the ticket
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b31967fa
kind: update
occurred_at: 2026-10-29T08:11:50.292Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_12548d17.moved
    from: "2"
    to: "9"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_87c85346
kind: update
occurred_at: 2026-10-29T08:11:50.311Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_12548d17.text
    from: "Whichever route: prove it with a probe that makes step 3 fail and asserts the app is still there afterwards"
    to: "Build the built-bundle probe: a failed swap leaves the original app launching, a good one launches the new version, and --self-test (delete-first order) goes red"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1ce7ec44
kind: update
occurred_at: 2026-10-29T08:25:40.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_385266e3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f4fd6bf2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0a19f574.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

ADR 0018 written (docs/adr/0018-the-app-replaces-its-own-bundle.md); spec D1, D2 step 4, D3 and story 26 amended to match.

Guard check, run 2026-10-29: declaring `flate2 = "1"`, `osakit = { version = "0.3", features = ["full"] }` and `tar = "0.4"` (the plugin's own features) under the macOS dependencies left `cargo tree`'s crate set identical (only the root's dependency list in Cargo.lock grew) and `release-audit` clean, self-test green. Reverted afterwards.

Two source-scan rules matter, and the ADR names both as gate changes:
- `Command::new` is banned in all shipped Rust, so the replacement cannot `touch` the bundle the way the plugin does; it sets the mtime by a direct call.
- `osakit::` is caught by nothing today. The audit gains a rule holding it to the replacement module, and the module joins UPDATE_MODULES' forbidden names.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_004ebc64
kind: update
occurred_at: 2026-10-29T08:25:40.292Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_99666974.added
    to: 0018-the-app-replaces-its-own-bundle.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
