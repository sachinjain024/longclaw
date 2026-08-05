---
format: longclaw.ticket/v1
id: e15cc263-ebc5-4278-9868-7db27d45ed6a
key: LC-39
title: Commit the screenshot pipeline and regenerate the Step-1 proof renders
status: done
priority: p3
labels:
  - design
  - v0-backlog
created_at: 2026-08-05T14:23:15Z
updated_at: 2026-08-05T14:23:16Z
---

~~Commit the screenshot pipeline and regenerate the Step-1 proof renders~~ **Done 2026-08-01** — `docs/design/foundations/scripts/render.mjs` is the pipeline, committed: WebKit through `playwright-core` resolved out of `apps/desktop`, the board at 1400×860 across all 4 presets × 2 appearances, the library full-page in its two spot-checks, axes set as the two root attributes exactly as the token contract changes them. `proof/renders/` is regenerated from the corrected HTML and `foundations/README.md` § Regenerating documents the command. [Plan 34](../../../docs/plans/completed/34-proof-render-pipeline.md)

## Must-pass

Passed: all ten files reproduce deterministically, and the regenerated set shows no assignee avatar, field or control (verified visually on the board and library renders; the HTML stays `assign`-free outside its explanatory prose) — **which closes V0-19's screen clause**. The renders are WebKit now and not pixel-comparable with the stale originals, deliberately

## Source

`docs/backlog/v0-backlog.md` — **V0-41**, Wave 3, step 13, owner Design.

## Checklist

- [x] Passed: all ten files reproduce deterministically, and the regenerated set shows no assignee avatar, field or control (verified visually on the board and library renders; the HTML stays assign-free outside its explanatory prose) — which closes V0-19's screen clause. The renders are WebKit now and… <!-- longclaw:item=ck_51288b65 -->

## Activity

<!-- longclaw:event
id: evt_11da1627
kind: create
occurred_at: 2026-08-05T14:23:15Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_648276c8
kind: update
occurred_at: 2026-08-05T14:23:16Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_51288b65.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-41 is recorded there as passed.
<!-- /longclaw:event -->
