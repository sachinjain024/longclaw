---
format: longclaw.ticket/v1
id: 2f685ed7-e46b-4fd4-8e54-6011f135f2e2
key: LC-239w
title: "Simplify the shell chrome: drop the sidebar lockup, rebalance the header"
status: in_review
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-29T00:14:11.894Z
updated_at: 2026-08-31T15:06:07.548Z
---

The shell says **LongClaw** twice and says which project you are in twice, and it spends the header's width on the first of those instead of on the filter field.

The sidebar opens with a brand lockup — `OwlMark size={22}` and a `<strong>LongClaw</strong>` at display 700/15.5 (`App.tsx:1697-1700`, `styles.css:71-83`, specified as the "Logo row" at `screen-specs.md:31`). Below it sit `Create project` and `Open folder` (`App.tsx:1714-1737`), then the Starred and Local sections. Meanwhile the content header carries the project name over its path chip, the disk-state indicator, the filter field, the ordering control, the view segment, `New ticket` and the gear — with the identity block on the left and everything else pushed right by `margin-left: auto` (`styles.css:859`).

Simplify it. Take the lockup out, and consider whether the identity block belongs in the sidebar instead, which is what would give the filter field the width it wants.

## Does the owl belong beside the traffic lights?

**Title bar, not status bar.** The three coloured buttons are the window's own title bar. The macOS *status bar* — properly the menu bar and its "menu bar extras" — is the system strip at the top of the screen; putting an icon there means a `TrayIcon`, which is the affordance of a background agent that drops a menu, not app branding. Wrong surface; do not spend the evaluation on it.

The window today is fully decorated. `tauri.conf.json` declares the main window with `"title": "LongClaw"` and no `titleBarStyle`, so macOS draws a standard opaque title bar with the traffic lights at the left and the word **LongClaw** centred in it. That native title is the *second* place the app's name appears, so removing the sidebar wordmark does not remove the name from the window — worth knowing before deciding anything else is needed.

To put a mark beside the lights, the change is `titleBarStyle: "Overlay"` plus `hiddenTitle: true` on the main window. The title bar goes transparent, the webview gets the full window height, and the lights float over the top-left of the app's own content. What it costs:

- The lights occupy roughly the top-left 78×28px **of the sidebar**. That band needs a top inset or the first thing in the sidebar is unclickable under them.
- The window stops being draggable by its top edge unless something carries `data-tauri-drag-region` — and that strip must not swallow clicks on whatever is inside it.
- Full screen hides the lights; the inset has to collapse with them or the mark floats in an empty band.
- `hiddenTitle` removes the centred native title, which is the app-name-in-chrome that removing the lockup was relying on.
- **The mark cannot go *inside* the title bar.** It can only be webview content positioned to the right of the lights. Every app that appears to do this is doing that.

So the honest form of the question is: is a ~22px owl in the strip right of the traffic lights worth an inset, a drag region, a full-screen case and the loss of the native title — when the alternative is to delete the lockup and change nothing about the window? Answer it in the prototype rather than in the abstract.

## Variation 1 — identity moves to the sidebar

Requested: move `Create project` / `Open folder` **down**, and put the current project's **name, path and gear** where the lockup was.

The trade is a good one on paper. The content header becomes controls only, so the filter field can take the width the identity block was holding, and the two create-a-project controls stop sitting above the list they add to and move to `.side-panel-footer` (`App.tsx:1792`), which is empty today but for a comment. Four things make it harder than it looks:

- **The sidebar already says which project is active.** The active project row is `line-soft` bg, `ink`, 600 weight (`screen-specs.md:35`). A name-and-path block above a list whose active row names the same project is the duplication this ticket exists to remove, reintroduced two inches higher. Either the block replaces the active row's emphasis or it has to earn its place some other way.
- **The disk-state indicator rides with the path.** `WriteIndicator` lives inside `.path-line` (`App.tsx:1860-1870`) and `screen-specs.md:64-73` puts it beside the path chip. Move the path and it moves; 240px of sidebar then has to hold `writing tickets/LC-69/ticket.md…` at mono 10px, which today the header's width absorbs and the ellipsis trims.
- **The gear is the way back from an unreachable project.** It renders outside the `project.reachable` guard on purpose, because settings holds `Locate…` (`App.tsx:1955-1975`). Wherever it moves, it must still be there when the project cannot be read.
- **There is a no-project state.** With the registry read and no project open the main panel draws `Welcome` (`App.tsx:1810-1820`) and there is no name or path to show. The block needs an empty state or must be absent.

## Widening the filter field

"Increase the overall width of the header" is not quite the lever. `.content-header` already spans the whole main region (`styles.css:777-788`); what is fixed is the field, at `width: 180px` with a `min-width: 120px` floor (`styles.css:1747-1761`), and it is the only item in the row that may shrink — everything else is `flex: none` (`styles.css:881`). So the change is at `.filter-wrap`, and the width to spend on it is whatever Variation 1 frees, plus whatever the 240px sidebar gives back if it narrows.

Keep LC-149's rule while doing it: the header is **one row that moves down whole or not at all**, which is why `.toolbar-actions` is `nowrap` with `min-width: 0`. A field that grows is a row that runs out of line sooner.

## Prototype first

Per the user: design before execution. `docs/ux/prototypes/` takes one standalone HTML file per ticket, named for its key, linking the app's real `tokens/design-tokens.css` and `styles.css` and rendering the components' real markup, with proposed CSS in `<style id="proposed">` and harness CSS in `<style id="harness">` (see its README). Draw at least three states side by side — lockup removed only, Variation 1, and Variation 1 with an overlay title bar — at the 1180px default and at the 760px `minWidth`, plus the no-project and unreachable cases. Get it reviewed before touching `App.tsx`.

## What the change has to respect

- **`screen-specs.md` lines 30, 32, 34 and 64–73 are pinned** in `apps/desktop/scripts/citation-lock.json`. The side-panel bullet and the entire content-header bullet are both cited by line. Rewrite prose **in place** rather than inserting beside it, re-point whatever cited it, then `npm run citations:update` — never `--update` to clear a red run.
- **`npm run probe:header` is exactly this ticket's subject.** It measures whether the content header is one row at every width the window can be, mid-write, and jsdom cannot see it. Emptying the header of identity changes the boxes it measures. Update it, run its `--self-test` inversion, and quote both runs.
- **Tab order changes.** Moving the gear moves a tab stop; `keyboard-focus-map.md` is a pinned document too. Update it in place and run `npm run a11y:audit`, which drives the real `App` with no pointer input anywhere in it.
- **Explicit `tabIndex` on every button.** `scripts/tab-order-guard.mjs` fails on an absent one, because WebKit's Tab skips buttons with macOS keyboard navigation off.
- **`npm run matrix`** — theme × appearance visual regression. A shell change of this size needs re-baselining, not a red run explained away.
- **`OwlMark` is not deleted.** `Welcome` draws it at `size={52}` (`App.tsx:2647`); the mark stays, only the sidebar lockup goes.
- **Touching `tauri.conf.json`'s window block is platform work.** `dragDropEnabled: false` is there for LC-60 — HTML5 drag-and-drop stops receiving `dragover` without it. Leave it alone, and run `npm run probe:drag` if the window config changes at all.

## Open questions

- Does the sidebar stay 240px, or narrow now that the lockup is gone?
- If identity moves to the sidebar, does the active project row lose its 600-weight emphasis, or does the block go and only the gear move?
- Does the app name survive anywhere in chrome, or is the native title bar the only place it needs to be?
- How wide should the filter field actually be — a number, or `1fr` of what the header has left?

## Checklist

- [x] Prototype the variations in docs/ux/prototypes/, at 1180px and 760px, and get them reviewed before code <!-- longclaw:item=ck_befadef3 -->
- [x] Evaluate titleBarStyle Overlay for the owl beside the traffic lights; record the decision either way <!-- longclaw:item=ck_fd5321d6 -->
- [x] Remove the brand lockup from the sidebar (App.tsx:1697-1700, styles.css:71-83) <!-- longclaw:item=ck_25e045cb -->
- [x] Decide Variation 1: identity + gear into the sidebar, create/open down to the footer <!-- longclaw:item=ck_b987b978 -->
- [x] Keep the gear reachable when the project is unreachable, and handle the no-project state <!-- longclaw:item=ck_dcf11b43 -->
- [x] Decide where WriteIndicator lives if the path chip moves <!-- longclaw:item=ck_78dc1aae -->
- [x] Widen the filter field at .filter-wrap; keep the header one indivisible row (LC-149) <!-- longclaw:item=ck_45747829 -->
- [x] Rewrite screen-specs.md lines 30-34 and 64-73 in place; npm run citations:update <!-- longclaw:item=ck_d354bf02 -->
- [x] Update keyboard-focus-map.md in place for the moved tab stops; npm run a11y:audit <!-- longclaw:item=ck_77678858 -->
- [x] Update npm run probe:header for the new header boxes; quote the run and its --self-test <!-- longclaw:item=ck_b2f2fbfb -->
- [x] npm run matrix and re-baseline; explicit tabIndex on every new button <!-- longclaw:item=ck_7906ff7d -->
- [x] npm run verify <!-- longclaw:item=ck_b2a07dc4 -->

## Activity

<!-- longclaw:event
id: evt_92971c7f
kind: create
occurred_at: 2026-08-29T00:14:11.894Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5503a660
kind: update
occurred_at: 2026-08-31T09:54:13.248Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_95cdab50
kind: comment
occurred_at: 2026-08-31T10:08:34.172Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype up for review before any `App.tsx` change: `docs/ux/prototypes/LC-239w-Simplify-The-Shell-Chrome.html`. Three variants (A lockup gone only, B identity in the sidebar, C B + an overlay title bar), both widths, the no-project and unreachable states, plus toggles for a write in flight, nine projects, a muted active row and the create form open.

Measured in WebKit off the laid-out frames:

- A · 1180px — header 62px, one row, filter 180px (today)
- A · 760px — header **126px, WRAPPED** — today’s designed two-row failure
- B · 1180px — header 62px, one row, filter **380px** (the cap binds)
- B · 760px — header **62px, one row**, filter 152px, nothing overflowing

So B does not merely widen the field: it removes the header’s only wrap point, because a row with one flex child has no seam to break at. That is a stronger guarantee than LC-149 asked for.

Recommendations carried in the prototype: sidebar stays 240px; the active row keeps its emphasis; the disk-state line moves to a **reserved** 13px slot under the path (a collapsing slot would move the project list on every write); the gear moves with the path and stays outside the reachable guard; the content header does not render at all for an unreachable project; the filter field is `flex: 1 1 240px` floor 120 cap 380, written at `.content-header .toolbar-actions > .filter-wrap` because the one-class rule loses to it.

Two findings worth the ticket:

1. **`.project-nav` must gain `overflow-y: auto`** for B. LC-73 moved the create pair *up* because the nav does not scroll, so at the foot of a long list it left the window. `.side-panel-footer` is `margin-top: auto`, pinned rather than trailing, so pinned-footer + scrolling-nav is what stops LC-73 recurring at nine projects.
2. **The owl beside the traffic lights: no.** Variant C draws it so the cost is visible — a 34px sidebar inset that must collapse in full screen, a drag region that must not swallow clicks, `hiddenTitle` deleting the centred native **LongClaw** that is the reason removing the lockup costs nothing, and a `tauri.conf.json` window edit next to LC-60`s `dragDropEnabled: false`. Recommendation: keep the decorated window.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3ec16b47
kind: comment
occurred_at: 2026-08-31T13:24:48.421Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype revised from review round 1. All five points are in, and the fourth one changed the design.

1. **`✓ ticket.md` is gone from the sidebar.** Only `writing …` is drawn there now — the half of `WriteFeedback` that is news. Variant A’s header keeps the settled mark, because A is today and is what B is measured against. The 13px slot stays reserved so the list never moves; `disk slot · collapsing` shows the alternative.
2. **The path is one line, always.** The demo path is now 46 characters. `.path-chip`’s 180px cap is the header’s number, so the block overrides it to `100%` and the chip’s own `.txt` ellipsizes. Measured: chip 207px wide, 22px tall, text 367px scrolling to 180px of box — one line, ellipsis, `title` and click-to-copy still carry the whole path.
3. **No hairline under the block.** `STARRED` already says a list starts here. The footer keeps *its* line, because the pair down there is pinned over a list that scrolls under it. `hairline under the block` toggles it back.
4. **Creating a project from the footer — this is the finding.** The real `CreateProjectForm` is **523px tall** and the panel has 560px of content at the 620px `minHeight` floor, so it does not fit under the pair. Two attempts died in the drawing: a `46vh` cap put the submit below the fold of a nested scroller, and pinning the footer collapsed the list to nothing and still hung `Create project` 150px past the panel. What works: **while the form is open it is the panel’s body** — the list hides, and so does the pair, which also removes a `Create project` that was appearing twice (the form’s filled submit, and the quieter toggle two rows under it). The way out becomes a ghost beside the submit, the slot `CreateProjectForm` already renders for `onBack`. At 780 the whole form is on screen unscrolled; at the 620 floor it scrolls ~120px.
5. **25 projects.** New control: 5 / 9 / 25, and a window-height control for 780 (the size the app opens at) and 620 (`minHeight`). At 25 the nav scrolls inside its own box and the footer’s pair is fully on screen — which is `.project-nav { overflow-y: auto }` doing the work LC-73 is about.

Open, and all three are consequences of moving the pair down: what the form’s ghost should say (`Back` is the welcome flow’s word for a two-step, and this is one step); whether hiding the project list for the duration of the form is right; and whether moving the pair earns all of this, or whether the identity block simply goes in above a pair that stays where LC-73 put it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_32382b9b
kind: comment
occurred_at: 2026-08-31T13:39:42.592Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

## UX feedback — round 1 (from the user, on the first prototype)

Recorded verbatim, so implementation works from the ask rather than from my reading of it.

- Remove the `ticket.md` text below the directory path
- Ensure that directory path is rendered in single line
- Do we need to show a horizontal line below this component on sidenav?
- In the prototype, also show the experience of creating a project when these options move to the bottom
- What happens where there are say 25 projects? Simulate that in the prototype as well.

My answers are the comment above: `✓ ticket.md` dropped from the sidebar, the one-line path, no hairline under the block, the create form taking the panel body because it does not fit under the pair, and the 5/9/25 and 780/620 controls.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4afb464
kind: comment
occurred_at: 2026-08-31T13:39:55.864Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

## UX feedback — round 2 (from the user, on the revised prototype)

Verbatim. This is the shape the identity block has to be built to, and it is what implementation must satisfy.

- When user hovers over the directory path, show the complete path
- To show the directory path in one line, we can show something like `<starting_word...ending_word>` with a cap on letters in starting and ending word so that it always fits into the sidenav
- Before the Project Name, Can we have the Project Name’s Intial Letter in a boxed square like how profile icon is shown but it should be square.
- Height of the square should be two rows
- First row Project Name
- Second row Project Path
- In the right show the settings icon
- Update the UX prototype to also show the context menu corresponding to a project

So the block is one row of three parts — a square initial tile spanning both text rows, a two-line text column (name over path), and the gear on the right edge — with the path middle-elided to a head and tail cap that always fits 216px of panel, and the full path on hover.

Two things this does not settle, to be decided while building it:

- **Where the `writing …` line goes.** The block is now specified as two rows, and the disk-state line was the third. It stays as a reserved full-width row *below* the tile-and-text row, so the tile still spans exactly the two rows named here and the list still never moves when a write starts.
- **The head/tail caps are a number.** The chip is mono, so a character cap *is* a pixel cap — every glyph is the same width. The cap gets set from the measured character width against the panel’s 216px, not guessed.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e8f2a8bd
kind: comment
occurred_at: 2026-08-31T13:46:23.913Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype revised to the round-2 feedback. The block is now the shape the review specified, and two of the numbers in it came off the laid-out frame rather than out of my head.

**The block.** One row of three parts: a 34px square tile with the project’s initial, the name over the path beside it, the gear on the right. 34px *is* the two rows — 18px name line, 2px gap, 14px path line. Square rather than round because a circle is this design language’s shape for people (humans are circle avatars in the timeline and composer) and a project is not one; the tile wears the project’s own accent at a 14% wash. Unreachable swaps the letter for the warn triangle and the wash for warn.

**The gear sits on the name’s line, out of the flow** rather than centred in the block. That is worth 34px to the row below it — six more characters of path — and it puts a title’s action beside its title.

**The path elides in the middle**, `<head>…<tail>`. A tail ellipsis keeps `~/Developer/…`, which is identical on every path in the app; the end is the folder that identifies the project, so that is the half kept whole.

**The cap is 24 characters, and it is a measurement.** The chip is mono, so a character cap *is* a pixel cap: the box is 157px, a glyph is 6.32px. Two guesses were wrong first — 22 characters in a box I called 140 and measured 123, then 25 in a 157px box by one pixel — so the frame now prints `path 24 chars, 151px in 151px · fits` under itself. Four sample paths (one that fits whole, the deep one, a `/Volumes` path outside `~`, and one whose last segment alone overflows the box) crossed with three splits (8/15, 11/12, 14/9): all twelve fit.

**Hover gives the whole path.** The chip keeps `title` with the full *absolute* path — not tilde-abbreviated, not elided — and the click copies that same string. The elision is a display and never the value.

**The project `⋮` menu is drawn**, from `ProjectMenu`’s items in `MenuList`’s markup: Rename, the Theme submenu with its `preset · appearance` hint, the star named for what pressing it does, the danger `Remove from app…`, and All settings with `⌘,`. It hangs off the open project’s row and is clamped to the window the way the real placement clamps to the viewport.

**The `writing …` slot moved below the tile-and-text row**, full width, still reserved — so the tile spans exactly the two rows the review names and the list still does not move when a write starts.

Three left for you: which head/tail split; whether 14px/600 display is the right weight for the name at 240px; and whether an unreachable project’s tile should go warn as it does here, or stay neutral and leave the triangle to the row.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dee77b7a
kind: update
occurred_at: 2026-08-31T14:35:32.454Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_befadef3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fd5321d6.checked
    from: "false"
    to: "true"
  - field: checklist.ck_25e045cb.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b987b978.checked
    from: "false"
    to: "true"
  - field: checklist.ck_dcf11b43.checked
    from: "false"
    to: "true"
  - field: checklist.ck_78dc1aae.checked
    from: "false"
    to: "true"
  - field: checklist.ck_45747829.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d354bf02.checked
    from: "false"
    to: "true"
  - field: checklist.ck_77678858.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b2f2fbfb.checked
    from: "false"
    to: "true"
  - field: checklist.ck_7906ff7d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b2a07dc4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_81eaa8b1
kind: comment
occurred_at: 2026-08-31T15:05:39.456Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

## Implemented, and the runs

`npm run verify` — green, including the native watcher.

```
npm run probe:header
HEADER-PROBE tickets=40 slow=1800ms engine=WebKit (playwright-core)
  1440px 1300px 1180px 1024px 900px 800px 760px
  126/126 checks passed

npm run probe:header -- --self-test
  104/126 checks passed
  SELF-TEST ok — the pre-fix rules failed 29 checks

npm run a11y:audit
  A1 PASS  A2 PASS  A3 PASS  A4 PASS  A5 PASS

npm run matrix
  theme matrix: 8 axes × 12 states clean

npm run citations:check          488 citations clean
npm run citations:check --self-test   a one-line shift is caught in each of the six
```

`probe:drag` and the perf budgets were not run: `tauri.conf.json` is untouched, and nothing here is a lane, a row, a comparator or a selector.

**The probe grew two checks and lost one.** It now measures that the identity block and the project list hold still while a write is in flight — the reserved disk row is the whole reason they do — and that the path fits its box and clears the gear. Its `--self-test` inversion was rewritten: the old one restored the pre-LC-149 header, which no longer exists, so it now restores the four rules that would bring the same class of defect back.

**Three defects the harnesses found that no test could:**

1. **The reserved row was 13px and the line boxes at 15**, so the whole project list moved 2px down on every write — LC-149’s defect on the other axis, in the exact place this ticket put it. The slot is now a `height` computed from the same two tokens as the line inside it.
2. **A5 went red**: with the header indivisible, `New ticket` was pushed to x=628 in a 640px window at 200% zoom. The page has been ~760px wide at that zoom since long before this ticket; what changed is that the old header wrapped and left-aligned. The row now wraps below 759px — under the window’s own `minWidth`, so at no width a window can be — and aligns left there.
3. **The gear was stealing the path’s last characters.** It is 26px tall on an 18px name line, so its box hangs into the path’s row and it is later in the DOM: a 16×4px sliver of the chip opened settings. The chip is now sized to its text and stopped 30px short of the gear.

**The path cap is 16 characters, and that number is a measurement.** Four derivations were wrong: 22 in a box calculated at 140 and measured at 123; 25 in a box of 157, over by one pixel; 24 in a box with a gear over the end of it; 18 taken at 1180, which clips at 900 where the shell squeezes the panel. The probe now prints `"…" 100px in 107px` at every width on every run, so a fifth cannot hide.

**Two things dropped after review.** The `@media (max-width: 900px)` that hid the word `Order` was scope creep — the ticket’s lever was `.filter-wrap`, and the probe confirms the row fits at 760–900 with the label drawn. And `elidePath`’s head/tail parameters, which no caller passed.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0692a8f6
kind: update
occurred_at: 2026-08-31T15:06:07.548Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
