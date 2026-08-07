---
format: longclaw.ticket/v1
id: bcdb7213-440c-4f6a-b26a-c303217925cf
key: LC-110
title: Ticket panel — checked checklist items are struck through — Not struck through
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.267Z
updated_at: 2026-08-07T01:20:18.950Z
---

**Prototype.** Checked checklist items are struck through

**App.** Not struck through

## Source

`docs/cc_screens_diff.md` — **D-3I**, § Ticket panel, severity P3.

## Checklist

- [x] Confirm against components.md § Checklist and align. <!-- longclaw:item=ck_efc9bbeb -->

## Activity

<!-- longclaw:event
id: evt_181a5e9d
kind: create
occurred_at: 2026-08-05T15:16:01.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a639ba92
kind: update
occurred_at: 2026-08-07T01:20:18.950Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_efc9bbeb.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Confirmed against components.md § Checklist, and the answer is keep (D-3I was still an open product decision in the diff's own list). components.md:192 gives the settled checked row an ink-3 box with a surface mark and ink-3 line-through text; :193 has the agent-fresh row keep full ink, no strike, and the accent-agent fill until the ticket settles. So the strike is not a flourish — it is what makes an acknowledged tick legible as a state distinct from a done one. Aligning meant both halves, not just the text: the settled box was accent-human and is now ink-3, which is what leaves the acknowledgement something to stand out against. The rows land as .checked and .fresh.checked, and the open question in cc_screens_diff.md is answered rather than left standing.
<!-- /longclaw:event -->
