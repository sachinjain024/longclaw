---
format: longclaw.ticket/v1
id: cf8f567b-5a59-409f-8810-07b29ff3826a
key: LC-189
title: Design-doc line citations had drifted, and nothing checked them
status: in_review
priority: p2
labels:
  - design
created_at: 2026-08-09T14:39:10.942Z
updated_at: 2026-08-09T14:39:10.942Z
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
