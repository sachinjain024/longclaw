---
format: longclaw.ticket/v1
id: 7aaf14c8-5a4d-4946-a009-4ee191a5d73a
key: LC-130
title: "Project settings — A Labels editor grid: slug · name input · native <select> colour · Save · Remove, plus an add row"
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.579Z
updated_at: 2026-08-07T03:46:55.744Z
---

**Prototype.** No label management in v0

**App.** A `Labels` editor grid: slug · name input · **native `<select>` colour** · Save · Remove, plus an add row

## Source

`docs/cc_screens_diff.md` — **D-4J**, § Project settings, severity P2.

## Checklist

- [x] This is real functionality the prototype never drew. It needs a design pass: the eight-hue ramp should be swatches (labels.ts:21-30), not an OS dropdown, and the per-row Save label X / Remove label X buttons should collapse into a single row affordance. <!-- longclaw:item=ck_43418a3f -->

## Activity

<!-- longclaw:event
id: evt_bc77f383
kind: create
occurred_at: 2026-08-05T15:16:01.579Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c441170e
kind: update
occurred_at: 2026-08-07T03:46:55.744Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_43418a3f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d6525e80
kind: comment
occurred_at: 2026-08-07T03:47:15.054Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The design pass this asked for.

- The eight-hue ramp is swatches in a radio group named for its row (`Color of label backend`), not an OS `<select>` — which also closes D-72, since the sidebar's was already gone with LC-72. No `<select>` is rendered anywhere in the app now.
- `Save label X` / `Remove label X` collapse to one affordance: the row commits itself — `Enter` or blur for the name, as `screen-specs.md:190` has the panel's title do — and a hue applies the moment it is picked, as the theme picker does. What is left is the `✕`.
- Two defects the code review caught in that: `Esc` reverts only a field that has been typed into (an untouched one owes the dialog its rung), and the `✕` holds focus where it is, so a typed name cannot commit a rename to the definition being deleted and race the delete for the same slug.
<!-- /longclaw:event -->
