---
format: longclaw.ticket/v1
id: a29fd12b-7f94-4ac3-a0b1-6806292559fd
key: LC-167
title: Dark-appearance density pass against board-indigo-dark.png, once the shell geometry has settled
status: todo
priority: p2
labels:
  - design
  - prototype-diff
created_at: 2026-08-07T05:42:02.086Z
updated_at: 2026-08-07T05:42:02.086Z
---

**What.** A dark-appearance visual pass against `docs/design/prototype/renders/board-indigo-dark.png`, at the same viewport and data state as the prototype reference — once the shell geometry has stopped moving.

Both deleted plan documents put this last on purpose: auditing contrast before the layout moves means auditing it twice. The geometry still outstanding is the `--lc-size-board-stack` retune, the welcome screen (LC-76…LC-82), and the empty-project scaffold (LC-86…LC-89).

**What to look at.** Board cards, side-panel active rows, fields, segments, borders and raised surfaces, read through the existing semantic tokens: `--lc-bg`, `--lc-surface`, `--lc-raised`, `--lc-line`, active-row fills, control borders, shadows, and status/accent usage. The observation that prompted it — the app's dark cards and active row read more boxed and filled than the prototype's.

**Constraints.** No one-off colours outside the token system. No control or card dimension may change between appearances. Verify all four project themes across System, Light and Dark, including text contrast, focus rings, selected segments, and long text/path truncation.

`npm run matrix` (LC-37's harness) is the tool for the theme × appearance sweep; this ticket is the judgement the harness cannot make.

## Source

`docs/cc_ui_diffs.md` § work order 6 and `docs/cd_ui_diffs.md` § 8 / Step 8, both deleted 2026-08-07.

## Checklist

- [ ] Capture Indigo light and Indigo dark at the prototype's viewport and data state. <!-- longclaw:item=ck_1c9b3676 -->
- [ ] Audit --lc-bg, --lc-surface, --lc-raised, --lc-line, active-row fills, control borders, shadows and accent usage against the renders; retune tokens, not components. <!-- longclaw:item=ck_77e60d9f -->
- [ ] Verify all four themes across System, Light and Dark, then run npm run matrix — theme x appearance is exactly what this pass moves. <!-- longclaw:item=ck_1bdc844b -->

## Activity

<!-- longclaw:event
id: evt_753328f6
kind: create
occurred_at: 2026-08-07T05:42:02.086Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
