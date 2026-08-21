---
format: longclaw.ticket/v1
id: aa30d102-2d8f-499e-9745-5d581eb9a2d1
key: LC-208
title: Improve the UI and UX of Project Settings
status: done
priority: urgent
labels:
  - frontend
  - design
created_at: 2026-08-11T14:48:54.999Z
updated_at: 2026-08-21T06:47:23.429Z
---

- Prototype this in Claude Design. Once convinced in Claude Design, bring in Claude Code for implementation.
- Idea is that Settings Icon should be different like a gear Icon
- Settings should be a dropdown and based on the options, we can open Modal like Right Panel (e.g. TicketDetails / TicketPanel)
- Theme could be one option inside the Settings Dropdown and Secondary menu could be Light, Dark, System
- In the Secondary menu of Theme itself, User can also choose the colour theme along with Light/Dark/System option.
- Other Options could be Project Labels, Status Fields, etc.
- Settings Panel will have a SideNavbar which shows all the Options and when user clicks on any option in side navbar then user can edit that particular setting
- We move the Settings Icon at two places (Inside Menu which gets opened through 3 vertical dots in front of Project Name) in SideNavbar and Second Place is Settings Icon on the Board Screen.

## Activity

<!-- longclaw:event
id: evt_e467cb6c
kind: create
occurred_at: 2026-08-11T14:48:54.999Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e478d659
kind: update
occurred_at: 2026-08-12T11:53:51.594Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: Zz
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a48cbbaa
kind: update
occurred_at: 2026-08-12T11:53:55.396Z
actor:
  type: human
  id: local
changes:
  - field: rank
    from: Zz
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a5917b0f
kind: update
occurred_at: 2026-08-12T11:57:07.823Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b25db319
kind: comment
occurred_at: 2026-08-12T11:57:46.273Z
actor:
  type: human
  id: local
-->
### You commented

Prompt shared by Claude Design

```
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/80afa300-653c-4a4e-8aed-6dc54b02e84a?file=LongClaw+Settings+Prototype.dc.html

Focus on these files (the whole project is readable):
- `LongClaw Settings Prototype.dc.html`

Also read these files the selection imports:
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/_ds_bundle.js`
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/styles.css`
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/tokens/colors.css`
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/tokens/fonts.css`
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/tokens/spacing.css`
- `_ds/longclaw-ds-v3-system-d34ededb-196a-431f-b064-1ab2ef09bfe1/tokens/typography.css`
- `assets/logo-dark.svg`
- `assets/logo.svg`
- `support.js`

Implement: `LongClaw Settings Prototype.dc.html`
```
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_778c05c8
kind: comment
occurred_at: 2026-08-12T12:59:06.345Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Implemented on `feat/lc-208-settings-ux` (21ae275).

**Shipped**
- Gear → dropdown (Theme ▸ · General · Labels · Status fields · Keyboard shortcuts · Reload from disk · All settings… ⌘,), with a Theme submenu carrying both axes: appearance (System/Light/Dark, this device) and colour preset (longclaw.yaml).
- Settings panel moved to the right edge with a side nav: General · Theme · Labels · Status fields · Shortcuts · Danger zone. One section at a time; the menu row you pick is the section you land on.
- `⋮` on every side-panel project row: Rename… · Theme ▸ · Star/Unstar · Remove from app… · All settings ⌘,. It acts on a project that may not be the open one.
- Gear icon replaced with the prototype's toothed cog.
- `⌘,` opens settings from anywhere.

**Deviation from the prototype: Status fields is read-only.** ADR 0002 fixes the status set in v0 and the file format has no status registry, so the prototype's inline rename/recolour/reorder/Add status would be writes with nowhere to land. The section lists the six with their on-disk values and says why.

**Not shipped:** the prototype's `Open folder` / `Reveal in Finder` menu rows — there is no Tauri command to reveal a folder, and adding one is backend scope beyond this ticket.

**Two pre-existing harness defects found and fixed on the way**
- `theme-matrix.mjs` stamped `data-theme=<preset>` + `data-appearance=<light|dark>`; `data-appearance` is not a selector anywhere in the product, so all 8 axes rendered byte-identically. "8 axes × 12 states clean" was one axis checked eight times.
- `tabStops` counted roving `tabindex="-1"` buttons as tab stops and returned them out of document order under jsdom.

**Follow-ups worth a ticket**
- `keyboard-focus-map.md` § Global has no `⌘,` row and no rung for the menu layer. Adding one shifts the file, and 124 citations name lines below it — a mechanical but separate re-point.
- `screen-specs.md:59` still specifies the star as a hover-revealed affordance; it is a mark now.
- Pre-existing and unrelated: `cargo test --test cli an_item_can_be_reworded_and_removed_by_id` fails on main — the CLI has no `--edit-item`/`--move-item`/`--after`.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_be599a58
kind: update
occurred_at: 2026-08-12T13:06:25.739Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b8a6752
kind: update
occurred_at: 2026-08-21T06:47:23.429Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
