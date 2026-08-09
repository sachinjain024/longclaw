---
format: longclaw.ticket/v1
id: 847d481d-d810-4136-89f8-3a5e15da4b8c
key: LC-183
title: "Acknowledgement, not Fresh: the app's freshness vocabulary diverges from the glossary"
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-09T00:04:39.938Z
updated_at: 2026-08-09T00:04:59.042Z
---

`CONTEXT.md:31-33` defines the domain term **Acknowledgement** — "the visible,
decaying treatment the app gives a ticket that changed externally and has not
been reviewed" — and lists `Fresh` as a word to *avoid*. The app speaks the
avoided word nearly everywhere this concept appears.

Found during LC-146 → LC-148's review. That branch renamed the identifiers it
introduced (`acknowledgementClass`, `acknowledgedChecks`, `checklistAcknowledged`,
`externallyCheckedIds`) and deliberately left the rest, because the rest is not a
rename of code alone.

## What still says Fresh

- `src/freshness.ts` — the module itself, plus `isFresh`, `FRESH_WINDOW_MS`,
  `isPulsing`'s neighbours, and `freshlyChecked`.
- `.fresh`, `.agent-fresh`, `.human-fresh`, `.unknown-fresh` and `.fresh-note` in
  `styles.css`, and the same strings in `Board.tsx`, `IssueList.tsx`,
  `TicketPanel.tsx`, their tests, and `perf/theme-matrix.mjs`'s probes.
- `--lc-accent-agent-fresh-border`, `--lc-accent-agent-fresh-ring`,
  `--lc-warn-fresh-*`, `--lc-mix-fresh-ring`, `--lc-size-board-card-fresh`.

## Why it is its own ticket

The token names are the hard part. `accent-agent-fresh-border` and
`accent-agent-fresh-ring` are pinned **by name** in
`docs/design/prototype/states.md:150-151` and
`docs/design/foundations/components.md:202`, and they appear in the frozen
prototype artifacts under `docs/design/prototype/prototype.css` and
`docs/design/foundations/proof/`. Renaming the app's tokens without those is the
drift `tokens:check` exists to prevent; renaming those too is an edit to the
design system's own record, which wants a decision rather than a sweep.

Half-migrating one layer is worse than either end: a stylesheet where some
classes say Fresh and some say Acknowledged reads as two concepts rather than one
badly named one.

## Approach

1. Decide whether the design system's token names move with the app's, or whether
   the glossary's `_Avoid_` is scoped to prose and product copy rather than to
   token identifiers. That decision is the ticket; the sweep is mechanical after
   it.
2. If they move: rename in `design-tokens.json` / `build.mjs`, `states.md`,
   `components.md`, `prototype.css` and the proof HTML, then the app.
3. `perf/theme-matrix.mjs` names several of these selectors in its probes and
   will go red loudly, which is the safety net.


## Checklist

- [ ] Decide whether the design-system token names move with the app's, or whether the glossary's Avoid is scoped to prose <!-- longclaw:item=ck_78b2fe2d -->
- [ ] Rename the module, its exports and the CSS classes in one sweep — never half a layer <!-- longclaw:item=ck_4a868e67 -->
- [ ] Update the theme-matrix and a11y probes that name these selectors <!-- longclaw:item=ck_3b7ded77 -->
## Activity

<!-- longclaw:event
id: evt_702ee45f
kind: create
occurred_at: 2026-08-09T00:04:39.938Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_90f975ab
kind: update
occurred_at: 2026-08-09T00:04:59.042Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_78b2fe2d.added
    to: Decide whether the design-system token names move with the app's, or whether the glossary's Avoid is scoped to prose
  - field: checklist.ck_4a868e67.added
    to: Rename the module, its exports and the CSS classes in one sweep — never half a layer
  - field: checklist.ck_3b7ded77.added
    to: Update the theme-matrix and a11y probes that name these selectors
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
