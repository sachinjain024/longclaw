---
format: longclaw.ticket/v1
id: 742f429d-3b2f-46d4-b9bd-a79f0bee3c08
key: LC-95
title: "Issue list — degraded row: warn triangle, mono filename, View raw file, danger treatment — Present, but with no danger tint or border, and a stray green freshness dot renders immediately left of View raw file"
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.048Z
updated_at: 2026-08-07T04:42:44.458Z
---

**Prototype.** Degraded row: warn triangle, mono filename, `View raw file`, danger treatment

**App.** Present, but with no danger tint or border, and a stray **green freshness dot** renders immediately left of `View raw file`

## Source

`docs/cc_screens_diff.md` — **D-37**, § Issue list, severity P3.

## Checklist

- [x] Apply the danger row treatment; suppress the freshness dot on a row that has no parsed content to be fresh about. <!-- longclaw:item=ck_581c022a -->

## Activity

<!-- longclaw:event
id: evt_c4bfdabf
kind: create
occurred_at: 2026-08-05T15:16:01.048Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_06264597
kind: update
occurred_at: 2026-08-07T03:36:40.476Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_09a99477
kind: update
occurred_at: 2026-08-07T04:42:44.458Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_581c022a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The degraded card's treatment at row height (`states.md:92-94`): the card's `--lc-danger-border` as an inset `::after` overlay — `.divided` owns the row's `border-top` and `.selected` owns its `box-shadow` — over `--lc-danger-surface`, with the ID slot, the warn glyph and `View raw file` in `--lc-danger`. The stray dot went with the whole fresh treatment: `ListRow` reads `isFresh(…) && !row.degraded`. The board card carries the same dot for the same reason and is filed as LC-164, because suppressing it there also moves `cardStrides`.
<!-- /longclaw:event -->
