---
format: longclaw.ticket/v1
id: e4ea0aca-c3ee-42ad-8d12-0966d95441ca
key: LC-149
title: Toasts and undo — while a write was in flight the header control row reflowed onto two lines and the ordering control was clipped
status: in_review
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.880Z
updated_at: 2026-08-08T09:10:29.024Z
---

**Prototype.** The content header is a fixed row and does not move

**App.** While a write was in flight the header control row **reflowed onto two lines** and the ordering control was clipped

## Source

`docs/cc_screens_diff.md` — **D-65**, § Toasts and undo, severity P2.

## Checklist

- [x] The controls row has no minimum width protection; the transient write indicator pushes it over. Give the row flex-wrap: nowrap with min-width: 0 on the filter field, or reserve the indicator's width. <!-- longclaw:item=ck_d7e760f3 -->

## Activity

<!-- longclaw:event
id: evt_9ab57f80
kind: create
occurred_at: 2026-08-05T15:16:01.880Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e3b96274
kind: update
occurred_at: 2026-08-08T09:10:29.024Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_d7e760f3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c686e0bb
kind: comment
occurred_at: 2026-08-08T09:10:46.766Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Fixed, and measured rather than looked at.

The control row is indivisible now — `flex-wrap: nowrap` with `min-width: 0`, which is this ticket's own first option. The `min-width` is what makes the rest of it work: a flex item's automatic minimum is its content's, and this row's content includes a text field whose own automatic minimum is its `size` attribute, so the row would sooner hang past the header's right edge than give a pixel back. The filter field is what gives it back, down to a 120px floor, because every other control here is a label in a box and the field's 190px is a size the spec chose. The 190px moved from the input to the wrapper around it, since the wrapper is the flex item and a box whose width lives on its child cannot be asked to give any of it up.

The header is also two items now rather than five: `.header-identity` holds the name, the gear, the path and the disk-state line, so the only place the header can break is between the identity and the controls. Ungrouped, the indicator was a fifth item that arrived when a write left and took a row of its own below 830px — a third row under a header the spec draws as one.

`npm run probe:header` is the test. It drives a real write through the real mutation path in WebKit and reads the header's geometry back at every width the window can be (1440 down to `tauri.conf.json`'s 760): neither half of the header breaks, nothing is clipped, no control leaves the header or the window, and the fixed controls keep their width while the filter yields. 84/84 green here, red against this branch's `main`, and `--self-test` puts the pre-fix header back and requires the run to fail.

Two things worth reading rather than inheriting:

- Below 760px — narrower than the window can be dragged, so only zoom reaches it — the row may break after all. `nowrap` there is a `New ticket` hanging off the side of the window, which `a11y:audit`'s A5 row failed on the first version of this fix and was right to.
- What is not closed: between ~1230px and ~1400px the control row still moves down whole when a write starts, because the header is one row without the indicator and cannot be one row with it. Reserving the indicator's width closes it and leaves 4px of slack at 1440px, so a longer project name would be two rows at the width the design was drawn at. LC-182 carries that choice with the numbers.
<!-- /longclaw:event -->
