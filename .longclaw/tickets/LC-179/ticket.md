---
format: longclaw.ticket/v1
id: 6ba18bfc-8cbd-441c-a9f4-87005fb3d081
key: LC-179
title: A Markdown table in a description collapses into one run-on line
status: in_review
priority: p2
labels:
  - frontend
created_at: 2026-08-07T16:12:05.944Z
updated_at: 2026-08-18T07:28:49.051Z
---

`markdown.ts` parses no table, and that is a decision rather than an oversight — its header says tables are "neither dropped nor executed. It comes back out as the paragraph text its author typed" (`markdown.ts:23`), and `markdown.test.ts:175` pins the promise with `| a | b |\n| - | - |`. The promise holds in the tree and breaks on screen.

A pipe table parses to exactly one `paragraph`. Its text nodes still carry the author's `\n`, but nothing turns those into `break` nodes: `parseInline` emits one only for a two-space or backslash line ending (`markdown.ts:301-311`). `.markdown` sets `font-size` and `line-height` and no `white-space` (`styles.css:2330-2334`), so the webview collapses every one of those newlines to a space.

LC-178 is the example the report cites. Its `## What the recording shows` section is a nine-line table — a header, a delimiter row, and seven timestamped rows — and `parseMarkdown` returns one `paragraph` for the whole thing, so the panel renders it as a single wrapped run:

```
| Time | State | | ---- | ----- | | 0:00 | Query `Full Create`. Todo reads 4. The column shows one card, `LC-170`, sitting mid-column with nothing above it. | | 0:05 | Filter cleared. The unfiltered board is correct: … | | 0:10 | Retyping. At `Full` Todo reads 5 and Done 6, all packed at the top — correct. | …
```

The delimiter row is the worst of it. A row of dashes that meant "the header ends here" is now inline punctuation mid-sentence, and the column boundaries it aligned are gone. What made that table worth writing was that a reader could run their eye down the Time column; collapsed, the timestamps are just more words in a paragraph, and `| |` between rows is the only thing marking where one ended. Cells holding code spans still resolve to `<code>`, so the line reads as monospace chips strung along a run of pipes — legible as characters, unreadable as a table.

It is every surface that mounts `MarkdownView`: the read-only description in `TicketPanel.tsx:1023`, the Preview tab in `DescriptionEditor.tsx:239`, and comment bodies in `Timeline.tsx`.

The existing test misses it because it asserts on node values rather than on layout. `shownText` joins the blocks and the `\n` is still inside the string, so `expect(shown).toContain(line.trim())` passes happily while the screen shows one line. A test for this has to assert that the rendered output still has as many lines as the author typed.

Two ways out, and they are not the same size. Keeping the author's line structure — a `break` per newline in the unsupported-construct fallback, or `white-space: pre-wrap` on the paragraph — restores the table as the aligned block it was typed as, and changes nothing else, because every other unsupported construct in that list is one line long. Rendering real tables means a `TableBlock` in the union and column styling from scratch, since `styles.css` carries no `table`, `th`, or `td` rule anywhere. Both keep the security invariant, which is structural: `MarkdownView` builds elements and never markup (`markdown.ts:6-11`). `docs/plans/completed/18-markdown-editor.md:77` put tables outside the v0 subset on purpose, so the second is a scope decision. The first is the bug.

LC-178 is the only ticket on disk holding a pipe table today, so this is rare rather than pervasive. It is worth fixing anyway: the tables that do get written are written where a reader needs to scan columns — LC-178's timeline of a recording, `docs/agents/triage-labels.md`'s label mapping — which is exactly the content collapsing destroys.

## The second round

Reopened after review, because the rows were apart and the table still was not a
table. What shipped now is the `TableBlock` the first pass ruled out.

`readTable` reads cells instead of lines. It splits each row on the pipes the
author did not escape, takes `:--`/`:-:`/`--:` off the delimiter row as one
alignment per column, and consumes that row rather than showing it — it was never
content, it was the author saying which row is the header and which way each
column reads, and both of those are in the block now. `MarkdownView` renders a
`<table>` with `<th scope="col">`, so the column a sighted reader scans down is
the same one a screen reader announces. `styles.css` gained the `.markdown-table`
rules it had never carried anywhere.

Three calls in there are not GFM's, and they are the same call three times:

| Case | GFM | Here | Why |
| --- | --- | --- | --- |
| A row runs past the header | truncate the extra cells | widen the table, pad the rest | nothing here may drop text an author typed |
| The delimiter row's cell count misses | refuse the table | square it off | refusing drops it onto the paragraph fallback, which is the collapse this ticket is about |
| The table is wider than the panel | — | `table-layout: auto`, no scroller | a table that fits beats one that scrolls, and a scroll region would owe the keyboard a stop `keyboard-focus-map.md` has no reason to describe |

LC-181 falls out of the structure rather than needing a patch of its own:
`splitCells` is the first thing in the file that can tell a wall from a pipe the
author escaped to keep inside a cell, so `x \| y` is one cell again. LC-180 does
not — a multi-line raw HTML block still collapses onto one line, and that is
still its own ticket.

The security invariant is unchanged and is still structural. A cell holds
`Inline[]` like every other run of text, so the grid lives in the tree's shape
and never in a string, and no branch gained the ability to produce markup.

Checked against what is on disk rather than against fixtures alone: LC-178's
`## What the recording shows` now parses to a 9×2 grid and LC-166's latency table
to a 5×3, and no paragraph anywhere in the 221 tickets came back as a run of
pipes. Two tables in 221 tickets is still rare — and both of them are tables
someone wrote to be read down a column, which was the whole argument.

## Checklist

- [x] Keep the author's line breaks in the unsupported-construct fallback, so a table stays as many lines as it was typed <!-- longclaw:item=ck_0058d7be -->
- [x] Assert rendered line structure in a test, because the current one passes against a collapsed line <!-- longclaw:item=ck_86237452 -->
- [x] Decide whether a real TableBlock is in scope, and record that where 18-markdown-editor.md put tables outside v0 <!-- longclaw:item=ck_8969414e -->
- [x] Render a real TableBlock, so a reader gets the column the pipes only implied <!-- longclaw:item=ck_de4c8fdc -->
- [x] Take the delimiter row's alignments, and consume the row rather than showing it <!-- longclaw:item=ck_0c1726e6 -->
- [x] Assert the grid the DOM gives, not only the lines <!-- longclaw:item=ck_b70fc214 -->

## Activity

<!-- longclaw:event
id: evt_8dcc19fc
kind: create
occurred_at: 2026-08-07T16:12:05.944Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_76ed91e2
kind: update
occurred_at: 2026-08-07T16:13:37.343Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1a1168cd
kind: update
occurred_at: 2026-08-08T04:53:09.560Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_0058d7be.checked
    from: "false"
    to: "true"
  - field: checklist.ck_86237452.checked
    from: "false"
    to: "true"
  - field: checklist.ck_8969414e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_02e6724b
kind: update
occurred_at: 2026-08-08T08:28:56.122Z
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
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f6be29a0
kind: update
occurred_at: 2026-08-18T07:27:41.538Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: done
    to: in_progress
-->
### Claude Code updated this ticket

Reopening. The fix that closed this is real and I checked it against LC-178's own table before touching anything: nine `break` nodes, not one soft newline left inside a text node, ten lines on screen through the actual `MarkdownView`. The rows are apart. That part works.

It still is not a table. What makes the construct worth writing is that a reader runs their eye *down* a column, and the fallback has no column in it — the pipes land wherever the proportional font puts them, the delimiter row is on screen as a row of dashes, and the rows that carry the most carry the most text, so in a panel this narrow each one wraps and runs back into the one under it. LC-178's State column is over a hundred characters in places. Lines were the unit the fallback could reach and they were not the unit the bug was in.

The scope note in `docs/plans/completed/18-markdown-editor.md` ruled a real `TableBlock` out partly on the grounds that a table appears in one ticket on disk. There are two — LC-166 has a 5×3 of before/after latencies, which is a numeric grid read down a column and the case that note named as what would reopen this. So the decision the third checklist item recorded is the one being reversed, and this ticket is where that happens rather than a new one.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e33a1c2a
kind: update
occurred_at: 2026-08-18T07:28:16.479Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_de4c8fdc.added
    to: Render a real TableBlock, so a reader gets the column the pipes only implied
  - field: checklist.ck_0c1726e6.added
    to: Take the delimiter row's alignments, and consume the row rather than showing it
  - field: checklist.ck_b70fc214.added
    to: Assert the grid the DOM gives, not only the lines
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fc9334ba
kind: update
occurred_at: 2026-08-18T07:28:49.051Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
  - field: checklist.ck_de4c8fdc.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0c1726e6.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b70fc214.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

In review. `TableBlock` is in the union, `readTable` reads cells and alignments, `MarkdownView` renders `<table>`/`<th scope="col">`/`<td>`, and `styles.css` has `.markdown-table`.

The three checklist items above the new ones stay ticked and stay true — that work is what this is built on, and `markdown.test.ts` still holds the claims that a soft-wrapped paragraph joins into one line and a hard break breaks.

Where the tests moved: a table is no longer in the "what happens to everything else" table in `markdown.test.ts`, it is in the documented-constructs one. The new assertions are § "the grid a table becomes" there and § "the grid a reader gets" in `MarkdownView.test.tsx`, which reads the rendered `<tr>`s rather than the node values — the same reason that file exists at all. `npm run verify` is green.

`docs/plans/completed/18-markdown-editor.md` § On tables now records the reversal rather than the exclusion.
<!-- /longclaw:event -->
