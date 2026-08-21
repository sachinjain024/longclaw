---
format: longclaw.ticket/v1
id: 9fe9e4fa-cf24-4826-84c1-3db7defe85d5
key: LC-225
title: screen-specs.md still lists four theme presets; the app ships five
status: done
priority: p3
labels:
  - design
  - prototype-diff
created_at: 2026-08-21T10:00:03.460Z
updated_at: 2026-08-21T12:44:46.074Z
---

Found during the LC-217 repo audit.

`docs/design/prototype/screen-specs.md:114` reads "Presets: Indigo (default) · Clay · Slate · Plum" — four. `apps/desktop/src/App.tsx:134` ships five: Indigo, Clay, Slate, Plum, **Graphite**.

Graphite arrived on 2026-08-10 with LC-192 (Sync Design System) and is fully specified everywhere else — `docs/design/foundations/accessibility.md:105-112` carries its measured contrast table for both appearances, and the theme matrix covers it. Only the prototype screen spec was left behind.

The stale line has a second reader: `apps/desktop/src/ThemePicker.tsx:10` cites `screen-specs.md:112-118` and its own comment says "Four presets", so the component doc repeats the wrong count.

## Approach

Correct the count in `screen-specs.md` and the `ThemePicker.tsx` comment.

**The gotcha:** `screen-specs.md` is one of the six documents pinned by `apps/desktop/scripts/citation-guard.mjs`. Editing it shifts pinned line numbers, so `npm run citations:check` will fail until `npm run citations:update` re-pins them — and that re-pin should be reviewed rather than taken on trust, because it rewrites the lock for every citation into that file.

## Checklist

- [x] Correct the preset list at screen-specs.md:114 to name Graphite <!-- longclaw:item=ck_a656dd5c -->
- [x] Correct the 'Four presets' comment in ThemePicker.tsx <!-- longclaw:item=ck_f4c0077c -->
- [x] Run citations:update and review the re-pinned lock diff, then citations:check <!-- longclaw:item=ck_faa614be -->

## Activity

<!-- longclaw:event
id: evt_3b732e81
kind: create
occurred_at: 2026-08-21T10:00:03.460Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_63e060fc
kind: update
occurred_at: 2026-08-21T12:44:31.411Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_a656dd5c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d7e4d3f6
kind: update
occurred_at: 2026-08-21T12:44:46.074Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f4c0077c.checked
    from: "false"
    to: "true"
  - field: checklist.ck_faa614be.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Resolved in favour of the code: five presets is correct, and the documents were behind it. Graphite shipped with LC-192 on 2026-08-10 and was already specified everywhere that measures anything — decisions.md D1 with its hues, the foundations README's data-lc-theme axis, accessibility.md's contrast tables for both appearances — and the token build emits '5 themes x 2 appearances'. Three places still said four, and a fourth turned up during the fix.

Fixed: screen-specs.md's theme-picker spec now names Graphite; decisions.md D15 listed the token axis as indigo/clay/slate/plum while D1 in the same file listed five, and now agrees; ThemePicker.tsx's comment said 'Four presets' while reading five from props.

The screen-specs paragraph is rewrapped at width 82 rather than reflowed freely, so it still occupies lines 114-118 and line 118 does not move. That line is a pinned citation boundary; letting it shift would have re-pinned every citation below it and turned a one-line change into an unreviewable lock diff. As it is, citations:update re-pinned exactly one line — screen-specs.md:116, whose wrapping changed — and that one-line lock diff is the evidence that no unrelated drift was masked.

A second citation the audit had not found, App.tsx:1149 citing screen-specs.md:116-118, was checked by hand before re-pinning: it names the 'applies instantly' sentence, which is still within that span.

docs/plans/completed/26-palette-sub-modes.md also says 'four presets' and was deliberately left alone — completed plans are dated records of what was true when written, per citation-guard's own header.

npm run verify passes. Work is on branch fix/lc-225-theme-preset-count, not merged.
<!-- /longclaw:event -->
