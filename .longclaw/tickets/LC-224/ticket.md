---
format: longclaw.ticket/v1
id: 1866aa1a-b288-4195-977e-fce9dda8b1a0
key: LC-224
title: "Checklist rows grew 14px: the row buttons ignore their own 24px"
status: todo
priority: urgent
labels:
  - frontend
created_at: 2026-08-21T06:32:14.091Z
updated_at: 2026-08-21T06:36:20.469Z
---

Found while validating LC-215's field fix: at-rest checklist rows render 38px tall where they were 24px before the LC-215 batch (62fd2fb) added the pencil and cross. Measured in WebKit against the real stylesheet: label-only row 24px, with row-actions 38px, list gap 4px throughout — the buttons stay in flow at rest (deliberately, for Tab reach and no hover jump), so their box sets every row's height all the time.

The excess is a cascade defect, not the design: components.md:222 states a 24px pencil and cross, and `.checklist-row .row-edit` asks for `height: var(--lc-size-control-sm)` (24px) — but the buttons carry `.ghost`, whose `min-height: var(--lc-size-control)` (30px) wins, because min-height always beats height. Both rules are correct read alone; the row renders 30px buttons and 38px rows.

The design system already has the way down: the `.small` button variant (`.ghost.small`, styles.css) is min-height control-sm. Fix: the two row buttons take `small`, rows settle at 32px (24px control + the row's own 4px paddings — the floor components.md:222's in-flow 24px control allows). Going back to the pre-batch 24px would need the buttons out of the row's height math entirely, which is a design decision this ticket does not take.

## Activity

<!-- longclaw:event
id: evt_2204eaf8
kind: create
occurred_at: 2026-08-21T06:32:14.091Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5ea8df69
kind: update
occurred_at: 2026-08-21T06:36:20.469Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p2
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->
