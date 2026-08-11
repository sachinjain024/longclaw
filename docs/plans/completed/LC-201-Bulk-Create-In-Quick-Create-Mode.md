---
title: "Bulk create in quick create mode"
product: LongClaw
status: completed
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

1. **Context line** — dot · project · `KEY-n`, and *new* `esc` at the right end:
   the word, in the eyebrow's own register, which **closes the modal when it is
   clicked**. The key re-reads the next free one on every create, so during a run
   it counts up: `LC-201`, `LC-202`, … Each is still a guess read off the rows on
   screen; Rust allocates the real one.
2. **Title** — borderless 15px input. Unchanged (D-47).
3. **Description** — *new.* Three lines to start, growing with what is typed,
   capped at 180px so a long one scrolls itself rather than pushing the footer
   off the modal. No Write/Preview tabstrip, no formatting toolbar, no footer of
   its own. Placeholder is D-4B's line, the same one full create carries:
   *"What should happen? Agents read this before they start."*
4. **Meta row** — status trigger, priority trigger, and *new* the label trigger,
   in the meta grid's order (`screen-specs.md:229`). All three wear D-49's bare
   treatment, which is already a rule on `.quick-create-meta .menu-trigger`, so
   the third one is bare for the same reason the first is.
5. **Footer** — ghost **Open full editor →** hard left, then a gap, then *new*
   the **Create more** checkbox, then primary **Create `⌘↵`**. No mono hints
   line: both bindings it carried now sit on controls of their own.

**The description takes a box; the title does not.** D-47 leaves the title
borderless because "the modal is one field and two menus, so a box around the
field is a frame around nothing" — at three lines that argument inverts, since an
unframed block of empty space under the title reads as a gap rather than as a
field. The panel makes the same split, with a bare `.panel-title` over a boxed
editor. What the field wears is `.composer textarea`'s shape and very nearly its
rules: `radius-control`, `space-2` of padding, the code type both existing
description surfaces use, `resize: none` and an auto-grow. The app already has a
bordered, auto-growing, capped markdown field; a second kind here would be a
second answer to a solved question.

**Its edge is `--lc-line`, not the `--lc-line-strong` of the field foundation.**
Field-strength is right where the box is the only thing saying "this is a
control" — a settings dialog, a composer at the bottom of a timeline. This modal
is four rows tall and the footer's own hairline sits directly under this one, so
a stronger edge than that reads as a frame rather than as a field. `--lc-line` is
the weight every other hairline in the modal already carries.

**The title still has no border of its own.** The rectangle that appears around
it is `outline: var(--lc-border-focus) solid var(--lc-accent-human-ring)` from
`styles.css:41` — the app-wide focus ring, on every control in the app, and the
whole of the keyboard-visibility contract. Nothing in this plan touches it.

**Why not `DescriptionEditor`.** It is the right component in full create and the
wrong one here. Its tabstrip and six formatting buttons are nine controls, and
this modal is meant to be crossed in a few presses of Tab; its Preview tab
projects a file that does not exist yet; and a toolbar is an invitation to
compose, which is the opposite of what a bulk run is. The bytes are the same
markdown either way, and the ticket that wants the toolbar has a door to it in
the same footer.

**Both create surfaces trim the description, and this one keeps doing that.**
`CreatePanel.tsx:193` has sent `description.trim()` since V0-16, so quick create
sending anything else would make the two surfaces disagree about the same field
of the same file. What `DescriptionEditor` promises is narrower than "nothing is
touched" and is worth stating precisely: **the textarea holds the raw string and
nothing round-trips it through the parser** — the value saved is the value typed,
never a re-render of the parsed tree (`DescriptionEditor.tsx:6-11`). Trimming the
ends is not that. Nothing markdown means survives at the ends of a document
anyway: a trailing hard break is two spaces before a newline that has no line
after it, and leading blank lines render as nothing. If that ever stops being
true, it changes for both surfaces at once, in `CreateTicketRequest`'s writer —
not in one of them.

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

## `↵` when there is a textarea in the modal, and where the bindings are said

Today the modal is a `<form>` and `↵` in the title input submits it; the hints
said `↵ create · esc cancel`. A textarea does not submit
on `↵` and must not — a description is markdown and needs its newlines. So the
binding grows a second half, the one full create already has:

- `↵` in the title creates, as it always has.
- `⌘↵` creates from anywhere in the modal, including the description.
- `Esc` closes, as it always has.

**Each of those is said once, on the control it belongs to, rather than a fourth
time in a mono line.** `⌘↵` goes inside **Create** as a `<kbd>`, which is exactly
how full create's own footer writes it (`CreatePanel.tsx:408`). `esc` goes to the
right end of the context row — the word, lower case, in the eyebrow's register.
With both moved, the mono hints line has nothing left to say and goes.

**And `esc` is a button, so quick create finally has an exit that is not a
create.** Today it has no **Cancel**, and its scrim is `role="presentation"` with
no click handler, so a human who opened the modal by pointer and changed their
mind has nowhere on the screen to go: **Open full editor →** is the only control
that leaves, and it does not leave. Clicking the word does what the word says.

It is deliberately **not** the palette's `kbd-chip` (`CommandPalette.tsx:583`).
That one is a `<kbd>` in a bordered box reporting a key it cannot perform, and a
box up here competes with the two fields below it for the only edge this modal
has to spend. The palette's chip stays as it is; this is a different job.

`tabIndex={-1}`, stated rather than defaulted (`tab-order-guard.mjs`). Its
keyboard path is the key it is named after, which is the purest form of the
focus map's rule 1, and a stop in front of the title for a control the keyboard
already has is a press the human pays on every open.

`↵` from the title is the one binding no longer written on the screen. It is the
habit rather than the discoverable path, `⌘↵` is stated and does the same thing
from the same field, and the alternative — keeping a line that repeats what two
controls now say — is the duplication the review asked to remove.

## Keyboard and focus

Tab order, which `keyboard-focus-map.md:133` states and `a11y:audit` walks:

> Title → description → status → priority → labels → Open full editor →
> Create more → Create

Create more sits immediately left of **Create**: the control it changes is the
next thing both the eye and the Tab key reach. `esc` is a control but not a stop,
for the reason above.

The focus-return table gains a second entry with it: **Quick create (closed by
`esc`, clicked or pressed) → prior focus**, which is the row canceling already
has (`keyboard-focus-map.md:165`) and now has two ways of being reached.

The checkbox carries an explicit `tabIndex={0}`. WebKit follows the macOS
*Keyboard navigation* setting and skips both buttons and checkboxes with it off,
which is what `scripts/tab-order-guard.mjs` exists to refuse — and the checkbox
half of that guard exists because exactly this hid in the checklist rows until
LC-185.

The focus-return table gains a row: **Quick create (created, Create more on) →
the title field, cleared.**

## Do this

1. **`src/QuickCreate.tsx`** — description textarea, `LabelMenuButton` on the
   meta row, the `esc` button on the context row calling the same `onCancel` the
   key does, the Create more checkbox, `⌘↵` on the **Create** button and in a
   modal-wide handler, and a `createMore` flag on what `onCreate` sends. On a
   create with the flag set, clear title and description and keep the rest; the
   modal owns its own reset, so App never reaches in.
2. **`src/App.tsx`** — `submitNewTicket`/`writeNewTicket` take a `keepOpen`
   option that skips `setCreateSurface(undefined)` and **both** `focusCard`
   calls. `PendingCreate` carries it too, so a run that crosses a project switch
   (LC-188) resumes into the same loop after the confirm.
3. **`src/styles.css`** — the description field, `esc`'s placement and its
   stripped-back treatment, the footer's checkbox, and the meta row with three
   triggers at 620px. No new token; nothing here introduces a colour. The exact
   rules are the `<style id="proposed">` block of the prototype, which is where
   they were measured.
4. **`src/autoGrow.ts`** — `useAutoGrow` sets `height = scrollHeight`, which is
   exact for a borderless field and two pixels short for one with a border under
   `box-sizing: border-box`. Every field it drives today is borderless except
   `.composer textarea`, so nobody has had to notice; the description here has a
   border, and two pixels short means it scrolls its own last line out of sight
   for as long as there is text in it. Add the borders back in the hook, which
   fixes the composer with it, rather than working around it in one caller.
5. **`src/QuickCreate.test.tsx`** — replace the "offers no description,
   checklist or label field at all" test with the honest pair: no checklist
   here, and labels through the menu rather than a text box. Cover the loop:
   what is cleared, what is kept, and that `onCreate` is called once per press.
6. **`src/App.test.tsx`** — the loop end to end: two creates from one open modal,
   two toasts, two cards, and the focus assertion that the write landing does
   not pull the caret out of the title field.
7. **`perf/a11y-audit.mjs`** — a row for the loop beside the existing create
   row: `C`, tick Create more, type, `↵`, and assert focus is the emptied title
   field rather than a card. Confirm it goes red under `--self-test`. The Tab
   walk in that section changes shape too, and the existing create row must stay
   green: with the box unticked, `↵` still creates and focus still lands on the
   new card. `esc` is pointer-only by design, so the walk must **not** find it —
   a row that reaches it is a row that says the tab order grew a stop.
8. **`docs/design/prototype/screen-specs.md`** and
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

## Settled at the review gate, 2026-08-11

The first three questions this plan opened are closed, and two more were decided
with them. Revision 2 of the prototype is what they look like.

1. **The description stays, at three lines**, growing and capped — so the first
   question ("does it belong here at all") is answered yes, and its shape is
   settled with it. It takes the field box the title does not; see *What the
   surface becomes*.
2. **`⌘↵` moves inside the Create button**, stated once on the thing it does
   rather than a second time in a mono line.
3. **`Esc` moves to the top right** of the context row.
4. **Open full editor → goes hard left** in the footer.
5. **Create more sits immediately left of Create.** The second question — footer
   or meta row — is answered footer, and more precisely than it was asked.

The mono hints line goes with them, because both bindings it carried now sit on
controls of their own.

### Revision 3, the same day

6. **The description's edge softens** from `--lc-line-strong` to `--lc-line`.
   The title has no edge to soften: what appears around it is the app-wide focus
   outline, which nothing here touches.
7. **`esc` is lower case, plain text, and not a chip** — the word in the
   eyebrow's register rather than a `<kbd>` in a box.
8. **Clicking it closes the modal**, which answers the question revision 2 left
   open and gives quick create its first exit that is not a create.

## Measured, not assumed

Revision 3 driven in WebKit over the app's own stylesheet:

| | |
|---|---|
| Footer at 1440 / 1280 / 1024 / 900 / 760 / 640px | one row, 39px, no wrap, nothing off the window |
| Description, empty | 72px — three lines of the code type, its floor |
| Description, five lines | 108px, no scrollbar |
| Description, twenty lines | 180px, scrolls itself; the modal does not |
| Description edge | `1px solid #e3e5ee` — `--lc-line`, one step down the ramp |
| `esc` | a `<button>`, `tabIndex` −1, no border, no background, no `text-transform`; clicking it closes a modal with a title typed into it |
| The run | title and description cleared, status/priority/labels kept, key advanced, focus in the title field, one toast replacing the last |

## Outcome

Shipped as planned, with one decision sharpened, one defect fixed on the way and
one stale citation found.

**`createMore` did not go where this plan put it.** The plan said "a `createMore`
flag on what `onCreate` sends", and the type boundary refused it: the first
argument of `onCreate` is `Omit<CreateTicketRequest, "projectId">`, which is
exactly what Rust is handed. A surface decision riding inside it would be a field
to remember to strip at the IPC boundary, and `App` already had the right shape
for this in `submitNewTicket`'s `openPanel`. So it is a second argument —
`onCreate(request, { createMore })` — and the request stays the request. The test
that pins it says so in its own comment.

**`useAutoGrow` was two pixels short on any bordered field**, which the plan
predicted and the measurement confirmed: `box-sizing: border-box` with `height =
scrollHeight` leaves the content box short by the borders, so the field scrolls
its own last line out of sight for as long as there is text in it. Every field
the hook drove was borderless until this one, which is why it never showed;
`.composer textarea` has carried it since it was written and is fixed with it.

**A stale citation, surfaced rather than found.** `a11y-audit.mjs:411` cited
`keyboard-focus-map.md:132` for "pick applies optimistically", but 132 is quick
create's `Esc` row and always was — the menus' row is 140. `citation-guard`
cannot catch this: it checks that a cited line's *text* has not moved, not that
the *claim* matches. Rewriting 132 is what made it visible. Re-pointed to 140
rather than re-pinned at 132.

**Both design docs were edited at the same line count.** 52 citation spans point
below the § Quick create block, and shifting them is the failure that once left
160 citations pointing at the wrong prose, so the block was rewritten inside its
own eight lines and the loop's prose appended at the end — the discipline
`screen-specs.md` closes by asking for. No line number moved; the lock diff is
ten re-pinned texts and one re-pointed citation.

### Validation

| | |
|---|---|
| `npm run verify` | green |
| `npm run a11y:audit` | five rows green; A2's three new checks pass, two of the three go red under `--self-test` |
| `npm run probe:checklist` | 60/60 across 8 sizes — the add-rows it drives are the panel's and full create's, neither of which this touches |
| Frontend suite | 903 green, 22 of them new — `QuickCreate.test.tsx` 14 → 29, `App.test.tsx` 169 → 176 |
| The real component in WebKit | description 72px empty with a `--lc-line` edge, footer one row at 39px in the order **Open full editor → · Create more · Create `⌘↵`**, `esc` at `tabIndex` −1 |

### Known, and deliberately not fixed here

**A3 of the accessibility audit does not invert.** `npm run a11y:audit
-- --self-test` reports `A3 passed against a broken build`: the row injects
`*:focus { outline: none }` — the exact mistake it exists to catch — and still
passes. This predates LC-201 (confirmed by running it at this branch's point),
and it is the "blind probe" failure `AGENTS.md` warns about by name. It wants a
ticket of its own; it is recorded here because this is the run that noticed.
