---
format: longclaw.ticket/v1
id: 13b2335a-b6da-4a1b-8256-94997dc7eb1b
key: LC-201
title: Add Support for creating multiple tickets during "Quick Create” Mode
status: in_progress
priority: urgent
created_at: 2026-08-11T12:45:46.841Z
updated_at: 2026-08-11T13:02:41.137Z
---

User should be able to create multiple tickets during Quick Create Mode. We can enable it by provide a CheckBox / Toggle like “Create More” in the Quick Create mode only.

When users have selected the option and the first ticket is created then Quick Create mode dialog stays with empty name and description while rest of the fields like Status, Priority, etc. copies from previous option.

## Spec

- Product spec: `docs/plans/active/LC-201-Bulk-Create-In-Quick-Create-Mode.md`
- Prototype: `docs/ux/prototypes/LC-201-Bulk-Create-In-Quick-Create-Mode.html`

Both are on the `feat/lc-201-quick-create-multiple` branch and are waiting on the
human review this ticket's checklist asks for before any code is written.

The spec widens quick create by two fields — a plain auto-growing **description**
(not the Write/Preview editor, which stays in full create) and **labels** through
the project's own menu — adds a **Create more** checkbox that is off on every
open and never persisted, and keeps the checklist in full create. With the box
ticked, Create writes the ticket optimistically as it does today, then clears
title and description, keeps status, priority and labels, advances the guessed
key, and returns focus to the title field. Neither `focusCard` may run on that
path: the second one fires when the disk write returns, which during a run is
while the next title is being typed.

It also re-opens a decision V0-16 took deliberately. Labels were cut because the
control was a comma-separated text box, not because the field was wrong, and
`LabelMenuButton` cannot produce a slug `longclaw.yaml` does not define — so the
menu re-introduces nothing. The description's case rests on Create more alone.

Three questions are open for the review, and the prototype has a switch for each:
the hints line now that a textarea is in the modal, whether **Create more** sits
in the footer or on the meta row, and whether the description belongs in quick
create at all.

## Checklist

- [ ] Add Support for description in Quick Create Mode <!-- longclaw:item=ck_1dea8249 -->
- [ ] Add Support for Lable in Quick Create Mode <!-- longclaw:item=ck_b58b13db -->
- [ ] Add "Create More” Checkbox in the Quick Create Mode which is bydefault unchecked <!-- longclaw:item=ck_c166a5e1 -->
- [ ] In the Follow up Creation Mode, Retain the value of Status, Priority & Label <!-- longclaw:item=ck_cafa4ea2 -->
- [x] Create the Product Spec in docs/plans/active/ with the name LC-XXX-Bulk-Create-In-Quick-Create-Mode.md <!-- longclaw:item=ck_608bdeed -->
- [ ] Once the task is complete, then move the above plan to docs/plans/completed directory <!-- longclaw:item=ck_30aed702 -->
- [x] Add the reference to the plan doc in this ticket. Update the description <!-- longclaw:item=ck_0fd47f92 -->
- [x] Use the design system to generate a prototype.html inside docs/ux/prototypes/LC=XXX….html <!-- longclaw:item=ck_f6bcba19 -->
- [ ] Product Spec -> Prototype.HTML Human Review. Wait for it before the implementation <!-- longclaw:item=ck_c7bc2bbf -->
- [ ] Once you get human review of Prototype.html then start the actual coding of the task <!-- longclaw:item=ck_eb951d8a -->
- [ ] Ship -> Commit & Merge to main <!-- longclaw:item=ck_0dbbee71 -->

## Activity

<!-- longclaw:event
id: evt_7ee1d93a
kind: create
occurred_at: 2026-08-11T12:45:46.841Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4fc6bb0e
kind: update
occurred_at: 2026-08-11T12:45:50.880Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7ac13016
kind: update
occurred_at: 2026-08-11T12:45:51.077Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3fa3d087
kind: update
occurred_at: 2026-08-11T12:45:51.691Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c42f3e13
kind: update
occurred_at: 2026-08-11T12:45:52.046Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_00097c4a
kind: update
occurred_at: 2026-08-11T12:45:53.172Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "false"
    to: "true"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_59b22185
kind: update
occurred_at: 2026-08-11T12:45:53.751Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_eb951d8a.checked
    from: "true"
    to: "false"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3e42651b
kind: update
occurred_at: 2026-08-11T13:02:41.137Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_608bdeed.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f6bcba19.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0fd47f92.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
