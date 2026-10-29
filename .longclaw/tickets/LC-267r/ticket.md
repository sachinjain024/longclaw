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
updated_at: 2026-10-29T08:07:49.662Z
---

A failed update can delete the installed app. `tauri-plugin-updater` 2.11.0 replaces the bundle by moving the current one into a `TempDir` and then moving the new one into place, and nothing puts the old one back: if the second move fails, or the administrator path's `rm -rf … && mv …` fails partway, or the process dies between the two, the machine is left with no LongClaw at all. The ticket originally named cross-volume `TMPDIR` and a full disk as the doors; both actually fail before the bundle moves and are safe. The real windows are the three above, the administrator path the widest.

**Spec:** `docs/specs/LC-267r-update-never-deletes-the-app.md`, recorded under References. Route chosen on 2026-10-29: LongClaw replaces its own bundle by an atomic swap (`renamex_np` + `RENAME_SWAP`) beside the installed one; the plugin keeps the check, download and signature verification. The step-two restore is offered upstream as a courtesy, not a dependency.

## Checklist

- [x] Decide between upstreaming the restore, pinning a patched build, and taking our own backup before install <!-- longclaw:item=ck_7955bd12 -->
- [ ] Whichever route: prove it with a probe that makes step 3 fail and asserts the app is still there afterwards <!-- longclaw:item=ck_12548d17 -->

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
