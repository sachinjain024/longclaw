---
title: "Installing the command asks for an administrator when /usr/local/bin needs one"
product: LongClaw
status: proposed
ticket: LC-285r
---

## Problem Statement

On a new Mac, especially Apple Silicon, `/usr/local/bin` is either missing or
owned by root. Pressing **Install** in the *Use LongClaw with Agents* dialog, or
in *Settings › Command line*, therefore always ends with "LongClaw could not
write to /usr/local/bin" and a `sudo` line to paste into Terminal. **Try
again** repeats the same write, which fails the same way. Saving the person
that Terminal step is the whole reason the install button exists (LC-233),
and on a stock Mac it never succeeds.

LC-233 accepted this because the app had no way to ask for an administrator.
It needed `Command::new`, which the release audit forbids, or an
`SMAppService` helper, which is too heavy for one symlink. LC-267r has since
added such a way: ADR 0018's single AppleScript administrator prompt for
replacing the bundle.

## Solution

When the plain write is refused for lack of permission, LongClaw asks macOS for
an administrator password once, from inside the app, and makes the link
itself. The command still goes in `/usr/local/bin/longclaw`, so a new terminal
finds it with no `PATH` setup.

From the person's side:

- **Writable `/usr/local/bin`** (for example, Homebrew for Intel set it up):
  nothing changes. Install succeeds with no prompt.
- **Missing or root-owned `/usr/local/bin`:** Install brings up macOS's password
  sheet with one sentence saying what LongClaw wants to do. Approving it
  installs the command, and the dialog reaches its existing *done* state.
- **Nothing warns before the press.** The button reads `Install`, and the sheet
  is the warning.
- **Cancelling the sheet** leaves "Nothing was installed." and the same
  `Install` button, not `Try again`. No `sudo` line appears.
- **A refused password** (three wrong tries, or no administrator to hand) shows
  a refusal with the `sudo` line, for whoever administers the Mac.
  `Try again` brings the sheet back.
- **A full disk** is never escalated: no `sudo` line, and `Try again` retries
  the write.
- **A `longclaw` the app did not create** is never replaced, with or without a
  password.

## User Stories

1. As a person on a new Apple Silicon Mac, I want Install to succeed without opening Terminal, so that the one-press install does what it promises.
2. As a person whose `/usr/local/bin` does not exist, I want LongClaw to create it as part of the install, so that I do not have to know the folder was missing.
3. As a person whose `/usr/local/bin` belongs to root, I want to be asked for an administrator password once, so that the install can finish with my approval.
4. As a person whose `/usr/local/bin` is already writable, I want Install to succeed without any password prompt, so that nothing about my working setup gets worse.
5. As a person asked for a password, I want the macOS sheet to say exactly what LongClaw is about to do, so that I can type an administrator password with confidence.
6. As a person asked for a password, I want the request to come from macOS's own sheet, so that I am not typing my password into an app's window.
7. As a person waiting at the password sheet, I want the dialog behind it to say it is waiting for my password, so that it does not pretend to be making progress.
8. As a person waiting at the password sheet, I want the dialog's buttons disabled, so that I cannot dismiss the dialog halfway through an install.
9. As a screen-reader user, I want to hear that macOS is asking for an administrator password, so that I know why the dialog went quiet.
10. As a person who cancels the password sheet, I want to be told that nothing was installed, so that I am not left guessing.
11. As a person who cancels the password sheet, I want the button to stay `Install` rather than `Try again`, so that a choice I made is not presented as a failure.
12. As a person who cancels the password sheet, I want pressing Install again to bring the sheet back, so that I can change my mind.
13. As a person who cancels and then closes the dialog, I want the same "Skipped" toast as Skip for now, so that I know where to find the install later.
14. As a person whose password is refused three times, I want a clear refusal and `Try again`, so that I can try a different password.
15. As a person on a standard account, I want the exact Terminal line shown after a refused password, so that someone who administers this Mac can run it for me.
16. As a person whose disk is full, I want the failure to say so and not ask for a password, so that I am not asked for something that cannot help.
17. As a person whose disk is full, I want `Try again` to retry the write after I free space, so that I can finish without restarting the app.
18. As a person with my own `longclaw` at `/usr/local/bin/longclaw`, I want LongClaw never to replace it, even with administrator rights, so that a binary I built or installed is safe.
19. As a person with my own `longclaw` there, I want to be told plainly that LongClaw cannot replace it and what to do, so that I can move it if I choose.
20. As a person whose link points at an old copy of LongClaw in a root-owned folder, I want `Point it at this app` to go through the same password flow, so that re-pointing works on a stock Mac.
21. As a person who skipped the offer, I want *Settings › Command line* to offer the same install with the same password flow, so that skipping costs me nothing.
22. As a person who skipped the offer, I want the pane's *Ask again…* checkbox to bring the dialog back, so that I can be offered it again at the next launch.
23. As a person who installed through the password sheet, I want a new terminal to run `longclaw` with no `PATH` setup, so that agents can use it immediately.
24. As a person who installed through the password sheet, I want the pane to report the command as installed and pointing at this app, so that I can confirm it worked.
25. As a maintainer, I want every script the app can run as root to be one value of a closed set in one module, so that a reviewer can read everything the app could ever do as an administrator in one place.
26. As a maintainer, I want the release audit to fail the build if any other file names the AppleScript crate, so that a second privileged path cannot be added without anyone noticing.
27. As a maintainer, I want the bundle replacement and the command install to share one administrator prompt, so that the two cannot drift in how they quote, prompt or report a cancel.
28. As a maintainer, I want the link step tested over a fake administrator that runs the real script without rights, so that the script's behaviour is covered without a password.
29. As a release manager, I want a release-candidate row that walks the real password sheet on a clean Apple Silicon Mac, so that the one thing no test can drive is checked before shipping.

## Implementation Decisions

**One privileged module, shared.** A new backend module becomes the only shipped source file allowed to name the AppleScript crate. It owns:

- the `Privileged` port that the bundle replacement already defines;
- the main-thread dispatch the updater adapter carries today, since AppKit's sheet must be raised from the main thread;
- the AppleScript and shell quoting;
- a **closed set of fixed scripts**: one to replace the bundle, which moves out of the bundle replacement unchanged, and one to link the command, which is new.

A caller names a script and its paths; it never passes a shell string. The bundle replacement keeps its own behaviour and tests. Only where its prompt comes from changes.

**What the prompt reports.** It returns one of four outcomes, so callers stop guessing from strings:

| Outcome | When |
|---|---|
| succeeded | the script ran |
| cancelled | the person pressed Cancel (AppleScript error -128) |
| refused | macOS did not authorize the administrator |
| failed | the script ran and exited non-zero, with its reason |

The exact AppleScript error number for a refused authorization is checked on a real Mac during implementation, not assumed.

**The command link script.** Running as root, it:

1. creates the folder if it is missing;
2. **refuses with a distinct exit status if the link path exists and is not a symlink**, re-checked as root so a file that appeared after the status read is still never replaced;
3. otherwise builds the link under a temporary name and renames it into place, the same rename-not-delete shape as the plain install.

The source must be the app's own bundled CLI, as today.

**Install becomes two steps across IPC.** The webview has to draw the waiting state before the sheet appears, and a single synchronous command cannot let it. So:

- **The existing install command is unchanged** for every outcome but one: its *permission denied* refusal gains a flag saying escalation is available. Every other failure (no space, read-only volume, an occupied path, nothing to install) is never flagged and never escalated.
- **A second command** runs the link script through the privileged module, off the main thread, and dispatches only the prompt to it. Its error crosses IPC in ADR 0010's closed shape:

| Outcome | Error code | Carries |
|---|---|---|
| cancelled | the existing `Cancelled` | nothing more |
| refused password | `PermissionDenied` | the manual `sudo` line |
| occupied path, re-checked as root | the occupied refusal | — |
| script failure | `Io` | the reason |

**The frontend install flow.** It is one state machine shared by the dialog and the pane. This shape is from the prototype:

```ts
type InstallStep =
  | { kind: "idle" }
  | { kind: "installing" }                                    // the plain write, one frame
  | { kind: "waiting" }                                       // the sheet is up
  | { kind: "installed" }
  | { kind: "cancelled" }                                     // primary stays Install
  | { kind: "refused"; message: string; command: string }    // Try again re-asks
  | { kind: "failed"; message: string };                      // e.g. no space: Try again, no sudo line
```

- **Try again** appears only in `refused` and `failed`. Pressing it reruns the whole install: the plain write first, then the sheet if that write is refused again.
- **The `sudo` line** appears only after a refused password and for an occupied path.
- **While `waiting`,** both footer buttons are disabled and the primary reads "Waiting for your password". When the sheet closes, focus returns to the primary.
- **Closing the dialog from `cancelled`** reports a skip, which raises the existing skipped toast.

**Copy.** Every string is settled in the ticket's § Copy deck, which is the source of truth:

- **New:** `button.waiting`, `live.waiting`, `mac.prompt`, `cancel.text.quiet`, `failed.admin` and `failed.script`.
- **Changed:** `status.occupied`.
- **Deleted:** the refused-write sentence "LongClaw could not write to /usr/local/bin. The line below does the same thing.", which no path reaches any more.

**ADR 0018 is amended, not superseded.** Its rule "one privileged script … the only privileged execution in the app" becomes: every privileged execution is one of the fixed scripts in the privileged module. The release audit's privileged-file rule and its self-test fixtures move from the bundle replacement to the new module. The update-path naming rule is unaffected: the command install names the privileged module, never the bundle replacement.

**Stale prose goes with the behaviour.** The comments in the install component and in the macOS platform layer that say the app "cannot escalate", and the release-candidate's *Filesystem scope* row, are rewritten to match.

## Testing Decisions

A good test here drives behaviour through the seam a caller uses and asserts what the person or the filesystem ends up with: the link, the folder, the words on screen. It never asserts which internal function ran. Three existing seams, and no new ones:

- **The link step, in Rust, over the `Privileged` port.** Fakes run the real script under `/bin/sh` in a temp directory without rights, cancel, or refuse authorization. The bundle replacement's tests are the prior art, including its fake that runs scripts unprivileged and its cancelled-prompt test. The cases:
  - a missing folder is created and linked;
  - a locked folder escalates and links;
  - a stale link is re-pointed;
  - an occupied path is refused before and after escalation, and the file is untouched;
  - a cancel changes nothing;
  - a refused authorization changes nothing;
  - a full disk or a read-only volume is never escalated.

  The existing plain-install tests in the macOS platform layer stay as they are.
- **The frontend, in the existing command-line install test file, over the mocked api.** Every row of the copy deck that a state can reach is asserted on both surfaces:
  - the waiting state, with both buttons disabled;
  - a cancel, which keeps `Install`;
  - a refused password, which shows `Try again` and the line;
  - a full disk, which shows `Try again` and no line;
  - an occupied path, with no button and the reworded sentence;
  - the skipped toast after cancel-then-close;
  - focus returning to the primary.

  The existing refusal and `Try again` tests there are the prior art and are rewritten to the new rules.
- **The release audit's `--self-test`.** The AppleScript crate named in any file other than the privileged module must go red, and naming it there must stay green. This replaces the current fixture pair.
- **A manual release-candidate row.** On a clean Apple Silicon Mac with no `/usr/local/bin`: install, approve, then run `longclaw ticket list` in a new terminal. Repeat the cancel and wrong-password paths. The real macOS sheet cannot be automated, so this is the only coverage of `mac.prompt` and of the error numbers.

## Out of Scope

- Any install location other than `/usr/local/bin`, editing shell profiles, or a user-writable `PATH` folder. Considered and rejected.
- An `SMAppService` privileged helper or a `Command::new` exemption.
- Uninstalling the command, or removing a link that root now owns.
- Moving *Command line tool* out of the gear menu. That is LC-261h, and this spec assumes the way back is the skipped toast and Settings.
- Any change to the update flow beyond sourcing its prompt from the shared module.
- Windows and Linux, which have no `/usr/local/bin` install path.
- New entries in `keyboard-focus-map.md`, which has no section for this dialog. The two keyboard rules live in this spec and the ticket.

## Further Notes

- The decisions came from a grilling session and a UX prototype review, both
  recorded on the ticket. The prototype
  (`docs/ux/prototypes/LC-285r-Install-The-Command-With-An-Administrator-Prompt.html`)
  is deleted, and `docs/ux/prototypes/README.md` names the commit that holds it.
- A link created through the sheet is owned by root, so re-pointing it later
  (the stale state) will also need the sheet. That is expected, and story 20
  covers it.
- `npm run a11y:audit` and `probe:*` do not cover this dialog today. The
  manual release-candidate row is the deliberate substitute, because the
  sheet is drawn by macOS.
