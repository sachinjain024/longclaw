---
format: longclaw.ticket/v1
id: 1512765c-b718-4eba-896d-5180eb82dd85
key: LC-219
title: Resolve the glib Dependabot alert (GHSA-wrw7-89jp-8q8g)
status: todo
priority: none
labels:
  - platform
created_at: 2026-08-11T15:05:07.974Z
updated_at: 2026-08-11T15:05:07.974Z
---

Dependabot alert #2, moderate: `glib` 0.18.5 in `apps/desktop/src-tauri/Cargo.lock`. Unsoundness in the `Iterator` and `DoubleEndedIterator` impls for `glib::VariantStrIter`. Vulnerable `>= 0.15.0, < 0.20.0`; patched in 0.20.0.

Two facts decide this ticket:

- **It is not in the macOS build.** `glib` arrives only through `atk`/`gdk`/`gtk`/`webkit2gtk` — the Linux side of Tauri, cfg-gated out on macOS. `cargo tree -i glib` prints nothing on the host and needs `--target all` to show it at all. Dependabot reads the lockfile, which is target-agnostic.
- **No `cargo update` fixes it.** `atk`, `gdk` and `gtk` 0.18.2 each require `glib ^0.18`, so 0.20.0 is unreachable until Tauri moves off the gtk-rs 0.18 line.

So this is a triage decision, not a patch: dismiss the alert as not-affected while the app ships macOS-only, or leave it open pending a Tauri bump. Either way it becomes real the day a Linux target does.

## Checklist

- [ ] Decide: dismiss as not-affected, or hold for Tauri's gtk-rs bump <!-- longclaw:item=ck_f5d0d79d -->
- [ ] If dismissing, record the reason on the GitHub alert <!-- longclaw:item=ck_e4a08e00 -->
- [ ] Re-open if a Linux target is ever added <!-- longclaw:item=ck_8f0a3cec -->

## Activity

<!-- longclaw:event
id: evt_0212f646
kind: create
occurred_at: 2026-08-11T15:05:07.974Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
