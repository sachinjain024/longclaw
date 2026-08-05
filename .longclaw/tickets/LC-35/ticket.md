---
format: longclaw.ticket/v1
id: 9a7eb056-8ac1-4a11-ab3c-dc0e9fed9fec
key: LC-35
title: System-matched appearance plus explicit light/dark override, persisted
status: done
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:12Z
updated_at: 2026-08-05T14:23:13Z
---

~~System-matched appearance plus explicit light/dark override, persisted~~ **Done 2026-08-01** — the preference (`system`/`light`/`dark`, `localStorage`, default `system`) already existed; what was missing was the *live* half: the resolved value was read once and never listened to, so macOS switching appearance mid-session changed nothing. The appearance effect now subscribes to the media query's `change` event and re-stamps `data-appearance` while the preference is `system`. [Plan 31](../../../docs/plans/completed/31-system-matched-appearance.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-35**, Wave 3, step 13, owner Frontend.

## Checklist

- [x] Passed: five claims in App.test.tsx § V0-35 — system resolution, the live re-stamp (confirmed red without the listener), override wins and ignores system flips, persistence across a simulated restart, and no project data touched. Appearance is dataset + CSS only, so layout cannot move <!-- longclaw:item=ck_1e1b6501 -->

## Activity

<!-- longclaw:event
id: evt_c18ce25d
kind: create
occurred_at: 2026-08-05T14:23:12Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e85a442d
kind: update
occurred_at: 2026-08-05T14:23:13Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1e1b6501.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-35 is recorded there as passed.
<!-- /longclaw:event -->
