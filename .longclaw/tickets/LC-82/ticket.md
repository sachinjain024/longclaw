---
format: longclaw.ticket/v1
id: b5c3c7be-ac53-4c8c-afb9-c4c04f8c8c9c
key: LC-82
title: Welcome / first launch — trust line in mono --lc-type-micro — Renders in the UI face, not mono
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.844Z
updated_at: 2026-08-07T06:27:19.390Z
---

**Prototype.** Trust line in mono `--lc-type-micro`

**App.** Renders in the UI face, not mono

## Source

`docs/cc_screens_diff.md` — **D-16**, § Welcome / first launch, severity P3.

## Checklist

- [x] .trust-line should use --lc-type-code-font. <!-- longclaw:item=ck_9bfe6637 -->

## Activity

<!-- longclaw:event
id: evt_880a729c
kind: create
occurred_at: 2026-08-05T15:16:00.844Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e99b9667
kind: update
occurred_at: 2026-08-07T06:27:19.390Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_9bfe6637.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed, but not the way the checklist reads — the token was never the defect. .trust-line already asked for --lc-type-kbd-font, which resolves to --lc-font-mono, and the sidebar's copy of the line renders in mono today (cc_screens_diff.md § 1 records it as matching). The welcome copy lost to .welcome-copy p, the subtitle's rule, which matched the trust line too and beat one class on specificity. So the subtitle carries .welcome-subtitle now and nothing in the column selects a bare p. Swapping in --lc-type-code-font as written would have moved the sidebar's line from 10px to 12px to fix a defect that was not there. jsdom loads no stylesheet, so scripts/trust-line-guard.mjs holds the invariant instead: .trust-line resolves to the mono stack, and no selector that can reach this line may set a font.
<!-- /longclaw:event -->
