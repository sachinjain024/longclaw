---
format: longclaw.ticket/v1
id: 2051f68b-e133-4586-8d41-c50aeb48eb48
key: LC-102
title: Ticket panel — A fourth row, Updated 2026-08-05T17:20:00Z — a raw ISO timestamp (TicketPanel.tsx:767-768)
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.149Z
updated_at: 2026-08-07T00:44:53.111Z
---

**Prototype.** Meta grid rows: **Status, Priority, Labels. Nothing else.**

**App.** A fourth row, **`Updated  2026-08-05T17:20:00Z`** — a raw ISO timestamp (`TicketPanel.tsx:767-768`)

## Source

`docs/cc_screens_diff.md` — **D-3A**, § Ticket panel, severity P1.

## Checklist

- [x] Remove it, or render it as the relative time the rest of the app uses. A raw UTC string in the product's most-read surface reads as debug output. <!-- longclaw:item=ck_88734cf2 -->

## Activity

<!-- longclaw:event
id: evt_7c365e99
kind: create
occurred_at: 2026-08-05T15:16:01.149Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_772ba7b9
kind: update
occurred_at: 2026-08-07T00:44:53.111Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_88734cf2.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Removed the row. The prototype's meta grid is Status, Priority, Labels and nothing else (screen-specs.md:192-196), and the age the raw `updatedAt` was standing in for is already on screen twice in the app's own relative form: the list row's right-aligned `2h`, and every entry in the panel's own timeline. That made removal the option the diff's own ranked list named, rather than a reformat. `.meta-grid code` went with it — the row was its only caller.

Held by two tests in `TicketPanel.test.tsx`: the ADR 0001 must-pass now pins the grid to three cells, and a new guard fails on an ISO timestamp anywhere in the panel. `verify`, `a11y:audit` (A1-A5, panel Tab order still 9 stops in reading order) and `matrix` (8 axes x 9 states) all green.
<!-- /longclaw:event -->
