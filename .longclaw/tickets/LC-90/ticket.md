---
format: longclaw.ticket/v1
id: 9d76581d-db25-43d2-8faa-4c60a19febb9
key: LC-90
title: Filter states — the filter input triggers WebKit's native autofill dropdown (a Zzzz × suggestion popover under the field)
status: done
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.973Z
updated_at: 2026-08-07T05:51:31.143Z
---

**Prototype.** —

**App.** The filter input triggers **WebKit's native autofill dropdown** (a `Zzzz ×` suggestion popover under the field)

## Source

`docs/cc_screens_diff.md` — **D-30**, § Filter states, severity P0.

## Checklist

- [x] Add autoComplete="off", autoCorrect="off", spellCheck={false}, and a name the browser will not treat as a saved field, to the filter input at App.tsx:1210-1219. A native OS popover inside a local-first app is both off-brand and a small privacy surprise. <!-- longclaw:item=ck_f4ac726c -->

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

<!-- longclaw:event
id: evt_e98fffd2
kind: update
occurred_at: 2026-08-07T05:49:24.213Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0dd273e8
kind: update
occurred_at: 2026-08-07T05:51:31.143Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_f4ac726c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The field turns four things off, not one: `autoComplete="off"` is the request, `name="longclaw-filter"` is what WebKit's heuristics read when they decline it — no saved-value store has a value for that name — and `autoCorrect`/`spellCheck` are the same class of unasked-for help over a query that is a substring, not prose. The prototype's field already carried the pair (`prototype.js:496`).
<!-- /longclaw:event -->
