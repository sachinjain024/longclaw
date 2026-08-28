---
format: longclaw.ticket/v1
id: f0085d76-29f3-44a3-bf3f-fd6401174b52
key: LC-236e
title: Define a new label from inside the create flows
status: todo
priority: none
labels:
  - frontend
  - product
created_at: 2026-08-28T04:12:09.099Z
updated_at: 2026-08-28T04:12:09.099Z
---

Both create surfaces can attach labels and neither can define one. `LabelMenuButton` lists exactly what `longclaw.yaml` defines plus any slug the ticket already carries, so on a project whose `labels:` map is empty — a fresh project, or one whose vocabulary has not been written yet — the menu opens on nothing and there is no way forward from inside the flow. Defining a label is only in project settings, which means leaving the half-typed ticket, opening settings, adding the slug, coming back and starting again.

The gap is the same in both surfaces and should close in both:

- **Quick create** (`QuickCreate.tsx:285`) — the meta row's label menu.
- **Full create through the editor** (`CreatePanel.tsx:304`) — the `Labels` row.

## What to build

Give `LabelMenu` a create affordance — a row in the popover that defines a new label and ticks it onto the ticket being written, in one gesture. It needs the same three fields the settings row already asks for: slug, display name and a colour from `LABEL_COLORS` (`labels.ts:22`); a sensible default colour and a name defaulted from the slug would let the common case be slug + Enter.

The write already exists on both sides — `addProjectLabel` (`api.ts:126`), `add_label` down through `app_state.rs:94`, `registry.rs:158` and `core/project.rs:160`, and `longclaw label add` on the CLI. This is a control, not a new capability.

## What the change has to respect

- **A slug is immutable once a ticket carries it.** `LabelMenu`'s header comment says it never edits a slug, and that stays true — this adds one, it does not rename one.
- **Defining a label is a project write, and it lands immediately.** The label outlives an abandoned draft: someone who defines `infra` and then closes quick create without creating a ticket has still changed `longclaw.yaml`. Decide that deliberately and say so in the comment; the alternative — holding the definition until the ticket is created — makes the ticket write conditional on a second write and is worse.
- **The green band is not on the ramp** (`labels.ts:17-21`) — green belongs to the agent, and the new colour picker must not reach for one.
- **A duplicate slug is a refusal, not a silent no-op.** `ProjectSettings.tsx:74` already routes the add-a-label row's failure through `onWrite`; the create surfaces need the same refusal path rather than a menu that quietly does nothing.
- **`tabIndex` is explicit.** The new row's button and any checkbox in it need `tabIndex={0}` or `-1`, or `npm run check` fails (`scripts/tab-order-guard.mjs`).
- **The keyboard contract covers the popover.** A text field inside an anchored `Menu` is new — the menu's existing key handling assumes rows, so typing in the field must not steer the list or close the popover. Update `keyboard-focus-map.md` in place and run `npm run a11y:audit`.

## Not in scope

Renaming, recolouring and removing definitions stay in project settings. This is the create path only.

## Checklist

- [ ] Add a define-a-label row to the LabelMenu popover: slug, name, colour from LABEL_COLORS <!-- longclaw:item=ck_02993786 -->
- [ ] Wire it in quick create (QuickCreate.tsx) so a new slug is defined and ticked in one gesture <!-- longclaw:item=ck_0e335d84 -->
- [ ] Wire the same row into full create's Labels row (CreatePanel.tsx) <!-- longclaw:item=ck_c90eb922 -->
- [ ] Route a duplicate or refused slug through the write-feedback path rather than a silent no-op <!-- longclaw:item=ck_f83e5c14 -->
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
