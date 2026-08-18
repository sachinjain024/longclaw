---
title: "Markdown write/preview editor"
product: LongClaw
status: completed
backlog_id: V0-12
order: 18
owner_area: Frontend
release_blocking: true
depends_on: "13 (mutate/save), 14 (panel shape)"
---

# Markdown write/preview editor

The description is where a human hands context to an agent, and it is a bare
`<textarea>` (`src/TicketPanel.tsx:529-563`). The approved editor
(`screen-specs.md:176-185`) is a Write/Preview tab strip, a six-button
formatting toolbar, a borderless mono textarea, a rendered CommonMark subset,
and a footer that says where the bytes go.

The must-pass is two claims, and they are tested separately:

1. **Round-trip of every markdown construct the format documents.** Text goes in
   and comes back byte-identical when nobody touched it.
2. **No reformatting of content the user did not touch.** A one-word edit
   produces a one-word diff.

## The rendering decision

There is no markdown library in the repo and this plan does not add one.

**Render to React elements, never to an HTML string.** Ticket descriptions are
written by external agents and by anyone with the file open, and this is a Tauri
webview with IPC access to the filesystem. `dangerouslySetInnerHTML` would make
an injected `<img onerror>` live DOM. Rendering an AST to elements makes that
structurally impossible and means the app needs no sanitizer at all — there is
nothing to sanitize, because no node type in the tree produces markup.

A dependency was considered and rejected. `marked` and `markdown-it` both emit
HTML strings, so they would need a sanitizer beside them; `remark`/`mdast` emits
an AST but drags in ~20 transitive packages, and V0-40 exists because the repo's
Dependabot alert list has stopped being meaningful. The subset below is about 300
lines and covers exactly what the format documents.

## The subset, and what happens to everything else

`docs/file_format.md` calls the ticket body "ordinary CommonMark apart from three
reserved sections" (`:147`) and then shows which constructs a ticket actually
uses. Those, plus what the toolbar writes, are the subset:

| Construct | Where the format asks for it |
|---|---|
| Paragraph | the description in the `ticket.md` example (`:71`) |
| ATX heading `#`–`######` | `## Acceptance criteria` (`:73`), `## Approach`/`## Discoveries` (`:153`), `### Claude Code updated this ticket` (`:118`, `:187`) |
| Bullet list `-` `*` `+` | `- Retries use exponential backoff.` (`:75`) |
| Task list item `- [ ]` / `- [x]` | "ordinary Markdown tasks" (`:130`), and the toolbar's task button |
| Fenced code block | the reserved-heading escape hatch is literally "wrap it in a code fence" (`ticket.rs:744`), and the `valid-fenced-reserved-heading` fixture depends on it |
| Code span | the toolbar's `` ` `` button (`keyboard-focus-map.md:84`) |
| Strong `**`, emphasis `*` | the toolbar's `**` and `*` buttons |
| Link | relative attachment links (`:272`) and the toolbar's link button |
| Hard line break | two trailing spaces, or a trailing backslash |
| Pipe table | not asked for by the format, and written anyway wherever a reader has to scan a column — see [On tables](#on-tables-lc-179) |

Three deliberate exclusions, each with a reason:

- **`_underscore_` emphasis is not emphasis.** This domain writes `created_at`,
  `in_progress`, and `checklist.ck_7d2a.checked`. A sentence naming two of them
  would go italic between them. `*` only.
- **An image renders as its own markdown text, not an `<img>`.** There is no
  attachment UI in v0 (ADR 0005), and loading a remote `![](https://…)` from
  agent-written content would leak that the ticket was opened.
- **Only `http`, `https`, and `mailto` become anchors.** A relative destination
  points into the ticket directory, which the webview cannot open and which
  would navigate the app away from itself; a `javascript:` destination is the
  obvious attack. Everything else renders as the literal `[text](dest)` its
  author typed — readable, and nothing is lost.

Everything outside the subset — thematic breaks, setext headings, raw HTML, HTML
comments — is **not** dropped and **not** executed. It comes out as the paragraph
text its author typed. The editor never writes the tree back, so an unsupported
construct is a rendering gap, never data loss.

(V0-13 moved ordered lists and block quotes into the subset. Tables followed, on
LC-179, and they are the one construct that came in because the fallback could
not carry it rather than because the format asked for it — see
[On tables](#on-tables-lc-179) below.)

## The seams

- `src/markdown.ts` — `parseMarkdown(source): Block[]`. Pure, no React, no DOM.
  The `Block`/`Inline` union has no `html` node, which is the security property
  stated as a type.
- `src/Markdown.tsx` — `<Markdown source headingOffset />`. AST to elements.
  `headingOffset` exists so a `#` inside a panel section becomes an `h4` rather
  than a second `h1`. V0-13 renders comment bodies with this.
- `src/markdownToolbar.ts` — `applyToolbarAction(action, {value, start, end})`.
  Pure string-in/string-out, so the "only the selection moved" property is a
  unit test rather than a DOM test.
- `src/DescriptionEditor.tsx` — the tab strip, the toolbar, the textarea, the
  preview, the footer. The panel keeps the draft and the ref discipline.

## How the two must-pass claims are proved

**Round-trip** lives in Rust, where the durable half is:
`a_description_round_trips_every_construct_the_format_documents` in
`src-tauri/tests/file_format_contract.rs` takes a fixture list of every construct
above, writes each through `TicketDocument::apply`, re-parses, and asserts the
description comes back byte-identical. The frontend half asserts the exact bytes
in the textarea are the exact bytes handed to `editTicket`.

**No reformatting** is the harder claim and the design is what carries it:

- the textarea holds the raw string and nothing normalizes it;
- the preview is a read-only projection built from that string;
- **the saved value is never round-tripped through the parser** — `save()` is
  handed the draft, not a re-render of the tree;
- toolbar actions mutate the selection and its delimiters and nothing else.

The test is deliberately non-canonical markdown — `*` and `-` bullets in one
list, setext headings, four-space indents, trailing whitespace, hard line breaks,
a tab — taken through an unrelated edit, asserting every byte outside the touched
region is identical.

## Accessibility

- Write/Preview is a real tab pattern: `tablist`/`tab`/`tabpanel`, `aria-selected`,
  roving tabindex, arrow keys, Home/End.
- The toolbar is one `role="toolbar"` with roving tabindex, so the panel's Tab
  order (`keyboard-focus-map.md:61`) reaches the textarea in one more press
  rather than seven.
- Six buttons, six accessible names. The glyph is decorative.
- `⌘↵` saves and `Esc` cancels (`keyboard-focus-map.md:82`). Esc must stop
  propagating: today it closes the whole panel from anywhere.

## Watch out for

- `TicketDocument::apply` refuses an edit that changes nothing, so Save stays
  disabled while the draft matches the file.
- The draft lives in a ref because the file can change under the editor. Do not
  move it into the editor component.
- A conflict is not a failed write. The `ConflictBanner` path does not change.
- The comment composer is "avatar + auto-growing field" (`screen-specs.md:193`).
  It does not get this editor.

## Done when

- Both must-pass claims have tests, each confirmed red first.
- `npm --prefix apps/desktop run check` passes.

## Outcome

Shipped as planned, with no dependency added. Four new frontend files and one new
Rust fixture:

- `apps/desktop/src/markdown.ts` — `parseMarkdown(source): Block[]` and
  `linkHref(destination): string | undefined`. ~330 lines, pure.
- `apps/desktop/src/MarkdownView.tsx` — `<MarkdownView source headingOffset
  className />`. **It is not called `Markdown.tsx`**: this filesystem is
  case-insensitive, so `./Markdown` resolved to `markdown.ts` and the component
  came back `undefined` at runtime with a message about default versus named
  imports. Worth knowing before the next `foo.ts` / `Foo.tsx` pair.
- `apps/desktop/src/markdownToolbar.ts` — `TOOLBAR_ACTIONS` and
  `applyToolbarAction(action, {value, start, end})`.
- `apps/desktop/src/DescriptionEditor.tsx` — the surface.
- `fixtures/format-contract/valid-non-canonical-description/` — the fixture both
  Rust tests run against. The corpus picked it up with no test-code change, as
  its README promises, which means its two blanket invariants now cover it too.

### The must-pass

**Round-trip** is `a_description_round_trips_every_construct_the_format_documents`
in `file_format_contract.rs`, over a `DOCUMENTED_CONSTRUCTS` table of seventeen
entries. Each is written through `TicketDocument::apply`, read back from the
document *and* re-parsed from the bytes. Confirmed red by making
`set_description` strip trailing-space hard breaks: the writer's own read-back
guard caught it and refused the write, which is a better failure than a silent
mangle.

**No reformatting** is proved in three places, because it is three different
risks:

- `an_unrelated_edit_never_reformats_the_description` compares the raw
  description region byte-for-byte across nine unrelated mutations. Confirmed red
  by making `apply` rewrite the description unconditionally with tabs expanded —
  nine failures, plus the corpus case.
- `markdownToolbar.test.ts` § "nothing outside the touched region moves" runs all
  six actions over non-canonical markdown and asserts the bytes before and after
  the touched line are identical and the touched line only gained characters.
- `TicketPanel.test.tsx` § "hands the bytes the human typed to the write,
  untouched" takes the same markdown through the editor, twice through the
  preview, and asserts `editTicket` received the exact string.

Seven panel claims were confirmed red first against the plain textarea, and the
two Rust claims against injected defects. The pure modules were written test-first
but their red is trivial (the module did not exist), so they are not claimed as
red-first evidence.

### Decisions taken here that the plan did not have

- **Only `http`, `https`, and `mailto` become anchors.** A relative destination
  now renders as its own markdown text. This was a plan decision but it lands
  harder than expected: `[debug-log.txt](./attachments/att_7d2a-debug-log.txt)` is
  the exact link `file_format.md:272` documents, and the preview shows it as
  source rather than as a link. That is right for v0 — there is no attachment UI
  (ADR 0005) and the webview would navigate the app to a 404 — but it is the
  first thing V0-27 (attachments) should change.
- **`_` is not an emphasis delimiter.** `created_at` and `in_progress` are
  everywhere in this domain.
- **Esc does not clear the conflict banner**, which `keyboard-focus-map.md:82`
  says it should. Cancelling the description draft does not retract the title
  draft that may also be pending, and clearing the banner would take "Keep mine"
  away with it. The banner path is unchanged.
- **The description view is no longer a `<button>`.** A button's content model is
  phrasing content, so it cannot legally contain a heading, a list, or a `<pre>`.
  It is a `div` with a hover-and-focus `Edit description` button, which is the
  keyboard path and the one Tab stop `keyboard-focus-map.md:61` allots.

### On the `confirm` in the Pilot column

The pilot would have been asked to confirm the editor's shape. Having built it,
the shape is not where the risk is — a Write/Preview tab strip with six buttons
is the most conventional thing in the whole product, and nobody will be surprised
by it. The risk is in the **subset**: an agent writes a description with a
numbered list of steps, and the preview shows `1.` `2.` `3.` as literal text.
That reads as a bug to a user even though nothing was lost. If one thing here
gets looked at before v0 ships, it should be whether ordered lists and block
quotes belong in the subset — both are about fifteen lines and neither weakens
either must-pass, and the only reason they are out is that `file_format.md` does
not show one.

### For V0-13

`MarkdownView` is the right thing for comment bodies. `Timeline.tsx:50` renders
`eventProse(event.body)` into a `<p>`; swapping that for
`<MarkdownView source={prose} headingOffset={3} />` gives agent comments their
code fences and lists, with the same no-live-DOM guarantee — which matters more
there than in the description, because a comment body is written by an agent by
definition. The `headingOffset` argument exists for exactly that call.

### On tables (LC-179)

Tables were left outside the v0 subset above, on the reasoning that an
unsupported construct still comes out as its own text. That held in the tree and
broke on screen. A pipe table parses to one paragraph whose text nodes keep the
author's `\n`, and `.markdown` sets no `white-space`, so the webview collapsed a
nine-row table into a single wrapped line with the delimiter row sitting inline
as punctuation. The existing test could not see it: it asserted on node values,
and the `\n` was still in the string.

**The first fix kept the lines, and lines were not the unit.** `readTable`
recognised a header row followed by a delimiter row and emitted `break` nodes
between the rows, so a table stayed as many lines as it was typed. That is a real
improvement over one run-on line and it still did not render a table. What makes
a table worth writing is that a reader can run their eye *down* a column, and
nine lines of pipes in a proportional font have no column in them — the pipes
land wherever the text puts them. The rows that carry the most also carry the
most text, so in a panel this narrow each one wrapped and ran back into its
neighbour, and the delimiter row was still on screen as a line of dashes. LC-179
was reopened on exactly that.

**So the table is a table.** `TableBlock` joins the union as the one node that is
a grid: a header row, body rows, and one alignment per column. `readTable` splits
cells on the pipes the author did not escape, reads `:--`/`:-:`/`--:` off the
delimiter row, and consumes that row rather than showing it — it was never
content, it was the author saying which row was the header and which way each
column reads, and both of those are in the block now. `MarkdownView` renders
`<table>`/`<th scope="col">`/`<td>`, and `styles.css` gained the `.markdown-table`
rules it had never had.

Three decisions inside that are not GFM's:

- **A ragged row is padded, never truncated.** GFM squares a table off by
  dropping the cells that run past the header. Nothing here may drop text an
  author typed — that is the rule the whole fallback list is built on — so the
  widest row sets the width and every other row is padded out to it.
- **A near-miss is still a table.** GFM refuses one whose delimiter row has a
  different cell count from its header. Refusing here would drop that table back
  onto the paragraph fallback, which is the collapse this section is about, so
  the count is squared off instead. The failure mode of being lenient is an empty
  column; the failure mode of being strict is the original bug.
- **No horizontal scroller.** `table-layout: auto` lets the browser measure the
  columns, so LC-178's four-character Time column takes four characters and its
  hundred-character State column takes the rest and wraps inside itself. A table
  that fits beats a table that scrolls in a panel this width, and it also means
  the description gained no scroll region, which would have owed the keyboard a
  stop that `keyboard-focus-map.md` has no reason to describe.

**LC-181 is answered by the structure rather than by a patch.** An escaped `\|`
was indistinguishable from a cell wall because `parseInline` drops the backslash
and nothing above it knew a cell from its boundary. `splitCells` is that
something: it splits on unescaped pipes only and hands the backslash through, so
a pipe the author escaped arrives inside the cell.

**LC-180 is not**, and is not waiting on one either — it was cancelled as
wontfix on 2026-08-11, and this section is where its answer lives now. A
multi-line raw HTML block — `<details>`, its `<summary>`, its closing tag —
still arrives as one line of shown text. Recognising it would mean CommonMark's
HTML-block start conditions, a parsing surface this subset does not have, and
the text is legible as source either way, which was never true of a table. What
would reopen it is a construct whose value is its line structure turning up in a
real description, the way LC-178's table did.

The security invariant is untouched and is still structural. A cell holds
`Inline[]` like every other run of text, so the grid lives in the tree's shape and
never in a string, and no branch gained the ability to produce markup —
`markdown.test.ts` § "still has no node type that could become markup" and
`MarkdownView.test.tsx` § "renders no markup a cell's text happened to spell" are
that claim at both levels.

What is still out: a cell may not hold a block. No fence, no list, no nested
table — GFM's own rule, and also the reason a cell can stay `Inline[]`. The
toolbar writes no table either; a table is something an author types.
