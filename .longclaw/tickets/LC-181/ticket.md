---
format: longclaw.ticket/v1
id: 1d34ff64-4254-4925-bd4e-a9aa54d298f2
key: LC-181
title: An escaped pipe in a table cell renders as a cell wall
status: todo
priority: p3
rank: Zz
labels:
  - frontend
created_at: 2026-08-08T08:06:03.285Z
updated_at: 2026-08-09T00:03:49.861Z
---

An escaped `\|` in a table cell renders as a cell wall.

`parseInline` drops the backslash of any escapable character (`markdown.ts:290-294`), which is right everywhere else: `\*` is a literal asterisk and nothing else was going to show it. A pipe is different now that LC-179 recognises tables well enough to keep their rows apart. An author writes

```
| Command | Effect |
| ------- | ------ |
| `a \| b` | pipes a into b |
```

and the escape means "this pipe is content, not a boundary". On screen it comes back as `| a | b |`, so the row reads as three cells where two were typed, and the one thing the fallback promises — that the pipes still mark the columns the author drew — is the thing it gets wrong.

The scope of it is narrow. It only shows where a cell holds a literal pipe, and a cell holding a literal pipe is usually holding a shell command, in which case it is usually inside a code span. Inside a code span the escape is not processed at all and the pipe survives as itself, so the common case is already right — `` `a | b` `` needs no escape and renders correctly. This is the case where an author escaped a pipe *outside* a code span.

There is no fix inside the current shape. `readTable` emits a paragraph of inlines and holds no notion of a cell, so nothing downstream knows which pipes were structural; and the escape has to be dropped before the text is shown, or every other `\` in the description would go literal. Telling a wall from its content means the table knows what a cell is, which is `TableBlock` — a new member of the union, a cell-and-alignment parser, and column styling from nothing, since `styles.css` carries no `table`, `th`, or `td` rule anywhere. That was declined in LC-179 for a construct that appears in one ticket on disk, and the decline is recorded at `docs/plans/completed/18-markdown-editor.md`, `### On tables (LC-179)`.

So this ticket is the marker for that decision rather than a bug with a small fix behind it. It closes either when a real `TableBlock` lands, or as `wontfix` when someone decides the case is too rare to buy one.

## Checklist

- [ ] Decide between a real TableBlock and accepting the ambiguity, and say which in 18-markdown-editor.md <!-- longclaw:item=ck_0ee741a4 -->
- [ ] If TableBlock lands: an escaped pipe stays inside its cell, asserted in lines on screen <!-- longclaw:item=ck_6179c8a9 -->

## Activity

<!-- longclaw:event
id: evt_9630e6ee
kind: create
occurred_at: 2026-08-08T08:06:03.285Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4f7ce5c7
kind: update
occurred_at: 2026-08-08T23:55:46.725Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    to: a1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1e328a46
kind: update
occurred_at: 2026-08-08T23:55:53.085Z
actor:
  type: human
  id: local
changes:
  - field: rank
    from: a1
    to: Zz
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a8ff78e2
kind: update
occurred_at: 2026-08-09T00:03:49.861Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->
