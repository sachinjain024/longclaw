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
updated_at: 2026-08-08T04:53:09.560Z
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

## Checklist

- [x] Keep the author's line breaks in the unsupported-construct fallback, so a table stays as many lines as it was typed <!-- longclaw:item=ck_0058d7be -->
- [x] Assert rendered line structure in a test, because the current one passes against a collapsed line <!-- longclaw:item=ck_86237452 -->
- [x] Decide whether a real TableBlock is in scope, and record that where 18-markdown-editor.md put tables outside v0 <!-- longclaw:item=ck_8969414e -->

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
