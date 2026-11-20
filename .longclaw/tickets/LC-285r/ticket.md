---
format: longclaw.ticket/v1
id: e259ac7d-0aaf-4344-8845-ca19901c76a4
key: LC-285r
title: "Installing the command line fails after a fresh install: LongClaw could not write to /usr/local/bin"
status: in_progress
priority: urgent
labels:
  - platform
  - ready-for-agent
type: bug
created_at: 2026-11-11T11:19:28.711Z
updated_at: 2026-11-20T09:42:51.811Z
---

After installing LongClaw on a new Mac — especially Apple Silicon (M series) — the *Use LongClaw with Agents* intro dialog cannot install the `longclaw` command. Pressing Install CLI (then *Try again*) shows "LongClaw could not write to /usr/local/bin. The line below does the same thing." and offers a `sudo mkdir -p … && sudo ln -sf …` line to paste into Terminal. The one-press path never succeeds, so the only way through is to leave the app, open Terminal, and type an administrator password there. That is the install step this screen exists to save someone (LC-233).

![The Use LongClaw with Agents dialog refusing to write to /usr/local/bin](./attachments/att_459c90d7-cli-install-refused.png)

![Same refusal on a new Apple Silicon Mac: Install CLI falls back to a sudo line](./attachments/att_885fd837-cli-install-m-series-refused.png)

Where it comes from: `install_command_line` in `src-tauri/src/platform/macos.rs` links `/usr/local/bin/longclaw` as the signed-in user. `/usr/local/bin` is root-owned (or missing) on a Mac that never had Homebrew for Intel installed, so `symlink` gets EACCES and the refusal path returns the copy-paste command. That is designed behaviour from LC-233, so on a stock Apple Silicon Mac the refusal is the common case, not the exception. LC-233 left escalation open only if the plain symlink proved insufficient in practice; this is that case.

The fix is specified in the spec recorded as this ticket's reference: an administrator prompt from inside the app, through one shared privileged module. The review's decisions and the settled copy deck stay here, as the prototype rules require.

## Review decisions (prototype, 2026-11-19)

The prototype was `docs/ux/prototypes/LC-285r-Install-The-Command-With-An-Administrator-Prompt.html`, deleted once settled; see `docs/ux/prototypes/README.md` for the commit that holds it.

- **A · In place.** No warning before the press: the button reads `Install` (or `Point it at this app`), and macOS's password sheet simply appears when it is needed (Q5-B).
- **When the sheet appears (Q4-A).** The plain write is tried first, and the sheet appears only when it is refused with `EACCES`. A Mac whose `/usr/local/bin` is writable never sees a prompt. A full disk, a read-only volume and an occupied path are never escalated.
- **B · The flow / behind the sheet.** The primary reads `Waiting for your password`, disabled, and `Skip for now` is disabled too; a polite live region says macOS is asking for a password. When the sheet closes, focus returns to the dialog's primary.
- **C · The sheet.** LongClaw passes macOS one sentence, `mac.prompt`, through AppleScript's `with prompt`; macOS draws everything else.
- **D · Cancelled.** Not a refusal and not `Try again`: "Nothing was installed." and the same `Install` button, which brings the sheet back. No `sudo` line. Closing the dialog after a cancel counts as a skip and raises the skipped toast.
- **E · Failures.**
  - **Password refused** (three wrong tries, or a standard account): the refusal and the `sudo` line, for someone else who administers the Mac. `Try again` brings the sheet back.
  - **Disk full:** the refusal and no `sudo` line, since `sudo` cannot make room. `Try again` re-writes and does not escalate.
  - **Occupied path:** no button, never escalated, with the reworded `status.occupied`.
- **Try again** appears only after a failure a second attempt could fix (a refused password, a full disk). It never repeats a write that is certain to fail the same way.
- **F · Installed.** Unchanged from today.
- **G · Installing later.** No new surface. The skipped toast names *Settings › Command line* (with *Open settings* inside a project), and the pane's *Ask again…* brings the dialog back. That holds after LC-261h removes the gear-menu row.
- **`refusal.denied` is deleted.** "LongClaw could not write to /usr/local/bin. The line below does the same thing." becomes unreachable: a refused write goes to the sheet, and a failed privileged script says `failed.script`.
- **Keyboard.** `keyboard-focus-map.md` has no section for the CLI offer, so the two keyboard rules are recorded here: both footer buttons are disabled while the sheet is up, and focus returns to the primary after it closes.

## Copy deck

Settled from the prototype. `{reason}` is the underlying error. `mac.prompt` is plain text in a system dialog.

| Id | Kind | Where | Text | Status |
| --- | --- | --- | --- | --- |
| `offer.title` | title | Intro dialog, heading | Use LongClaw with Agents | existing |
| `offer.title.done` | title | Intro dialog, heading after a successful install | `longclaw` is on your PATH | existing |
| `offer.lede` | note | Intro dialog and pane, first line | Add the `longclaw` binary to your `PATH` so agents can read, file, update and close tickets. | existing |
| `preview.caption` | caption | Terminal preview block | what it gets you · example | existing |
| `preview.caption.stale` | caption | Terminal preview block, stale link | what it is running today · example | existing |
| `button.install` | button | Dialog footer / pane header — the primary | Install | existing |
| `button.stale` | button | Primary, stale link | Point it at this app | existing |
| `button.installing` | button | Primary, disabled, during the write | Installing… | existing |
| `button.waiting` | button | Primary, disabled, while macOS's password sheet is up | Waiting for your password | new |
| `button.retry` | button | Primary, after a failure that a second attempt could fix | Try again | existing |
| `button.skip` | button | Dialog footer, dismissal | Skip for now | existing |
| `button.done` | button | Dialog footer, after success | Done | existing |
| `button.close` | button | Dialog footer, nothing to install | Close | existing |
| `button.copy` | button | Beside the Terminal line | Copy | existing |
| `mac.prompt` | system prompt | macOS password sheet — the sentence LongClaw supplies (`with prompt`) | LongClaw wants to add the longclaw command to /usr/local/bin. | new |
| `live.waiting` | live region | Dialog/pane live region while the sheet is up | macOS is asking for an administrator password. | new |
| `cancel.text.quiet` | note | Dialog/pane after the password sheet is cancelled | Nothing was installed. | new |
| `failed.admin` | refusal | After macOS refused the password (three wrong tries, or a standard account) | macOS did not accept an administrator password, so nothing was installed. If someone else administers this Mac, they can run the line below. | new |
| `failed.script` | refusal | After the privileged script itself failed (rare: e.g. the disk filled between check and write) | LongClaw could not install the command, even as an administrator: {reason} | new |
| `refusal.diskfull` | refusal | After the write failed because the disk is full | Installing the longclaw command failed: there is no space left on the disk. | existing |
| `manual.instead` | field label | Above the Terminal line, after a refusal | Run this in Terminal instead: | existing |
| `manual.yourself` | field label | Above the Terminal line, occupied path | To do it yourself: | existing |
| `a11y.copy` | aria-label | Copy button beside the Terminal line | Copy the install command | existing |
| `a11y.preview` | aria-label | Terminal preview block | Example of the longclaw command and its output | existing |
| `toast.copied` | toast | After Copy | Command copied | existing |
| `status.linked` | note | Pane, linked | `longclaw` is installed at `/usr/local/bin/longclaw` and points at this copy of LongClaw. | existing |
| `status.stale` | note | Pane and dialog, stale link | `/usr/local/bin/longclaw` points at `/Users/sam/Downloads/LongClaw.app/Contents/MacOS/longclaw`, which is not this copy of LongClaw. Re-linking replaces it. | existing |
| `status.occupied` | note | Pane and dialog, a file LongClaw did not create | LongClaw cannot replace `/usr/local/bin/longclaw`. Move it or rename it, then reopen this pane, or run the line below yourself. | changed |
| `toast.installed` | toast | After Done | longclaw is on your PATH. | existing |
| `toast.skipped` | toast | After Skip for now, inside a project | Skipped. Settings › Command line has it whenever you want it. | existing |
| `toast.skipped.welcome` | toast | After Skip for now, on the welcome screen | Skipped. Open a project, and Settings › Command line has it. | existing |
| `toast.skipped.action` | button | On the skipped toast | Open settings | existing |
| `pane.title` | title | Settings, pane heading / nav | Command line | existing |
| `pane.name` | label | Pane header | longclaw | existing |
| `pane.kind` | label | Pane header, beside the name | command-line interface | existing |
| `pane.askAgain` | checkbox | Pane footer | Ask again when I open a project without the command | existing |
| `pane.askAgain.hint` | hint | Pane footer, beside the checkbox | — off since you chose Skip for now | existing |
| `menu.row` | menu row | Gear menu | Command line tool | existing |
| `menu.hint.absent` | menu hint | Gear menu row | not set up | existing |
| `menu.hint.linked` | menu hint | Gear menu row | on PATH | existing |

## Checklist

- [ ] 1. Prefactor: one shared privileged module (blocked by: none) <!-- longclaw:item=ck_ff8688b1 -->
- [x] 1.1 Move the Privileged port, the main-thread prompt and the AppleScript/shell quoting into the new module <!-- longclaw:item=ck_ebda3d42 -->
- [x] 1.2 Make the module's scripts a closed set, with the bundle replacement as its first entry <!-- longclaw:item=ck_971d0f63 -->
- [x] 1.3 Report a typed outcome: succeeded, cancelled, refused, failed <!-- longclaw:item=ck_4cd9867d -->
- [x] 1.4 Move the release-audit osakit rule and its --self-test fixtures to the new module <!-- longclaw:item=ck_3d475b08 -->
- [x] 1.5 Amend ADR 0018's 'only privileged execution' rule <!-- longclaw:item=ck_043c6bab -->
- [ ] 2. Tracer bullet: Install escalates and succeeds on both surfaces (blocked by: 1) <!-- longclaw:item=ck_c4ab5c4d -->
- [ ] 2.1 Link-the-command script: create the folder, re-check the occupied path as root, link under a temporary name and rename; Rust tests over the port <!-- longclaw:item=ck_e8637f1e -->
- [ ] 2.2 Flag only the plain write's permission-denied refusal as escalatable <!-- longclaw:item=ck_770b5dde -->
- [ ] 2.3 Second IPC command that runs the script off the main thread <!-- longclaw:item=ck_67df6feb -->
- [ ] 2.4 Frontend install state machine: installing, waiting, installed; button.waiting, live.waiting, both buttons disabled, focus back to the primary <!-- longclaw:item=ck_0ed8f628 -->
- [ ] 2.5 Pass mac.prompt as the sheet's sentence <!-- longclaw:item=ck_74693766 -->
- [ ] 3. Cancel and refusal outcomes (blocked by: 2) <!-- longclaw:item=ck_748c53a1 -->
- [ ] 3.1 Cancel: 'Nothing was installed.', the button stays Install, no sudo line <!-- longclaw:item=ck_79fa2fe7 -->
- [ ] 3.2 Cancelling and then closing the dialog raises the skipped toast <!-- longclaw:item=ck_a8714be2 -->
- [ ] 3.3 Refused password: failed.admin, the sudo line, Try again re-asks; confirm the AppleScript error number on a real Mac <!-- longclaw:item=ck_dff68dfe -->
- [ ] 3.4 Script failure: failed.script with its reason <!-- longclaw:item=ck_457cec8d -->
- [ ] 3.5 Occupied path found after escalating: the occupied refusal, file untouched <!-- longclaw:item=ck_f79b1e60 -->
- [ ] 4. Non-escalated failures and copy (blocked by: 2; parallel with 3) <!-- longclaw:item=ck_c0a6b7ed -->
- [ ] 4.1 Full disk: no sudo line; Try again retries the write <!-- longclaw:item=ck_bd918b50 -->
- [ ] 4.2 Reworded status.occupied <!-- longclaw:item=ck_5579d293 -->
- [ ] 4.3 Delete refusal.denied <!-- longclaw:item=ck_9ddb938f -->
- [ ] 5. Docs and release check (blocked by: 3, 4) <!-- longclaw:item=ck_088dd221 -->
- [ ] 5.1 Rewrite the comments that say the app cannot escalate <!-- longclaw:item=ck_3bd534ff -->
- [ ] 5.2 Update the release-candidate Filesystem scope row <!-- longclaw:item=ck_c7d4741f -->
- [ ] 5.3 Manual release-candidate row: on a clean Apple Silicon Mac, install, cancel and wrong-password, then longclaw ticket list in a new terminal <!-- longclaw:item=ck_6d76ed60 -->
## Attachments

<!-- longclaw:attachment
id: att_459c90d7
file: attachments/att_459c90d7-cli-install-refused.png
name: cli-install-refused.png
media_type: image/png
size: 304070
added_at: 2026-11-11T11:19:33.343Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[cli-install-refused.png](./attachments/att_459c90d7-cli-install-refused.png)
<!-- /longclaw:attachment -->

<!-- longclaw:attachment
id: att_885fd837
file: attachments/att_885fd837-cli-install-m-series-refused.png
name: cli-install-m-series-refused.png
media_type: image/png
size: 304070
added_at: 2026-11-17T14:14:34.703Z
added_by:
  type: agent
  id: grok-build
  name: Grok
-->
[cli-install-m-series-refused.png](./attachments/att_885fd837-cli-install-m-series-refused.png)
<!-- /longclaw:attachment -->

## Ticket References

<!-- longclaw:reference
id: ref_ef021440
path: docs/ux/prototypes/LC-285r-Install-The-Command-With-An-Administrator-Prompt.html
added_at: 2026-11-18T15:36:18.074Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-285r-Install-The-Command-With-An-Administrator-Prompt.html](../../../docs/ux/prototypes/LC-285r-Install-The-Command-With-An-Administrator-Prompt.html)
<!-- /longclaw:reference -->

<!-- longclaw:reference
id: ref_fbb8a7f3
path: docs/specs/LC-285r-install-the-command-with-an-administrator-prompt.md
added_at: 2026-11-19T14:06:16.721Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-285r-install-the-command-with-an-administrator-prompt.md](../../../docs/specs/LC-285r-install-the-command-with-an-administrator-prompt.md)
<!-- /longclaw:reference -->

## Activity

<!-- longclaw:event
id: evt_1651ff9d
kind: create
occurred_at: 2026-11-11T11:19:28.711Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_04cb390a
kind: update
occurred_at: 2026-11-11T11:19:33.343Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: attachments.att_459c90d7.added
    to: cli-install-refused.png
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4818930
kind: update
occurred_at: 2026-11-11T11:19:44.129Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c6d74331
kind: update
occurred_at: 2026-11-17T14:14:34.703Z
actor:
  type: agent
  id: grok-build
  name: Grok
changes:
  - field: attachments.att_885fd837.added
    to: cli-install-m-series-refused.png
-->
### Grok updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_de9f61d6
kind: update
occurred_at: 2026-11-17T14:14:49.598Z
actor:
  type: agent
  id: grok-build
  name: Grok
changes:
  - field: priority
    from: p1
    to: urgent
  - field: description
  - field: checklist.ck_a26ec01b.added
    to: Reproduce on a clean Apple Silicon Mac with no writable /usr/local/bin
  - field: checklist.ck_6bcb0ecc.added
    to: Make the one-press install succeed without a Terminal paste
  - field: checklist.ck_a7503fbb.added
    to: "Keep the occupied-file refusal: never replace a longclaw the app did not create"
  - field: checklist.ck_eab24ad8.added
    to: Try again must not repeat a write that is certain to fail the same way
  - field: checklist.ck_2e4f87fa.added
    to: After install, a new terminal can run longclaw without extra PATH setup
-->
### Grok updated this ticket

Raised to urgent after another report from a new Apple Silicon Mac: the intro dialog's Install CLI press lands on this refusal, and Try again cannot succeed. Screenshot attached (att_885fd837).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3eed93a6
kind: update
occurred_at: 2026-11-18T15:32:04.544Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Grilled the fix (admin prompt, shared privileged module) and built the UX prototype: docs/ux/prototypes/LC-285r-Install-The-Command-With-An-Administrator-Prompt.html. The open UX questions are listed in the description.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_974b9aca
kind: update
occurred_at: 2026-11-18T15:36:18.074Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_ef021440.added
    to: LC-285r-Install-The-Command-With-An-Administrator-Prompt.html
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c6553540
kind: update
occurred_at: 2026-11-19T13:21:04.713Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Applied prototype review 1: Q4-A, Q5-B, quiet cancel, no sudo line on disk full, two copy edits. Open items listed under Review 1.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e80e4d00
kind: update
occurred_at: 2026-11-19T13:26:22.672Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Prototype review settled: the remaining open questions took the recommended answers. The decisions and the copy deck are in the description; the prototype is deleted.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_281f8715
kind: update
occurred_at: 2026-11-19T14:06:16.721Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_fbb8a7f3.added
    to: LC-285r-install-the-command-with-an-administrator-prompt.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_719d4a71
kind: update
occurred_at: 2026-11-19T14:06:16.747Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: platform
    to: platform, ready-for-agent
  - field: description
-->
### Claude Code updated this ticket

Spec written to docs/specs/LC-285r-install-the-command-with-an-administrator-prompt.md and recorded as a reference; labelled ready-for-agent.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b490d585
kind: update
occurred_at: 2026-11-19T15:02:57.850Z
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
id: evt_81e981b1
kind: update
occurred_at: 2026-11-19T15:06:22.231Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ff8688b1.added
    to: "1. Prefactor: one shared privileged module (blocked by: none)"
  - field: checklist.ck_ebda3d42.added
    to: 1.1 Move the Privileged port, the main-thread prompt and the AppleScript/shell quoting into the new module
  - field: checklist.ck_971d0f63.added
    to: 1.2 Make the module's scripts a closed set, with the bundle replacement as its first entry
  - field: checklist.ck_4cd9867d.added
    to: "1.3 Report a typed outcome: succeeded, cancelled, refused, failed"
  - field: checklist.ck_3d475b08.added
    to: 1.4 Move the release-audit osakit rule and its --self-test fixtures to the new module
  - field: checklist.ck_043c6bab.added
    to: 1.5 Amend ADR 0018's 'only privileged execution' rule
  - field: checklist.ck_c4ab5c4d.added
    to: "2. Tracer bullet: Install escalates and succeeds on both surfaces (blocked by: 1)"
  - field: checklist.ck_e8637f1e.added
    to: "2.1 Link-the-command script: create the folder, re-check the occupied path as root, link under a temporary name and rename; Rust tests over the port"
  - field: checklist.ck_770b5dde.added
    to: 2.2 Flag only the plain write's permission-denied refusal as escalatable
  - field: checklist.ck_67df6feb.added
    to: 2.3 Second IPC command that runs the script off the main thread
  - field: checklist.ck_0ed8f628.added
    to: "2.4 Frontend install state machine: installing, waiting, installed; button.waiting, live.waiting, both buttons disabled, focus back to the primary"
  - field: checklist.ck_74693766.added
    to: 2.5 Pass mac.prompt as the sheet's sentence
  - field: checklist.ck_748c53a1.added
    to: "3. Cancel and refusal outcomes (blocked by: 2)"
  - field: checklist.ck_79fa2fe7.added
    to: "3.1 Cancel: 'Nothing was installed.', the button stays Install, no sudo line"
  - field: checklist.ck_a8714be2.added
    to: 3.2 Cancelling and then closing the dialog raises the skipped toast
  - field: checklist.ck_dff68dfe.added
    to: "3.3 Refused password: failed.admin, the sudo line, Try again re-asks; confirm the AppleScript error number on a real Mac"
  - field: checklist.ck_457cec8d.added
    to: "3.4 Script failure: failed.script with its reason"
  - field: checklist.ck_f79b1e60.added
    to: "3.5 Occupied path found after escalating: the occupied refusal, file untouched"
  - field: checklist.ck_c0a6b7ed.added
    to: "4. Non-escalated failures and copy (blocked by: 2; parallel with 3)"
  - field: checklist.ck_bd918b50.added
    to: "4.1 Full disk: no sudo line; Try again retries the write"
  - field: checklist.ck_5579d293.added
    to: 4.2 Reworded status.occupied
  - field: checklist.ck_9ddb938f.added
    to: 4.3 Delete refusal.denied
  - field: checklist.ck_088dd221.added
    to: "5. Docs and release check (blocked by: 3, 4)"
  - field: checklist.ck_3bd534ff.added
    to: 5.1 Rewrite the comments that say the app cannot escalate
  - field: checklist.ck_c7d4741f.added
    to: 5.2 Update the release-candidate Filesystem scope row
  - field: checklist.ck_6d76ed60.added
    to: "5.3 Manual release-candidate row: on a clean Apple Silicon Mac, install, cancel and wrong-password, then longclaw ticket list in a new terminal"
-->
### Claude Code updated this ticket

Broke the spec into a numbered checklist (to-tickets): 1 prefactor, 2 tracer bullet, 3 and 4 outcomes, 5 docs and release. It replaces the five earlier items, which it covers.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e536676b
kind: update
occurred_at: 2026-11-19T15:06:22.259Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a26ec01b.removed
    from: Reproduce on a clean Apple Silicon Mac with no writable /usr/local/bin
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ea09a54a
kind: update
occurred_at: 2026-11-19T15:06:22.289Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6bcb0ecc.removed
    from: Make the one-press install succeed without a Terminal paste
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3871967c
kind: update
occurred_at: 2026-11-19T15:06:22.312Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a7503fbb.removed
    from: "Keep the occupied-file refusal: never replace a longclaw the app did not create"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_86145700
kind: update
occurred_at: 2026-11-19T15:06:22.333Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_eab24ad8.removed
    from: Try again must not repeat a write that is certain to fail the same way
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2145e659
kind: update
occurred_at: 2026-11-19T15:06:22.354Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2e4f87fa.removed
    from: After install, a new terminal can run longclaw without extra PATH setup
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a101fea7
kind: update
occurred_at: 2026-11-20T04:44:42.762Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ebda3d42.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

1.1 done: the Privileged port, the main-thread prompt and the shell/AppleScript quoting now live in one privileged module; the platform layer's duplicate quoting folds into it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cc16fb88
kind: update
occurred_at: 2026-11-20T04:44:42.787Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3d475b08.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

1.4 done with 1.1: moving the osakit call meant the release audit's privileged rule had to move too. It now exempts src/privileged.rs by path, and its self-test rejects three cases.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e76d8553
kind: update
occurred_at: 2026-11-20T04:55:23.910Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_971d0f63.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

1.2 done: the privileged module's scripts are a closed Script enum, with the bundle replacement as its first entry. The port takes a Script and no caller can hand the prompt a shell string. The rendered text is unchanged.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c5521441
kind: update
occurred_at: 2026-11-20T08:34:08.245Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_4cd9867d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

1.3 done: PromptError {Cancelled, Refused, Failed{code, reason}}. -128 and exit statuses verified via osascript; the refusal numbers (-60005/-60007) and -60006 are from Security's headers and still owe a check at a real sheet in the release-candidate row.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_544bc815
kind: update
occurred_at: 2026-11-20T09:42:51.811Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_043c6bab.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

1.5 done: ADR 0018 amended (status line + 'The amendment: one privileged module, not one privileged script'). Item 1 is complete; item 2 (link the command) can start.
<!-- /longclaw:event -->
