---
format: longclaw.ticket/v1
id: e000fbe3-a3c2-4c40-8522-adc37bdc15aa
key: LC-182
title: Toasts and undo — between ~1230px and ~1400px the control row still moves down when a write starts
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-08T09:08:51.227Z
updated_at: 2026-08-08T09:08:59.849Z
---

**Prototype.** The content header is a fixed row and does not move.

**App.** LC-149 made the control row indivisible: it no longer breaks inside, no
control is clipped, and the filter field is what yields width. What it did not
close is the *header* changing shape when a write starts. Between roughly 1230
and 1400 CSS pixels of window width the header is one row with the disk quiet
and cannot be one row with the disk-state indicator on it, so the control row
moves down whole — the designed wrap, arriving for a reason the user did not ask
for and leaving again when the write lands.

Measured with `npm run probe:header`, which prints the header's height beside
every check so the band is visible; the run asserts everything except this.

## The choice

Closing it means reserving the indicator's width whether or not a write is in
flight — the second half of D-65's own plan. Measured on the fixture at 1440px,
reserving the 32ch cap leaves 4px of slack in the row, so a project whose name is
a little longer than the fixture's would be two rows at the width the design was
drawn at. That is worse than the transient wrap, which is why LC-149 did not take
it.

What would make the reserve affordable is a narrower indicator: a cap that is not
32ch, or a disk-state line that does not carry the full `tickets/<key>/ticket.md`
while the row is short of width.

## Checklist

- [ ] Decide between reserving the indicator's width and leaving the transient wrap, with the 1440px slack measured on a realistic project name rather than the fixture's <!-- longclaw:item=ck_9b60b3e3 -->
- [ ] If the reserve wins, the reserved box has to be the thing that states 32ch — the cap lives in two places otherwise <!-- longclaw:item=ck_e3f5d193 -->
- [ ] Extend perf/header-probe.mjs to assert the header's height is unchanged while a write is in flight, and remove the note that says it does not <!-- longclaw:item=ck_385ab98d -->

## Activity

<!-- longclaw:event
id: evt_ab69c1d6
kind: create
occurred_at: 2026-08-08T09:08:51.227Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c5f58cce
kind: update
occurred_at: 2026-08-08T09:08:59.849Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: priority
    from: none
    to: p3
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
