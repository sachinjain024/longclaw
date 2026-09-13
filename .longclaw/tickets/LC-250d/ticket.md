---
format: longclaw.ticket/v1
id: 9268437b-6b65-43bd-8855-64de960752f0
key: LC-250d
title: Modals draw at the panel radius, not the modal radius
status: todo
priority: p2
labels:
  - design
  - frontend
created_at: 2026-09-11T08:49:07.983Z
updated_at: 2026-09-11T08:49:07.983Z
---

The design system states the rule in its own readme and in `tokens/spacing.css`:

> radius: controls 5 · cards 8 · panels 10 · **modals & palette 14**. Never
> pill-shaped containers.

The app carries the token — `--lc-radius-modal: 14px`. Two rules use it:
`.raw-file-view` and `.command-palette`. The palette half of the rule is
honoured; the modal half is not. **`.confirm-dialog` and `.quick-create-modal`
both draw at `--lc-radius-panel`, which is 10px.**

Found while reviewing the imported Claude Design canvas for LC-249a against the
prototype built on the app's real stylesheet. The design's dialog looked
noticeably softer than the app's and the 4px of corner was most of the
difference — the canvas had followed the rule and the app had not.

## Why no guard caught it

`token-guard.mjs` exists for exactly this family of defect. Its own header says
so:

> 31 literal `border-radius` values in `styles.css`, ten of them `7px`, which is
> **not a value on the radius scale at all**. The design system had a control
> radius of 5px and the app had one of 7px, and nothing said so.

But `.confirm-dialog` does not use a literal. It uses `var(--lc-radius-panel)` —
a legal token from the right scale, applied to the wrong kind of element. The
guard checks that a value is a token; nothing checks that it is *the* token for
that element. That gap is its own ticket.

## Not a blind swap

`--lc-radius-panel` has other users and most of them are genuinely panels. The
work is to audit every one, change only the surfaces the system calls modals,
and say in the commit which were left alone and why. `npm run matrix` is the run
that proves nothing else moved.

## Checklist

- [ ] confirm-dialog and quick-create-modal use --lc-radius-modal, which the app already defines at 14px and the design system's spacing.css and readme both name as the modal radius <!-- longclaw:item=ck_2ef9ea57 -->
- [ ] Every other --lc-radius-panel user is audited and the ones that are genuinely panels are left alone, with the commit saying which and why — this is not a find-and-replace <!-- longclaw:item=ck_972f836d -->
- [ ] npm run matrix is re-run and quoted, because a corner radius is exactly the kind of change a theme by appearance visual regression exists to catch and nothing else in verify can see it <!-- longclaw:item=ck_1527f306 -->
- [ ] npm run verify passes with the run quoted <!-- longclaw:item=ck_03e748e6 -->

## Activity

<!-- longclaw:event
id: evt_7d203070
kind: create
occurred_at: 2026-09-11T08:49:07.983Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
