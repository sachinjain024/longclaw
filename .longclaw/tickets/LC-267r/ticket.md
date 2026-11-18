---
format: longclaw.ticket/v1
id: c12e7fae-3aa6-4510-adad-696713db067d
key: LC-267r
title: A failed update can delete the installed app
status: in_progress
priority: urgent
labels:
  - platform
  - ready-for-agent
type: bug
created_at: 2026-09-22T11:48:28.542Z
updated_at: 2026-11-18T13:43:07.837Z
---

A failed update can delete the installed app. `tauri-plugin-updater` 2.11.0 replaces the bundle by moving the current one into a `TempDir` and then moving the new one into place, and nothing puts the old one back: if the second move fails, or the administrator path's `rm -rf … && mv …` fails partway, or the process dies between the two, the machine is left with no LongClaw at all. The ticket originally named cross-volume `TMPDIR` and a full disk as the doors; both actually fail before the bundle moves and are safe. The real windows are the three above, the administrator path the widest.

**Spec:** `docs/specs/LC-267r-update-never-deletes-the-app.md`, recorded under References. Route chosen on 2026-10-29: LongClaw replaces its own bundle by an atomic swap (`renamex_np` + `RENAME_SWAP`) beside the installed one; the plugin keeps the check, download and signature verification. The step-two restore is offered upstream as a courtesy, not a dependency.

**Ownership on the administrator path** (found 2026-11-18, standard-account run): the installed app ends up owned by the standard user who pressed _Restart to update_ (`lctest:staff`), not by the admin who installed it. The script runs `ditto` as root, and `ditto` keeps the owner of the copy that the standard user unpacked; the plugin's own script did the same. A standard account then owns an app every account on the Mac runs, and an admin's later update may not be able to remove the old copy's insides. The script now gives the new bundle the replaced one's owner and group before it moves into place.

## Checklist

- [x] Decide between upstreaming the restore, pinning a patched build, and taking our own backup before install <!-- longclaw:item=ck_7955bd12 -->
- [x] Merge PR #103 so the spec and the ready-for-agent label are on main <!-- longclaw:item=ck_385266e3 -->
- [x] Write the ADR amending LC-256a D2: the replacement is ours, check/download/verification stay the plugin's <!-- longclaw:item=ck_f4fd6bf2 -->
- [x] Check whether declaring osakit or the archive crates directly trips a dependency or symbol guard; if so, the ADR names the gate change <!-- longclaw:item=ck_0a19f574 -->
- [x] Settle how the probe gets a signed archive (release key locally, or a probe-only test key) before writing it <!-- longclaw:item=ck_5224a9e9 -->
- [x] Build the replacement module test-first over a fake .app in a temp dir, with a fault injected at each step <!-- longclaw:item=ck_d40e33b8 -->
- [x] Build the launch-time sweep over a temp dir: removes only its own staging and backup names <!-- longclaw:item=ck_986393aa -->
- [x] Switch the updater adapter's install to the replacement module; install_keeping_bytes tests pass unchanged <!-- longclaw:item=ck_09e4816b -->
- [x] Build the built-bundle probe: a failed swap leaves the original app launching, a good one launches the new version, and --self-test (delete-first order) goes red <!-- longclaw:item=ck_12548d17 -->
- [x] Record a manual run of the administrator path on a standard account, quoted in the ticket <!-- longclaw:item=ck_c23f5561 -->
- [x] Add the release-candidate row: update the previous release to the candidate through Restart to update, and confirm the candidate relaunches <!-- longclaw:item=ck_617faa18 -->
- [x] Administrator path: the new bundle takes the replaced one's owner and group, not the standard user's who unpacked it; prove it with a script test and a second standard-account run <!-- longclaw:item=ck_6c985962 -->

## Ticket References

<!-- longclaw:reference
id: ref_a3c982c0
path: docs/specs/LC-267r-update-never-deletes-the-app.md
added_at: 2026-10-29T08:06:39.231Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-267r-update-never-deletes-the-app.md](../../../docs/specs/LC-267r-update-never-deletes-the-app.md)
<!-- /longclaw:reference -->

<!-- longclaw:reference
id: ref_99666974
path: docs/adr/0018-the-app-replaces-its-own-bundle.md
added_at: 2026-10-29T08:25:40.292Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[0018-the-app-replaces-its-own-bundle.md](../../../docs/adr/0018-the-app-replaces-its-own-bundle.md)
<!-- /longclaw:reference -->

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

<!-- longclaw:event
id: evt_4b6569c7
kind: update
occurred_at: 2026-10-23T22:34:34.055Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p1
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1e485943
kind: update
occurred_at: 2026-10-29T08:06:39.206Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: platform
    to: platform, ready-for-agent
  - field: description
  - field: checklist.ck_7955bd12.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_85460103
kind: update
occurred_at: 2026-10-29T08:06:39.231Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_a3c982c0.added
    to: LC-267r-update-never-deletes-the-app.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e4394407
kind: update
occurred_at: 2026-10-29T08:07:49.662Z
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
id: evt_9e0073d5
kind: update
occurred_at: 2026-10-29T08:11:43.017Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_385266e3.added
    to: "Merge PR #103 so the spec and the ready-for-agent label are on main"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_865bb1f3
kind: update
occurred_at: 2026-10-29T08:11:43.038Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f4fd6bf2.added
    to: "Write the ADR amending LC-256a D2: the replacement is ours, check/download/verification stay the plugin's"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c10f1d38
kind: update
occurred_at: 2026-10-29T08:11:43.059Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0a19f574.added
    to: Check whether declaring osakit or the archive crates directly trips a dependency or symbol guard; if so, the ADR names the gate change
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_572a1d50
kind: update
occurred_at: 2026-10-29T08:11:43.078Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5224a9e9.added
    to: Settle how the probe gets a signed archive (release key locally, or a probe-only test key) before writing it
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fa1bd2f1
kind: update
occurred_at: 2026-10-29T08:11:43.096Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d40e33b8.added
    to: Build the replacement module test-first over a fake .app in a temp dir, with a fault injected at each step
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ae1f6036
kind: update
occurred_at: 2026-10-29T08:11:43.118Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_986393aa.added
    to: "Build the launch-time sweep over a temp dir: removes only its own staging and backup names"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e0ecf72a
kind: update
occurred_at: 2026-10-29T08:11:43.144Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e4816b.added
    to: Switch the updater adapter's install to the replacement module; install_keeping_bytes tests pass unchanged
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2fca9660
kind: update
occurred_at: 2026-10-29T08:11:43.165Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c23f5561.added
    to: Record a manual run of the administrator path on a standard account, quoted in the ticket
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b31967fa
kind: update
occurred_at: 2026-10-29T08:11:50.292Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_12548d17.moved
    from: "2"
    to: "9"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_87c85346
kind: update
occurred_at: 2026-10-29T08:11:50.311Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_12548d17.text
    from: "Whichever route: prove it with a probe that makes step 3 fail and asserts the app is still there afterwards"
    to: "Build the built-bundle probe: a failed swap leaves the original app launching, a good one launches the new version, and --self-test (delete-first order) goes red"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1ce7ec44
kind: update
occurred_at: 2026-10-29T08:25:40.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_385266e3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f4fd6bf2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0a19f574.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

ADR 0018 written (docs/adr/0018-the-app-replaces-its-own-bundle.md); spec D1, D2 step 4, D3 and story 26 amended to match.

Guard check, run 2026-10-29: declaring `flate2 = "1"`, `osakit = { version = "0.3", features = ["full"] }` and `tar = "0.4"` (the plugin's own features) under the macOS dependencies left `cargo tree`'s crate set identical (only the root's dependency list in Cargo.lock grew) and `release-audit` clean, self-test green. Reverted afterwards.

Two source-scan rules matter, and the ADR names both as gate changes:
- `Command::new` is banned in all shipped Rust, so the replacement cannot `touch` the bundle the way the plugin does; it sets the mtime by a direct call.
- `osakit::` is caught by nothing today. The audit gains a rule holding it to the replacement module, and the module joins UPDATE_MODULES' forbidden names.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_004ebc64
kind: update
occurred_at: 2026-10-29T08:25:40.292Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_99666974.added
    to: 0018-the-app-replaces-its-own-bundle.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_440f7602
kind: update
occurred_at: 2026-10-29T08:29:17.001Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5224a9e9.checked
    from: "false"
    to: "true"
  - field: checklist.ck_617faa18.added
    to: "Add the release-candidate row: update the previous release to the candidate through Restart to update, and confirm the candidate relaunches"
-->
### Claude Code updated this ticket

Probe signing settled: the probe's archive is unsigned. It exercises the replacement, which accepts bytes the plugin already verified; signature checking is the plugin's unchanged half. Signing would mean either the release key on a probe run (a file every installed copy would accept, off the release machine) or a second bundle with a test key and a localhost endpoint (what the sanctioned-hosts rule keeps out of anything shippable). The probe instead makes a second version from the built bundle (Info.plist version raised, re-signed ad hoc), plants a failure at the real swap, verifies the original with codesign and launches it; a FAT disk image gives a real RENAME_SWAP refusal for the fallback. What it cannot see, the adapter's wiring inside a real bundle, gets a release-candidate row. Spec seam 4 rewritten, seam 5 added.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e6e82582
kind: comment
occurred_at: 2026-10-29T08:30:33.287Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Unverified: that a FAT32 disk image refuses renamex_np(RENAME_SWAP). APFS swaps (confirmed on this machine, rc 0). hdiutil create was refused with 'Operation not permitted' from this terminal, inside and outside the sandbox — a macOS privacy permission, not the repo — so the FAT case could not be tried. The spec now has the probe check the refusal on the image first and fail the run if the swap succeeds there. Whoever builds the probe confirms it first.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_52046c28
kind: update
occurred_at: 2026-11-02T11:53:06.508Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d40e33b8.checked
    from: "false"
    to: "true"
  - field: checklist.ck_986393aa.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Replacement module and sweep built: `bundle_replace` (macOS only). 20 unit tests over a fake .app in a temp dir, with a fault or a process death planted at each movement (swap, both fallback renames, removal, mtime), plus truncated, mis-shaped, `..`, out-pointing-link and AppleDouble archives. The four tests that run the administrator script through /bin/sh live in tests/bundle_replace.rs, because a process launch anywhere under src/ is a release-audit finding. A control proves the sh shadow used to fail ditto/mv does not break the script on its own. Mutation check: dropping the fallback's restore, putting the plugin's rm-first order back in the script, and switching off the link check each turned the expected tests red. release-audit gains the osakit-in-one-file rule (self-test: accepts 1, rejects 1) and bundle_replace joins the update path's names. Two deviations from the spec: there is no logger in the app, so the failed step lives in ReplaceError rather than a log line; and the step is lost once the adapter maps it to InstallFailed.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a16548db
kind: update
occurred_at: 2026-11-02T11:57:04.607Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e4816b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Adapter switched: install_and_restart hands the verified bytes to bundle_replace::replace with the running bundle's path (platform::macos::running_bundle, the same helper running_from_bundle now uses) and a MainThreadPrompt that runs the administrator script on the main thread. The plugin's Update::install is no longer called. install_keeping_bytes and its three tests are unchanged and green; the mapping test now covers every ReplaceError step. The sweep runs from PluginUpdater::attach on a blocking thread — not strictly after first paint as the spec says, but off the main thread and nothing waits on it. npm run verify green: 338 Rust unit tests, 1634 frontend tests, release-audit 141 files clean, native watcher 2/2.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3ac3b265
kind: update
occurred_at: 2026-11-02T12:25:49.300Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_12548d17.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Built-bundle probe done: `npm run probe:update` (wrapper perf/update-probe.mjs, cases in src-tauri/tests/update_probe.rs behind the `update-probe` feature). Run on 2026-11-02 against the 0.3.1 build:app bundle and its release archive:

```
test probe_update ...   pass  a refused swap leaves the original intact
  pass  a good swap installs the newer version
  pass  the release archive gets through the unpack
  pass  a FAT volume replaces through the fallback
probe:update: 4 passed, 0 failed, 0 skipped, against apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app
test probe_update ... probe:update --self-test: the plugin's order lost the app, and the probe saw it (no bundle at the path)
```

It found what the spec got wrong. FAT32 does not refuse RENAME_SWAP. macOS's FSKit msdos driver accepts the flag and does a plain rename: two non-empty directories fail with ENOTEMPTY (so on FAT32 every update failed, safely, at the swap), and two files 'swap' with the displaced side deleted. The volume's own VOL_CAP_INT_RENAME_SWAP bit tells the truth (FAT32 and ExFAT: absent; APFS: present), so the replacement now asks the volume first through core::storage::volume_declares_swap and takes the fallback when it says no. Mutation check: without that check the FAT case fails at Swap with 'Directory not empty (os error 66)'. The same driver behaviour breaks ticket saving on FAT32, filed as LC-283u. The FAT assumption flagged on 2026-10-29 is settled: it was wrong, and the probe's precondition caught it.

'Runs' here means the bundle's own `longclaw --help` exits 0 and `codesign --verify --deep --strict` passes. It does not open the window, which would start against the person's real projects. Opening the window is the release-candidate row's job.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a29a78d9
kind: update
occurred_at: 2026-11-18T09:51:01.247Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_617faa18.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Release-candidate row added to docs/acceptance/release-candidate.md under Install, upgrade, restart, and offline: install the previous release, publish the candidate as latest, press Restart to update, and confirm the candidate relaunches with its window open, Settings names its version, the last project reloads, codesign --verify --deep --strict passes on /Applications/LongClaw.app, and no .LongClaw.app.lc-update-* or .lc-previous-* folder is left. Two things writing it surfaced. The update into a candidate is carried out by the previous release's code, so the first release carrying bundle_replace (the next one) still installs through the plugin's old order; its replacement is first exercised in the field when that release updates to the one after, and the row says to record both versions. And the endpoint is releases/latest, so the row can only be run once the candidate is published as latest; it says to mark the previous release latest again if it fails. The Filesystem scope row now also names the two folders the update writes beside the app (ADR 0018). The row is written, not yet run: it runs at the next release.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_58cf3557
kind: update
occurred_at: 2026-11-18T12:49:22.352Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c23f5561.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Administrator path run on a standard account, 2026-11-18. Setup: this branch built with `tauri build --bundles app --config {"version":"0.3.0"}` (ad hoc signed; bundle_replace strings present in longclaw-desktop), installed over /Applications/LongClaw.app by an admin, then a new Standard account `lctest` opened it, pressed Check now, which offered the live 0.3.1 release, and pressed Restart to update. /Applications is root:admin 775, so creating the staging folder beside the app was refused and the replacement took the privileged path.

Reported by the person who ran it:
- Cancel at the password prompt: the app stayed on 0.3.0 and did not close.
- Restart to update again: exactly one prompt, the standard macOS dialog asking for an administrator name and password.
- After entering admin credentials, LongClaw relaunched with its window up.

/Users/Shared/lc-admin-test/check.sh, run as lctest before and after:

```
== run by: lctest (standard) at Wed Nov 18 18:09:00 IST 2026
== version
0.3.0
== signature
signature-ok
== /Applications entries named longclaw
drwxr-xr-x@  3 sachinjain  admin    96 14 Sep 12:28 LongClaw.app

== run by: lctest (standard) at Wed Nov 18 18:12:59 IST 2026
== version
0.3.1
== signature
signature-ok
== /Applications entries named longclaw
drwxr-xr-x@  3 lctest      staff    96 18 Nov 18:12 LongClaw.app
```

No staging or backup folder was left in /Applications.

One finding, not fixed here: the installed app is now owned by lctest:staff, not by the admin who installed it. The script runs ditto as root, and ditto keeps the owner of the copy that lctest unpacked. The plugin's own script had the same effect. As a result, a standard user owns an app that every account on the Mac runs. An admin's later update may also be unable to remove the old copy's insides, which would leave a .lc-previous folder that the sweep cannot clear; this is untested. The fix is to give the new bundle the old one's owner inside the script.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_82c6a7d7
kind: update
occurred_at: 2026-11-18T12:52:59.367Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_6c985962.added
    to: "Administrator path: the new bundle takes the replaced one's owner and group, not the standard user's who unpacked it; prove it with a script test and a second standard-account run"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c08f6bfc
kind: comment
occurred_at: 2026-11-18T12:58:02.387Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Ownership fix written, not yet re-run on a standard account, so ck_6c985962 stays open. The administrator script gains one line between the copy and the first move: `/usr/sbin/chown -R -h "$(/usr/bin/stat -f %u:%g <bundle>)" <copy>`, and a failure there removes the copy and exits like a failed copy. Tests: a unit test pins the order (copy, then owner, then move); tests/bundle_replace.rs gains a failed chown leaving 1.0 and no leftovers, chown added to the never-fires control, and a group test. Without root the owner cannot be changed in a test, so that test puts the old bundle in a second group the user belongs to and asserts the installed bundle and its Info.plist come out in that group with the same uid. Mutation check: with the chown line removed, that test fails with "has the unpacker's group". ADR 0018 and spec D4 name the step. npm run verify passes: 340 Rust unit tests, 1634 frontend tests, release-audit 141 files clean.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_96c728e6
kind: update
occurred_at: 2026-11-18T13:43:07.837Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6c985962.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Second standard-account run, 2026-11-18, with the ownership fix (e29dcb5). Same setup as the first: this branch built as 0.3.0, ad hoc signed, with the chown line present in longclaw-desktop. An admin installed it at /Applications/LongClaw.app (owner sachinjain:staff), then the Standard account lctest updated it to the live 0.3.1.

check.sh, run as lctest before and after:

```
== run by: lctest (standard) at Wed Nov 18 19:08:28 IST 2026
== version
0.3.0
== signature
signature-ok
== /Applications entries named longclaw
drwxr-xr-x@  3 sachinjain  staff    96 18 Nov 19:03 LongClaw.app

== run by: lctest (standard) at Wed Nov 18 19:11:51 IST 2026
== version
0.3.1
== signature
signature-ok
== /Applications entries named longclaw
drwxr-xr-x@  3 sachinjain  staff    96 18 Nov 19:11 LongClaw.app
```

The owner is kept: sachinjain:staff before and after, where the first run went to lctest:staff. `find /Applications/LongClaw.app ! -user sachinjain` and `! -group staff` both come back empty, so every file inside kept its owner too. No staging or backup folder was left.

Reported by the person who ran it: cancelling the password prompt left 0.3.0 open; there was one prompt; LongClaw relaunched by itself with its window up.

Also reported, and outside this ticket: 0.3.1 was not shown as available until Check now was pressed, and after cancelling and relaunching, the app did not show it as available again. Both follow from the scheduled check running at most once per 24 hours (CHECK_INTERVAL_MS, isCheckDue), with Check now counting as that check. The found version lives only in the process (UpdateService.pending), so a relaunch forgets an update it had already found, and the pane reads up to date until the next slot.

Cleanup note: macOS App Management blocks changing another app's bundle even as root (osascript with administrator privileges got EPERM on chown), so restoring ownership by hand needed a terminal with App Management allowed.
<!-- /longclaw:event -->
