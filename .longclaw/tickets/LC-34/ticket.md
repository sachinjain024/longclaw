---
format: longclaw.ticket/v1
id: 9c5ece32-b12a-4fcb-8773-cb1d7dfb8dd6
key: LC-34
title: Apply every token to every production component and state; add a regression check for hardcoded accents and missing theme values
status: done
priority: p3
labels:
  - design
  - v0-backlog
created_at: 2026-08-05T14:23:11Z
updated_at: 2026-08-05T14:23:12Z
---

~~Apply every token to every production component and state; add a regression check for hardcoded accents and missing theme values~~ **Done 2026-08-01** — the audit half was already true (zero color literals outside `src/tokens/`, built up incrementally by Waves 1–2), so the item is almost entirely the check: `tokens/build.mjs` refuses a missing theme value naming every gap, and `scripts/color-guard.mjs` fails on any hex or functional color notation in `src/**` outside `src/tokens/`, both as steps of `tokens:check` and therefore of `check` and CI. Named CSS colors are deliberately outside the guard's scope. [Plan 33](../../../docs/plans/completed/33-token-guard.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-34**, Wave 3, step 13, owner Design.

## Checklist

- [x] Passed both red cases, each confirmed first: an injected #ff0000 fails the build naming file, line and value; a deleted themes.plum.agent.dark fails naming the token. The rendered "all four presets" half is V0-37's matrix <!-- longclaw:item=ck_0d639f60 -->

## Activity

<!-- longclaw:event
id: evt_46a89c9c
kind: create
occurred_at: 2026-08-05T14:23:11Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_74350a28
kind: update
occurred_at: 2026-08-05T14:23:12Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0d639f60.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-34 is recorded there as passed.
<!-- /longclaw:event -->
