---
format: longclaw.ticket/v1
id: cf8f567b-5a59-409f-8810-07b29ff3826a
key: LC-189
title: Design-doc line citations had drifted, and nothing checked them
status: done
priority: p2
labels:
  - design
created_at: 2026-08-09T14:39:10.942Z
updated_at: 2026-08-11T11:32:51.840Z
---

The four design docs are cited by line number from ~413 places, including the
app's own source comments, and nothing checked those numbers. `screen-specs.md`
closes by asking that edits occupy exactly the lines they replace, for that
reason — but it was a note, not a gate, and three changes ignored it: the ADR
propagation, LC-73's sidebar rewrite, and LC-188's mid-document section. Each
inserted prose and shifted everything below it while the citations stayed put.

160 citations were pointing at the wrong prose. `RawFileView.tsx` named the
board's empty state; `yaml.rs` named a blank line; the palette's own comments
named the ticket panel. Nobody noticed for months, because a stale line number
reads exactly like a fresh one and no test loads a Markdown file.

## What was done

Every citation was resolved against the document **as it stood when that citing
line was written** — blame the line, read what sat at the number it named then,
find where that text lives now — so the correction restores the author's intent
rather than guessing from topic. That distinction earned its keep: a citing line
reformatted after its citation was written makes blame read an already-drifted
document, and several citations turned out to have been wrong on the day they
were typed rather than drifting later. Nineteen needed hand resolution.

`citation-guard.mjs` then pins every cited line of the four documents to its
text in `citation-lock.json` and fails when that text moves, naming the line it
moved to so re-pointing is mechanical. It runs in `npm run check`.

## Open

`file_format.md` and `data-requirements.md` are cited 14 times between them and
were never audited, so they are on the structural checks (in range, not
reversed) rather than pinned. Auditing them the same way promotes them and
retires the two-tier split.

## Activity

<!-- longclaw:event
id: evt_655ef1db
kind: create
occurred_at: 2026-08-09T14:39:10.942Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3f7ef254
kind: comment
occurred_at: 2026-08-10T04:54:41.226Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The open item is closed: `file_format.md` and `data-requirements.md` are audited and pinned, so all six line-cited documents are now locked and the two-tier split is retired.

The audit found no drift in either — every citation still matched the text it was written against, which is what `.md` files nobody inserts into look like. One citation was wrong on its own terms rather than moved: `file_format.md:213-231`, cited from `labels.ts` and `ProjectSettings.tsx` for "a ticket stores slugs and nothing else", began at `name: Sachin Jain` inside the `people:` block. Tightened to 214-231, where `labels:` starts.

That is the reason pinning follows auditing rather than replacing it: a lock generated a day earlier would have frozen that range and called it clean forever.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6bcedfaa
kind: update
occurred_at: 2026-08-11T11:32:51.840Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
