---
format: longclaw.ticket/v1
id: 1d34ff64-4254-4925-bd4e-a9aa54d298f2
key: LC-181
title: An escaped pipe in a table cell renders as a cell wall
status: done
priority: p3
rank: a1V
labels:
  - frontend
created_at: 2026-08-08T08:06:03.285Z
updated_at: 2026-08-18T09:22:56.111Z
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

## What closed it

The paragraph above beginning "There is no fix inside the current shape" was
true when it was written and is not true now. It reasoned that telling a wall
from its content means the table knows what a cell is, and that this was
declined. LC-179 was reopened on 2026-08-18 and shipped exactly that: a
`TableBlock` in the union, and `splitCells` splitting on unescaped pipes only.
So the ambiguity this ticket describes is gone, and it went by the route the
paragraph named rather than by a patch of its own.

What is above stands as the report it was. This section is here so a reader who
stops before the activity log does not leave with the declined version of the
decision.

## Checklist

- [x] Decide between a real TableBlock and accepting the ambiguity, and say which in 18-markdown-editor.md <!-- longclaw:item=ck_0ee741a4 -->
- [x] If TableBlock lands: an escaped pipe stays inside its cell, asserted in lines on screen <!-- longclaw:item=ck_6179c8a9 -->

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

<!-- longclaw:event
id: evt_eebf3c40
kind: update
occurred_at: 2026-08-09T07:36:36.682Z
actor:
  type: human
  id: local
changes:
  - field: rank
    from: Zz
    to: a1V
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9d805713
kind: update
occurred_at: 2026-08-11T14:24:32.052Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: canceled
-->
### Claude Code updated this ticket

This ticket names its own closing condition: "It closes either when a real `TableBlock` lands, or as `wontfix` when someone decides the case is too rare to buy one." Someone did, in the same pass that filed it, and it is on disk: `docs/plans/completed/18-markdown-editor.md:248` reads "**A real `TableBlock` stays out of scope.** It is a new member of the union, a cell-and-alignment parser, and column styling from nothing … for a construct that appears in one ticket on disk." That is what checklist item 1 asks to be decided and said in that file. Item 2 was conditional on a `TableBlock` landing.

Verified unchanged: `markdown.ts` still has no `TableBlock` in its union and `readTable` (`:333`) still emits a paragraph of inlines with `break` nodes between rows, so nothing downstream knows which pipes were structural; `styles.css` still carries no `table`, `th` or `td` rule anywhere. The one escaped pipe in the whole store is this ticket's own example, inside a fenced block where `parseInline` never runs on it.

Cancelled as wontfix, which is the terminal state the ticket asked for by name. The marker it was filed to be survives in the plan document, together with what would reopen it — a table written for alignment rather than for reading, where the pipes carry the boundary but not the alignment.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_73e73f3b
kind: update
occurred_at: 2026-08-18T09:22:15.742Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: canceled
    to: done
  - field: checklist.ck_0ee741a4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_6179c8a9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Reopened in effect rather than in status, so this corrects the record rather than the code.

Cancelling as wontfix was right on 2026-08-11 and stopped being right a week later. Its premise was one line — `18-markdown-editor.md:248`, "**A real `TableBlock` stays out of scope.**" — and LC-179 was reopened on 2026-08-18 to reverse exactly that line. This ticket named both outcomes when it was filed: "It closes either when a real `TableBlock` lands, or as `wontfix` when someone decides the case is too rare to buy one." A `TableBlock` landed, so the other branch is the one that happened.

Both items are ticked against what is on disk rather than against intent:

- Item 1 asked for the decision to be said in `18-markdown-editor.md`. It is, in the same section the cancel note quoted the opposite from: § On tables (LC-179) now reads "**LC-181 is answered by the structure rather than by a patch**" (`:287`).
- Item 2 is `splitCells` (`markdown.ts:430`) — the first thing in the file that can tell a wall from a pipe an author escaped. It takes `\\` and `\|` in pairs, so the escape never reaches the wall test and a `\\` cannot make a wall look escaped, and it hands the backslash through for `parseInline` to drop. The row in this ticket's own example is two cells again, not three. Asserted in `markdown.test.ts:222`, "keeps an escaped pipe inside its cell".

Done rather than canceled, because the behaviour was fixed. The fix shipped under LC-179 and nothing about it changes here.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0d946990
kind: update
occurred_at: 2026-08-18T09:22:56.111Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Added § What closed it to the description. The report above it is untouched; the section only says that its "no fix inside the current shape" paragraph was overtaken, so a reader who stops before this log does not leave with the declined version of the decision.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_21f80092
kind: comment
occurred_at: 2026-08-18T09:23:41.699Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Correcting a citation in the entry two above: it cites `18-markdown-editor.md:248` for "**A real `TableBlock` stays out of scope.**" as though that line reads that way today. It does not — the LC-179 round rewrote § On tables, and the sentence is nowhere in the file now. That citation was the 2026-08-11 cancel note's, quoted to show what the cancellation rested on, and it should have been marked as the historical pointer it is. The live text at that spot is "**The first fix kept the lines, and lines were not the unit.**" Nothing else in that entry moves.
<!-- /longclaw:event -->
