---
format: longclaw.ticket/v1
id: 8f296ac9-6f3f-4de6-ac82-007d1daf2a1e
key: LC-147
title: External update / agent freshness — ⚠ file changed on disk — actor unknown with no age, truncated to …actor unkn… at 264px
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.851Z
updated_at: 2026-08-05T15:16:01.851Z
---

**Prototype.** Footer line carries the age: `❯ updated by agent · 12s`

**App.** `⚠ file changed on disk — actor unknown` with no age, truncated to `…actor unkn…` at 264px

## Source

`docs/cc_screens_diff.md` — **D-61**, § External update / agent freshness, severity P2.

## Checklist

- [ ] Add the relative age; shorten the unknown-actor string so it fits the card (file changed · 12s + the warn glyph is enough — the panel timeline can carry the full sentence). <!-- longclaw:item=ck_578e40cc -->

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
