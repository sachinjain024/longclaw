# The app replaces its own bundle; the updater plugin only fetches and verifies

**Status:** accepted on 2026-10-29, amending D2 of
[the auto-update spec](../specs/LC-256a-auto-update.md), which gave
`tauri-plugin-updater` "the in-place install", and narrowing
[ADR 0014](0014-one-optional-check-for-a-newer-longclaw.md)'s description of
what the plugin does. Written for
[LC-267r](../../.longclaw/tickets/LC-267r/ticket.md); the design is
[its spec](../specs/LC-267r-update-never-deletes-the-app.md).
Amended on 2026-11-20 by
[LC-285r](../../.longclaw/tickets/LC-285r/ticket.md)
([its spec](../specs/LC-285r-install-the-command-with-an-administrator-prompt.md)):
the administrator prompt moves to a shared privileged module with a closed set
of fixed scripts, so installing the `longclaw` command can use it too. See
[_The amendment_](#the-amendment-one-privileged-module-not-one-privileged-script).

The updater plugin keeps the check, the download and the minisign
verification. **Putting the verified bytes where the bundle is becomes
LongClaw's**, under one rule: at every instant a launchable LongClaw is at the
path the person installed it to. The new version is unpacked beside the old one
on the same volume and the two exchange names in one atomic rename
(`renamex_np` with `RENAME_SWAP`); the old version is deleted only after the
exchange has succeeded.

## Why D2's reason does not cover the replacement

D2 kept the install in the plugin because minisign verification and bundle
replacement are a security-critical path, and a second implementation is what
[ADR 0011](0011-cli-is-the-creation-surface-agents-use.md) exists to avoid.
That reason holds for the half that decides **whether to trust the bytes**, and
this decision leaves it where it was: nothing here fetches, verifies or
re-verifies anything, and the replacement accepts only the bytes the plugin's
`download` returned after its own signature check.

It does not hold for the half that **moves directories**. That half has a
safety property the plugin's 2.11.0 macOS install does not have, and an
upstream fix to it would close one of the three ways it loses the bundle and
leave two:

1. the second rename fails after the first moved the bundle into a `TempDir`,
   which then drops and deletes it;
2. the administrator path runs `rm -rf <bundle> && mv -f <new> <bundle>`, so a
   cross-volume `mv` that fails partway leaves nothing;
3. the process dies between the two movements, leaving the old bundle orphaned
   in `TMPDIR`.

`Update::install` is the plugin's only entry point and its backup never escapes
it, so there is no seam to fix this from outside. Carrying a fork was
considered and refused: it is a second implementation of the *whole* plugin,
which is the thing D2 was avoiding. Owning the one movement is the smallest
implementation that has the property.

## What the replacement may do, exactly

- **One module.** The replacement and the launch-time sweep of its leftovers
  live in one backend module. It names no Tauri type and no plugin type; it is
  given bytes and a bundle path. The updater adapter is its only caller, and
  `lib.rs` its only other reference, to run the sweep after first paint.
- **Only the bundle's own folder.** It writes inside the bundle's parent, and
  only under staging and backup names derived from the bundle's own name. The
  sweep deletes those names and no others.
- **No network, and no new crate.** It reads bytes it is handed. The archive
  crates and the AppleScript crate it uses are the ones the plugin already
  compiles in, declared at the plugin's own features; a trial declaration on
  2026-10-29 left the resolved crate graph identical and the release audit
  clean.
- **No process launch.** The plugin `touch`es the bundle with a child process;
  the release audit forbids `Command::new` in shipped source, and the
  replacement sets the bundle's timestamp with a direct call instead.
- **One privileged script, and only when it must.** When the bundle's folder
  cannot be written without an administrator, one AppleScript prompt runs a
  fixed script that copies the new version beside the bundle before anything
  is moved, gives that copy the replaced bundle's owner and group, then
  renames, then deletes — never `rm` first. It is the only privileged
  execution in the app.

## The gates this changes

The release audit's source scan gains two rules, each with a `--self-test` case
that must go red:

- `osakit::` may appear in the replacement module and in no other shipped Rust
  file, in the shape the HTTP client is already held to one file. Today the
  AppleScript path is inside the plugin and no rule needs to see it; once it is
  in LongClaw's own source, a second caller would otherwise be invisible.
- The replacement module joins the update path's names: no file outside the
  update modules and `lib.rs` may name it, so ADR 0014's offline invariant —
  no existing code path reaches the update path — covers it.

No other gate changes. The network-capable crate allowlist, the frozen crate
set, the binary audit's symbol and framework sets and the runtime network audit
are unaffected, because nothing here can reach the network.

## The amendment: one privileged module, not one privileged script

LC-285r gave the app a second thing it cannot always do with the person's own
rights: link the bundled `longclaw` into `/usr/local/bin`, which a fresh Apple
Silicon Mac does not have or leaves owned by root. The choice was a second
prompt beside this one or one prompt shared by both. Two would be two sets of
quoting, two hops onto the main thread and two readings of what a cancel looks
like — exactly the drift a single rule exists to prevent — and a second caller
of `osakit` is what the rule above was written to make visible, not to permit.

So the rule **"one privileged script … the only privileged execution in the
app" becomes: every privileged execution is one of the fixed scripts in the
privileged module.**

- **One module owns the prompt** — `privileged.rs`, the file the release
  audit's rule is keyed on. It holds the AppleScript and shell quoting, the hop
  onto the main thread, and the scripts themselves. A caller names a script and
  the paths it acts on; it never hands over a shell string. Adding a script is
  a change to that one module, read in one place.
- **The scripts are a closed set.** Replacing the bundle (this ADR's script,
  moved unchanged) was the first; linking the command is the second, added by
  LC-285r. Anything else the app might want to do as root is a new decision,
  not a new call.
- **The prompt reports what happened.** Succeeded, cancelled, refused, or
  failed with the script's exit status and reason, so neither caller reads
  AppleScript's prose to tell a person's choice from a failure.
- **What the replacement may do is otherwise unchanged.** Its script, its
  order (copy beside, own, rename, delete last), its one folder and its sweep
  are as above. Only where its prompt comes from changes.

This supersedes two statements above, which are left as accepted: the last
sentence of _One privileged script, and only when it must_, and the first rule
under _The gates this changes_, whose `osakit` rule now names the privileged
module rather than the replacement module (and whose remark that the
AppleScript path is inside the plugin predates both). The release audit's rule
and its `--self-test` cases follow the module, and a module of that name in any
other folder is no way round it. The update-path naming rule is unaffected: the
command install is to name the privileged module, never the bundle replacement,
so ADR 0014's offline invariant still covers the update path alone.

## Consequences

- A plugin bump no longer changes how the bundle is replaced, but must still be
  read: the replacement keeps the plugin's archive layout rule (the first path
  component is the bundle and is stripped), and a change to the archive format
  would need the replacement to follow.
- The administrator path keeps one residual window, a dead process between two
  renames in the same folder. It leaves the old version beside the bundle under
  a name the sweep collects, not an empty Applications folder.
- A pull request restoring the backup in the plugin's second rename is offered
  upstream as a courtesy. LongClaw does not wait for it.
