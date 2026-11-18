---
format: longclaw.ticket/v1
id: e259ac7d-0aaf-4344-8845-ca19901c76a4
key: LC-285r
title: "Installing the command line fails after a fresh install: LongClaw could not write to /usr/local/bin"
status: todo
priority: urgent
labels:
  - platform
type: bug
created_at: 2026-11-11T11:19:28.711Z
updated_at: 2026-11-17T14:14:49.598Z
---

After installing LongClaw on a new Mac — especially Apple Silicon (M series) — the *Use LongClaw with Agents* intro dialog cannot install the `longclaw` command. Pressing Install CLI (then *Try again*) shows "LongClaw could not write to /usr/local/bin. The line below does the same thing." and offers a `sudo mkdir -p … && sudo ln -sf …` line to paste into Terminal. The one-press path never succeeds, so the only way through is to leave the app, open Terminal, and type an administrator password there. That is the install step this screen exists to save someone (LC-233).

![The Use LongClaw with Agents dialog refusing to write to /usr/local/bin](./attachments/att_459c90d7-cli-install-refused.png)

![Same refusal on a new Apple Silicon Mac: Install CLI falls back to a sudo line](./attachments/att_885fd837-cli-install-m-series-refused.png)

Where it comes from: `install_command_line` in `src-tauri/src/platform/macos.rs` links `/usr/local/bin/longclaw` as the signed-in user. `/usr/local/bin` is root-owned (or missing) on a Mac that never had Homebrew for Intel installed, so `symlink` gets EACCES and the refusal path returns the copy-paste command. That is designed behaviour from LC-233, so on a stock Apple Silicon Mac the refusal is the common case, not the exception. LC-233 left escalation open only if the plain symlink proved insufficient in practice; this is that case.

To decide:
- Ask for an administrator once from inside the app, the way the update's privileged step does (ADR 0018). The release audit holds `osakit` to `bundle_replace.rs`, so this needs either a second sanctioned module or a shared one, and an ADR amendment.
- Or link into a user-writable folder on `PATH` instead, and say which one.
- Either way, *Try again* should not repeat an attempt that is certain to fail the same way.


## Checklist

- [ ] Reproduce on a clean Apple Silicon Mac with no writable /usr/local/bin <!-- longclaw:item=ck_a26ec01b -->
- [ ] Make the one-press install succeed without a Terminal paste <!-- longclaw:item=ck_6bcb0ecc -->
- [ ] Keep the occupied-file refusal: never replace a longclaw the app did not create <!-- longclaw:item=ck_a7503fbb -->
- [ ] Try again must not repeat a write that is certain to fail the same way <!-- longclaw:item=ck_eab24ad8 -->
- [ ] After install, a new terminal can run longclaw without extra PATH setup <!-- longclaw:item=ck_2e4f87fa -->
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
