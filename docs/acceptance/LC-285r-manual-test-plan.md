---
ticket: LC-285r
---

# LC-285r manual test plan: installing the command with an admin prompt

The macOS password sheet cannot be driven from a test, so this plan is the only
check of four things:

- the AppleScript actually running on the main thread;
- the sentence macOS puts on the sheet;
- the numbers macOS answers with when the password is wrong (checklist 3.3);
- the update path's new prompt.

Everything else is covered by `npm run verify`. The release-candidate row
_Command install on a clean Apple Silicon Mac_ in
[`release-candidate.md`](release-candidate.md) is the short form of this plan.

Run it on an Apple Silicon Mac that has never had Homebrew installed to
`/usr/local`. Apple Silicon Homebrew lives in `/opt/homebrew`, so a Mac with
only that still counts. Record each result on LC-285r with the build number
and the macOS version.

## Setup

1. Install the release build from its DMG into `/Applications`.
2. In Terminal, run `ls -ld /usr/local/bin`. On a clean Mac it says _No such
   file or directory_. If it exists, write down its owner. You will need
   `/usr/local/bin` missing for A1 and owned by root for A2.
3. Make one project folder to run the command in, for example
   `~/lc-test`, from the app's _New project_.

### Resetting between scenarios

- `sudo rm -f /usr/local/bin/longclaw` removes the link.
- `sudo rmdir /usr/local/bin` removes the folder again, if it is empty.
- The first-launch dialog appears when you open a project and the command is
  not installed. If you chose _Skip for now_ once, tick _Ask again when I open
  a project without the command_ in _Settings › Command line_ to get it back.

## A. It installs

| #   | Start from                                                                 | Do                                                                     | Expect                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | No `/usr/local/bin`. The first-launch dialog.                              | Press _Install_ and approve the sheet.                                 | The sheet reads "LongClaw wants to add the longclaw command to /usr/local/bin." The title becomes "`longclaw` is on your PATH". _Done_ closes it. In a new terminal, `cd ~/lc-test && longclaw ticket list` prints that project's tickets. |
| A2  | `sudo mkdir -p /usr/local/bin` (owned by root). The first-launch dialog.   | Press _Install_ and approve the sheet.                                 | Same as A1.                                                                                                                                                                                                                                |
| A3  | `sudo chown $USER /usr/local/bin`. The first-launch dialog.                | Press _Install_.                                                       | It installs with **no sheet at all**.                                                                                                                                                                                                      |
| A4  | Root-owned folder, and `sudo ln -sf /tmp/nowhere /usr/local/bin/longclaw`. | Open _Settings › Command line_, press _Point it at this app_, approve. | The pane said it points elsewhere; afterwards it says it points at this copy of LongClaw.                                                                                                                                                  |
| A5  | No `/usr/local/bin`.                                                       | Repeat A1 from _Settings › Command line_ instead of the dialog.        | Same as A1, in the pane.                                                                                                                                                                                                                   |

## B. Cancel

| #   | Do                                                                                                                   | Expect                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| B1  | Press _Install_, then _Cancel_ on the sheet.                                                                         | "Nothing was installed." The button still reads _Install_. No `sudo` line. |
| B2  | After B1, press _Install_ again.                                                                                     | The sheet comes back.                                                      |
| B3  | From the first-launch dialog: cancel the sheet, then close the dialog with _Skip for now_, `Esc` or a click outside. | The skipped toast appears.                                                 |

## C. Wrong password (closes checklist 3.3)

| #   | Do                                                                                    | Expect                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Press _Install_ and enter a wrong password until macOS stops asking.                  | "macOS did not accept an administrator password, so nothing was installed. If someone else administers this Mac, they can run the line below.", then the `sudo` line with its copy button, and _Try again_. |
| C2  | After C1, press _Try again_.                                                          | The sheet comes back.                                                                                                                                                                                       |
| C3  | Log in as a **standard** (non-admin) user and press _Install_.                        | The sheet asks for an admin's name and password. Correct details install it. Wrong details give C1's message.                                                                                               |
| C4  | After C3's refusal, copy the `sudo` line, have an admin run it, then reopen the pane. | The pane says it points at this copy of LongClaw.                                                                                                                                                           |

**If C1 shows anything else, record it.** `privileged.rs` assumes macOS answers
a wrong password with -60005 or -60007, and that has never been checked on a
real Mac:

- "Nothing was installed." means macOS reported the refusal as a cancel.
- "LongClaw could not install the command, even as an administrator: …" ends
  with the real number in brackets. You should also see the `sudo` line, which
  is the safety net in E2.

Either way, write the number or the message on LC-285r so the mapping can be
fixed.

## D. Someone else's file

| #   | Start from                                   | Do                                                                                                  | Expect                                                                                                                                                                                                           |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `echo x \| sudo tee /usr/local/bin/longclaw` | Open _Settings › Command line_.                                                                     | No install button. "LongClaw cannot replace /usr/local/bin/longclaw. Move it or rename it, then reopen this pane, or run the line below yourself." and the line. `cat /usr/local/bin/longclaw` still prints `x`. |
| D2  | No link, root-owned folder.                  | Press _Install_. While the sheet is up, run D1's `tee` in another terminal. Then approve the sheet. | The same state as D1, and the file still prints `x`.                                                                                                                                                             |

## E. While the sheet is up, and when it breaks

| #   | Do                                                              | Expect                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Press _Install_ and look at the app before answering the sheet. | The button reads _Waiting for your password_ and is disabled. In the dialog, _Skip for now_ is disabled and `Esc` and clicking outside do nothing. When the sheet closes, keyboard focus is on the main button, and Tab and Enter work without the mouse. |
| E2  | With VoiceOver on (`⌘F5`), press _Install_.                     | VoiceOver says "macOS is asking for an administrator password."                                                                                                                                                                                           |
| E3  | Not testable by hand: the prompt itself breaking.               | Covered by tests. If you ever see "…even as an administrator:" followed by an AppleScript error or a negative number in brackets, the `sudo` line should be there too, and _Try again_ should bring the sheet back.                                       |

A full disk cannot be set up by hand either; unit tests cover it.

## F. Updates (at the release after this one)

The bundle replacement uses the same prompt code, but an update **to** this
version is still installed by the previous version's code. Test this when the
next version is published, updating **from** this one.

| #   | Start from                                                                         | Do                                             | Expect                                                            |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| F1  | This version in `/Applications`, installed by an admin. Log in as a standard user. | Use _Restart to update_ and approve the sheet. | macOS's own sheet appears. The app relaunches on the new version. |
| F2  | The same.                                                                          | Use _Restart to update_ and press _Cancel_.    | The app stays on this version and still launches.                 |
