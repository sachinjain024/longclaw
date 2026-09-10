/**
 * Installing the `longclaw` command, offered once and available forever after
 * (LC-233).
 *
 * The binary is already on the disk: `tauri build` seals every `[[bin]]` this
 * crate declares into `Contents/MacOS/`, so a person who opened the `.dmg`
 * already has the CLI — exactly the app's own build, which is what keeps the
 * two from ever disagreeing about the file format. What they do not have is a
 * *name on `PATH`*, and that is the only thing this file is about.
 *
 * **It is offered rather than done.** The link lands in `/usr/local/bin`, which
 * is outside every folder the user picked, and the v0 promise is that the app
 * touches nothing outside those. That promise is worth more than the two
 * seconds the offer costs, so there is a prompt on first launch and a pane in
 * settings, and nothing happens on either until somebody presses the button —
 * VS Code's *Install 'code' command in PATH*, and for the same reason.
 *
 * **A refusal is answered in words.** `/usr/local/bin` is admin-writable on most
 * developer Macs and Homebrew is why, so the write usually just succeeds; on a
 * clean Apple Silicon machine the directory may not exist and creating it needs
 * root. The app cannot escalate — `release-audit.mjs` fails the build on
 * `Command::new`, so `osascript … with administrator privileges` is not
 * available, and neither a subprocess exemption nor an `SMAppService` helper is
 * worth a symlink. So the refusal names what happened and hands over the exact
 * line, paths filled in, with a button that copies it. That is the whole
 * escalation story, and it is deliberately the whole of it.
 *
 * One file for both surfaces because they are one set of sentences. The offer
 * and the pane differ in framing — one asks, the other reports — and must not
 * come to describe the same act two different ways.
 */

import { useCallback, useId, useState } from "react";
import { installCommandLine } from "./api";
import { copyToClipboard } from "./clipboard";
import { ConfirmDialog } from "./ConfirmDialog";
import { normalizeError } from "./errors";
import type { CommandLineStatus } from "./types";

/**
 * What the pane shows before the answer arrives, and on a host that never
 * answers at all — a browser tab, the perf harness, a `vitest` render.
 *
 * `unavailable` rather than a spinner, because it is the truthful answer to
 * both: this process has no command it can offer to install. The pane's own
 * sentence for that state names the dev window it is nearly always seen in.
 */
export const UNREAD_COMMAND_LINE: CommandLineStatus = {
  state: "unavailable",
  sourcePath: null,
  linkPath: "/usr/local/bin/longclaw",
  currentTarget: null,
  manualCommand: null,
};

/**
 * The sentence both surfaces open with. Present tense and no jargon: the person
 * being asked has just opened a project manager, and `symlink` is not a word
 * this app uses anywhere else.
 */
function whatItDoes(status: CommandLineStatus) {
  return (
    <>
      Adds <code>longclaw</code> to your <code>PATH</code>, so agents and
      terminals can read and file tickets in this project. It links{" "}
      <code>{status.linkPath}</code> to the copy of the command inside LongClaw
      — the only thing LongClaw ever writes outside a project folder.
    </>
  );
}

/** What the button says, given what is installed now. `null` is no button. */
function actionLabel(status: CommandLineStatus): string | null {
  switch (status.state) {
    case "absent":
      return "Install";
    case "stale":
      return "Point it at this app";
    // `linked` needs nothing; `occupied` and `unavailable` are states the app
    // cannot write its way out of, and a button that always fails is worse than
    // the sentence that says why.
    default:
      return null;
  }
}

/**
 * Running one install and holding what it answered.
 *
 * The refusal is local state rather than the app's error banner: it belongs
 * beside the command it is telling you to run, and a banner at the top of the
 * window with a `sudo` line in it would be a shell command somewhere nobody can
 * select it.
 */
function useInstall(onStatus: (status: CommandLineStatus) => void) {
  const [installing, setInstalling] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const install = useCallback(async () => {
    setInstalling(true);
    setRefusal(undefined);
    try {
      onStatus(await installCommandLine());
      return true;
    } catch (error) {
      setRefusal(normalizeError(error).message);
      return false;
    } finally {
      setInstalling(false);
    }
  }, [onStatus]);
  return { installing, refusal, install };
}

/**
 * The line to run, and a button that puts it on the clipboard.
 *
 * Selectable text as well as a button, because a person who has just been told
 * the app is not allowed to do something has every reason to read what they are
 * about to run as root before they run it.
 */
function ManualCommand(props: { command: string; label: string }) {
  const labelId = useId();
  return (
    <div className="cli-manual">
      <p className="settings-label" id={labelId}>
        {props.label}
      </p>
      <div className="cli-manual-row">
        <code className="cli-command">{props.command}</code>
        <button
          tabIndex={0}
          type="button"
          className="secondary small"
          onClick={() =>
            void copyToClipboard(props.command, {
              done: "Command copied",
              failed: "Could not copy the command",
            })
          }
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/** What is installed right now, in one sentence per state. */
function StatusLine(props: { status: CommandLineStatus }) {
  const status = props.status;
  switch (status.state) {
    case "linked":
      return (
        <p className="cli-state ok">
          <code>longclaw</code> is installed at <code>{status.linkPath}</code>{" "}
          and points at this copy of LongClaw.
        </p>
      );
    case "stale":
      return (
        <p className="cli-state">
          <code>{status.linkPath}</code> points at{" "}
          <code>{status.currentTarget}</code>, which is not this copy of
          LongClaw. Re-linking replaces it.
        </p>
      );
    case "occupied":
      return (
        <p className="cli-state">
          <code>{status.linkPath}</code> is a file LongClaw did not create, so
          LongClaw will not replace it. Move or rename it and reopen this pane,
          or run the line below yourself.
        </p>
      );
    case "unavailable":
      return (
        <p className="cli-state">
          This build has no copy of the command beside it, so there is nothing
          to install. That is what a <code>npm run dev</code> window looks like;
          an app built from the <code>.dmg</code> carries one.
        </p>
      );
    case "absent":
      return (
        <p className="cli-state">
          <code>longclaw</code> is not on your <code>PATH</code> yet.
        </p>
      );
  }
}

/**
 * The status, the button, and whatever the last attempt had to say — shared by
 * the pane and the dialog so the two cannot drift apart.
 */
function InstallBody(props: {
  status: CommandLineStatus;
  installing: boolean;
  refusal?: string;
  onInstall: () => void;
  /** The pane leads with its own subhead; the dialog leads with the offer. */
  lead?: boolean;
}) {
  const label = actionLabel(props.status);
  // The line is shown when the app has just been refused, and when the state is
  // one the app can never write its way out of. Not otherwise: an unpressed
  // button beside a `sudo` line reads as two ways to do one thing.
  const manual =
    props.status.manualCommand &&
    (props.refusal !== undefined || props.status.state === "occupied")
      ? props.status.manualCommand
      : undefined;
  return (
    <>
      {props.lead && (
        <p className="settings-subhead">{whatItDoes(props.status)}</p>
      )}
      {/* Polite rather than assertive: the outcome is worth announcing and is
          never urgent, and it replaces text the reader may be part-way through
          (`accessibility.md`). */}
      <div aria-live="polite">
        <StatusLine status={props.status} />
        {props.refusal && <p className="cli-refusal">{props.refusal}</p>}
      </div>
      {label && (
        <div className="cli-actions">
          <button
            tabIndex={0}
            type="button"
            className="primary"
            disabled={props.installing}
            onClick={props.onInstall}
          >
            {props.installing ? "Installing…" : label}
          </button>
        </div>
      )}
      {manual && (
        <ManualCommand
          command={manual}
          label={
            props.refusal
              ? "Run this in Terminal instead:"
              : "To do it yourself:"
          }
        />
      )}
    </>
  );
}

/**
 * The settings pane (`settingsSections.ts` — `Command line`).
 *
 * It is in the project settings panel and is not about the project, which the
 * closing note says outright rather than leaving to be inferred from the nav's
 * `stored in longclaw.yaml`. The Theme pane already does exactly this for the
 * appearance (D-42); this is the same exception, one pane along.
 */
export function CommandLineSection(props: {
  status: CommandLineStatus;
  onStatus: (status: CommandLineStatus) => void;
}) {
  const { installing, refusal, install } = useInstall(props.onStatus);
  return (
    <>
      <InstallBody
        lead
        status={props.status}
        installing={installing}
        refusal={refusal}
        onInstall={() => void install()}
      />
      <p className="settings-note">
        An app preference, not stored in the project — the command belongs to
        this Mac. The link points at the binary inside LongClaw, so it is always
        the same build as the app and the two cannot disagree about the file
        format. Moving or replacing the app leaves the link stale, and this pane
        is where it is put back.
      </p>
    </>
  );
}

/**
 * The first-launch offer.
 *
 * `ConfirmDialog` rather than a banner: it is asked once, it is answered in one
 * press either way, and the focus rules a modal owes — open on the safe button,
 * hold focus, `Esc` cancels — are already written there and would otherwise be
 * written a second time here.
 *
 * The dialog stays up after a refusal, because the refusal is the point: it is
 * where the line to paste appears, and dismissing the person to a toast would
 * be dropping them somewhere with no way back until they have made a project.
 * `Not now` becomes `Close` once there is nothing left to press.
 */
export function CommandLineOffer(props: {
  status: CommandLineStatus;
  onStatus: (status: CommandLineStatus) => void;
  /** Answered, either way. The caller records that this Mac has been asked. */
  onDismiss: () => void;
}) {
  const { installing, refusal, install } = useInstall(props.onStatus);
  const label = actionLabel(props.status);
  return (
    <ConfirmDialog
      title="Install the longclaw command?"
      body={
        <>
          <p>{whatItDoes(props.status)}</p>
          <InstallBody
            status={props.status}
            installing={installing}
            refusal={refusal}
            onInstall={() => {
              void install().then((done) => {
                if (done) props.onDismiss();
              });
            }}
          />
        </>
      }
      // The offer's own button lives in `InstallBody`, so the dialog's confirm
      // is only ever the one that is not there: once the state has no action
      // left, the two buttons would say the same thing twice.
      confirmLabel={null}
      cancelLabel={label && !refusal ? "Not now" : "Close"}
      onConfirm={props.onDismiss}
      onCancel={props.onDismiss}
    />
  );
}

/**
 * Whether this launch should raise the offer.
 *
 * Not when the command is already installed and pointing here, not when there
 * is nothing to install, and not when this Mac has been asked before. A stale
 * link *is* asked about: it is the one state that looks installed from a
 * terminal and runs the wrong build.
 */
export function shouldOfferCommandLine(
  status: CommandLineStatus,
  alreadyPrompted: boolean,
): boolean {
  if (alreadyPrompted) return false;
  return status.state === "absent" || status.state === "stale";
}
