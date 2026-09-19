---
format: longclaw.ticket/v1
id: 052c3901-1c4f-4a70-83ad-340742251f02
key: LC-261h
title: Remove Command line tool from the gear menu
status: todo
priority: p2
labels:
  - frontend
  - ready-for-agent
estimate: "1"
created_at: 2026-09-19T00:49:57.005Z
updated_at: 2026-09-19T00:49:57.005Z
---

The gear menu's `Command line tool` row goes, leaving that menu about the
project you are looking at. The pane itself does not move: it keeps its row in
the settings panel's side nav and is still reached by `All settings` and `⌘,`.

`settingsSections.ts` already carries the argument — `Command line` sits
"beside the other pane that is about the app rather than about this project" —
and LC-256a's UX review took it one step further. A control labelled *Project
settings* should not offer app-level panes from its menu, so that review removed
this row and declined to add an `Updates` row beside it. The prototype shows the
result: [`docs/ux/prototypes/LC-256a-Auto-Update.html`](../../../docs/ux/prototypes/LC-256a-Auto-Update.html),
the **Gear menu** scene.

Split out of LC-256a because this half changes behaviour that shipped in 0.1.0,
and a release note saying a menu row moved should not be buried inside the
auto-update ticket.

**Nothing becomes unreachable.** `SETTINGS_SECTIONS` is unchanged, so the pane
keeps its nav row, its landing behaviour and its keyboard path.

**One loose end to decide rather than assume.** `commandLineHint()` in
`CommandLineInstall.tsx` exists only to fill this row's trailing hint, and it
has its own tests. With the row gone it has no caller. Deleting it and its tests
is the obvious move, but it is a deliberate one rather than a tidy-up, so it is
a checklist item rather than a footnote.

## Related

- LC-256a settled this in its UX review and carries the prototype.

## Checklist

- [ ] Remove the commandLine row from SettingsMenu.tsx <!-- longclaw:item=ck_97ba8c11 -->
- [ ] Remove the now-unread commandLineHint prop from SettingsMenu and its test harness <!-- longclaw:item=ck_71c88edf -->
- [ ] Decide what becomes of commandLineHint() in CommandLineInstall.tsx and its tests, which exist only for this row <!-- longclaw:item=ck_2ba99821 -->
- [ ] Update App.test.tsx where it asserts the gear menu's rows <!-- longclaw:item=ck_573c3463 -->
- [ ] Leave settingsSections.ts alone: the pane keeps its nav row and its ⌘, path <!-- longclaw:item=ck_161a5edb -->
- [ ] npm run verify green <!-- longclaw:item=ck_7544e627 -->

## Activity

<!-- longclaw:event
id: evt_3526def1
kind: create
occurred_at: 2026-09-19T00:49:57.005Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
