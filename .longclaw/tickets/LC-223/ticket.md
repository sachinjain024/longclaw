---
format: longclaw.ticket/v1
id: 3d5c26b8-3b6b-40e0-bdf5-e0d9fb3cdb56
key: LC-223
title: "Design audit: converge the app on the Claude Design prototype"
status: in_progress
priority: urgent
labels:
  - design
  - frontend
created_at: 2026-08-18T06:50:53.264Z
updated_at: 2026-08-18T09:45:01.159Z
---

A complete design audit of the app against the Claude Design settings prototype
(`docs/ux/prototypes/LongClaw Settings Screen UI/`, vendoring design system
`longclaw-ds-v3-system-d34ededb…`), covering font size, style and weight,
color, background, borders, radii, shadows, spacing and states — for every
component, not only the settings screen. The founder's direction: **the Claude
Design rendering wins.** The one authority that may overrule a prototype value
is the AA/CVD checker (`a11y-check.mjs`, 226 checks) — where it rejects a hue,
the closest passing value is chosen and **pushed back to Claude Design** so the
two sides converge on the same resolved value instead of drifting apart again.

## Why the two sides look different

The short answer: only the accent layer has a pipe between design and code;
everything else is two hand-written renderings of the same product.

1. **Two parallel implementations.** The prototype composes hand-authored DS
   components (`Input`, `Button`, `BoardCard`, `Toast`) over hand-authored
   token files. The app hand-writes its own CSS over `--lc-*` tokens. LC-192
   (2026-08-10) connected exactly one layer: `design-tokens.json` →
   `design:emit` → `themes.css` pushed to Claude Design, guarded by
   `token-source-guard.mjs` and `design:check`. Accents can no longer drift.
   Neutrals, status hues, typography and component chrome have no such pipe.
2. **LC-192 stopped at the accent layer, knowingly.** Its conflict table
   (`.longclaw/tickets/LC-192/conflicts.md`, groups E/F/G) records 20+ token
   conflicts it identified but did not resolve. They were filed as LC-195 and
   are still `todo`. Consequence, in LC-195's own words: the design system
   renders its components against *unadjusted* neutrals, so "anything designed
   in Claude Design looks subtly unlike the app it is a design for."
3. **Nothing guards the component layer.** LC-197 (`todo`) proposes the
   `components.md` contract guard; until it exists, the DS `Input` and the
   app's input CSS drift silently — which is precisely what this audit found.
4. **The app's styling predates the settings prototype.** LC-208 imported the
   prototype's *structure* (menu, right panel, side nav) but relocated existing
   controls unchanged instead of re-deriving their chrome from the DS
   components — and one class of controls (the settings text inputs) turns out
   to have never been styled at all (§ C1).
5. **LC-198 (`todo`) names the systemic cause:** the prototype's reference job
   and the app are parallel implementations with nothing checking they agree.

## The audit

Both sides were inventoried property-by-property (font family/size/weight,
letter-spacing, color, background, border, radius, padding, dimensions,
shadows, states), the prototype from its HTML + `_ds_bundle.js` + token files,
the app from `styles.css` + `design-tokens.css`. `✓` marks surfaces already
aligned (largely the LC-208 review round: nav metrics, kebab hover, menu
widths, colour-menu geometry). What follows is only the diffs.

### A. Token layer (already catalogued as LC-195 groups E/F/G — execute there, direction set here)

| Token | Prototype (DS) | App | Note |
| --- | --- | --- | --- |
| `ink-3` (meta text) | `#878CA0` | `#666B80` | app darkened for AA — largest single contributor to the "heavier" feel |
| `ink-4` / `ink-disabled` | `#B7BBC9` | `#A9ADC0` | |
| `danger` | `#D64545` | `#C43A3A` | AA |
| `warn` | `#B45309` | `#9A5008` | AA |
| `status-progress` | `#DE9B0D` | `#B47D0A` | AA |
| `status-review` | `#E5732A` | `#C25C1B` | AA |
| backlog/todo/canceled | 3 distinct greys | collapsed to `#82879B` | |
| label ramp | 8 hues incl. `#2AA8A0`, `#8B6CF0`, `#E05B5B`, `#DFA412`, `#878CA0` | AA-shifted: `#2E9BB8`, `#9A6BF3`, `#E15B5B`, `#D9A514`, `#8A90A5` | blue/pink match |
| `micro` type | 10.5px mono | 11.5px ui 500 | same name, different thing (F6) |
| `label` tracking | 0.09em | 0.06em | F5 |
| `display` tracking | −0.02em | −0.015em | F4 |
| title face (F1) | Familjen Grotesk | Geist | the decision that changes every heading |
| agent pulse | 1.8s infinite | 900ms ×2 | G8 |
| `shadow-raised` `0 1px 3px .10` | present | absent | G10 |

Resolution rule for every row: adopt the prototype value **if** it clears the
checker; otherwise the nearest passing value, recorded in `decisions.md`, and
the result pushed to the DS so both sides render it.

### B. The systemic focus/selection differences

| | Prototype | App |
| --- | --- | --- |
| Focus ring | accent border + 3px `--focus-ring` box-shadow hugging the control | 3px `outline` at `outline-offset: 2px` — a detached halo (text controls also swap border) |
| Selected chrome (nav rows, segments, sidebar rows, view toggle) | **neutral**: `line-soft` fill + `ink` + weight 600 | **accent**: `accent-human-soft` fill + accent text (sidebar `.selected`, `.view-segment .selected`, `.appearance-segment .selected`) |

The prototype reserves the accent for *actor* meaning (a person chose this
theme, planned this ticket) and renders *where-am-I* state in neutrals. The
app spends the accent on navigation state. Adopting the prototype's rule is
one decision applied in four places.

### C. Controls (every screen inherits these)

1. **Text inputs — the headline bug.** The app's field styling
   (`label input, …`) only reaches inputs that are *descendants* of a
   `<label>`. Every settings field uses a sibling `<label htmlFor>` or a bare
   `aria-label` input, so the Name field, Key field and the labels editor's
   inputs render as **browser-default boxes at 16px** — no height, border,
   radius or focus treatment from the design system at all. Fix by giving the
   app a real input class per the DS `Input` spec: height 30px, `1px solid`
   `line-strong`, radius 5, ui 13px, padding 0 10px, placeholder `ink-3`,
   focus = accent border + 3px ring; compact 28px / 12.5px variant for dense
   rows (labels editor), mono variants for slug/path/key fields.
2. **Button `small`**: prototype 24px / **11.5px** / 0 9px; app 24px /
   **13px** / 0 9px.
3. **Button hover**: prototype `filter: brightness(0.96)` everywhere; app
   swaps background tokens per variant. Keep the app's token-driven mechanism
   (dark-mode-safe) but verify each variant's hover lands within a step of the
   prototype's rendering.
4. **`.menu-trigger`** (select-like): prototype pads 0 10px at 30px; app pads
   0 8px, and the ordering variant drops to 24px with a softer border.
5. **Toast padding**: prototype 9px 12px, gap 10; app 8px 16px, gap 12.

### D. Settings panel

| Element | Prototype | App |
| --- | --- | --- |
| Presentation | **in-flow** panel that pushes the board aside (like TicketPanel), no scrim by default, no shadow — `border-left` only | fixed overlay + 34% scrim + `shadow-overlay` |
| Panel title | Familjen Grotesk 600 **15px** −0.01em | Geist 600 17px |
| `longclaw.yaml` chip | mono 10.5px, radius 4, `bg` fill | mono 10px, radius 5, `wash` fill |
| Close button | 24×24, radius 5, hover `line-soft` | a `.ghost` at 30px min-height with 12px side padding |
| Content padding | 18px 20px | 16px 20px |
| Section intro | 12.5px `ink-2` lh 1.55 | 13px lh 1.5 |
| Field labels | **12px** 500 **`ink-2`** | 11.5px 500 `ink-3` |
| Key field | width 44, `bg` fill, mono 12 centered, `ink-3` | width 82, unstyled input (§ C1) |
| Folder path | mono **11px** `ink-2`, `bg` fill, `line` border | mono 12px, `wash` fill, `line-strong` border |
| Appearance segment | selected = `line-soft` + `ink` + 600; `ctrl-border` container **with segment separators**; 28px, pad 0 16 | selected = accent-soft + accent text; `line` border, no separators; 30px, pad 0 14 |
| Theme picker | vertical **preset cards** (36×22 split swatch + name 12.5 + ✓, 1.5px border, selected = accent border + ring, max-width 280) | horizontal bare 44×28 swatches with micro name below |
| Shortcuts `kbd` | mono 10.5px `ink-2`, radius 4, `bg` fill, `ctrl-border` | mono 10px, radius 3, `wash` fill |
| Status rows | drag-reorder chevrons + `v0` tag | read-only list — **intentional** (ADR 0002); align rendering of what remains, keep the deviation |

### E. Menus (gear dropdown, kebab menu, submenu)

| Element | Prototype | App |
| --- | --- | --- |
| Shadow | `0 6px 18px rgba(23,25,35,.14)` | `shadow-overlay` (.22) — noticeably heavier |
| Open animation | `lcMenuIn` 120ms (−3px translate + fade) | none |
| Submenu rows | **28px** (parent 30px) | 30px everywhere |
| Row text | 13px (root inheritance) | 12.5px |
| Separator margin | 5px 4px | 4px 4px |
| Kebab menu min-width | 224px | 220px |

### F. Labels editor

| Element | Prototype | App |
| --- | --- | --- |
| Name inputs | 28px bordered, 12.5px, focus ring | unstyled (§ C1) |
| Trigger swatch dot | 9px | 7px |
| Swatch selection | ring in the swatch's own hue (`0 0 0 2px surface, 0 0 0 3.5px color`), 11px dot | 18px hit target, selected = accent border |
| "Add label" | secondary **small** (24px) | secondary full (30px) |
| Remove ✕ hover | `danger` | `ink` |

### G. Sidebar

| Element | Prototype | App |
| --- | --- | --- |
| Wordmark | Familjen 700 **15.5px** −0.03em | Familjen 600 14.5px |
| Section labels | mono **10px** +0.09em | mono 11px +0.06em |
| Selected row | `line-soft` + `ink` 600 (neutral) | `accent-human-soft` + 500 |
| Star | `ink-2` | accent |
| Footer | mono 10.5px `ink-3` | mono 10px `ink-disabled` |

### H. Board header

| Element | Prototype | App |
| --- | --- | --- |
| Structure | 62px header with full-width `border-bottom`, path in mono 10.5 `ink-3` stacked under the title | padded header block, no hairline, path chip inline at mono 12 `ink-2` |
| Title | Familjen 600 16.5px | Geist 600 17px |
| Gear | 26×26, `ink-2`, hover fills `line-soft` | 24×24, `ink-3`, hover changes color only (fill arrives only in the open state) |
| View segment | selected neutral (`line-soft`/ink/600), 28px, 12.5px, segment separators | selected accent-soft/accent, 24px, 12px |
| Filter field | DS Input, 30px, `ctrl-border`, width 180 | 28px, `line` border, 12px text, width 190 |
| Order trigger | 30px, pad 0 10 | 24px, `line` border |

### I. Components beyond the settings flow

| Surface | Prototype (DS) | App |
| --- | --- | --- |
| Board column header | mono 11px +0.09em **uppercase** `ink-3`, plain 8px status-hue dot, `name · count` in one run | Geist 13px 500 `ink-2` + 14px status glyph, count in mono beside it |
| Column metrics | 258px wide, 16px gap, 16px 18px scroller padding | 264px, 12px gap, 8px 0 20px |
| Empty column | dashed border, mono 10.5px `ink-4`, "no tickets yet", padding 16 | dashed guide card, Geist 13px `ink-3`, padding 22 12 |
| Card label chip | 10.5px, padding 0 7px | 11.5px micro, padding 0 6px |
| Checklist checkbox | custom 15px SVG — open: `check-border` #C9CCDA stroke; done: `ink-3` fill + white check | native `<input>` with `accent-color` = human accent |
| Human avatar | filled hue trio (`avatar-1/2/3`: #DDE0F6/#4043B8 …), 600 initials | outline circle, `line-strong` border, `ink-3` initials — the E14 token gap |
| Card hover | none | border firms to `line-strong` — **keep** (the card is a button) |
| Card progress | fill + counter always agent green | neutral `ink-3` until acknowledged, then the actor's accent — **keep**; the DS side violates its own green-exclusivity rule (D2) and gets corrected in the sync push |
| Agent tile avatar, timeline entries, agent hairline/badge, toasts, chips (22px), warn banner | ✓ aligned within a token's width — they inherit the token pass and need no structural work | |

The command palette, list view and drag/drop chrome have no prototype
counterpart and keep their current (token-correct) rendering.

## Approach

Bottom-up, so each layer inherits the one below and nothing is painted twice:

1. **Tokens first** (checklist "Tokens:") — biggest visual payback per edit;
   every value change must clear `npm --prefix apps/desktop run check`.
2. **Control chrome** ("Controls:") — the input class, button small, focus
   ring; one fix, every screen.
3. **The accent rule** ("Accent:") — neutral selected-state in the four
   places that spend accent on navigation today.
4. **Surface passes** ("Settings:", "Menus:", "Sidebar:", "Header:",
   "Components:") — the tables above, each row one edit.
5. **Push back to Claude Design** ("Sync:") — re-emit and design-sync so the
   DS renders the resolved values; then the LC-195/196/197 backlog closes the
   loop on the design side.
6. **Gates**: full `check`, `matrix` (8 axes × 12 states), `a11y:audit`, and
   re-pin citations if design docs change. `screen-specs.md` and
   `components.md` must be updated where the resolution changes a documented
   value — they are the contract, not a mirror.

## Out of scope

- Executing LC-195/196/197/198 wholesale — this ticket sets the *direction*
  (prototype look wins, checker arbitrates) and lands the app-side rendering;
  the DS-side pushes ride the design-sync item.
- The status-field reorder UI the prototype draws (retired by ADR 0002).
- `Open folder` / folder relocation (no Tauri command exists yet).

## Checklist

- [x] Tokens: resolve LC-195 groups E/F/G prototype-first — adopt the DS value where it clears the AA/CVD checker, else the nearest passing value, recorded in decisions.md <!-- longclaw:item=ck_fa00916e -->
- [x] Tokens: move the title/heading roles to Familjen Grotesk (F1) — panel titles, board title, wordmark weights per the prototype <!-- longclaw:item=ck_73ab0e74 -->
- [x] Tokens: restore the 10.5px mono micro role (F6) and 0.09em label tracking (F5); display tracking to -0.02em (F4) <!-- longclaw:item=ck_0a6b25f5 -->
- [x] Tokens: align the label ramp to the prototype hues where the checker allows (E13) <!-- longclaw:item=ck_fcbfda98 -->
- [x] Controls: add a real input class per the DS Input spec (30px, line-strong border, radius 5, ui 13, focus = accent border + 3px ring; 28px/12.5 compact and mono variants) and apply it to every settings and labels field — the label-descendant selector reaches none of them today <!-- longclaw:item=ck_137b0ebc -->
- [ ] Controls: button small variant drops its text to 11.5px <!-- longclaw:item=ck_dea5e6e8 -->
- [x] Controls: replace the offset focus outline with the DS hugging ring (accent border + 3px ring) app-wide <!-- longclaw:item=ck_e1996b6e -->
- [ ] Controls: menu-trigger to 30px with 0 10px padding; toast padding to 9px 12px <!-- longclaw:item=ck_34703d66 -->
- [ ] Accent: selected-state goes neutral (line-soft + ink + 600) in the sidebar rows, view segment and appearance segment; sidebar star back to ink-2 <!-- longclaw:item=ck_bfecfa01 -->
- [ ] Settings: panel becomes in-flow beside the board like TicketPanel — border-left only, no scrim, no overlay shadow <!-- longclaw:item=ck_16e34461 -->
- [ ] Settings: header — Familjen 15px title, 24×24 close affordance, longclaw.yaml chip at mono 10.5 / radius 4 / bg fill <!-- longclaw:item=ck_ec91d2dc -->
- [ ] Settings: text scale — field labels 12px ink-2, section intros 12.5px lh 1.55, content padding 18px 20px <!-- longclaw:item=ck_08031445 -->
- [x] Settings: key field 44px centered mono on bg fill; folder path mono 11px ink-2 on bg fill with line border <!-- longclaw:item=ck_74e52921 -->
- [ ] Settings: appearance segment at 28px with segment separators and neutral selection <!-- longclaw:item=ck_26c0eb6c -->
- [ ] Settings: theme picker becomes the prototype preset cards (36×22 split swatch, name, check; selected = accent border + ring) <!-- longclaw:item=ck_24a56617 -->
- [ ] Settings: shortcuts kbd chips to mono 10.5 / radius 4 / bg fill / ctrl-border <!-- longclaw:item=ck_37275d06 -->
- [ ] Menus: shadow softens to the prototype 0 6px 18px 14%, entrance gets lcMenuIn 120ms, submenu rows 28px, separator margins 5px 4px <!-- longclaw:item=ck_5759b020 -->
- [ ] Labels: 9px trigger dot, selection ring in the swatch's own hue, Add label goes small, remove hover turns danger <!-- longclaw:item=ck_3e7941ef -->
- [ ] Sidebar: wordmark 700 / 15.5 / -0.03em; section labels mono 10 +0.09em; footer mono 10.5 ink-3 <!-- longclaw:item=ck_c35c4f27 -->
- [ ] Header: 62px band with full-width hairline, path stacked under the title in mono 10.5 ink-3, gear 26px with hover fill <!-- longclaw:item=ck_441f2e5b -->
- [x] Header: filter field becomes the DS Input (30px, ctrl-border, 180px) and the order trigger returns to 30px <!-- longclaw:item=ck_1ab64970 -->
- [ ] Components: board column headers go mono 11 +0.09em uppercase with the plain 8px status dot; columns 258px / 16px gap / 16px 18px scroller padding; empty state mono 10.5 ink-4 <!-- longclaw:item=ck_d8a2d43d -->
- [ ] Components: card label chips at 10.5px with 0 7px padding <!-- longclaw:item=ck_e69bcf29 -->
- [ ] Components: checklist checkboxes become the DS 15px SVG pair (check-border open, ink-3 fill + white check) — needs the E15 check-border token <!-- longclaw:item=ck_18536917 -->
- [ ] Components: human avatars adopt the DS filled hue trio (E14 tokens); agent tiles stay exactly as they are <!-- longclaw:item=ck_f5ac2e17 -->
- [ ] Sync: correct the DS BoardCard's always-green progress to the app's actor-conditional rule (D2) as part of the push <!-- longclaw:item=ck_267157f5 -->
- [ ] Sync: run design:emit and /design-sync to push the resolved system to Claude Design (LongClaw DS v3 — system, d34ededb…) — AA neutrals, status hues, typography and the LC-196 retirements ride along <!-- longclaw:item=ck_6347bbb6 -->
- [ ] Sync: extend the generated token layer beyond accents (neutrals, status, type) so the E-group cannot drift again <!-- longclaw:item=ck_ad86f82a -->
- [ ] Gates: npm run check, matrix and a11y:audit green; citations re-pinned; screen-specs.md and components.md updated wherever a resolution changes the documented contract <!-- longclaw:item=ck_9a71d64e -->

## Activity

<!-- longclaw:event
id: evt_817ad3ea
kind: create
occurred_at: 2026-08-18T06:50:53.264Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4fb84ec3
kind: update
occurred_at: 2026-08-18T06:58:09.483Z
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
id: evt_dc678d86
kind: update
occurred_at: 2026-08-18T06:58:11.029Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p1
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_902b0940
kind: update
occurred_at: 2026-08-18T08:37:44.374Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fa00916e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Item 1 done — E/F/G re-derived prototype-first. DS values adopted as-is: warn #B45309, todo/backlog grey #878CA0, ink-disabled pair, dark todo #7E8398. Derived to the gate boundary toward the DS hue: in-review #DF6E23, in-progress #C28000, urgent #DB7129, danger #C9393B, ink-3 #686D80/#7F8599, dark backlog/canceled #5F6375. Pulse follows the DS spec again (1.8s, loops until the state decays); shadow-raised joined the scale. Not adopted (gates bind): distinct backlog/todo/canceled greys, retired-glyph recolors. Checker 226/226; D18 records it all.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8251a795
kind: update
occurred_at: 2026-08-18T09:04:23.146Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_73ab0e74.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Item 2 done — the title role wears the display face (F1): board title, panel titles, create-form heading and the ticket title editor all render Familjen Grotesk 600 via the one token flip; card titles stay ui 13 as the DS BoardCard specifies. Wordmark takes the DS lockup exactly (display 700 / 15.5 / -0.03em) and the 700 weight ships as a real OFL latin subset in both fonts.css copies — font-synthesis: none would have faked it at 600 otherwise. D19 records the call.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_17808128
kind: update
occurred_at: 2026-08-18T09:25:42.329Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0a6b25f5.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Item 3 done — F4/F5/F6 resolved. micro is the 10.5 mono voice again; chip text and the other UI-voice consumers (menu hints, settings notes/labels, create-more, preset names) re-pointed to their own 11.5 ui values per the DS Chip spec; the degraded list row keeps the role since it renders a path. Sidebar section labels now track at +0.09em via the label role; display tightens to -0.02em. D20 records it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_20324da1
kind: update
occurred_at: 2026-08-18T09:35:51.913Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fcbfda98.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Item 4 done — the ramp is the prototype's picker strip verbatim: cyan #2AA8A0, purple #8B6CF0, red #E05B5B, orange #E0762F, amber #DFA412, gray #878CA0 (blue/pink already matched). Checked before adopting: cyan sits at hue 176, outside D12's excluded 120-165 green band, and holds dE >= 20 vs agent green under normal/protan/deutan; its tritanopia 9.4 merely matches the old cyan's 8.9. Dark siblings derive by each old pair's oklab lift. D21 records it, including the DS's own label-watcher disagreeing with its prototype's picker.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_144d0311
kind: update
occurred_at: 2026-08-18T09:45:01.159Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_137b0ebc.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e1996b6e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_74e52921.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1ab64970.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Items 5, 7, 13, 21 done — the input work as one pass. The field foundation now reaches the orphans via an .input class (30px box, 400-weight content text, compact 28px and mono variants), applied to the Name field, key field, both label-editor add inputs and the label name inputs; two tests pin the reach. Focus is the DS hugging ring app-wide (components.md:30 was already the contract) with box-shadow reasserted on cards/rows/tabs that carry their own. Key field is the prototype's 44px centred mono on canvas fill; folder path drops to mono 11 on canvas fill with the quiet line border. The filter field rides the foundation at 180x30 with the 9.5px prototype chip, and the ordering trigger returns to the full 30px control. Gates: 1023 tests, matrix 8x12, a11y:audit 5/5 (52 checks), probe:header 98/98, citations re-pinned after the screen-specs filter line moved to 180x30.
<!-- /longclaw:event -->
