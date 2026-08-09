---
format: longclaw.ticket/v1
id: e10773b3-9802-4179-b1b5-abedb132d8ac
key: LC-146
title: External update / agent freshness — pulse dot sits before the ID — Renders after the ID
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.832Z
updated_at: 2026-08-08T14:59:31.467Z
---

**Prototype.** Pulse dot sits **before** the ID

**App.** Renders **after** the ID

## Source

`docs/cc_screens_diff.md` — **D-60**, § External update / agent freshness, severity P2.

## Checklist

- [x] Move it. <!-- longclaw:item=ck_1474a4cf -->

## Activity

<!-- longclaw:event
id: evt_17f6855f
kind: create
occurred_at: 2026-08-05T15:16:01.832Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_77949291
kind: update
occurred_at: 2026-08-08T14:59:31.467Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_1474a4cf.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dce78fd3
kind: comment
occurred_at: 2026-08-08T14:59:48.301Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The dot now leads the key on the board card (`Board.tsx`), and the 6px that separated them moved from the dot's own margin onto `.card-top .ticket-key`'s flex gap — the dot sits on either side depending on the surface, so the spacing belongs to the row rather than to it. The list row's dot still trails the title, which is where `states.md:155` puts it. Pinned by a DOM-order assertion in Board.test.tsx.
<!-- /longclaw:event -->
