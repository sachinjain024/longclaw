---
format: longclaw.ticket/v1
id: 17edb830-5384-4b8a-960f-3ce5bc6a0547
key: LC-141
title: "Folder missing / unreachable — the project stays flagged unreachable after the folder returns — even across an app relaunch, because reachable: false is persisted to the registry"
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.758Z
updated_at: 2026-08-05T15:16:01.758Z
---

**Prototype.** Once the folder is back, the project recovers

**App.** The project stays flagged unreachable after the folder returns — even across an app relaunch, because `reachable: false` is persisted to the registry

## Source

`docs/cc_screens_diff.md` — **D-56**, § Folder missing / unreachable, severity P1.

## Checklist

- [ ] Re-probe reachability on launch and on watcher activity; treat the persisted flag as a cache, not a fact. <!-- longclaw:item=ck_487a89e9 -->

## Activity

<!-- longclaw:event
id: evt_0c533b87
kind: create
occurred_at: 2026-08-05T15:16:01.758Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
