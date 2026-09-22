---
format: longclaw.ticket/v1
id: c12e7fae-3aa6-4510-adad-696713db067d
key: LC-267r
title: A failed update can delete the installed app
status: todo
priority: p1
labels:
  - platform
type: bug
created_at: 2026-09-22T11:48:28.542Z
updated_at: 2026-09-22T11:48:28.542Z
---

A failed update can delete the installed app, and the failure window is real rather than theoretical.

`tauri-plugin-updater` 2.11.0's macOS `install_inner` (`src/updater.rs:1332-1375`) replaces the bundle in three movements:

1. extract the archive into a `TempDir`;
2. `fs::rename` the **current** bundle into a second `TempDir` as `current_app`;
3. `fs::rename` the extracted tree onto `extract_path`.

If step 3 fails, nothing puts step 2 back. The backup is a `TempDir`, so it is deleted when it drops, and the machine is left with no LongClaw at all — the person's only route back is the download page, which is exactly the moment they are least likely to trust the app.

Step 3 is not unreachable. `fs::rename` fails with `EXDEV` across mount points, and `TMPDIR` and `/Applications` are only the same volume by convention — a machine whose `TMPDIR` is redirected, or an app installed on an external or network volume, gets a cross-device rename. A full disk during the extract in step 1 is the other everyday door.

LC-265y did not lose anyone's app because its failure was in step 1, before the current bundle was moved. That was luck, not design.

## Why it is not fixed in LC-265y

The code is the upstream crate's, and `Update::install` is the only entry point the plugin has. There is no seam: the backup `TempDir` is a local inside `install_inner` and never escapes it.

## Options

- **Upstream it.** A `match` on step 3 that renames `current_app` back before returning the error. Small, obviously correct, and the right home for it.
- **Pin a patched build** via `[patch.crates-io]` until that lands, which means carrying a fork.
- **Take our own backup first** — copy the bundle aside with `ditto` before calling `install`, and restore it if `install` returns `Err`. Costs one bundle-sized copy per update and needs somewhere to put it, but it is ours and needs no upstream.

## Checklist

- [ ] Decide between upstreaming the restore, pinning a patched build, and taking our own backup before install <!-- longclaw:item=ck_7955bd12 -->
- [ ] Whichever route: prove it with a probe that makes step 3 fail and asserts the app is still there afterwards <!-- longclaw:item=ck_12548d17 -->

## Activity

<!-- longclaw:event
id: evt_700ed969
kind: create
occurred_at: 2026-09-22T11:48:28.542Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
