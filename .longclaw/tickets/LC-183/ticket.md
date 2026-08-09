---
format: longclaw.ticket/v1
id: 847d481d-d810-4136-89f8-3a5e15da4b8c
key: LC-183
title: "Acknowledgement, not Fresh: the app's freshness vocabulary diverges from the glossary"
status: done
priority: p3
labels:
  - frontend
created_at: 2026-08-09T00:04:39.938Z
updated_at: 2026-08-09T00:21:19.158Z
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

- [x] Decide whether the design-system token names move with the app's, or whether the glossary's Avoid is scoped to prose <!-- longclaw:item=ck_78b2fe2d -->
- [x] Rename the module, its exports and the CSS classes in one sweep — never half a layer <!-- longclaw:item=ck_4a868e67 -->
- [x] Update the theme-matrix and a11y probes that name these selectors <!-- longclaw:item=ck_3b7ded77 -->
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

<!-- longclaw:event
id: evt_fe3fc635
kind: update
occurred_at: 2026-08-09T00:21:19.158Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_78b2fe2d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4a868e67.checked
    from: "false"
    to: "true"
  - field: checklist.ck_3b7ded77.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_85c683ee
kind: comment
occurred_at: 2026-08-09T00:21:19.181Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Done on the LC-146 → LC-148 branch rather than separately, at the user's call.

**The decision the ticket asked for:** the design system's names move with the app's. The glossary's `_Avoid_` binds identifiers, not only prose — a token called `accent-agent-fresh-ring` teaches the avoided word to everyone who reads the stylesheet.

**What moved.** `freshness.ts` → `acknowledgement.ts`; `isFresh` → `isAcknowledged`; `FRESH_WINDOW_MS` → `ACKNOWLEDGEMENT_WINDOW_MS`; `freshlyChecked` → `newlyChecked`; `FRESH_CARD_HEIGHT`/`_STRIDE` → `ACKNOWLEDGED_CARD_*`. The classes became `.acknowledged` plus `.acknowledged-agent` / `-human` / `-unknown` (the accent now trails the state rather than leading it, so they sort together), and `.fresh-note` → `.acknowledged-note`. The tokens became `accent-agent-acknowledged-ring`/`-border`, `warn-acknowledged-*`, `mix-acknowledged-ring`, `size-board-card-acknowledged` — in **both** token sources, the app's and the design system's, each regenerated from its own `build.mjs`.

**And the docs that pin them**, which is why this was its own ticket: `states.md`, `components.md`, `screen-specs.md`, `prototype.css`, `prototype.js`, both proof pages, `data-requirements.md`, `render.mjs` and the glyph sheet's comment. The prototype is a standalone artifact, so its own state field, helper and emitted class strings moved together or not at all.

**Left alone deliberately:** the ordinary English word where it is not this concept — `refreshing`, "a fresh mount", "read fresh from disk", "Fresh per test" — and the dated records under `docs/plans/completed/` and `docs/acceptance/`, which are history. Where a *living* doc named a moved symbol I repointed the reference and left the narrative, because a stale path is a broken link.

**Two things the sweep exposed.** `components.md:192`/`:193`/`:207`/`:213-215` were already stale on `origin/main` by ~27 lines — nothing to do with this — and are now repointed to `:218`, `:219`, `:234-238`, `:258-260`. And § 17 of `cc_screens_diff.md` is now "agent acknowledgement"; LC-146 → LC-148 quote the old heading in their Source lines, but they identify the rows by D-number, so the pointers still resolve.

Verified by the probes rather than by reading: `matrix` fails any probe that matches nothing, and it is clean on 8 axes × 9 states with every renamed selector — so the rename is wired end to end rather than silently hollowed. `a11y:audit` Part A passes, and its A4 row reads `.ticket-row.acknowledged`.
<!-- /longclaw:event -->
