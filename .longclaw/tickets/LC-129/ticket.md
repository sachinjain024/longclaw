---
format: longclaw.ticket/v1
id: eb76978b-29ae-4084-a412-8b15a5231309
key: LC-129
title: Project settings — A full-width red-text button; no explanatory copy and no confirm dialog observed
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.562Z
updated_at: 2026-08-05T15:16:01.562Z
---

**Prototype.** Remove from app: danger button + confirm dialog naming the path and repeating "Removing only forgets the project in LongClaw. Files on disk are never touched."

**App.** A full-width red-text button; **no explanatory copy** and no confirm dialog observed

## Source

`docs/cc_screens_diff.md` — **D-44**, § Project settings, severity P1.

## Checklist

- [ ] Add the copy and the confirm dialog. This is the app's single most destructive-looking action and its guarantee is currently unstated. <!-- longclaw:item=ck_77b4095e -->

## Activity

<!-- longclaw:event
id: evt_ca65e649
kind: create
occurred_at: 2026-08-05T15:16:01.562Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
