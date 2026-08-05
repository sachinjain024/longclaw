---
format: longclaw.ticket/v1
id: 2115f95c-c1c2-4cd3-96ba-be03e58dca15
key: LC-97
title: Ticket panel — inline code renders as a solid black block — unlink, add, watcher/coalesce.rs, [ ], [x] are all unreadable rectangles in light appearance
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.078Z
updated_at: 2026-08-05T15:16:01.078Z
---

**Prototype.** Inline code renders as `wash`-backed mono

**App.** **Inline code renders as a solid black block** — `unlink`, `add`, `watcher/coalesce.rs`, `[ ]`, `[x]` are all unreadable rectangles in light appearance

## Plan

`.markdown code { background: var(--lc-tile) }` (`styles.css:1698-1703`). `--lc-tile` is `#171923` (`tokens/design-tokens.css:127`) — the near-black *agent terminal tile*, deliberately near-black in both appearances (`styles.css:1850`). Inherited ink then paints dark-on-dark. Fix: use `--lc-wash` (or add a `--lc-code-bg`) and set an explicit `color`.

## Source

`docs/cc_screens_diff.md` — **D-02**, § Ticket panel, severity P0.

## Checklist

- [ ] .markdown code { background: var(--lc-tile) } (styles.css:1698-1703). --lc-tile is #171923 (tokens/design-tokens.css:127) — the near-black agent terminal tile, deliberately near-black in both appearances (styles.css:1850). Inherited ink then paints dark-on-dark. Fix: use --lc-wash (or add a… <!-- longclaw:item=ck_3cd77577 -->

## Activity

<!-- longclaw:event
id: evt_96df521b
kind: create
occurred_at: 2026-08-05T15:16:01.078Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
