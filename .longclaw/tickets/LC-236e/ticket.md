---
format: longclaw.ticket/v1
id: f0085d76-29f3-44a3-bf3f-fd6401174b52
key: LC-236e
title: Define a new label from inside the create flows
status: done
priority: none
labels:
  - frontend
  - product
  - release
created_at: 2026-08-28T04:12:09.099Z
updated_at: 2026-09-08T08:25:43.938Z
---

Both create surfaces can attach labels and neither can define one. `LabelMenuButton` lists exactly what `longclaw.yaml` defines plus any slug the ticket already carries, so on a project whose `labels:` map is empty — a fresh project, or one whose vocabulary has not been written yet — the menu opens on nothing and there is no way forward from inside the flow. Defining a label is only in project settings, which means leaving the half-typed ticket, opening settings, adding the slug, coming back and starting again.

The gap is the same in both surfaces and should close in both:

- **Quick create** (`QuickCreate.tsx:285`) — the meta row's label menu.
- **Full create through the editor** (`CreatePanel.tsx:304`) — the `Labels` row.

## What to build

Give `LabelMenu` a create affordance — a row in the popover that defines a new label and ticks it onto the ticket being written, in one gesture. The write already exists on both sides — `addProjectLabel` (`api.ts:126`), `add_label` down through `app_state.rs:94`, `registry.rs:158` and `core/project.rs:160`, and `longclaw label add` on the CLI. This is a control, not a new capability.

**One field, not three.** The row asks for a display name, derives the slug from it, and shows the derived key as muted text under the field rather than as a second input. The colour defaults and can be picked from `LABEL_COLORS` (`labels.ts:22`) without leaving the row. The common case is a name and Enter.

This inverts what this ticket first asked for — a slug field with the name defaulted from it. Asking a human to author a key is the wrong way round: the name is what they know, and the key falls out of it.

## Why the slug is derived but not hidden

The obvious next step from "derive it" is "hide it entirely, it is a backend detail". That one is wrong here, because a slug is not an internal id:

- **`longclaw.yaml` is a user-facing file.** The slug is a map key in a file the user owns, diffs and merges. There is no layer it hides behind.
- **The CLI takes slugs**: `--label <slug>`, `longclaw label add --slug`. This repository's own `AGENTS.md` and `docs/agents/triage-labels.md` are hand-written tables of them.
- **An undefined slug is drawn as the chip's own text** (`LabelChip.tsx:35-40`), on a card, to a user who never asked to see a key. That fallback is legible only because slugs read as words; a generated `backend-2` on a card is not.

The failure modes also get worse when the key is off screen:

- **A collision is a refusal, and the refusal has to name a key.** "Back-end" and "Back end" both derive to `back-end`. That reads as obvious when the derived key is updating on screen as the user types, and as inexplicable when it is not.
- **A name may derive to nothing.** `is_label_slug` (`core/project.rs:343-359`) wants an ASCII lowercase first character, so a name in Japanese, or one that starts with a digit, produces no valid key at all. The visible line carries the rule instead — `Label Name must start with a letter [a-z]`, in red, where the key would be — rather than a bounce with no cause on screen. The name is then the only way forward, which is a dead end for a name with no Latin in it at all; see the prototype note.
- **Hidden plus immutable drifts in silence.** A slug cannot be renamed and must not become renameable (`file_format.md:231`, plan 15's settled design). Hide it, and people rename labels freely — correctly, since it is only a display name — while the key stays whatever the first name happened to derive to. A year on, `labels: { backend: { name: "Platform / Infra" } }` still answers to `--label backend`, and nothing on screen ever said so.

So: the derived key is shown as the quiet consequence of what was typed, and read-only — review settled that in the prototype. A key on screen is always the key the name produces, which is the only version of this row that can promise it.

## The derivation

One exported function in `labels.ts`, so the create row and the settings row cannot disagree about it: lowercase, trim, collapse each run of characters outside `[a-z0-9]` to a single `-`, drop a leading and trailing `-`, and return empty when nothing survives. Both `-` and `_` are legal in the grammar; pick `-`. Rust keeps owning validation (`ProjectSettings.tsx:636`) — the derivation only proposes a key, `is_label_slug` still decides whether it is one.

## What the change has to respect

- **A slug is immutable once a ticket carries it.** `LabelMenu`'s header comment says it never edits a slug, and that stays true — this adds one, it does not rename one. Deriving is not renaming: the key follows the name while the row is open, and is fixed the moment the definition is written.
- **Defining a label is a project write, and it lands immediately.** The label outlives an abandoned draft: someone who defines `infra` and then closes quick create without creating a ticket has still changed `longclaw.yaml`. Decide that deliberately and say so in the comment; the alternative — holding the definition until the ticket is created — makes the ticket write conditional on a second write and is worse.
- **The green band is not on the ramp** (`labels.ts:17-21`) — green belongs to the agent, and the new colour picker must not reach for one.
- **A duplicate slug is a refusal, not a silent no-op.** `ProjectSettings.tsx:74` already routes the add-a-label row's failure through `onWrite`; the create surfaces need the same refusal path rather than a menu that quietly does nothing, and the message names the derived key that collided.
- **`tabIndex` is explicit.** The new row's button and any checkbox in it need `tabIndex={0}` or `-1`, or `npm run check` fails (`scripts/tab-order-guard.mjs`).
- **The keyboard contract covers the popover.** A text field inside an anchored `Menu` is new — the menu's existing key handling assumes rows, so typing in the field must not steer the list or close the popover. Update `keyboard-focus-map.md` in place and run `npm run a11y:audit`.

## Not in scope

Renaming, recolouring and removing definitions stay in project settings, and no rename-slug command comes out of this. The settings add-row is in scope for one thing only: adopting the shared derivation, so that the two places a label can be defined do not disagree about whether a human types a key (`ProjectSettings.tsx:702-704` asks for one today).

## Checklist

- [x] Generate the UX prototype <!-- longclaw:item=ck_45d890d4 -->
- [x] slugFromName() in labels.ts: NFD fold, lowercase, each run outside [a-z0-9] collapsed to a single -, ends trimmed; empty, punctuation, diacritic and non-ASCII cases tested <!-- longclaw:item=ck_7e10ce87 -->
- [x] Menu gains a footer slot and a wide flag, and the popover carries its wider width from the moment it opens - usePopoverPlacement measures once and clamps nothing <!-- longclaw:item=ck_f0cc134c -->
- [x] Define row in the LabelMenu popover: collapsed "New label", one name field, the read-only key line beneath it (hint / key / rule in red), colour from LABEL_COLORS defaulting to the first hue the project is not using <!-- longclaw:item=ck_02993786 -->
- [x] A collision is refused in the row while typing - {key} already exists for {Label} - and never a toast; Add label stays disabled until a key can be written <!-- longclaw:item=ck_3e29245b -->
- [x] An empty project opens the popover with the define row already expanded and the caret in it <!-- longclaw:item=ck_f9c2603b -->
- [x] Wire it in quick create (QuickCreate.tsx) so a new slug is defined and ticked in one gesture <!-- longclaw:item=ck_0e335d84 -->
- [x] Wire the same row into full create's Labels row (CreatePanel.tsx) <!-- longclaw:item=ck_c90eb922 -->
- [x] ProjectSettings' add-a-label row adopts the derivation and the same colour default; its slug input goes, so nobody authors a key <!-- longclaw:item=ck_ca079284 -->
- [x] A refused write lands on the danger toast, not ErrorBanner: writeProjectFile ends a failure at setError, which draws at board level under the modal scrim <!-- longclaw:item=ck_f83e5c14 -->
- [x] The define stop joins the menus roving group: arrow-down past the last label reaches it, the collapsed button when closed and the name field when open <!-- longclaw:item=ck_33034160 -->
- [x] Add label, the colour trigger and its eight swatches carry an explicit tabIndex; npm run check <!-- longclaw:item=ck_6e2d195e -->
- [x] Menu.onKeyDown returns early for events from a field, so j/k/arrows/Enter are the row's; Esc walks the ladder colours - row - menu - modal; keyboard-focus-map.md edited in place and citations re-pointed <!-- longclaw:item=ck_c1a2bf82 -->
- [x] npm run a11y:audit, and npm run verify <!-- longclaw:item=ck_04b987c3 -->

## Activity

<!-- longclaw:event
id: evt_70f9674c
kind: create
occurred_at: 2026-08-28T04:12:09.099Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7c3b4e59
kind: update
occurred_at: 2026-08-28T23:50:14.110Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_02993786.text
    from: "Add a define-a-label row to the LabelMenu popover: slug, name, colour from LABEL_COLORS"
    to: "Add a define-a-label row to the LabelMenu popover: name field, derived slug shown beneath it, colour from LABEL_COLORS"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5bb963ed
kind: update
occurred_at: 2026-08-28T23:50:25.459Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f83e5c14.text
    from: Route a duplicate or refused slug through the write-feedback path rather than a silent no-op
    to: Route a duplicate or refused slug through the write-feedback path, naming the derived key that collided
  - field: checklist.ck_7e10ce87.added
    to: "slugFromName() in labels.ts: lowercase, non-alphanumerics to a single -, trimmed; empty, punctuation and non-ASCII cases tested"
  - field: checklist.ck_ca079284.added
    to: Adopt the same derivation in the ProjectSettings add-a-label row so the two definition surfaces agree
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_74483864
kind: update
occurred_at: 2026-08-28T23:50:34.009Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7e10ce87.moved
    from: "8"
    to: "1"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_23e789d3
kind: update
occurred_at: 2026-08-28T23:50:34.030Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ca079284.moved
    from: "9"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5bc8a491
kind: update
occurred_at: 2026-09-07T14:05:03.388Z
actor:
  type: human
  id: local
changes:
  - field: labels
    from: frontend, product
    to: frontend, product, release
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a58ea2d7
kind: update
occurred_at: 2026-09-07T14:05:57.313Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_45d890d4.added
    to: Generate the UX prototype
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6a856e07
kind: update
occurred_at: 2026-09-07T14:06:00.625Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_45d890d4.moved
    from: "10"
    to: "1"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0cfcb206
kind: update
occurred_at: 2026-09-07T14:21:24.770Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_45d890d4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b3ab6b53
kind: comment
occurred_at: 2026-09-07T14:21:40.536Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

UX prototype: `docs/ux/prototypes/LC-236e-Define-A-New-Label-From-Inside-The-Create-Flows.html` — open it in a browser, no build. It drives all three surfaces (quick create, full create, the settings add-row) against a live `longclaw.yaml` pane.

Five things it leaves for review, listed in its notes column: the *tick it instead* offer beside a collision (more than this ticket asked for), whether the colour should default to the first unused hue rather than blue, whether the derivation should fold diacritics (without it `Café` gives `caf`), whether the toast gets an Undo, and whether the define row joins the menu's roving group so `↓` reaches it.

Two findings the build will hit: (1) a create-surface refusal cannot use `ErrorBanner` — `writeProjectFile` ends a failure at `setError`, which draws at board level under the modal scrim, so it has to be the danger toast or stay in the row; (2) the popover must carry its wider min-width from the moment it opens, because `usePopoverPlacement` measures once and clamps nothing, so widening on expand would run off the right edge in full create and stay there.

One correction to this ticket's own prose: it says "Back-end" and "Back end" both derive to `backend`. Under the derivation the ticket itself specifies — collapse each run to a single `-` — they both derive to `back-end`. They still collide, so the argument stands; only the key named in the example is wrong.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9a17c506
kind: comment
occurred_at: 2026-09-08T06:30:16.256Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype revision 2, from review:

1. **The flicker is fixed, and it was the harness lying about the design.** Typing called `render()`, which rewrites the overlay whole — so the field was destroyed and rebuilt per character, the popover replayed its `lc-menu-in` animation each time, and the caret jumped to the end of the text. React keeps the field mounted and re-renders the line under it; the prototype now patches the key line, the refusal and the Add button in place and touches nothing else.

2. **The key is read-only.** No pencil, no key field, in either surface. This overturns the ticket's "editable while the row is open" and re-opens the hole that clause was written to close: a name that derives to nothing — Japanese, Greek, Cyrillic — is now a dead end inside the create flow, and inside settings too once that row adopts the same derivation. A name that derives to an invalid key still has a way out through the name (`2026 goals` fails, `Goals 2026` works), so only the no-ASCII case is stranded. Filed as the first open question in the prototype's notes with three ways out, none free. The NFD diacritic fold is now load-bearing rather than nice: `Café` → `caf` is no longer something the person can correct.

3. **The settings add-row stacks the key under the name field**, matching the create surfaces, rather than putting it in the `code` column of the four-column grid. The rows above show a key that is already a fact; this row shows one still following what is being typed, and one column would have said they were the same kind of thing.

61 assertions pass in a jsdom driver over the file, including that the field node survives a keystroke and the caret holds its position.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_519bd90c
kind: comment
occurred_at: 2026-09-08T07:00:25.266Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype revision 3 — reviewed copy, settled by the user.

The strings, as they now render:

| State | Key line | Line under it |
|---|---|---|
| nothing typed | `Label key (auto-generated)` (muted) | — |
| a key | the key | — |
| a key that collides | the key | `{key} already exists for {Label}. Please provide a new Label name.` |
| no key can be made | `Label Name must start with a letter [a-z]` (red) | — |

The collapsed row reads `New label`. `Tick it instead` was removed: a refusal that also acts is two things, and the row it would have ticked is on screen directly above the message.

Two decisions inside that table are worth carrying into the build.

**Both ways a name fails to make a key look identical.** `日本語` derives nothing; `2026 goals` derives `2026-goals`, which is not a slug. The row no longer distinguishes them — same sentence, same slot, same tone — because there is one thing to do about either and it is the name. `state()` collapsed to one `refused` kind as a result.

**The rejected string is not drawn.** This reverses what revision 1 argued: the key's slot never holds something that is not a key, and with the key read-only a rejected derivation is not actionable. The ticket's "the refusal has to name a key" still holds everywhere a key exists — a collision names it.

Which leaves the two lines divided cleanly: the key line says whether a key can be made, the line under it says the one thing that can be wrong with a key that was. So the second line is only ever a collision. That closes the open question revision 2 raised about which slot owns the rule.

Still open and unanswered: the no-ASCII dead end, the `Label name` / `Display name` placeholder split between the popover and settings, the colour default, the NFD fold, the missing Undo, and whether the define row joins the menu's roving group.

67 assertions pass in the jsdom driver.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_56148eb5
kind: update
occurred_at: 2026-09-08T07:20:08.752Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7e10ce87.text
    from: "slugFromName() in labels.ts: lowercase, non-alphanumerics to a single -, trimmed; empty, punctuation and non-ASCII cases tested"
    to: "slugFromName() in labels.ts: NFD fold, lowercase, each run outside [a-z0-9] collapsed to a single -, ends trimmed; empty, punctuation, diacritic and non-ASCII cases tested"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bc9db2c9
kind: update
occurred_at: 2026-09-08T07:20:21.380Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_02993786.text
    from: "Add a define-a-label row to the LabelMenu popover: name field, derived slug shown beneath it, colour from LABEL_COLORS"
    to: "Define row in the LabelMenu popover: collapsed \"New label\", one name field, the read-only key line beneath it (hint / key / rule in red), colour from LABEL_COLORS defaulting to the first hue the project is not using"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4ee35849
kind: update
occurred_at: 2026-09-08T07:20:21.400Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ca079284.text
    from: Adopt the same derivation in the ProjectSettings add-a-label row so the two definition surfaces agree
    to: ProjectSettings' add-a-label row adopts the derivation and the same colour default; its slug input goes, so nobody authors a key
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_98452edb
kind: update
occurred_at: 2026-09-08T07:20:21.420Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f83e5c14.text
    from: Route a duplicate or refused slug through the write-feedback path, naming the derived key that collided
    to: "A refused write lands on the danger toast, not ErrorBanner: writeProjectFile ends a failure at setError, which draws at board level under the modal scrim"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f40dd437
kind: update
occurred_at: 2026-09-08T07:20:21.440Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6e2d195e.text
    from: Give every new button and checkbox an explicit tabIndex; npm run check
    to: Add label, the colour trigger and its eight swatches carry an explicit tabIndex; npm run check
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef0f4c19
kind: update
occurred_at: 2026-09-08T07:20:21.459Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c1a2bf82.text
    from: Keep the popover's key handling correct with a text field in it; update keyboard-focus-map.md in place and re-point citations
    to: Menu.onKeyDown returns early for events from a field, so j/k/arrows/Enter are the row's; Esc walks the ladder colours - row - menu - modal; keyboard-focus-map.md edited in place and citations re-pointed
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8af7a26e
kind: update
occurred_at: 2026-09-08T07:20:28.642Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f0cc134c.added
    to: Menu gains a footer slot and a wide flag, and the popover carries its wider width from the moment it opens - usePopoverPlacement measures once and clamps nothing
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_de0b44bf
kind: update
occurred_at: 2026-09-08T07:20:28.665Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3e29245b.added
    to: A collision is refused in the row while typing - {key} already exists for {Label} - and never a toast; Add label stays disabled until a key can be written
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8be9dcd6
kind: update
occurred_at: 2026-09-08T07:20:28.686Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f9c2603b.added
    to: An empty project opens the popover with the define row already expanded and the caret in it
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_40561a28
kind: update
occurred_at: 2026-09-08T07:20:28.707Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_33034160.added
    to: "The define stop joins the menus roving group: arrow-down past the last label reaches it, the collapsed button when closed and the name field when open"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_440f796f
kind: update
occurred_at: 2026-09-08T07:20:39.958Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f0cc134c.moved
    from: "11"
    to: "3"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d3230094
kind: update
occurred_at: 2026-09-08T07:20:39.984Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3e29245b.moved
    from: "12"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a9be39ca
kind: update
occurred_at: 2026-09-08T07:20:40.018Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f9c2603b.moved
    from: "13"
    to: "6"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b4eb0520
kind: update
occurred_at: 2026-09-08T07:20:40.039Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_33034160.moved
    from: "14"
    to: "11"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e928f54d
kind: update
occurred_at: 2026-09-08T07:21:14.067Z
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
id: evt_b2cd9908
kind: comment
occurred_at: 2026-09-08T07:21:31.586Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype gate cleared. The five open questions are answered, and the checklist now says what the build is rather than what the ticket first asked for.

**Adopted, all three as the prototype has them.** The NFD fold, so `Café` gives `cafe` and not `caf` — load-bearing rather than nice, because a read-only key is not something the person can correct afterwards. The colour default is the first hue in `LABEL_COLORS` the project is not already using, blue when all eight are taken, and **settings adopts it too**, which is what stops a seeded project coming out all blue. And the define stop joins the menu's roving group, so `↓` past the last label reaches it: the collapsed button when closed, the name field when open. Tab-only would have left `↓` wrapping straight past the one row in the popover that is not a label.

**Not adopted: an Undo on the toast.** The inverse is two things — `removeProjectLabel` *and* unticking the draft — and `writeProjectFile`'s `undo` is for one field with one inverse. Left off deliberately rather than by omission.

**Not closed: a name with no ASCII in it.** `日本語` derives nothing, the key is read-only, and there is no way past that from either surface — so a project whose vocabulary is Japanese, Greek or Cyrillic defines its labels by editing `longclaw.yaml` or through `longclaw label add --slug`. Reviewed and accepted: the alternatives were a key field in settings only, which puts the two definition surfaces back into disagreement and is the thing this ticket exists to stop, or a generated fallback key, which the ticket argues against by name — `backend-2` on a card. The limitation goes in the comment on `slugFromName`, so the next person reads it as a decision rather than an oversight.

**Two clauses of the description above were overturned by the review and are now patched in place**: "editable while the row is open" is read-only in both places it appeared, and the `Back-end`/`Back end` example names `back-end`, which is what the derivation this ticket specifies actually produces.

Four checklist items are new, and none of them is a new decision — each is a thing the prototype found that the original list had no line for: `Menu` needs a footer slot and a `wide` flag before the row has anywhere to live; the popover has to carry its width from the moment it opens, because `usePopoverPlacement` measures once and clamps nothing; a collision is refused in the row while typing and is never a toast; and an empty project opens with the row already expanded, since a popover whose only content is a collapsed invitation is still a popover that says nothing.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d8fa4302
kind: update
occurred_at: 2026-09-08T07:49:23.632Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7e10ce87.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6c5281bf
kind: update
occurred_at: 2026-09-08T07:49:23.657Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f0cc134c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_91e2d6fb
kind: update
occurred_at: 2026-09-08T07:49:23.679Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_02993786.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4ad6bd72
kind: update
occurred_at: 2026-09-08T07:49:23.700Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3e29245b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_495f2e64
kind: update
occurred_at: 2026-09-08T07:49:23.720Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f9c2603b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5f072fcb
kind: update
occurred_at: 2026-09-08T07:49:23.744Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0e335d84.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6439fa9b
kind: update
occurred_at: 2026-09-08T07:49:23.766Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c90eb922.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7a6dbecb
kind: update
occurred_at: 2026-09-08T07:49:23.787Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ca079284.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2df356bf
kind: update
occurred_at: 2026-09-08T07:49:23.809Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f83e5c14.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef674b6f
kind: update
occurred_at: 2026-09-08T07:49:23.830Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_33034160.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1ac4b9ee
kind: update
occurred_at: 2026-09-08T07:49:23.853Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6e2d195e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5f91e0bf
kind: update
occurred_at: 2026-09-08T07:49:23.876Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c1a2bf82.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8082b99c
kind: update
occurred_at: 2026-09-08T07:49:23.896Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_04b987c3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ac70f655
kind: comment
occurred_at: 2026-09-08T07:49:43.195Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Built. `npm run verify` and `npm run a11y:audit` are both green.

**The a11y probe earned its keep, and it caught a defect in this change.** Closing the define row with `Esc` unmounted the field that was holding focus, so focus fell to `<body>` — and every key after that went nowhere. The first `Esc` looked right (the row closed); the two rungs below it were dead, so the menu would not close and neither would the modal behind it. Every jsdom test passed throughout, because jsdom does not care where focus went. `DefineRow` now hands focus back to the collapsed row on the way out, and A2 has three new rows over the real WebKit build: the popover opening into the field on a project with no labels, `Jack` typed into it arriving as `Jack` rather than steering the list, and the ladder walking all the way out of the modal.

Three of those four go red under `--self-test`. The run still reports a failure — `A3 passed against a broken build` — and that is **pre-existing**: A3 survives the same injury on a clean tree, checked by stashing this branch and re-running.

**Two things worth knowing at review.**

`LabelColors` moved out of `ProjectSettings.tsx` into `LabelColorPicker.tsx`, unchanged. It was private to settings while settings was the only place a label could be defined, and a menu reaching into a settings panel for it would have been the wrong way round.

`Menu`'s roving group needed the footer to be `"footer"` rather than `options.length`. As an index it was correct for exactly one render: defining a label adds a row, so the number that meant *the footer* meant *the last row* the next time round, and the caret was pulled out of the field the instant a definition landed in it.

The `Esc` ladder is `keyboard-focus-map.md:139`, `:141` and `:142`, all three edited in place; `:139` was not previously pinned, so the lock gained it rather than having a line re-pointed.

**One cosmetic difference the prototype left standing and this keeps**: the name field's placeholder is `Label name` in the popover and `Display name` in settings. It was on the prototype's open list and is not covered by anything above — the derivation, which is what the two surfaces must not disagree about, is one function called from both.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3c6cfdac
kind: comment
occurred_at: 2026-09-08T08:01:17.490Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Reviewed on both axes. **Spec: clean** — the copy matches revision 3 character for character, one derivation serves both surfaces, the write lands immediately, `TicketPanel` is correctly untouched, the ramp is still green-free, and nothing from *Not in scope* was built. **Standards: three real defects**, all fixed in `cbb218a`, all invisible to the jsdom tests and to `verify`.

**`Menu` took `Enter` from the define row's own buttons.** The handler is on the popover, so a press on **Add label** bubbles to it, and the guard was `active === "footer"` — an index that only reads `"footer"` when the *arrows* put it there. Open the row with the pointer and the index is still standing on the first label, so `Enter` on the commit ticked that label and swallowed the write. A regression test drives it and goes red without the fix: it produced `labels: ["frontend"]` where `["reliability"]` was asked for. The guard is now where the press came from rather than where the index happens to be.

**The footer's roving stop was attached to the collapsed button alone.** React nulls a callback ref on unmount, so the stop was null exactly while the row was open — `↑` onto the footer moved the active index, focused nothing, and left every row at `tabIndex={-1}`. The name field carries the ref too now. Worth recording that my first test for this was **vacuous**: the row focuses its own field when it opens, so asserting from there held whether or not the stop was wired. It stands on a label row first now, and is red without the fix.

**Defining a slug the draft already carried took it off.** The tick went through `toggleLabel`, and `defineState` reads only the definitions — so a slug an agent had written onto the draft was ticked *off* for the crime of having just been defined. It ticks on now.

Three smaller ones with it: the collision sentence moved **inside** the `aria-live` region, since it is the one thing that says why the commit is dead and a region holding only the key announced the key and left the reason unsaid; the hue is a `LabelColor` end to end rather than a `string` and a cast at the call site; and `Menu.tsx`'s wrap citation named the quick-create table's header rather than the rule it meant.

`verify` green at 1155 tests, `a11y:audit` A1–A5 green. The `--self-test` inversion reports `A3 passed against a broken build`, which is **pre-existing** — A3 survives the same injury on a clean tree, confirmed by stashing this branch and re-running.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6ca0cdb2
kind: update
occurred_at: 2026-09-08T08:25:43.938Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
