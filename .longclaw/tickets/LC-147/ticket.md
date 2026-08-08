---
format: longclaw.ticket/v1
id: 8f296ac9-6f3f-4de6-ac82-007d1daf2a1e
key: LC-147
title: External update / agent freshness — ⚠ file changed on disk — actor unknown with no age, truncated to …actor unkn… at 264px
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.851Z
updated_at: 2026-08-08T14:59:36.930Z
---

**Prototype.** Footer line carries the age: `❯ updated by agent · 12s`

**App.** `⚠ file changed on disk — actor unknown` with no age, truncated to `…actor unkn…` at 264px

## Source

`docs/cc_screens_diff.md` — **D-61**, § External update / agent freshness, severity P2.

## Checklist

- [x] Add the relative age; shorten the unknown-actor string so it fits the card (file changed · 12s + the warn glyph is enough — the panel timeline can carry the full sentence). <!-- longclaw:item=ck_578e40cc -->

## Activity

<!-- longclaw:event
id: evt_526000f1
kind: create
occurred_at: 2026-08-05T15:16:01.851Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1bf39f24
kind: update
occurred_at: 2026-08-08T14:59:36.930Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_578e40cc.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0ea25068
kind: comment
occurred_at: 2026-08-08T15:00:06.044Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The card's unattributed line is now `⚠ file changed · 12s` — every acknowledgement carries its age, including this one, which was the only line on the board that could not say how stale it was. The full sentence is unchanged where there is room for it: `UNATTRIBUTED_CHANGE` still reads `file changed on disk — actor unknown` and the panel timeline still says it (Timeline.test.tsx:244). The two forms sit together in attribution.ts as `UNATTRIBUTED_CHANGE` and `UNATTRIBUTED_CHANGE_BRIEF` so it stays one claim at two lengths.
<!-- /longclaw:event -->
