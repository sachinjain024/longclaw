---
format: longclaw.ticket/v1
id: 2f685ed7-e46b-4fd4-8e54-6011f135f2e2
key: LC-239w
title: "Simplify the shell chrome: drop the sidebar lockup, rebalance the header"
status: todo
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-29T00:14:11.894Z
updated_at: 2026-08-29T00:14:11.894Z
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

- [ ] Prototype the variations in docs/ux/prototypes/, at 1180px and 760px, and get them reviewed before code <!-- longclaw:item=ck_befadef3 -->
- [ ] Evaluate titleBarStyle Overlay for the owl beside the traffic lights; record the decision either way <!-- longclaw:item=ck_fd5321d6 -->
- [ ] Remove the brand lockup from the sidebar (App.tsx:1697-1700, styles.css:71-83) <!-- longclaw:item=ck_25e045cb -->
- [ ] Decide Variation 1: identity + gear into the sidebar, create/open down to the footer <!-- longclaw:item=ck_b987b978 -->
- [ ] Keep the gear reachable when the project is unreachable, and handle the no-project state <!-- longclaw:item=ck_dcf11b43 -->
- [ ] Decide where WriteIndicator lives if the path chip moves <!-- longclaw:item=ck_78dc1aae -->
- [ ] Widen the filter field at .filter-wrap; keep the header one indivisible row (LC-149) <!-- longclaw:item=ck_45747829 -->
- [ ] Rewrite screen-specs.md lines 30-34 and 64-73 in place; npm run citations:update <!-- longclaw:item=ck_d354bf02 -->
- [ ] Update keyboard-focus-map.md in place for the moved tab stops; npm run a11y:audit <!-- longclaw:item=ck_77678858 -->
- [ ] Update npm run probe:header for the new header boxes; quote the run and its --self-test <!-- longclaw:item=ck_b2f2fbfb -->
- [ ] npm run matrix and re-baseline; explicit tabIndex on every new button <!-- longclaw:item=ck_7906ff7d -->
- [ ] npm run verify <!-- longclaw:item=ck_b2a07dc4 -->

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
