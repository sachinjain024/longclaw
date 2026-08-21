---
format: longclaw.ticket/v1
id: 9fe9e4fa-cf24-4826-84c1-3db7defe85d5
key: LC-225
title: screen-specs.md still lists four theme presets; the app ships five
status: todo
priority: p3
labels:
  - design
  - prototype-diff
created_at: 2026-08-21T10:00:03.460Z
updated_at: 2026-08-21T10:00:03.460Z
---

Found during the LC-217 repo audit.

`docs/design/prototype/screen-specs.md:114` reads "Presets: Indigo (default) · Clay · Slate · Plum" — four. `apps/desktop/src/App.tsx:134` ships five: Indigo, Clay, Slate, Plum, **Graphite**.

Graphite arrived on 2026-08-10 with LC-192 (Sync Design System) and is fully specified everywhere else — `docs/design/foundations/accessibility.md:105-112` carries its measured contrast table for both appearances, and the theme matrix covers it. Only the prototype screen spec was left behind.

The stale line has a second reader: `apps/desktop/src/ThemePicker.tsx:10` cites `screen-specs.md:112-118` and its own comment says "Four presets", so the component doc repeats the wrong count.

## Approach

Correct the count in `screen-specs.md` and the `ThemePicker.tsx` comment.

**The gotcha:** `screen-specs.md` is one of the six documents pinned by `apps/desktop/scripts/citation-guard.mjs`. Editing it shifts pinned line numbers, so `npm run citations:check` will fail until `npm run citations:update` re-pins them — and that re-pin should be reviewed rather than taken on trust, because it rewrites the lock for every citation into that file.

## Checklist

- [ ] Correct the preset list at screen-specs.md:114 to name Graphite <!-- longclaw:item=ck_a656dd5c -->
- [ ] Correct the 'Four presets' comment in ThemePicker.tsx <!-- longclaw:item=ck_f4c0077c -->
- [ ] Run citations:update and review the re-pinned lock diff, then citations:check <!-- longclaw:item=ck_faa614be -->

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
