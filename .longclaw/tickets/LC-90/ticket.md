---
format: longclaw.ticket/v1
id: 9d76581d-db25-43d2-8faa-4c60a19febb9
key: LC-90
title: Filter states — the filter input triggers WebKit's native autofill dropdown (a Zzzz × suggestion popover under the field)
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.973Z
updated_at: 2026-08-05T15:16:00.973Z
---

**Prototype.** —

**App.** The filter input triggers **WebKit's native autofill dropdown** (a `Zzzz ×` suggestion popover under the field)

## Source

`docs/cc_screens_diff.md` — **D-30**, § Filter states, severity P0.

## Checklist

- [ ] Add autoComplete="off", autoCorrect="off", spellCheck={false}, and a name the browser will not treat as a saved field, to the filter input at App.tsx:1210-1219. A native OS popover inside a local-first app is both off-brand and a small privacy surprise. <!-- longclaw:item=ck_f4ac726c -->

## Activity

<!-- longclaw:event
id: evt_dec3e528
kind: create
occurred_at: 2026-08-05T15:16:00.973Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
