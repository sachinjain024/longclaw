---
format: longclaw.ticket/v1
id: cb44f3fd-7f6c-41ef-aa9b-347b330dd91a
key: LC-148
title: External update / agent freshness — an unknown-actor change gets the full agent-green treatment and a warn triangle — the two vocabularies are mixed on one line
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.864Z
updated_at: 2026-08-08T14:59:36.948Z
---

**Prototype.** Agent green is for agent writes; an unknown actor gets the **warn** treatment (`states.md:150-152`)

**App.** An unknown-actor change gets the full agent-green treatment *and* a warn triangle — the two vocabularies are mixed on one line

## Source

`docs/cc_screens_diff.md` — **D-62**, § External update / agent freshness, severity P3.

## Checklist

- [x] Pick per attribution: agent → green + ❯; unknown → warn + triangle. <!-- longclaw:item=ck_b160d938 -->

## Activity

<!-- longclaw:event
id: evt_64df619f
kind: create
occurred_at: 2026-08-05T15:16:01.864Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d058f4e3
kind: update
occurred_at: 2026-08-08T14:59:36.948Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_b160d938.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d821bde6
kind: comment
occurred_at: 2026-08-08T15:00:06.065Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

`freshAccentClass` in attribution.ts is now the single place that picks a freshness accent, and both the board card and the list row ask it — agent → green, human → violet, unknown → warn. It replaces `wearsAgentAccent`, which returned true for anything that was not a person and was what lent green to an unclaimed change.

Two things the card was not the only one getting wrong. The list row wore `human-fresh` but every rule for it was written `.ticket-row.human-fresh`, so a person's edit showed a green dot there; the selectors are now written for the treatment rather than the surface. And the pulse halo is a hue inside a `@keyframes`, so it beat agent-green under every actor — design-tokens.css now generates `lc-pulse`, `lc-pulse-human` and `lc-pulse-warn` from one shape, with matching `-fresh-ring`/`-fresh-border`/`-pulse` token sets. The existing `accent-agent-fresh-*` names are untouched; the design system pins them.

Colour is the point here and jsdom cannot see it, so `npm run matrix` now renders a second fresh card carrying no attribution at all and probes it: the footer must resolve to `--lc-warn`, and it must be ΔE ≥ 10 from the agent's. Both go red on exactly this defect in all 8 theme × appearance axes — verified by reverting the colour and watching them fail.
<!-- /longclaw:event -->
