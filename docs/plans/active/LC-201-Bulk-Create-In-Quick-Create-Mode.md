---
title: "Bulk create in quick create mode"
product: LongClaw
status: active
ticket: LC-201
owner_area: Frontend
release_blocking: false
depends_on: "13 (mutate), 15 (LabelMenu), 18 (DescriptionEditor), 22 (create surfaces)"
prototype: ../../ux/prototypes/LC-201-Bulk-Create-In-Quick-Create-Mode.html
---

# Bulk create in quick create mode

Filing one ticket is a solved problem. Filing eight in a row is not: quick create
closes on every `↵`, so the eighth ticket costs eight presses of `C`, eight trips
back through the status menu and eight through priority — for a run of tickets
that almost always share both. The modal already knows everything the next one
needs and throws it away on purpose.

LC-201 asks for three things, and they are one feature: quick create should be
able to hold a **description** and **labels**, it should offer a **Create more**
toggle, and with that toggle on it should stay open after a create with the
title and description cleared and status, priority and labels kept.

## The narrowing this widens, and why that is not a reversal

Quick create used to ask for six fields. V0-16 ([plan 22](../completed/22-full-create-surface.md))
cut it to title and status, LC-186 put priority back, and `QuickCreate.tsx:16-19`
states the rule that came out of it: *labels, description and checklist stay in
full create, where the menus and drafts that make them safe already are.* This
plan re-opens two of those three. The reasons the narrowing was right are worth
being precise about, because only one of them still applies.

**Labels were cut because the control was wrong, not because the field was.**
Plan 22's opening sentence is that quick create "asks for labels as a
comma-separated text box — which was defensible before V0-10 gave the project
real label definitions and a real label menu, and is not defensible now. A slug
typed into a free-text field is a slug the project may not define." That defect
is a property of the *text box*. `LabelMenuButton` (plan 15) offers the project's
own definitions and cannot produce a slug `longclaw.yaml` does not carry, so
putting it in this modal re-introduces nothing. The existing test that guards
this — `QuickCreate.test.tsx:91-101`, "offers no description, checklist or label
field at all" — even says so in its own comment: *"the label field in particular
was free text … which is what V0-10's menu exists to stop — so widening this
surface by one field is not an invitation."* This is the invitation, and it is
being accepted with the menu, not the box.

**Description was cut because quick create should be quick, and that still
holds — for one ticket.** It stops holding under Create more. A bulk run is
where the human has eight small things in their head at once; a one-line
description each is the difference between eight tickets an agent can start on
and eight titles someone has to reopen and explain. The cost the narrowing was
avoiding — a modal that is a worse version of full create — is answered by
*which* description editor this gets (below), not by leaving the field out.

**The checklist stays out.** It is the one of the three whose case does not
change: draft rows, drag reordering, an add-row that has to stay on screen
(LC-193) and a remove affordance are the shape of a surface you sit in, and
nothing about filing eight tickets quickly wants them. `Open full editor →` is
the answer for the ticket that needs one, and it now carries five fields rather
than three.

## What the surface becomes

620px modal at 12vh, unchanged. Rows, in order:

1. **Context line** — dot · project · `KEY-n`. Unchanged. It re-reads the next
   free key on every create, so during a run it counts up: `LC-201`, `LC-202`, …
   Each is still a guess read off the rows on screen; Rust allocates the real
   one.
2. **Title** — borderless 15px input. Unchanged (D-47).
3. **Description** — *new.* A borderless auto-growing textarea in the same
   register as the title: no Write/Preview tabstrip, no formatting toolbar, no
   footer. One row, growing as it is typed. Placeholder is D-4B's line, the same
   one full create carries: *"What should happen? Agents read this before they
   start."*
4. **Meta row** — status trigger, priority trigger, and *new* the label trigger,
   in the meta grid's order (`screen-specs.md:229`). All three wear D-49's bare
   treatment, which is already a rule on `.quick-create-meta .menu-trigger`, so
   the third one is bare for the same reason the first is.
5. **Footer** — *new* **Create more** checkbox, then ghost **Open full
   editor →**, then the mono hints, then primary **Create**.

**Why not `DescriptionEditor`.** It is the right component in full create and the
wrong one here. Its tabstrip and six formatting buttons are nine controls, and
this modal is meant to be crossed in a few presses of Tab; its Preview tab
projects a file that does not exist yet; and a toolbar is an invitation to
compose, which is the opposite of what a bulk run is. The bytes are the same
markdown either way — nothing here normalizes the string — and the ticket that
wants the toolbar has a door to it in the same footer.

## The Create more loop

**Default off, every time the modal opens.** It is a mode for the run in front of
you, not a preference: it is not written to device preferences and not carried
across a close. Someone who presses `C` next week to file one thing gets the
surface they have always had.

**Off** — nothing changes anywhere. Create closes the modal, the card appears,
the toast offers Undo, focus moves to the new card.

**On** — Create submits exactly the same optimistic write, and then:

| | |
|---|---|
| The modal | stays open |
| Title, description | cleared |
| Status, priority, labels | kept, as the human last set them |
| Create more | stays ticked |
| Context line | advances to the next free key |
| Focus | returns to the **title** field |
| Toast | `LC-n created`, with Undo, per create — unchanged |

**The one thing that has to be got right is focus.** `writeNewTicket` moves focus
to the optimistic card in `apply` and to the real card again in `onWritten`
(`App.tsx:1144,1152`). The second of those fires when the disk write returns —
which, during a run, is *while the human is typing the next ticket's title*. A
create that stole the caret mid-word would make Create more unusable and would
look like dropped keystrokes rather than like a focus bug. Neither `focusCard`
may run on this path.

**Escape is unchanged.** It closes the modal and returns focus to whatever held
it before, ticked box or not. The empty draft behind it is discarded, as it is
today. There is no "you have created 8 tickets" confirmation: nothing is lost by
closing, because every create in the run has already been written.

**Undo is still one deep.** `data-requirements.md:121` scopes it to the inverse
of the last mutation, so after a run of ten `⌘Z` archives the tenth. That is
existing scope and not a gap this plan opens; it is written down because a bulk
surface invites the assumption of a bulk undo.

**`Open full editor →` carries all five fields.** Title, description, status,
priority, labels. Create more has nowhere to go in full create and is simply left
behind — full create closes on create, as it does today.

**A column `+` still preseeds status.** On the second create of a run the status
is whatever the first one used, which may be the column that opened it. That is
the retention working, not the preseed leaking.

## `↵` when there is a textarea in the modal

Today the modal is a `<form>` and `↵` in the title input submits it; the hints
say `↵ create · esc cancel` (`screen-specs.md:258-259`). A textarea does not submit
on `↵` and must not — a description is markdown and needs its newlines. So the
binding grows a second half, the one full create already has:

- `↵` in the title creates, as it always has.
- `⌘↵` creates from anywhere in the modal, including the description.
- Hints read `↵ create · ⌘↵ anywhere · esc cancel`.

This is the one visible change to a documented line that is not additive, and it
is listed under **Open questions** below.

## Keyboard and focus

Tab order, which `keyboard-focus-map.md:133` states and `a11y:audit` walks:

> Title → description → status → priority → labels → Create more → Open full
> editor → Create

Create more sits with the footer rather than with the fields because it modifies
what **Create** does, and it is first in the footer so that Tab passes it on the
way to the button it changes.

The checkbox carries an explicit `tabIndex={0}`. WebKit follows the macOS
*Keyboard navigation* setting and skips both buttons and checkboxes with it off,
which is what `scripts/tab-order-guard.mjs` exists to refuse — and the checkbox
half of that guard exists because exactly this hid in the checklist rows until
LC-185.

The focus-return table gains a row: **Quick create (created, Create more on) →
the title field, cleared.**

## Do this

1. **`src/QuickCreate.tsx`** — description textarea, `LabelMenuButton` on the
   meta row, the Create more checkbox, `⌘↵`, and a `createMore` flag on what
   `onCreate` sends. On a create with the flag set, clear title and description
   and keep the rest; the modal owns its own reset, so App never reaches in.
2. **`src/App.tsx`** — `submitNewTicket`/`writeNewTicket` take a `keepOpen`
   option that skips `setCreateSurface(undefined)` and **both** `focusCard`
   calls. `PendingCreate` carries it too, so a run that crosses a project switch
   (LC-188) resumes into the same loop after the confirm.
3. **`src/styles.css`** — the description field's borderless treatment, the
   footer's checkbox, and the meta row with three triggers at 620px. No new
   token; nothing here introduces a colour.
4. **`src/QuickCreate.test.tsx`** — replace the "offers no description,
   checklist or label field at all" test with the honest pair: no checklist
   here, and labels through the menu rather than a text box. Cover the loop:
   what is cleared, what is kept, and that `onCreate` is called once per press.
5. **`src/App.test.tsx`** — the loop end to end: two creates from one open modal,
   two toasts, two cards, and the focus assertion that the write landing does
   not pull the caret out of the title field.
6. **`perf/a11y-audit.mjs`** — a row for the loop beside the existing create
   row: `C`, tick Create more, type, `↵`, and assert focus is the emptied title
   field rather than a card. Confirm it goes red under `--self-test`.
7. **`docs/design/prototype/screen-specs.md`** and
   **`keyboard-focus-map.md`** — the § Quick create rows, in place where the
   prose allows it, then `citations:update` for what genuinely moved. Both are
   line-cited and pinned by `citation-lock.json`; do not run `--update` to clear
   a red run.

## Done when

- Behavioural coverage for the loop and for the two new fields, each confirmed
  red-first.
- `npm run verify` is green, and `npm run a11y:audit` is green with the new row
  and red under `--self-test`.
- `npm run probe:checklist` is untouched by this — but if the description
  textarea is given a scroll container of its own, it is not, and the run is
  quoted.
- The design docs' citations are re-pointed rather than re-pinned.

## Watch out for

- **Do not let the write's return move focus.** It is the defect this feature
  would ship with if nobody looked for it, and it will not reproduce on a fast
  disk with a small project unless a test forces it.
- **Do not persist Create more.** A create surface that quietly stays in bulk
  mode is a surface that files a ticket you thought you were cancelling.
- **Do not add a second label affordance.** `LabelMenuButton` is the meta row,
  everywhere, and the comma-separated box is the thing V0-10 and plan 22 removed.
- **Do not put the checklist back.** Three of four checklist items in this ticket
  are about the other two fields; the fourth is the toggle.
- **The provisional key is still a guess.** A run advances it optimistically off
  the rows on screen; nothing here may present it as allocated.
- **One create per press.** The optimistic card and the cleared title both land
  through React state; a second `↵` on an empty title must be refused by the same
  `canCreate` that refuses it today.

## Open questions for the review gate

1. **The hints line.** `↵ create · ⌘↵ anywhere · esc cancel` is the honest
   version once a textarea is in the modal, but it lengthens a line the footer
   shares with three controls. The alternative is `⌘↵ create · esc cancel` — one
   binding, true everywhere, and a quieter footer, at the cost of retiring a
   documented habit.
2. **Where Create more sits.** The footer (proposed, and what the prototype
   shows) or the right end of the meta row. The meta row keeps the footer as it
   is; the footer keeps the toggle beside the button it changes.
3. **Whether the description belongs in quick create at all**, or whether the
   Create more loop alone answers the ticket's real complaint. Dropping it would
   leave the modal at three fields plus labels and make this a much smaller
   change.
