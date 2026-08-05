---
format: longclaw.ticket/v1
id: d602302f-c91c-4a80-b226-be1cf302ff48
key: LC-150
title: Cross-cutting — appearance preference is not restored on relaunch
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.898Z
updated_at: 2026-08-05T15:16:01.898Z
---

**Finding.** **Appearance preference is not restored on relaunch.** Set to Light, quit, relaunch → the control reads `System` again. It is written to `localStorage` under `longclaw.appearance` (`App.tsx:79`, `:491`)

## Source

`docs/cc_screens_diff.md` — **D-70**, § Cross-cutting, severity P1.

## Checklist

- [ ] Verify on a packaged build before filing as a bug — but if it reproduces there, the webview's storage is not surviving the process, and the ordering preference (stored the same way, App.tsx:222) is lost with it. <!-- longclaw:item=ck_6de94c89 -->

## Activity

<!-- longclaw:event
id: evt_02492dcf
kind: create
occurred_at: 2026-08-05T15:16:01.898Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
