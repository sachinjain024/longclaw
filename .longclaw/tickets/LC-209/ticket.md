---
format: longclaw.ticket/v1
id: c8828317-e491-4588-8ac2-02972b8c3ac8
key: LC-209
title: Improve the Styling of + button next to every Status / Column
status: done
priority: urgent
labels:
  - frontend
  - design
created_at: 2026-08-11T14:49:23.565Z
updated_at: 2026-08-12T06:43:36.858Z
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

<!-- longclaw:event
id: evt_5ef32a89
kind: comment
occurred_at: 2026-08-11T23:18:43.381Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Reworked on your note: no box around the +. The 24px was only ever meant to be hit area and had been drawing itself — a wash on hover, a darker one on press. Nothing draws it now: no fill, no border, no press wash. The glyph carries every state instead — ink-3 at rest, ink under the pointer, the human accent while held — and the 24px target stays, since it costs nothing to look at. screen-specs.md § Board says so.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe282461
kind: update
occurred_at: 2026-08-12T06:43:36.858Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket

The + no longer waits to be found: it is drawn at rest, at ink-3, the quietest ink in that header. Everything else about it is as it was after the last round — the same bare 13px glyph, no box, the same 24px hit area, and the same ink-3 → ink → accent progression on hover and press. The :focus reveal went with the hover reveal, since it only existed to stop a pointer-focused button being invisible; the global button:focus-visible ring is untouched. screen-specs.md § Board now reads 'always-visible +'.
<!-- /longclaw:event -->
