---
format: longclaw.ticket/v1
id: f0085d76-29f3-44a3-bf3f-fd6401174b52
key: LC-236e
title: Define a new label from inside the create flows
status: in_progress
priority: none
labels:
  - frontend
  - product
  - release
created_at: 2026-08-28T04:12:09.099Z
updated_at: 2026-09-07T14:21:24.770Z
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

- **A collision is a refusal, and the refusal has to name a key.** "Back-end" and "Back end" both derive to `backend`. That reads as obvious when the derived key is updating on screen as the user types, and as inexplicable when it is not.
- **A name may derive to nothing.** `is_label_slug` (`core/project.rs:343-359`) wants an ASCII lowercase first character, so a name in Japanese, or one that starts with a digit, produces no valid key at all. The visible line is the escape hatch — it shows empty and the edit affordance is the way forward — instead of a bounce with no cause on screen.
- **Hidden plus immutable drifts in silence.** A slug cannot be renamed and must not become renameable (`file_format.md:231`, plan 15's settled design). Hide it, and people rename labels freely — correctly, since it is only a display name — while the key stays whatever the first name happened to derive to. A year on, `labels: { backend: { name: "Platform / Infra" } }` still answers to `--label backend`, and nothing on screen ever said so.

So: the derived key is shown as the quiet consequence of what was typed, editable while the row is open and never after.

## The derivation

One exported function in `labels.ts`, so the create row and the settings row cannot disagree about it: lowercase, trim, collapse each run of characters outside `[a-z0-9]` to a single `-`, drop a leading and trailing `-`, and return empty when nothing survives. Both `-` and `_` are legal in the grammar; pick `-`. Rust keeps owning validation (`ProjectSettings.tsx:636`) — the derivation only proposes a key, `is_label_slug` still decides whether it is one.

## What the change has to respect

- **A slug is immutable once a ticket carries it.** `LabelMenu`'s header comment says it never edits a slug, and that stays true — this adds one, it does not rename one. Deriving is not renaming: the key is editable while the row is open and fixed the moment the definition is written.
- **Defining a label is a project write, and it lands immediately.** The label outlives an abandoned draft: someone who defines `infra` and then closes quick create without creating a ticket has still changed `longclaw.yaml`. Decide that deliberately and say so in the comment; the alternative — holding the definition until the ticket is created — makes the ticket write conditional on a second write and is worse.
- **The green band is not on the ramp** (`labels.ts:17-21`) — green belongs to the agent, and the new colour picker must not reach for one.
- **A duplicate slug is a refusal, not a silent no-op.** `ProjectSettings.tsx:74` already routes the add-a-label row's failure through `onWrite`; the create surfaces need the same refusal path rather than a menu that quietly does nothing, and the message names the derived key that collided.
- **`tabIndex` is explicit.** The new row's button and any checkbox in it need `tabIndex={0}` or `-1`, or `npm run check` fails (`scripts/tab-order-guard.mjs`).
- **The keyboard contract covers the popover.** A text field inside an anchored `Menu` is new — the menu's existing key handling assumes rows, so typing in the field must not steer the list or close the popover. Update `keyboard-focus-map.md` in place and run `npm run a11y:audit`.

## Not in scope

Renaming, recolouring and removing definitions stay in project settings, and no rename-slug command comes out of this. The settings add-row is in scope for one thing only: adopting the shared derivation, so that the two places a label can be defined do not disagree about whether a human types a key (`ProjectSettings.tsx:702-704` asks for one today).

## Checklist

- [x] Generate the UX prototype <!-- longclaw:item=ck_45d890d4 -->
- [ ] slugFromName() in labels.ts: lowercase, non-alphanumerics to a single -, trimmed; empty, punctuation and non-ASCII cases tested <!-- longclaw:item=ck_7e10ce87 -->
- [ ] Add a define-a-label row to the LabelMenu popover: name field, derived slug shown beneath it, colour from LABEL_COLORS <!-- longclaw:item=ck_02993786 -->
- [ ] Wire it in quick create (QuickCreate.tsx) so a new slug is defined and ticked in one gesture <!-- longclaw:item=ck_0e335d84 -->
- [ ] Wire the same row into full create's Labels row (CreatePanel.tsx) <!-- longclaw:item=ck_c90eb922 -->
- [ ] Adopt the same derivation in the ProjectSettings add-a-label row so the two definition surfaces agree <!-- longclaw:item=ck_ca079284 -->
- [ ] Route a duplicate or refused slug through the write-feedback path, naming the derived key that collided <!-- longclaw:item=ck_f83e5c14 -->
- [ ] Give every new button and checkbox an explicit tabIndex; npm run check <!-- longclaw:item=ck_6e2d195e -->
- [ ] Keep the popover's key handling correct with a text field in it; update keyboard-focus-map.md in place and re-point citations <!-- longclaw:item=ck_c1a2bf82 -->
- [ ] npm run a11y:audit, and npm run verify <!-- longclaw:item=ck_04b987c3 -->

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
