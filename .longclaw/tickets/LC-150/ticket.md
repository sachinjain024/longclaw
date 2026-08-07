---
format: longclaw.ticket/v1
id: d602302f-c91c-4a80-b226-be1cf302ff48
key: LC-150
title: Cross-cutting — appearance preference is not restored on relaunch
status: in_review
priority: p1
rank: a0
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.898Z
updated_at: 2026-08-07T12:15:37.547Z
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

<!-- longclaw:event
id: evt_6bd01023
kind: update
occurred_at: 2026-08-07T11:20:03.011Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    to: a0
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_64a64f37
kind: update
occurred_at: 2026-08-07T12:15:37.547Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket

Fixed by moving the preference, not by explaining the loss — and the checklist item above stays unticked, because the packaged verification it asks for was never performed *for the old store*.

What was done instead. Appearance, the open project and every project's workspace are one document in `device-preferences.json`, beside the project registry in application support, written through `atomic_write` like every other file this app owns. Rust keeps the file without reading it — the vocabulary inside is the frontend's — and `devicePreferences.ts` validates every field, reads the document once before the first render, and pushes the appearance into the store there rather than from an effect (an effect runs its first pass with the launch default still in place and records `system` over what it just read, which is this bug wearing a different hat). ADR 0012 records the decision and supersedes the sentence in ADR 0006 that allowed webview storage.

Why fix it without the confirmation. The record is in tension and this ticket should say so. `8578f73` — the clean-machine pass, the same day this was filed — reports that appearance *survived* a packaged upgrade, and it had been in `localStorage` since 57b291e. And a packaged check run now cuts the same way: the old `localStorage` value was still readable to the bundle after the new preferences file was deleted, and across a redirected HOME, so webview storage is persisting on this machine and does not even live under HOME. So why the control read `System` again is unexplained, and this change does not claim otherwise.

What decided it was the asymmetry. `localStorage` is unreadable to the suite as well (LC-161), so a preference living there produces P1s that nobody can close without a manual quit-and-relaunch. Moving it costs one file and makes both claims assertions. If the old store was keeping these all along, nothing is lost by the move; if it was not, the bug is gone.

The new mechanism *was* checked on the bundle, which is the claim that has to hold from here: with two projects registered, a remembered second project comes up as the second project, and a remembered `light` survives the quit — with a control launch (no document) proving the file records which project actually opened, by writing the first one.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_24e65893
kind: comment
occurred_at: 2026-08-07T13:20:58.901Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review follow-up: the migration off webview storage now consumes the old keys once what they held has been written to the file.

It did not, and that broke the reset path this change documents. A document can be empty because somebody emptied it — deleting the file is the supported way to start over (`user-guide.md`) — and adoption keyed on 'the document is empty' handed the old choices straight back on the next launch. Now the four legacy keys are removed after the carrying write lands, so the migration happens once and a reset stays reset. Only after it lands: a host that refuses the write must not also be the host that empties the only copy. Both are tests.

The trade is a downgrade — a build older than LC-150 installed over this one finds its storage empty and comes up on the defaults — and it is the right way round, since the alternative is stale values that outlive every later change to them.
<!-- /longclaw:event -->
