---
format: longclaw.ticket/v1
id: c8828317-e491-4588-8ac2-02972b8c3ac8
key: LC-209
title: Improve the Styling of + button next to every Status / Column
status: in_review
priority: urgent
labels:
  - frontend
  - design
created_at: 2026-08-11T14:49:23.565Z
updated_at: 2026-08-11T18:36:19.407Z
---

## Activity

<!-- longclaw:event
id: evt_1f840cf1
kind: create
occurred_at: 2026-08-11T14:49:23.565Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f7dad3ac
kind: update
occurred_at: 2026-08-11T18:36:19.407Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

The description was empty, so this was read as: the + is the smallest control on the board and the only one under the 24px target floor (it was 19px — a 13px glyph in 3px of padding). It is now a 24px square with the glyph centred, a press state matching .ghost, and it reveals on :focus rather than :focus-visible alone, because a button reached by pointer kept focus while invisible. The hover-reveal screen-specs.md asks for is unchanged, and that line now names the target. If you meant something else by 'improve the styling' — persistent rather than hover-revealed, a different glyph, a different weight — say so and I will take it further.
<!-- /longclaw:event -->
