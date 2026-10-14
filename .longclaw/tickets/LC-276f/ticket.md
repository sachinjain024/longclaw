---
format: longclaw.ticket/v1
id: 684b2158-bd79-433e-b77e-2ebfe35930d4
key: LC-276f
title: "Add the lc-build-prototype skill: a reviewable HTML UX prototype from a spec or ticket"
status: in_review
priority: none
labels:
  - design
created_at: 2026-10-14T08:08:19.257Z
updated_at: 2026-10-14T08:13:18.759Z
---

A prototype under `docs/ux/prototypes/` is meant to let a person see a feature standing in the real app, and give design and product feedback, before any of `src/` changes. Each one so far was built from memory and from the last one. The vendored `prototype` skill aims somewhere else: it builds variants as a route inside the app and keeps them on a throwaway branch.

`lc-build-prototype` (`.agents/skills/lc-build-prototype/`) takes a ticket key or a spec path and writes `docs/ux/prototypes/<KEY>-<Title>.html`. It starts from a template that already has:

- the app's tokens and styles;
- a driver bar with scene, appearance, the five accent themes, window width and per-scene controls;
- a copy deck rendered from one `COPY` object;
- a review panel on each scene, with the questions the reviewer should decide and a feedback box;
- a Feedback scene that turns every note into Markdown to paste into the ticket.

Every step ends on a checkable criterion: every UI-facing story drawn, every string read through the deck, both appearances looked at. `REVIEW.md` covers taking feedback, and when the review settles it writes the decisions and the deck into the ticket and deletes the file.

## Activity

<!-- longclaw:event
id: evt_50aa2d8a
kind: create
occurred_at: 2026-10-14T08:08:19.257Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef3fe1fe
kind: update
occurred_at: 2026-10-14T08:13:18.759Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: description
-->
### Claude Code updated this ticket

Skill, template and REVIEW.md written. The template was smoke-tested in Chrome: tokens load, light and dark, theme switch, arrow keys between scenes, feedback saved and exported as Markdown, no console errors. npm run verify is green.
<!-- /longclaw:event -->
