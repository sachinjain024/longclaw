---
name: lc-build-prototype
description: Build the reviewable HTML UX prototype for a LongClaw ticket or spec in docs/ux/prototypes/, with scenes, a copy deck and a feedback panel. Use when the user wants a UI prototype, mockup or copy deck for a ticket or spec before code is written, or brings back review feedback on one.
---

A LongClaw prototype is **a review, not a demo**. A person who has not read the
spec opens one HTML file, sees the feature standing in the real app at every
state it can be in, and writes design and product feedback against named scenes
and copy ids before a line of `src/` changes.

It borrows two ideas from the vendored `prototype` skill: **a prototype answers
a question**, and variants must disagree about **structure**, not colour. The
rest differs. It is one standalone file under `docs/ux/prototypes/`, not a route
in the app, and when its review settles it is deleted rather than kept on a
branch. This skill is the procedure, and the house rules have one home each:

- `docs/ux/prototypes/README.md`: the file's shape and the index of live prototypes.
- `AGENTS.md`, section *UX prototypes*: the copy deck's five rules.

Read both first.

**Feedback came back on an existing prototype?** Go to [REVIEW.md](REVIEW.md).

## 1. Resolve the input

The input is a ticket key (`LC-206`) or a spec path (`docs/specs/LC-206-attachments.md`).

- From a key, read `.longclaw/tickets/<KEY>/ticket.md` and follow its `**Spec:**` link.
- From a spec, read its `ticket:` frontmatter.
- With no spec, the ticket's description is the brief.

Then list every **visible change**: each user story or decision that puts
something on screen, makes a sound in a screen reader, or changes a string.

**Done when:** you have the key, the brief, and a numbered list of visible changes
that leaves out no UI-facing story.

## 2. Read what it lands in

A scene renders the components' **real markup** wearing the real `styles.css`,
so before drawing anything, read:

- The components the change touches in `apps/desktop/src/`, and the class names
  they render.
- The rows for that area in `docs/design/prototype/screen-specs.md`, `states.md`
  and `keyboard-focus-map.md`.
- The ADRs the spec cites.
- `docs/ux/prototypes/LC-257s-GitHub-Star-Badge.html`, the model for shape: a
  header, a driver, notes per scene, and a deck rendered from one `COPY` object.

**Done when:** for every visible change you can name the component and the
markup it will sit inside.

## 3. Plan the scenes

A **scene** is one thing the reviewer looks at and decides on. Plan them in the
order a reviewer should walk them:

1. **In place.** The feature inside a whole window: side panel, header, board
   or ticket panel. Fill it with realistic data, never lorem ipsum. A feature
   drawn on an empty page looks fine whatever it is.
2. **The flow.** The main gesture, step by step, made clickable with stubbed
   actions (`data-act`), so the reviewer *does* it rather than reads about it.
3. **Every state.** Empty, one, many, pending, failed or refused, and removed or
   unavailable. Add the states the spec names, plus the ones it implies.
4. **The edges.** Long names, forty items, the 760px minimum window, keyboard
   focus visible on each new control, and dark appearance.
5. **Open questions.** Only where the spec leaves a choice open: two or three
   *structurally* different variants of the same scene, side by side or behind
   a scene control.

Give every scene an `ask`: the specific questions the reviewer should answer
there. "Does it look right?" is not an ask; "Is the remove action findable
without hovering?" is.

**Done when:** every item from step 1 is drawn by some scene or listed in the
page's header as not drawn, with the reason, and every scene has at least one
ask.

## 4. Write the copy deck

Put every string the scenes show, plus every `aria-label`, `title`, live region,
toast and CLI line, into `COPY.rows` with an id, kind, where, status
(`new`, `changed`, `moved` or `existing`) and, where the wording is a decision,
a note. Add the existing neighbours a new string sits beside, for tone.

**Done when:** every string in the scenes is read through `T(id)` and none is
typed into the markup. Check this by searching the scene functions for quoted
literals that reach the screen.

## 5. Build it

```sh
cp .agents/skills/lc-build-prototype/template.html docs/ux/prototypes/<KEY>-<Title-In-Words>.html
```

The template already has these parts working; fill in every `TODO(prototype)`:

- **Links:** the app's fonts, tokens and `styles.css`.
- **The two style blocks:** `#proposed` for the CSS this ticket asks for, and
  `#harness` for the review page itself.
- **The driver bar:** scene, appearance, the five accent themes, window width,
  and per-scene controls.
- **Keyboard:** `←` and `→` move between scenes.
- **The review panel:** each scene's asks and a feedback box.
- **The copy deck:** a rewrite box on every row.
- **The Feedback scene:** gathers all notes into Markdown to paste into the ticket.

Rules while building:

- `#proposed` uses tokens only, with no raw colour. Comment each rule with why
  it exists, and mark alternatives as alternatives.
- Every `<button>` and checkbox in proposed markup carries an explicit
  `tabIndex`, the same contract `npm run check` enforces in `src/`.
- No network, no disk. Actions change `app` and re-render.

**Done when:** `grep -n "TODO(prototype)" <file>` prints nothing.

## 6. Look at it

Open it in a real browser. Prefer the Chrome DevTools MCP for this, or fall back
to `open <file>`. Walk every scene in light and dark appearance at 1180 and 760.

**Done when:**

- Every scene has been screenshotted in both appearances at both widths, and
  you have looked at each screenshot.
- The console shows no errors, including no `copy id not in the deck` errors.
- Nothing overflows its frame unless the scene is there to show the overflow.
- The Feedback scene's Markdown includes a note typed on a scene and a note
  typed on a deck row.

## 7. Register and hand over

- Add an entry for the file to `docs/ux/prototypes/README.md`, in the same
  shape as the others.
- Link the prototype from the spec's *Further Notes* and from the ticket. Use
  `longclaw ticket edit <KEY> --description-file … --comment "…"` with
  `--agent-id claude-code --agent-name "Claude Code"`, and never hand-edit
  `ticket.md`.
- Tell the user:
  - the path, and `open <path>` to view it;
  - the scenes, one line each;
  - the three or four asks that matter most;
  - that the Feedback scene turns their notes into one Markdown block to paste
    back.

**Done when:** the README lists the prototype, the ticket links it, and the
user has the path and the asks.
