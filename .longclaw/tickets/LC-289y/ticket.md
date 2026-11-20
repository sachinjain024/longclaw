---
format: longclaw.ticket/v1
id: 5eee1a88-7307-4f90-82d7-145e0392476c
key: LC-289y
title: Test the admin-prompt CLI install on a fresh M2 MacBook (0.4.0)
status: todo
priority: p2
labels:
  - platform
type: chore
created_at: 2026-11-20T13:47:32.104Z
updated_at: 2026-11-20T13:47:32.512Z
---

Run the LC-285r manual test plan on the spare 8 GB M2 MacBook with LongClaw 0.4.0. The plan is attached as a reference (`docs/acceptance/LC-285r-manual-test-plan.md`); each checklist item below is one of its scenarios, with the expected result in the plan's table. Record each result in a comment on this ticket, with the macOS version.

Section C settles LC-288d (the refusal error number): close that ticket with what C1 shows.

## Setup

1. Download `LongClaw_0.4.0_aarch64.dmg` from longclaw.io, drag it into `/Applications` and open it. Expect one dialog, saying Apple found no malware, with **Open**.
2. In Terminal: `ls -ld /usr/local/bin`. On a fresh Apple Silicon Mac it says _No such file or directory_. If it exists, note its owner.
3. In the app, create one project folder to test from, for example `~/lc-test`.

## Resetting between scenarios

- `sudo rm -f /usr/local/bin/longclaw` removes the link.
- `sudo rmdir /usr/local/bin` removes the folder, if it is empty.
- To see the first-launch dialog again after _Skip for now_, tick _Ask again when I open a project without the command_ in _Settings › Command line_, then reopen a project.


## Checklist

- [ ] 1. Setup: DMG installs and opens with the notarized dialog; /usr/local/bin state recorded <!-- longclaw:item=ck_03a669cf -->
- [ ] 2. A. It installs <!-- longclaw:item=ck_b88d58e6 -->
- [ ] 2.1 A1: no /usr/local/bin, first-launch dialog → sheet sentence correct, installs, longclaw ticket list works in a project <!-- longclaw:item=ck_1db4be90 -->
- [ ] 2.2 A2: root-owned /usr/local/bin → installs through the sheet <!-- longclaw:item=ck_7e933400 -->
- [ ] 2.3 A3: /usr/local/bin owned by you → installs with no sheet <!-- longclaw:item=ck_a02022d8 -->
- [ ] 2.4 A4: stale link → Point it at this app re-links through the sheet <!-- longclaw:item=ck_1ad2c7bd -->
- [ ] 2.5 A5: A1 again from Settings › Command line <!-- longclaw:item=ck_31ad559d -->
- [ ] 3. B. Cancel <!-- longclaw:item=ck_befc6109 -->
- [ ] 3.1 B1: cancel the sheet → Nothing was installed, Install kept, no sudo line <!-- longclaw:item=ck_ce09f86c -->
- [ ] 3.2 B2: Install again → the sheet comes back <!-- longclaw:item=ck_9c44065f -->
- [ ] 3.3 B3: cancel, then close the first-launch dialog → skipped toast <!-- longclaw:item=ck_f5c19f3a -->
- [ ] 4. C. Wrong password (settles LC-288d) <!-- longclaw:item=ck_81a6cfe4 -->
- [ ] 4.1 C1: wrong password until macOS gives up → refused-password message, sudo line, Try again; if not, record what showed <!-- longclaw:item=ck_c4e94084 -->
- [ ] 4.2 C2: Try again → the sheet comes back <!-- longclaw:item=ck_eda7dbb7 -->
- [ ] 4.3 C3: standard (non-admin) user → sheet asks for an admin; right details install, wrong ones refuse <!-- longclaw:item=ck_4d6c5506 -->
- [ ] 4.4 C4: an admin runs the copied sudo line → pane shows installed <!-- longclaw:item=ck_bcf91652 -->
- [ ] 5. D. Someone else's file <!-- longclaw:item=ck_c61f4cd5 -->
- [ ] 5.1 D1: a file at /usr/local/bin/longclaw → occupied sentence, no button, file untouched <!-- longclaw:item=ck_bdffc97d -->
- [ ] 5.2 D2: file arrives while the sheet is up → same as D1, file untouched <!-- longclaw:item=ck_9868cf04 -->
- [ ] 6. E. While the sheet is up <!-- longclaw:item=ck_09c13f5a -->
- [ ] 6.1 E1: Waiting for your password, Skip and Esc disabled, focus returns to the main button <!-- longclaw:item=ck_3107b2d6 -->
- [ ] 6.2 E2: VoiceOver says macOS is asking for an administrator password <!-- longclaw:item=ck_7d9f05a6 -->
- [ ] 7. Offline Gatekeeper: with Wi-Fi off, the first launch still shows the no-malware dialog <!-- longclaw:item=ck_f182d392 -->

## Ticket References

<!-- longclaw:reference
id: ref_fd99e7e4
path: docs/acceptance/LC-285r-manual-test-plan.md
added_at: 2026-11-20T13:47:32.512Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-285r-manual-test-plan.md](../../../docs/acceptance/LC-285r-manual-test-plan.md)
<!-- /longclaw:reference -->

## Activity

<!-- longclaw:event
id: evt_0fd1d683
kind: create
occurred_at: 2026-11-20T13:47:32.104Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e55b0b80
kind: update
occurred_at: 2026-11-20T13:47:32.490Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_03a669cf.added
    to: "1. Setup: DMG installs and opens with the notarized dialog; /usr/local/bin state recorded"
  - field: checklist.ck_b88d58e6.added
    to: 2. A. It installs
  - field: checklist.ck_1db4be90.added
    to: "2.1 A1: no /usr/local/bin, first-launch dialog → sheet sentence correct, installs, longclaw ticket list works in a project"
  - field: checklist.ck_7e933400.added
    to: "2.2 A2: root-owned /usr/local/bin → installs through the sheet"
  - field: checklist.ck_a02022d8.added
    to: "2.3 A3: /usr/local/bin owned by you → installs with no sheet"
  - field: checklist.ck_1ad2c7bd.added
    to: "2.4 A4: stale link → Point it at this app re-links through the sheet"
  - field: checklist.ck_31ad559d.added
    to: "2.5 A5: A1 again from Settings › Command line"
  - field: checklist.ck_befc6109.added
    to: 3. B. Cancel
  - field: checklist.ck_ce09f86c.added
    to: "3.1 B1: cancel the sheet → Nothing was installed, Install kept, no sudo line"
  - field: checklist.ck_9c44065f.added
    to: "3.2 B2: Install again → the sheet comes back"
  - field: checklist.ck_f5c19f3a.added
    to: "3.3 B3: cancel, then close the first-launch dialog → skipped toast"
  - field: checklist.ck_81a6cfe4.added
    to: 4. C. Wrong password (settles LC-288d)
  - field: checklist.ck_c4e94084.added
    to: "4.1 C1: wrong password until macOS gives up → refused-password message, sudo line, Try again; if not, record what showed"
  - field: checklist.ck_eda7dbb7.added
    to: "4.2 C2: Try again → the sheet comes back"
  - field: checklist.ck_4d6c5506.added
    to: "4.3 C3: standard (non-admin) user → sheet asks for an admin; right details install, wrong ones refuse"
  - field: checklist.ck_bcf91652.added
    to: "4.4 C4: an admin runs the copied sudo line → pane shows installed"
  - field: checklist.ck_c61f4cd5.added
    to: 5. D. Someone else's file
  - field: checklist.ck_bdffc97d.added
    to: "5.1 D1: a file at /usr/local/bin/longclaw → occupied sentence, no button, file untouched"
  - field: checklist.ck_9868cf04.added
    to: "5.2 D2: file arrives while the sheet is up → same as D1, file untouched"
  - field: checklist.ck_09c13f5a.added
    to: 6. E. While the sheet is up
  - field: checklist.ck_3107b2d6.added
    to: "6.1 E1: Waiting for your password, Skip and Esc disabled, focus returns to the main button"
  - field: checklist.ck_7d9f05a6.added
    to: "6.2 E2: VoiceOver says macOS is asking for an administrator password"
  - field: checklist.ck_f182d392.added
    to: "7. Offline Gatekeeper: with Wi-Fi off, the first launch still shows the no-malware dialog"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f388992b
kind: update
occurred_at: 2026-11-20T13:47:32.512Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_fd99e7e4.added
    to: LC-285r-manual-test-plan.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
