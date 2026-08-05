---
format: longclaw.ticket/v1
id: 75e50191-3a30-4be2-bf12-5d4421b52228
key: LC-12
title: Markdown write/preview editor with the common-formatting toolbar
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:55Z
updated_at: 2026-08-05T14:22:56Z
---

~~Markdown write/preview editor with the common-formatting toolbar~~ **Done 2026-07-31** — the Write/Preview tab strip, the six buttons, the mono textarea and the rendered subset (`src/DescriptionEditor.tsx`), over a CommonMark subset written here rather than taken as a dependency: `src/markdown.ts` parses to a tree with **no `html` node**, and `src/MarkdownView.tsx` renders that tree to React elements. There is no `dangerouslySetInnerHTML` and no sanitizer, because a renderer with no branch that can emit markup has nothing to sanitize — which is what a description written by an external agent, in a webview holding IPC to the filesystem, actually requires. The subset is what `file_format.md` documents plus what the toolbar writes; everything outside it (ordered lists, block quotes, thematic breaks, setext headings, tables, raw HTML) renders as the text its author typed rather than as a blank. Only `http`, `https` and `mailto` become anchors; a relative attachment link and an image render as their own markdown, because v0 has no attachment UI (ADR 0005). `src/markdownToolbar.ts` is the six actions as pure string transforms, which is what makes the no-reformatting claim a unit test. [Plan 18](../../../docs/plans/completed/18-markdown-editor.md)

## Must-pass

Passed both clauses. **Round-trip:** `a_description_round_trips_every_construct_the_format_documents` writes seventeen constructs through `TicketDocument::apply` and reads each back from the document and from the bytes — confirmed red by making `set_description` strip trailing-space hard breaks. **No reformatting:** `an_unrelated_edit_never_reformats_the_description` compares the raw description region byte-for-byte across nine unrelated mutations over a new `valid-non-canonical-description` fixture (setext, three bullet markers, a four-space indent, a tab, trailing-space hard breaks, a table, an HTML comment) — confirmed red by making `apply` rewrite the description unconditionally; plus the toolbar property test over all six actions and the panel test proving the exact bytes typed reach `editTicket`. Seven panel claims confirmed failing first against the plain textarea. **Three things worth a look:** the preview shows `1.` and `>` as literal text, which reads as a bug even though nothing is lost, and the plan argues that is where the `confirm` risk actually sits rather than in the editor's shape; `Esc` does not clear the conflict banner as `keyboard-focus-map.md:82` says it should, deliberately, because that would take "Keep mine" away from a title draft that is also pending; and `Markdown.tsx` had to become `MarkdownView.tsx` because this filesystem is case-insensitive and `./Markdown` resolved to `markdown.ts`. **Amended 2026-08-01 by V0-13:** the first of those three is closed. `markdown.ts` and `MarkdownView.tsx` now render **ordered lists and block quotes** — `ListBlock` carries `ordered` and `start` so `<ol start="7">` keeps the author's own numbering, and a new `BlockquoteBlock` holds parsed blocks so a quoted list is a list. Two CommonMark rules went in deliberately: only a `1.` may interrupt a paragraph, so "shipped in\n1985. A good year." stays prose; and a `>`-less line ends a quote rather than being absorbed as a lazy continuation. Both of this row's must-pass properties are intact — still no `html` node, and the editor still never writes the tree back, so the byte-for-byte no-reformatting test is untouched. It cost one assertion here: `shows the whole document in the preview, rendered or not` asserted `> a block quote` was literal text and now asserts the element. V0-13 needed it because a timeline comment is agent-written by definition and numbered steps are what an agent writes

## Source

`docs/backlog/v0-backlog.md` — **V0-12**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed both clauses. Round-trip: a_description_round_trips_every_construct_the_format_documents writes seventeen constructs through TicketDocument::apply and reads each back from the document and from the bytes — confirmed red by making set_description strip trailing-space hard breaks. No… <!-- longclaw:item=ck_d7998d63 -->

## Activity

<!-- longclaw:event
id: evt_71180605
kind: create
occurred_at: 2026-08-05T14:22:55Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_866b97d8
kind: update
occurred_at: 2026-08-05T14:22:56Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d7998d63.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-12 is recorded there as passed.
<!-- /longclaw:event -->
