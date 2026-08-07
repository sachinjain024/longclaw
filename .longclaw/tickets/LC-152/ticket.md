---
format: longclaw.ticket/v1
id: 160d5106-b401-41ba-ae0f-40805aa1feee
key: LC-152
title: Cross-cutting — native <select> elements appear in two places (sidebar appearance, settings label colours)
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.936Z
updated_at: 2026-08-07T12:15:20.347Z
---

**Finding.** Native `<select>` elements appear in two places (sidebar appearance, settings label colours)

## Source

`docs/cc_screens_diff.md` — **D-72**, § Cross-cutting, severity P2.

## Checklist

- [x] Neither is in the design system, and both render OS chrome inside an otherwise fully-styled app. Replace with the segment (D-42) and swatches (D-4J). <!-- longclaw:item=ck_127af8f9 -->

## Activity

<!-- longclaw:event
id: evt_d5bad3da
kind: create
occurred_at: 2026-08-05T15:16:01.936Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7627b522
kind: update
occurred_at: 2026-08-07T12:15:20.347Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_127af8f9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Nothing was left to fix: both `<select>` elements had already gone — the sidebar's with LC-72, replaced by the appearance segment (LC-127), and the settings label colours with LC-130's swatches. Verified: no production component renders one, and the only occurrences in the tree are prose in comments explaining what was replaced.

What this ticket added is that it stays true. `field-guard.mjs` now walks the `.tsx` tree — comments stripped, since two files describe the `<select>` they removed — and fails on a rendered one. A `<select>` is the shortest way to write a menu, which is exactly why the guard is worth more than the memory of two removals.
<!-- /longclaw:event -->
