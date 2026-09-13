---
format: longclaw.ticket/v1
id: 4a7c3fda-7466-40d8-83e0-533eaa22f5ab
key: LC-251v
title: Nothing checks that an element uses the right token, only that it uses one
status: todo
priority: p2
labels:
  - design
  - frontend
created_at: 2026-09-11T08:49:19.199Z
updated_at: 2026-09-11T08:49:19.199Z
---

`color-guard.mjs` fails the build on a literal hue. `token-guard.mjs` fails it on
a literal radius or duration. Between them the app cannot hardcode a value that
belongs to the scale — which was LC-34's job, and it is done.

What neither can see is a **legal token applied to the wrong kind of element.**
`.confirm-dialog` draws at `var(--lc-radius-panel)`; the design system says
modals are `--radius-modal`. Every guard passes, because a token was used. The
rule that was broken is semantic, and nothing in the repo encodes it.

## The rules exist already — pointed the wrong way

The design system ships `_adherence.oxlintrc.json`: raw-px and raw-hex bans,
per-component prop whitelists, allowed font families, and the canonical token
list (`--radius-modal` among them). It lints **the design project's** components.
It has never run against `apps/desktop/src`, and `npm run check` has no
adherence pass at all.

## The sync layer is half-generated

`design:emit` writes `claude-design/{themes,colors,typography}.css` and
`design:check` fails the build if they drift. That is three of the five token
files. **`spacing.css` — the radius scale, the space scale, shadows and motion —
is hand-authored on both sides** and agrees today by inspection rather than by
construction. The rule this ticket is about lives in that file.

## And there is no Dialog component

The system's manifest lists 16 components; none is a Dialog or Modal. So the
LC-249a canvas drew its dialog freehand with inline styles — `width: 452px`,
`padding: 22px 22px 16px`, and raw hexes in the terminal block, none of which are
on any scale. A design with no component to be checked against cannot drift from
one, and cannot be held to one either.

## What would have caught it

A guard that maps **element kind → required token** and fails on a legal-but-
wrong one: a modal must take `--lc-radius-modal`, a card `--lc-radius-card`, a
control `--lc-radius-control`. It belongs beside `token-guard.mjs` in
`tokens:check`, and it needs the `--self-test` inversion this repo asks of every
guard — `citation-guard` and `a11y:audit` both carry one, and two of the first
a11y probes were blind until theirs was run.

## Checklist

- [ ] A guard maps element kind to required token — modal to --lc-radius-modal, card to --lc-radius-card, control to --lc-radius-control — and fails on a legal token applied to the wrong kind, which is the case color-guard and token-guard both pass today <!-- longclaw:item=ck_b7146ab8 -->
- [ ] The guard carries a --self-test inversion that breaks the build on purpose and fails if a row still passes, the way citation-guard and a11y:audit do — two of the first a11y probes were blind until theirs was run <!-- longclaw:item=ck_cae17c05 -->
- [ ] It runs inside tokens:check beside token-guard.mjs rather than as a separate command nobody remembers, since that is where the other two literal guards already live <!-- longclaw:item=ck_9c094079 -->
- [ ] spacing.css is either emitted by design:emit like themes, colors and typography, or is declared hand-authored on purpose with the reason recorded — the radius scale currently agrees on both sides by inspection rather than by construction <!-- longclaw:item=ck_82ac723b -->
- [ ] The absent Dialog component is settled: either the design system gains one so the next dialog design is not drawn freehand, or it is recorded why the app's modals have no kit counterpart and what governs them instead <!-- longclaw:item=ck_1d56024a -->
- [ ] npm run verify passes with the run quoted, and the guard is shown failing against the confirm-dialog radius before that fix lands <!-- longclaw:item=ck_ebf59ccb -->

## Activity

<!-- longclaw:event
id: evt_47a9627d
kind: create
occurred_at: 2026-09-11T08:49:19.199Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
