---
format: longclaw.ticket/v1
id: dcfdbd14-7b1d-460d-80c0-8c274ddba4b6
key: LC-112
title: Description editor — tabs 24px on a wash strip — ~20px, strip tint is lighter than wash
status: done
priority: p3
rank: Zz
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.296Z
updated_at: 2026-08-07T13:44:06.000Z
---

**Prototype.** Tabs 24px on a `wash` strip

**App.** ~20px, strip tint is lighter than `wash`

## Source

`docs/cc_screens_diff.md` — **D-46**, § Description editor, severity P3.

## Checklist

- [x] Align to the token. <!-- longclaw:item=ck_4964f932 -->

## Activity

<!-- longclaw:event
id: evt_69bc4c4d
kind: create
occurred_at: 2026-08-05T15:16:01.296Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_284f0061
kind: update
occurred_at: 2026-08-07T10:51:04.496Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: Zz
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6cfb33e7
kind: update
occurred_at: 2026-08-07T13:44:06.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_4964f932.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Gave the tab strip its vertical padding and the active tab its chip, and put both controls on the 24px token; verified with the full repository gate.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4d669f85
kind: comment
occurred_at: 2026-08-07T13:44:06.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Neither symptom was the value it named, which is why the fix touches neither the tint nor the height.

**"Strip tint is lighter than `wash`."** The colour was never wrong. `.editor-tabstrip` has read `background: var(--lc-wash)` since the editor landed in `d02b107`, it is the only rule for that element, nothing overlays or fades it, and `--lc-wash` matches the foundations value in both appearances. What there wasn't was much of it: with `padding: 0 var(--lc-space-2)` the 28px of controls reached the top and bottom edges, so none of the wash ran above or below them — it showed across the middle, where `space-between` leaves a gap, and nowhere else. Chasing the colour is a dead end, and this branch proved it — an earlier attempt blended wash toward surface, which made the strip genuinely lighter, i.e. produced the report rather than curing it.

**"~20px."** The tab was already `height: 24px`. But `.editor-tab` was transparent and its 2px rule showed only when active, so it had no box anyone could see; what you measure off a screenshot is the ink, not the 24px. The prototype (`prototype.css:500`, a `--lc-surface` fill under a 1px ring) and the foundations' own specimen (`components-library.html:311`, the same fill with a `--lc-line` border and `--lc-shadow-card`) both draw the selected tab as a chip, and a chip is what gives the 24px a visible edge.

**So.** The strip takes `--lc-space-1` top and bottom — over our 28px row that is the prototype's 36px band, with each tab on its 6px of wash — and the active tab becomes the chip both drawings specify, replacing the underline. That chip is `surface` rather than the `accent-human-soft` `components.md` § Global interaction model gives Selected: this control lifts the active pane off the wash instead of tinting it, in both drawings, and the border keeps the selection off colour alone either way. `.editor-tab` and `.editor-toolbar button` also read `--lc-size-control-sm` where they read a literal `24px`, which is the checklist's own line and the only part of this that changes nothing.
<!-- /longclaw:event -->
