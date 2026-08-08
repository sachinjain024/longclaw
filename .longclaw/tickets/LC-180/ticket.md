---
format: longclaw.ticket/v1
id: 4b23309d-c23d-4347-8451-5252c5526bc9
key: LC-180
title: A multi-line raw HTML block collapses onto one line
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-08T08:05:56.718Z
updated_at: 2026-08-08T08:05:56.718Z
---

A multi-line raw HTML block collapses onto one line, the way a table did before LC-179.

`markdown.ts` renders raw HTML as text, on purpose and structurally — there is no `html` node in the union, so no branch could produce markup (`markdown.ts:6-11`). The claim that made that acceptable is that the text still comes back as the text its author typed. LC-179 found that claim is about lines, not characters: `.markdown` sets no `white-space`, so a `\n` left inside a text node is a space on screen.

LC-179 fixed the table, which was the construct the report was written about, and left this one recorded as accepted (`docs/plans/completed/18-markdown-editor.md`, `### On tables (LC-179)`). What is left is any raw HTML block longer than a line:

```
<details>
<summary>The trace</summary>
…
</details>
```

That arrives as `<details> <summary>The trace</summary> … </details>` on one wrapped run. Nothing is lost and nothing executes — but a reader looking at HTML source reads it by its line structure, and the closing tag no longer sits under the opening one.

It is a smaller harm than the table's. A table's value *was* its columns; HTML source stays legible as characters either way, which is why LC-179 did not stretch to cover it. The reason it is filed rather than closed is that the fallback now keeps lines for one construct and not another, and the difference is invisible from the code — a reader of `readTable` has no way to tell whether raw HTML was considered and refused or simply missed.

The cost is the reason it was deferred: recognising an HTML block means CommonMark's [HTML block start conditions](https://spec.commonmark.org/0.31.2/#html-blocks) — seven of them, with their own end conditions — which is a parsing surface this subset does not have and which exists to decide something the subset does not care about, since the answer is "text" either way. A cheaper shape may be enough: a run of consecutive lines where the first opens with `<` and nothing else in the run parses as a supported block could keep its breaks without any of that machinery being right.

No ticket on disk holds a multi-line HTML block today, so this is speculative until one does. LC-178's table was the same kind of rare, right up until it was written.

## Checklist

- [ ] Decide whether a multi-line raw HTML block keeps its lines, or whether the table stays the only construct that does <!-- longclaw:item=ck_d944ae05 -->
- [ ] If it does: keep the breaks without importing CommonMark's HTML block start conditions <!-- longclaw:item=ck_227a8b8c -->
- [ ] Assert it in lines on screen, in MarkdownView.test.tsx, not in node values <!-- longclaw:item=ck_f51fe96b -->

## Activity

<!-- longclaw:event
id: evt_e2ac5e7d
kind: create
occurred_at: 2026-08-08T08:05:56.718Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
