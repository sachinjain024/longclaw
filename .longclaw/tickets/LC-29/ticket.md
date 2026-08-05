---
format: longclaw.ticket/v1
id: f6131ad5-11a1-47d2-b815-d915d23a522a
key: LC-29
title: Permission and disk-write failures as actionable, typed states
status: done
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:06Z
updated_at: 2026-08-05T14:23:07Z
---

~~Permission and disk-write failures as actionable, typed states~~ **Done 2026-08-04** — all four clauses [plan 23](../../../docs/plans/completed/23-retry-must-not-resend-a-stale-hash.md) left, plus a fifth found while planning. (1) A board-raised conflict now travels to the panel holding its refused edit, and gets the ordinary Reload / Keep mine choice over the file the panel read — not a blind overwrite, because the write goes against a hash the human was shown and `TicketEdit` is field-level. (2) `conflict_error` drops the banner's button names and `conflictMessage` is the one composer both surfaces use. (3) `AppError::io` names the file, states the cause, and types it as `context.cause`; `src/failure.ts` renders title, path, recovery and guarantee for the toast and the banner alike, and `error.code` is no longer a heading. (4) Undo shares the forward save's `takeConflict`. (5) **Found in planning:** a refused write left `detail` holding the rejected hash, so Keep mine re-sent it and only worked when the watcher's event won a race — the panel re-reads on refusal now, and after review Keep mine *waits* for that read rather than racing it inside the round trip. [Plan 39](../../../docs/plans/completed/39-v0-29-write-failure-states.md)

## Must-pass

Passed: thirteen new frontend tests and eleven new Rust tests, the eight defect tests each confirmed red first (`!message.contains("Reload")`, `!message.contains(".tmp")`, the panel never re-reading, the banner never appearing on Undo, and the banner heading reading `permission denied`). `npm run verify` green end to end; `test:stress` green

## Source

`docs/backlog/v0-backlog.md` — **V0-29**, Wave 3, step 14, owner Frontend.

## Checklist

- [x] Passed: thirteen new frontend tests and eleven new Rust tests, the eight defect tests each confirmed red first (!message.contains("Reload"), !message.contains(".tmp"), the panel never re-reading, the banner never appearing on Undo, and the banner heading reading permission denied). npm run verify… <!-- longclaw:item=ck_35259211 -->

## Activity

<!-- longclaw:event
id: evt_e88efd68
kind: create
occurred_at: 2026-08-05T14:23:06Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4f19b728
kind: update
occurred_at: 2026-08-05T14:23:07Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_35259211.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-29 is recorded there as passed.
<!-- /longclaw:event -->
