---
format: longclaw.ticket/v1
id: 231dc311-6df0-48ab-9ad2-07d3534ab0ae
key: LC-243d
title: Fix the Inconsistencies with the Prototype
status: todo
priority: none
created_at: 2026-08-31T09:50:40.465Z
updated_at: 2026-09-15T15:44:35.478Z
---


## Checklist

- [x] Board and List View Switcher <!-- longclaw:item=ck_73bf8498 -->
- [x] Remove the Border around “-“ when there is no Priority. Simply Show as - <!-- longclaw:item=ck_1af0547b -->
- [ ] Ticket Panel Fields <!-- longclaw:item=ck_f9160e3b -->
- [ ] Date Field in Ticket Panel is too long. <!-- longclaw:item=ck_01be6641 -->
## Activity

<!-- longclaw:event
id: evt_af82df7b
kind: create
occurred_at: 2026-08-31T09:50:40.465Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_058d2a32
kind: update
occurred_at: 2026-09-15T12:18:28.269Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_73bf8498.added
    to: Board and List View Switcher
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dbc39ff6
kind: update
occurred_at: 2026-09-15T12:18:31.738Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_f9160e3b.added
    to: Ticket Panel Fields
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4fb940c4
kind: update
occurred_at: 2026-09-15T12:59:39.791Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_1af0547b.added
    to: Remove the Border around “-“ when there is no Priority. Simply Show as -
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4e410583
kind: update
occurred_at: 2026-09-15T13:00:10.953Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_01be6641.added
    to: Date Field in Ticket Panel is too long.
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_415ebae9
kind: update
occurred_at: 2026-09-15T13:17:53.846Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_73bf8498.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_990d7a82
kind: comment
occurred_at: 2026-09-15T15:21:35.457Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Board and List View Switcher — shipped in PR #47: https://github.com/sachinjain024/longclaw/pull/47

The header's Board | List segment now draws the prototype's mark in front of each word and fills the pressed half with `--lc-accent-human` (`prototype.js:115-116`, `prototype.css:330-335`). The two marks are masters on `glyphs.svg` and registered with `glyph-drift-guard`, so the sheet and the component cannot drift apart.

Two decisions the review settled, recorded here because the prototype and the docs disagreed:

1. The settings dialog's Appearance and Estimate segments move with the header's. They share one rule and the prototype fills all three the same way, so scoping the change to `.view-segment` would have left the shared rule prescribing a treatment nothing used. `components.md:31` was amended in place to say so.
2. The pressed pill needed a focus ring of its own. `--lc-accent-human-ring` is the accent at 14%, and over `--lc-accent-human` it composites to exactly that fill — the ring painted an identical pixel and tabbing onto Board showed nothing. It is now drawn in `--lc-on-accent-human` at full opacity (5.6:1 at worst across the five themes × both appearances). `components.md:30` names the exception and `a11y:audit` A3 measures it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_69ab7e78
kind: update
occurred_at: 2026-09-15T15:27:24.653Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_1af0547b.moved
    from: "3"
    to: "2"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_471c6976
kind: update
occurred_at: 2026-09-15T15:44:35.478Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1af0547b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e8d2f634
kind: comment
occurred_at: 2026-09-16T06:16:34.662Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Board | List view switcher, the pressed state — settled as **option B** (words, accent the pressed half), shipped in PR #48.

The prototype stood the three answers in the real header row, in five themes × both appearances, and the review picked B:

- **A — icon only.** Not taken. It saves 78px and costs both words; the buttons then need `aria-label`s they do not need today, and two unlabelled 12px marks is a lot of recognition to ask of the one control that says which surface you are looking at.
- **B — words, accent the pressed half.** Taken. The control keeps the shape the prototype draws — mark, then word, both halves, equal width — and only the fill's job moves, to the ink.
- **C — the mark is the state.** Not taken. It is the only one of the three that survives greyscale with nothing left over, but it leaves an 18px indent in front of the unpressed word that means nothing on its own.

What shipped, in `styles.css` § the segmented control:

- The pressed half is `--lc-accent-human-text` + 600 on the segment's own surface, and the unpressed half steps back from `ink-2` to `ink-3` so the pressed one is the stronger of the two. The 600 is not decoration: the two inks come as close as 1.1:1 in luminance, so the weight is what keeps this from being state by colour alone.
- **Why the fill went.** One row holds the filter field, the ordering trigger, this segment and `New ticket` — and `New ticket` is the accent fill in that row, the one action a header is for. A second fill the width of `Board` put the surface you are already looking at in competition with it. This is a deliberate departure from `prototype.css:334`, which this ticket otherwise exists to follow.
- **The dialog's segments keep the fill** (`prototype.css:724`): they have no accent-filled neighbour, and the ask was about the header's switcher. That reverses half of decision 1 in the PR #47 comment above — the two no longer share one `.selected` rule — and `components.md:31` now names both treatments. **Open:** whether Appearance and Estimate should follow the header's. Worth its own item rather than a silent change to a dialog nobody asked about.
- **The focus indicator, fixed on both halves.** Taking the fill away also takes away the special ring PR #47 had to invent, but handing back the ordinary inset ring was not enough: `--lc-focus-ring` on its own is the accent at 14%, which is 1.2:1 against the pill it lands on where WCAG 2.2 SC 1.4.11 wants 3:1. This control cannot spell the other half of the treatment as a border — `border: 0`, because the group clips — so the 1px `--lc-accent-human` line `components.md:30` asks for is now a second inset shadow beside the ring. Measured 5.6:1 on both halves, light and dark. It fixes the unpressed half too, which had worn the ring alone since the control existed.
- **`a11y:audit` A3 stopped being blind.** It was a KNOWN-BLIND row, and blind on `main` — `--self-test` had reported "A3 passed against a broken build" since the row was written — because the break it injected took the outline, which is neither of focus's two carriers here. The break is now `box-shadow: none`, which the segment's contrast checks can see, and `--self-test` now reports every row red.

### Copy deck, settled

Option B changes no copy, which is a good part of the case for it: the two rows the prototype marked `new` (`a11y.board`, `a11y.list`) existed only because option A took the words off the screen and left the buttons with no accessible name. Recorded here because the prototype is deleted.

| id | text | kind and where | status |
|---|---|---|---|
| `view.group` | View | group name — `aria-label` on the `role="group"`, so a reader hears "View, Board, pressed" | ships |
| `view.board` | Board | button label, content header | ships |
| `view.list` | List | button label, content header | ships |
| `view.pressed` | pressed | state, announced not drawn — `aria-pressed`, the platform's word rather than ours | ships |

Both marks stay `aria-hidden`: the button carries the word, and a mark that repeated it would say it twice.

The prototype was `docs/ux/prototypes/LC-243d-Board-List-View-Switcher-Selected-State.html`, deleted with this change and in the history at `567d0cf`.
<!-- /longclaw:event -->
