---
title: "A failed update never deletes the installed app"
product: LongClaw
status: proposed
ticket: LC-267r
---

# A failed update never deletes the installed app

The spec for [LC-267r](../../.longclaw/tickets/LC-267r/ticket.md). Written on
2026-10-29 from the ticket as filed, a reading of `tauri-plugin-updater`
2.11.0's macOS install, and the update path specified in
[LC-256a](LC-256a-auto-update.md). It changes one movement of that path — the
replacement of the bundle — and nothing a person sees when it works.

## Problem Statement

A person presses *Restart to update*. Something goes wrong while the new
version is being put in place, and when they look for LongClaw afterwards it is
not in Applications any more: not the old version, not the new one. Their
tickets are untouched on disk, but the tool they use to read them is gone, and
the only way back is to find the download page and trust the app that just
deleted itself.

The ticket names the right defect and the wrong doors. Reading the plugin's
install, both of its temporary directories are created under `TMPDIR`, so the
two everyday failures the ticket names are *safe*: a cross-volume `TMPDIR`
fails the **first** rename — moving the current bundle out — with `EXDEV`,
before anything has moved, and a full disk fails the extraction, which is
before that again (LC-265y's failure was there, and lost nobody's app). The
windows in which the bundle is actually lost are three:

1. **The second rename fails after the first succeeded.** The current bundle
   is in a `TempDir`; the error returns through `?`; the `TempDir` drops and
   deletes it. Rare — both renames cross the same pair of directories — but
   nothing puts the backup back.
2. **The administrator path.** When the first rename is refused with
   permission denied — a standard user, an `/Applications` they do not own —
   the plugin runs `rm -rf <bundle> && mv -f <new> <bundle>` through an
   AppleScript prompt. The removal comes first. With `TMPDIR` on another
   volume that `mv` is a copy, and a copy that fails halfway — a full disk, an
   interrupted write — leaves no bundle at all. This is the widest window and
   the ticket does not name it.
3. **The process dies between the two movements.** A crash, a force quit or a
   power cut after the first rename leaves the old bundle orphaned in `TMPDIR`
   and nothing in Applications.

The plugin's API offers no seam into any of these: `install` is the only entry
point and the backup is a local inside it. An upstream fix to the second
rename would close window 1 and leave 2 and 3 open.

## Solution

LongClaw stops handing the install to the plugin and replaces its own bundle,
with one rule: **at every instant, a launchable LongClaw is at the path the
person installed it to.** The plugin keeps everything it is trusted for — the
check, the download, the minisign verification. Only the last movement, putting
verified bytes where the bundle is, becomes ours.

That movement is an **atomic swap**. The new version is unpacked beside the
installed one, on the same volume, under a hidden staging name; then the two
directories exchange names in one system call. Before the call the old
version is installed; after it the new one is; there is no moment in between
for a failure or a dead process to land in. Only once the swap has succeeded is
the old version, now under the staging name, deleted.

When the folder holding the bundle cannot be written without an administrator,
the same order is kept under the prompt: copy first, then exchange, then
delete — never delete first. Anything left behind by an interrupted attempt is
under a recognisable staging name beside the bundle, and the next launch clears
it away.

From the person's side nothing changes when an update works. When one fails,
the pane says what it already says — *The update could not be installed.* —
and that sentence is now always true in the reassuring direction: the version
they had is still there and still opens.

## User Stories

### The person updating

1. As a person updating LongClaw, I want a failed update to leave the version I had installed, so that a bad update costs me a retry and not my app.
2. As a person updating LongClaw, I want there to be no moment during an update at which LongClaw is missing from Applications, so that a crash, a force quit or a power cut mid-update cannot leave me without it.
3. As a person whose temporary folder is on a different volume from Applications, I want updates to work, so that how my disk is laid out is not a reason I cannot update.
4. As a person whose disk fills up during an update, I want the update to fail cleanly with my current version untouched, so that freeing space and pressing *Try again* is all I need to do.
5. As a standard (non-administrator) user, I want the administrator prompt to replace LongClaw in an order that cannot delete it, so that typing a password is never the step that loses my app.
6. As a standard user who cancels the administrator prompt, I want nothing to have changed, so that cancelling means cancelling.
7. As a person whose update failed, I want *Try again* to be a real second attempt, so that the button keeps the promise LC-265y made it keep.
8. As a person whose update failed, I want the pane's existing sentence to be the one I see, so that I am not handed new, unreviewed copy at a worrying moment.
9. As a person whose update worked, I want the relaunch to open the new version exactly as it does today, so that the fix is invisible when nothing goes wrong.
10. As a person whose update was interrupted, I want no hidden copy of LongClaw left in my Applications folder for ever, so that an interrupted update does not leak a bundle's worth of disk.
11. As a person who installed LongClaw somewhere other than `/Applications` — `~/Applications`, an external disk — I want updates to replace it where it is, so that the update does not move or duplicate my app.
12. As a person whose LongClaw sits on a volume that cannot swap atomically, I want the update either to complete safely or to refuse before touching anything, so that an unusual filesystem is never a reason to lose the app.
13. As a person, I want my project folders and tickets never to be touched by an update, so that the worst a failed update can do is fail.

### The person reading the outcome

14. As a person whose update failed, I want the old version to open with its own version number in *Settings → About*, so that I can tell which version I am on.
15. As a person who reports a failed update, I want the log to name which step failed — unpack, swap, or cleanup — so that the person diagnosing it does not have to guess the way LC-265y's diagnosis did.

### The developer

16. As a developer, I want the replacement to be a function that takes verified bytes and a bundle path, so that I can test it against a fake bundle in a temporary directory without a network, a signature or Tauri.
17. As a developer, I want to inject a failure at each step of the replacement, so that "the bundle survives every failure" is a test and not an argument.
18. As a developer, I want the plugin's check, download and verification to be unchanged, so that the security-critical half of the path is still the one Tauri maintains.
19. As a developer, I want the archive unpacked with the same layout rule the plugin uses — the archive's top-level directory is the bundle — so that releases built by the current release script install unchanged.
20. As a developer, I want an archive entry that would land outside the staging directory refused, so that owning the unpack does not mean owning a path-traversal bug.
21. As a developer, I want the staging name to be recognisable and derived from the bundle's own name, so that the launch-time sweep can find it without guessing and cannot delete anything else.
22. As a developer, I want the bundle path derived from the running executable in one place, so that the install and the sweep cannot disagree about which bundle is ours.
23. As a developer, I want a filesystem that cannot swap atomically detected and handled, so that the fallback is a decision rather than an accident.

### The release engineer and reviewer

24. As a release engineer, I want a probe that makes the swap fail on a real built bundle and asserts the app still launches afterwards, so that the property is proved where it matters and not only in a temporary directory.
25. As a release reviewer, I want the probe to carry a `--self-test` inversion that reintroduces the delete-first order and goes red, so that a probe that cannot see the failure cannot pass.
26. As a release reviewer, I want the network audits and the structural guards to stay green with no amendment, so that taking over the install is shown not to have widened what LongClaw touches.

### Agents and the repository

27. As an agent reading this area later, I want an ADR recording that the install is ours while verification stays the plugin's, so that LC-256a's D2 is not read as forbidding what this spec does.
28. As a maintainer, I want the step-two restore offered upstream as well, so that other Tauri apps get the smaller fix even though LongClaw no longer depends on it.

## Implementation Decisions

### D1. An ADR first, amending LC-256a's D2

LC-256a's D2 gave the plugin "the in-place install" on the grounds that bundle
replacement is security-critical and a second implementation is what ADR 0011
exists to avoid. The next ADR records the narrower line this spec draws: the
**security-critical** half — fetching, and verifying the minisign signature
against the bundled public key — stays the plugin's and is never reimplemented.
The **replacement** half is a filesystem movement with a safety property the
plugin does not have, and it becomes LongClaw's. The ADR names the three
windows above as the reason, and records the upstream offer (D9) as not
blocking.

### D2. The bundle replacement module

A new deep module in the backend owns replacing a bundle. Its interface is one
function: given the verified archive bytes and the path of the installed
bundle, put the new version at that path or return an error — and on every
return, a complete bundle is at that path. It knows nothing about Tauri,
releases or the pane.

Its steps, in order:

1. **Stage.** Create a staging directory beside the bundle — same parent, so
   same volume — named from the bundle's own name with a fixed hidden prefix
   and suffix and a random part. Unpack the archive into it.
2. **Check.** Refuse a staged tree that is not a bundle — no `Contents`, no
   `Info.plist`, no executable under `Contents/MacOS` — before anything has
   moved. An archive with the wrong shape is a failed install, not an empty
   app in Applications.
3. **Swap.** Exchange the installed bundle and the staged tree in one atomic
   rename (`renamex_np` with `RENAME_SWAP`). On success the new version is at
   the bundle path and the old one is at the staging path.
4. **Settle.** Touch the bundle, as the plugin does, so Launch Services sees
   the change. Delete the staging path, which now holds the old version. A
   failure here is logged and is **not** an install failure: the new version
   is in place, and the sweep (D5) collects what was left.

A failure in steps 1–3 deletes the staging directory and returns an error; the
installed bundle was never moved.

### D3. The unpack keeps the plugin's layout rule and adds a boundary

The release archive is the one the release script already produces. The
unpack keeps the plugin's rule — the archive's first path component is the
bundle directory and is stripped — so no release has to change. Every entry is
resolved inside the staging directory and an entry that would land outside it
(an absolute path, a `..` component, a link pointing out) is refused, which
fails the install at step 1. AppleDouble entries (`._*`), the defect LC-265y
found in 0.3.0, are refused the same way rather than unpacked.

The archive crates are the ones the plugin already pulls in, declared at the
versions already in the lockfile; no crate enters the build that was not in
it, and no network-capable one is added. The structural guards that assert
the dependency shape run unchanged.

### D4. Filesystems that cannot swap, and folders that need an administrator

- **No atomic swap on this volume** (`renamex_np` returns `ENOTSUP`, as some
  network and FAT-family volumes do). The module falls back to two renames on
  the same volume — current bundle to a hidden backup name beside it, staged
  tree to the bundle path — and if the second fails, renames the backup back
  before returning. Both renames are within one directory, so `EXDEV` cannot
  occur; the residual window is a dead process between them, and the backup
  is beside the bundle under a name the sweep recognises.
- **The parent folder is not writable** (staging fails with permission
  denied). The module unpacks into a temporary directory as the user, then
  runs one administrator prompt whose script keeps the same order: copy the
  staged tree beside the bundle, rename the bundle to the backup name, rename
  the copy into place, and only then remove the backup — with the second
  rename's failure restoring the backup. **There is no `rm` before the new
  version is beside the bundle.** A cancelled prompt changes nothing.
- The prompt runs on the main thread, as the plugin's does; the existing rule
  that the download cache is not locked across the install (LC-265y) holds.

### D5. The launch-time sweep

At launch, from an installed bundle only, LongClaw lists the bundle's parent
for entries carrying the staging or backup name derived from its own bundle
name, and deletes them. It runs off the main thread after first paint, makes
no network request, and never deletes an entry whose name it did not derive.
A sweep that fails is logged and ignored. This is what keeps windows 3 and the
fallback's residual window from leaking a bundle of disk per interruption.

### D6. Where the plugin stops

The updater adapter keeps the plugin's check and download unchanged, and keeps
the verified bytes cached exactly as it does today. Its install-and-restart
calls the replacement module with those bytes and the bundle path instead of
the plugin's `install`, then restarts as before. The bytes are still put back
on failure, so *Try again* still retries. The bundle path comes from the same
platform helper that decides whether the process runs from a bundle, so the
install and the sweep cannot disagree about which bundle is ours.

### D7. Faults and copy

Every failure of the replacement is the port's existing install-failed fault
and reaches the pane as the sentence it already has. No new fault, no new
copy, no prototype. The log line for a failure names the step (stage, check,
swap, fallback, prompt, settle) and the errno, which is the detail LC-265y's
diagnosis lacked.

### D8. The CLI and the webview are untouched

No command is added or changed on either side of IPC, and the CLI gains
nothing — the replacement is reachable only from the existing install command.

### D9. Upstream

A pull request to `tauri-plugin-updater` restoring the backup when the second
rename fails is offered as a courtesy. LongClaw does not wait for it, pin it,
or carry a fork.

## Testing Decisions

A good test here asserts what is on disk afterwards — whether a launchable
bundle is at the path, which version it is, and what else is left in the
folder — and never which syscall ran or in what order. The invariant every
test asserts, whatever it injects, is the same: **after the call returns, the
bundle path holds a complete bundle, and it is the old one unless the call
returned success.**

### Seams, highest first

1. **The replacement module over a temporary directory** — the main seam, and
   the one this spec adds. The suite builds a fake bundle (a `Contents`
   directory, an `Info.plist` carrying a version, an executable) and a
   `.tar.gz` of a newer one, calls the module, and reads the directory back.
   The filesystem operations are reached through a small injectable set so a
   failure can be planted at each step: unpack (a full disk, a truncated
   archive), check (an archive with the wrong shape, an AppleDouble entry, a
   traversal entry), swap (`ENOTSUP`, then a failure in the fallback's second
   rename), and settle (the old version cannot be deleted). A further case
   abandons the call between steps — standing in for a dead process — and
   asserts that a bundle is at the path and that the sweep then leaves the
   folder exactly as it was before the update.
2. **The sweep over a temporary directory**, given a parent holding leftovers
   of its own name, leftovers of another app's name and unrelated hidden
   files, asserting it removes only its own.
3. **The updater adapter's existing tests**, unchanged in purpose: a failed
   install leaves the bytes for the next press, a successful one consumes
   them, and a filesystem failure while installing is an install failure.
4. **A built-bundle probe**, a new `npm run` script beside the other probes.
   It takes a built bundle, copies it into a temporary folder standing in for
   Applications, serves a signed archive of a second build locally, drives an
   update with the swap made to fail, and asserts the original bundle still
   launches and reports its version. A second case lets the swap succeed and
   asserts the new version launches. Its `--self-test` swaps in the
   delete-first order and must go red. Run it when the replacement module or
   the release archive changes, and quote the run in the ticket.

The administrator path cannot be driven unattended — it needs a person at a
password prompt — so it is covered by seam 1 with the prompt's script run
unprivileged against a temporary directory, and by one recorded manual run on
a standard account, quoted in the ticket.

### Prior art

- The command-line install's describing function, split out so the suite can
  drive it against a temporary directory rather than `/usr/local/bin` — the
  same shape as seam 1.
- `install_keeping_bytes` and its tests, the free function LC-265y split out
  of the adapter so its behaviour had a seam.
- `probe:header`, `probe:drag` and `probe:checklist` for a probe that refuses
  to report on what it cannot reach, and their `--self-test` inversions.

## Out of Scope

- **A new version that installs but will not launch.** Rolling back a bundle
  that swapped in successfully and then crashes on start is a different
  feature with a different trigger.
- **Recovering from a dead process while running the administrator path.**
  The prompt's script has one residual window between two renames in the same
  directory; it is narrowed, not closed, and the sweep collects what it leaves.
- **New copy in the update pane.** The existing install-failed sentence is
  kept; making it say that the current version is unchanged is a copy change
  for the deck, not this ticket.
- **Platforms other than macOS on Apple Silicon**, matching the one artifact
  the release produces.
- **Changing the release archive's format** or the release script.
- **Waiting on, pinning or forking the upstream plugin.**

## Further Notes

- The plugin code read for this spec is `tauri-plugin-updater` 2.11.0, the
  version in the lockfile. A bump of the plugin no longer changes how the
  bundle is replaced, but should still be read: a change to the archive layout
  rule would need D3 to follow.
- `renamex_np` with `RENAME_SWAP` is available on every macOS release LongClaw
  supports and is implemented by APFS and HFS+, which covers the internal disk
  and most external ones.
- The ticket's checklist maps onto this spec as follows: *decide the route* is
  D1–D2 (our own replacement, by atomic swap, chosen on 2026-10-29), and *prove
  it with a probe* is seam 4.
