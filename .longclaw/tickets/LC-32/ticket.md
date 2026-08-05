---
format: longclaw.ticket/v1
id: 6a10b255-5f39-41ee-823c-a76d24b1728a
key: LC-32
title: Clean up after an I/O failure during project creation
status: done
priority: p3
labels:
  - storage
  - v0-backlog
created_at: 2026-08-05T14:23:09Z
updated_at: 2026-08-05T14:23:10Z
---

~~Clean up after an I/O failure during project creation~~ **Done 2026-08-02** — late initialization failures remove only the `.longclaw` files and directories the initializer claimed; if `.longclaw` pre-existed and cleanup is skipped, the typed error names the left-behind paths and why. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-32**, Wave 3, step 14, owner Storage.

## Checklist

- [x] Passed: storage tests inject late write failures for both claimed-directory cleanup and pre-existing .longclaw residue naming <!-- longclaw:item=ck_6d52b73f -->

## Activity

<!-- longclaw:event
id: evt_74b34e40
kind: create
occurred_at: 2026-08-05T14:23:09Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_33cf826b
kind: update
occurred_at: 2026-08-05T14:23:10Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6d52b73f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-32 is recorded there as passed.
<!-- /longclaw:event -->
