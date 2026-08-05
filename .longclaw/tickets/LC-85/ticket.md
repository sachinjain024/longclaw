---
format: longclaw.ticket/v1
id: 2e4ac0d2-cd33-41f2-ad9d-0e53482dd71b
key: LC-85
title: Board — priority None renders as a stray hyphen in a chip slot with no chip
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.889Z
updated_at: 2026-08-05T15:16:00.889Z
---

**Prototype.** Priority `None` renders as a dash glyph in the ID row

**App.** Same, but the dash sits in the chip slot with no chip — reads as a stray hyphen (see LC-108)

## Source

`docs/cc_screens_diff.md` — **D-23**, § Board, severity P3.

## Checklist

- [ ] Either render the — inside the same 22×16 chip frame as P1…P4, or omit it. <!-- longclaw:item=ck_83b18b6c -->

## Activity

<!-- longclaw:event
id: evt_97352533
kind: create
occurred_at: 2026-08-05T15:16:00.889Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
