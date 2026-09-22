---
format: longclaw.ticket/v1
id: 9f1da099-2ad1-48b1-a72a-ae7c9e5ee34e
key: LC-265y
title: Auto-Update Functionality - Restart App doesn’t work
status: in_progress
priority: urgent
type: bug
due: 2026-09-22
estimate: "2"
created_at: 2026-09-22T10:19:17.882Z
updated_at: 2026-09-22T11:32:17.862Z
---

I am on Apple Macbook Air M2 8GB Machine and It shows Update available properly but when I click on Download, It downloads the app and then CTA becomes Restart after that clicking on Restart button doesn’t work.

Clicking on "Restart to Update” button shows an error message “The download didn’t finish” and "Try Again” button but clicking on Try Again button does nothing. 

This is a release blocker!

As part of this fix, let’s create one more release and we will push to Github and test.


## Checklist

- [ ] Point the pane's download link at https://longclaw.io, not https://longclaw.io/download, which 404s. Two places: DOWNLOAD_PAGE_URL (update.rs:39) and the refusal sentence that names the address in prose (lib.rs:508). The site has no /download route — index.astro is the download page. <!-- longclaw:item=ck_92f6fe87 -->
## Activity

<!-- longclaw:event
id: evt_13a66a45
kind: create
occurred_at: 2026-09-22T10:19:17.882Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_30ece148
kind: update
occurred_at: 2026-09-22T10:20:39.518Z
actor:
  type: human
  id: local
changes:
  - field: description
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_451a19ed
kind: comment
occurred_at: 2026-09-22T11:23:38.114Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

## Diagnosis: the 0.3.0 update archive is packed with AppleDouble entries, and the updater cannot extract it

**Root cause.** `release-macos.mjs:321` builds the updater archive with macOS `tar czf`. macOS `tar` writes a bundle's extended attributes as sibling AppleDouble files (`._name`), so `LongClaw_0.3.0_aarch64.app.tar.gz` — the file `latest.json` points at — contains 22 entries, 11 of which are `._` entries. macOS `tar tzf` does not show them, because Apple's `bsdtar` silently folds them back into xattrs on read; `python3 -m tarfile` and the Rust `tar` crate both see them as ordinary files.

The updater uses the Rust `tar` crate. `tauri-plugin-updater-2.11.0/src/updater.rs:1306` strips the leading path component of every entry:

```rust
let collected_path: PathBuf = entry.path()?.iter().skip(1).collect();
let extraction_path = tmp_extract_dir.path().join(&collected_path);
```

The archive's first entry is `._LongClaw.app`. That path has exactly one component, so `skip(1)` leaves it **empty**, and `extraction_path` becomes the extraction temp directory itself. Unpacking a 163-byte regular file onto an existing directory fails, and `install_inner` returns that error before it has touched anything.

Every press of *Restart to update* therefore fails at the first archive entry. The download itself is fine — it completed, and its minisign signature verified, which is why the button reached the *Restart* state at all.

### Feedback loop

`scripts/` has nothing that exercises install, so I replicated `install_inner` byte for byte against the real published archive and a `ditto` copy of an installed bundle in `/Applications`. Red on the shipped archive:

```
$ installprobe lc030.app.tar.gz /Applications/LongClaw-lc265y-probe.app
  [probe] unpack failed for ""
INSTALL FAILED: kind=PermissionDenied msg=failed to unpack `._LongClaw.app` into
  `/var/folders/d9/.../T/tauri_updated_appo9LbK4/`
```

Green once the same bundle is repacked with `COPYFILE_DISABLE=1 tar czf`:

```
  [probe] extracted to /var/folders/d9/.../T/tauri_updated_appNu6Zgu
  [probe] need_authorization=false
  [probe] final rename OK
INSTALL OK -> /Applications/LongClaw-lc265y-probe.app
```

The probe left a working 0.3.0 bundle in place of a 0.1.0 one. `codesign --verify --deep --strict` passes on it, `spctl -a -vv` reports `accepted / source=Notarized Developer ID`, and `xcrun stapler validate` succeeds — so dropping the AppleDouble entries costs the release nothing. The notarization ticket is stapled inside the bundle, not carried in an xattr. The probe copy has been removed.

### Why *Try Again* does nothing

A second, independent defect, and it is why the pane looks frozen rather than merely wrong.

`update_plugin.rs:160-165` takes the verified bytes out of the cache when the restart press begins:

```rust
let bytes = self
    .downloaded
    .lock()
    .expect("update download lock")
    .take()
    .ok_or(UpdateFault::CorruptDownload)?;
```

`.take()` empties the cache before `install` is attempted, and nothing puts the bytes back when `install` fails. Meanwhile `update.rs`'s own `downloaded` flag is an `AtomicBool` that the failure does not clear, so the guard at `update.rs:377` still passes. *Try Again* therefore reaches the plugin, finds `None`, and returns `CorruptDownload` immediately — the same sentence, with no download and no delay. The retry can never succeed, whatever the underlying cause was.

### Why the message is wrong

`update_plugin.rs:225` ends `fault_of` with `_ => UpdateFault::CorruptDownload`. `PluginError::Io` is unnamed, so **every** filesystem failure during install — permission denied, a cross-device rename, a full disk, this one — reaches the pane as *The download didn't finish.* The download was the one part of the sequence that worked. A distinct fault for "the install could not be applied" would have pointed at the archive on the first report instead of at the network.

### Latent, not the cause here

Two more things worth fixing while this area is open.

1. **A failed install can delete the installed app.** `install_inner` renames the current bundle into a backup temp directory, then renames the extracted one into place; if that second rename fails, the backup is dropped with its `TempDir` and the app is gone. Our failure happens during extraction, before the backup move, so nothing was lost — but a release that gets past extraction and fails at the rename would uninstall the app.
2. **Two sources of truth for "downloaded".** `update_plugin.rs:100` clears the byte cache on *every* check, while `update.rs:337-340` clears its `AtomicBool` only when the offered version changed. A check that lands between the download and the restart press leaves the flag true and the cache empty — the same false state, reached a different way.

## Suggested fix

1. `release-macos.mjs:321` — set `COPYFILE_DISABLE=1` in the environment of the `tar` step (or use `--no-mac-metadata`). Verified above to produce an archive the updater accepts, with signing, notarization and stapling intact.
2. Assert the archive's shape in the release script, right after it is written: no member whose base name starts with `._`, and exactly one top-level component. This is the check that would have caught it before upload, and it is cheap. `update-manifest.mjs` is the precedent for making it a pure function with a `--self-test` so it runs in the gate rather than for the first time during a release.
3. `update_plugin.rs` — do not `.take()` the bytes until `install` has returned `Ok`, so *Try Again* is a real retry.
4. `update_plugin.rs` — give install failures their own `UpdateFault` and their own sentence, rather than reporting them as a download that did not finish.
5. Restore the backed-up bundle when the final rename fails, or upstream the fix.

Fixes 1 and 2 unblock the release. 3, 4 and 5 are what stops the next one costing this much to find.

## What would have prevented this

Nothing in `npm run verify` or in CI ever extracts the updater archive the way the updater does, and macOS `tar tzf` actively hides the difference — the archive looked correct to every command anyone would have run on it. The release gate checks that the manifest names the right version and that the assets are uploaded; it never asks whether the artifact can be installed. An extraction assertion in the release script is the smallest thing that closes that gap.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_af8affad
kind: update
occurred_at: 2026-09-22T11:31:19.633Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_92f6fe87.added
    to: "Point the pane's download link at https://longclaw.io, not https://longclaw.io/download, which 404s. Two places: DOWNLOAD_PAGE_URL (update.rs:39) and the refusal sentence that names the address in prose (lib.rs:508). The site has no /download route — index.astro is the download page."
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_86f75bf2
kind: update
occurred_at: 2026-09-22T11:32:17.862Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: none
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->
