---
format: longclaw.ticket/v1
id: 3249d84b-0669-45d9-851e-28cdc9e0104a
key: LC-17
title: Optimistic create, per-mutation write feedback, and undo
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:00Z
updated_at: 2026-08-05T14:23:01Z
---

~~Optimistic create, per-mutation write feedback, and undo~~ **Done 2026-07-31** — one seam every ticket mutation runs through: `mutate()` in `src/mutations.ts` applies optimistically, writes in the background, reverts and says so on failure, and takes the change back through an ordinary `edit_ticket`. `WriteIndicator` and `ToastStack` in `src/WriteFeedback.tsx` own the 500ms spinner delay and the 5s toast, and `⌘Z` is paired with the toast. Create no longer blocks: the card appears under a guessed key and adopts the one Rust allocated. [Plan 13](../../../docs/plans/completed/13-optimistic-create-toasts-and-undo.md)

## Must-pass

Passed: `must-pass 1` (the card and the tick appear before the write returns), `must-pass 2` (a failed write reverts the optimistic state and raises a danger toast with Retry), and `must-pass 3` (undo writes the previous value back through `edit_ticket` against the hash the first write returned), all confirmed failing first. **Two things the founder should look at:** undo of a create archives rather than deletes, because v0 has no deletion (ADR 0004) — the screen spec's Undo-on-create promise and the ADR disagree; and the revert-on-failure rule diverges from `states.md:64-67`, which says the optimistic value stays visible and unsaved. Both are named in the plan's Outcome

## Source

`docs/backlog/v0-backlog.md` — **V0-17**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed: must-pass 1 (the card and the tick appear before the write returns), must-pass 2 (a failed write reverts the optimistic state and raises a danger toast with Retry), and must-pass 3 (undo writes the previous value back through edit_ticket against the hash the first write returned), all… <!-- longclaw:item=ck_d059ed80 -->

## Activity

<!-- longclaw:event
id: evt_f838038c
kind: create
occurred_at: 2026-08-05T14:23:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_76595fc1
kind: update
occurred_at: 2026-08-05T14:23:01Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d059ed80.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-17 is recorded there as passed.
<!-- /longclaw:event -->
