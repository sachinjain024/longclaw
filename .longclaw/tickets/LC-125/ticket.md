---
format: longclaw.ticket/v1
id: b7a50bfb-51e5-4823-80f7-a166bb2da335
key: LC-125
title: Project settings — inline expanding section; the board shifts down by ~430px behind it
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.498Z
updated_at: 2026-08-07T03:46:55.648Z
---

**Prototype.** Centered modal dialog with a scrim

**App.** Inline expanding section; the board shifts down by ~430px behind it

## Source

`docs/cc_screens_diff.md` — **D-40**, § Project settings, severity P1.

## Checklist

- [x] Convert to a modal. The app already has a modal scrim (styles.css:2036) and two dialogs using it. <!-- longclaw:item=ck_08cd5538 -->

## Activity

<!-- longclaw:event
id: evt_e655247f
kind: create
occurred_at: 2026-08-05T15:16:01.498Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4cc5298f
kind: update
occurred_at: 2026-08-07T03:46:55.648Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_08cd5538.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef1177ed
kind: comment
occurred_at: 2026-08-07T03:47:15.009Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Landed on `feat/lc-125-lc-132-project-settings-modal`, together with LC-126 → LC-132: the whole § Project settings row of `cc_screens_diff.md` (D-40 → D-44, D-4J, D-4K, D-4L, and D-0A / D-72 with them).

`ProjectSettings.tsx` is the dialog, built with the app's other layers in `App` rather than inside the main panel — the board stays where it was, and stays visible behind it. The gear says `aria-haspopup="dialog"`; `aria-expanded` describes a region that stays under its trigger.

`Esc` is a document listener rather than a handler on the `<section>`: a click on the dialog's own heading puts focus on `body`, and a handler on the element stops firing there while `App`'s stands down for the open layer. Tab is trapped, as rule 5 of the focus map asks. `a11y:audit` A2 gained two checks — the gear opens it with focus in the first field, `Esc` closes it and returns focus to the gear — and both go red under `--self-test`.

`npm run check`, `npm run a11y:audit` and `npm run matrix` pass.
<!-- /longclaw:event -->
