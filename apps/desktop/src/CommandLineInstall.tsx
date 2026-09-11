/**
 * Installing the `longclaw` command, offered once and available forever after
 * (LC-233), and saying what it is *for* (LC-249a).
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
 * **The argument comes before the button.** LC-233 opened on what the press
 * writes to the filesystem and closed on a promise about folders: a complete
 * answer to a question nobody had asked, because nothing on screen said what
 * the command was for. So the first thing on both surfaces is now a terminal
 * block showing one real command and what it gets you, and the sentences that
 * survived it are the ones that are *news* — see `saysStatus`.
 *
 * **A refusal is answered in words.** `/usr/local/bin` is admin-writable on most
 * developer Macs and Homebrew is why, so the write usually just succeeds; on a
 * clean Apple Silicon machine the directory may not exist and creating it needs
 * root. The app cannot escalate — `release-audit.mjs` fails the build on
 * `Command::new`, so `osascript … with administrator privileges` is not
 * available, and neither a subprocess exemption nor an `SMAppService` helper is
 * worth a symlink. So the refusal names what happened and hands over the exact
 * line, paths filled in, with a button that copies it. That is the whole
 * escalation story, and it is deliberately the whole of it. There is no
 * approval stage anywhere in here, because there is no approval: the write is
 * one synchronous `symlink`, and `Installing…` is a frame rather than a step
 * somebody is waiting on.
 *
 * One file for both surfaces because they are one set of sentences. The offer
 * and the pane differ in framing — one asks, the other reports — and must not
 * come to describe the same act two different ways.
 */

import { useCallback, useId, useState, type ReactNode } from "react";
import { installCommandLine } from "./api";
import { copyToClipboard } from "./clipboard";
import { DEMO_ACTOR, DEMO_COMMAND, DEMO_OUTPUT } from "./commandLineDemo";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  readCommandLinePrompted,
  rememberCommandLinePrompted,
} from "./devicePreferences";
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
 * The sentence both surfaces open with, and the only one that has to make the
 * case rather than report a fact.
 *
 * It names what is added and who wants it, in that order, and it is one line
 * because the block underneath it is the argument. LC-233's version was
 * thirty-four words opening on `PATH` and ending on a promise about folders,
 * which is an answer to "is this safe" written above the question "what is
 * this".
 */
function whatItDoes() {
  return (
    <>
      Add the <code>longclaw</code> binary to your <code>PATH</code> so agents
      can read, file, update and close tickets.
    </>
  );
}

/**
 * What each state means to a surface: what the button says, whether it is worth
 * offering unasked, and whether the line to paste is the answer rather than a
 * second way to do the same thing.
 *
 * One record rather than a `switch` per question. The three questions were three
 * cascades over the same five values, which is the shape where a sixth state
 * gets added to two of them — and the one it misses is the one that silently
 * offers a button that can only fail. `StatusLine` keeps its own `switch`,
 * because a sentence with markup in it is not a table cell.
 */
const STATES: Record<
  CommandLineStatus["state"],
  {
    /** `null` is no button — a state the app cannot write its way out of. */
    action: string | null;
    /** Raised unasked on a machine that has never been offered the command. */
    offer: boolean;
    /** The `sudo` line stands without a refusal first, because it is the way out. */
    manual: boolean;
    /** The pane's readout, as the modifier on `.cli-dot`. `""` is the resting
     *  grey: nothing is installed, and nothing is wrong either. */
    dot: "" | "ok" | "warn";
  }
> = {
  absent: { action: "Install", offer: true, manual: false, dot: "" },
  stale: {
    action: "Point it at this app",
    offer: true,
    manual: false,
    dot: "",
  },
  linked: { action: null, offer: false, manual: false, dot: "ok" },
  occupied: { action: null, offer: false, manual: true, dot: "warn" },
  unavailable: { action: null, offer: false, manual: false, dot: "" },
};

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
  const [refusal, setRefusal] = useState<{
    message: string;
    command?: string;
  }>();
  const install = useCallback(async () => {
    setInstalling(true);
    setRefusal(undefined);
    try {
      onStatus(await installCommandLine());
      return true;
    } catch (error) {
      // The refusal carries its own `command`, and it is the fresher one: the
      // status was read at launch, and the app may have been moved since. Rust
      // computed this line against the paths the write actually used, so a
      // pasted line always names the bundle the refusal was about.
      const refused = normalizeError(error);
      setRefusal({
        message: refused.message,
        command: refused.context?.command,
      });
      return false;
    } finally {
      setInstalling(false);
    }
  }, [onStatus]);
  return { installing, refusal, install };
}

/**
 * One real command and what it gets you, in the agent's own terminal.
 *
 * This is the block LC-233 was missing and the strongest idea in the imported
 * design. It is above the fold on both surfaces, before the button is described,
 * because it is the reason anybody would press it.
 *
 * The command is a constant in `commandLineDemo.ts` rather than copy here, and
 * `scripts/cli-demo-guard.mjs` holds it to a verb `cli.rs` really dispatches.
 * The output is a knowing abbreviation — `ticket list` prints pretty-printed
 * JSON of every ticket — which is what `· example` in the caption is doing:
 * saying so, rather than passing two tidy lines off as a transcript.
 *
 * Not decorative, so not `aria-hidden`: it is the argument, and a reader who
 * cannot see it should be told there is one.
 */
function CommandPreview(props: { stale: boolean }) {
  return (
    <div
      className="cli-preview"
      role="group"
      aria-label="Example of the longclaw command and its output"
    >
      <div className="cli-preview-caption">
        {props.stale ? "what it is running today" : "what it gets you"} ·
        example
      </div>
      <div className="cli-preview-body">
        <div className="cli-preview-cmd">
          <span className="cli-preview-actor">{DEMO_ACTOR}</span>
          <span className="cli-preview-caret" aria-hidden="true">
            ❯
          </span>
          <span>{DEMO_COMMAND}</span>
        </div>
        {DEMO_OUTPUT.map((line) => (
          <div className="cli-preview-out" key={line}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
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
          aria-label="Copy the install command"
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
 * Whether this state's sentence is *news* on this surface.
 *
 * Both surfaces got shorter in review, and this is where that landed. `absent`
 * never says its sentence: in a dialog that exists to offer the install it
 * restates the dialog's own reason for being open, and in the pane the `Install`
 * button says the same thing by offering to change it. Every other state says
 * it in the pane, where somebody has come looking.
 *
 * In the dialog the survivors are the states whose sentence nothing else
 * carries: `occupied` and `unavailable`, which have no button and would
 * otherwise be a dialog that does not explain itself, and **`stale`** — the one
 * state a terminal reports as working while it runs the wrong build. Its button
 * alone (`Point it at this app`) would be carrying the whole explanation of why
 * a person who already has a working `longclaw` is being asked anything.
 *
 * `linked` is the exception that proves it: after a successful install the
 * dialog's own title says it, so the sentence would be said twice.
 */
function saysStatus(
  status: CommandLineStatus,
  surface: "dialog" | "pane",
  installed: boolean,
) {
  if (status.state === "absent") return false;
  if (surface === "pane") return true;
  return status.state !== "linked" && !installed;
}

/**
 * The argument, the state and whatever the last attempt had to say — shared by
 * the pane and the dialog so the two cannot drift apart.
 *
 * The button is **not** in here any more. Each surface owns its own, because
 * they belong in different places: the dialog's sits in the footer beside the
 * dismissal, which is the other half of one decision, and the pane's sits on
 * its header row opposite the name of the thing it installs. LC-233 put the
 * primary mid-body on both and the dismissal in the dialog's footer, so the two
 * answers to one question were in two places.
 */
function InstallBody(props: {
  status: CommandLineStatus;
  refusal?: { message: string; command?: string };
  surface: "dialog" | "pane";
  /** The install landed in this session, so the surface says so elsewhere. */
  installed?: boolean;
}) {
  const { manual } = STATES[props.status.state];
  const installed = props.installed ?? false;
  // The line is shown when the app has just been refused, and when the state is
  // one the app can never write its way out of. Not otherwise: an unpressed
  // button beside a `sudo` line reads as two ways to do one thing. The
  // refusal's own copy wins where there is one — see `useInstall`.
  const command = props.refusal
    ? (props.refusal.command ?? props.status.manualCommand)
    : manual
      ? props.status.manualCommand
      : null;
  // Nothing to preview where there is nothing to install, and nothing to argue
  // for in a dialog that has just done it.
  const preview =
    props.status.state !== "unavailable" &&
    !(props.status.state === "linked" && props.surface === "dialog");
  return (
    <>
      {preview && <CommandPreview stale={props.status.state === "stale"} />}
      {/* Polite rather than assertive: the outcome is worth announcing and is
          never urgent, and it replaces text the reader may be part-way through.
          The same choice the label editor and the write toast make. */}
      <div aria-live="polite">
        {saysStatus(props.status, props.surface, installed) && (
          <StatusLine status={props.status} />
        )}
        {props.refusal && (
          <p className="cli-refusal">{props.refusal.message}</p>
        )}
      </div>
      {command && (
        <ManualCommand
          command={command}
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
 * What the primary reads, given everything that has happened to it.
 *
 * `Try again` after a refusal is the whole reason this is a function. LC-233
 * left the button saying `Install` after a failed install, so pressing it a
 * second time looked like the first press had not registered.
 */
function actionLabel(
  status: CommandLineStatus,
  installing: boolean,
  refused: boolean,
) {
  if (installing) return "Installing…";
  if (refused) return "Try again";
  return STATES[status.state].action;
}

/**
 * The offer's one lasting side effect, made visible and reversible.
 *
 * `commandLinePrompted` is written the moment the dialog is answered either way
 * and LC-233 gave it no way back, so a person who pressed the dismissal on
 * first launch could never be asked again on that Mac — a preference with a
 * surface that could set it and none that could read it. The checkbox is that
 * surface, and it is in the pane rather than in the dialog: offering somebody
 * the chance to opt out of being asked *while they are being asked* is one more
 * control in a first-run modal for a decision they have already been given.
 */
function AskAgain(props: { status: CommandLineStatus }) {
  const id = useId();
  const [prompted, setPrompted] = useState(readCommandLinePrompted);
  return (
    <div className="cli-ask-again">
      <input
        type="checkbox"
        tabIndex={0}
        id={id}
        checked={!prompted}
        onChange={(event) => {
          const asking = event.target.checked;
          rememberCommandLinePrompted(!asking);
          setPrompted(!asking);
        }}
      />
      <label htmlFor={id}>
        Ask again when I open a project without the command
        {/* Only where the press is what turned it off. A machine that already
            had the command has the same preference recorded for it on launch,
            and telling that person they chose Skip for now would be telling
            them about a press they never made. */}
        {prompted && props.status.state !== "linked" && (
          <span className="hint"> — off since you chose Skip for now</span>
        )}
      </label>
    </div>
  );
}

/**
 * The settings pane (`settingsSections.ts` — `Command line`).
 *
 * Its header row is the thing it installs, named, with its state beside it and
 * the action opposite. The dot is redundancy rather than colour-as-information:
 * every state but `absent` says it in words on the same screen, and `absent`
 * says it in the `Install` button, which states the case by offering to change
 * it.
 *
 * The closing note LC-233 ended on — the paragraph saying the pane is an app
 * preference rather than project data — was cut in review with the rest of the
 * writes copy. That leaves nothing here saying the pane is not one more row of
 * `longclaw.yaml`, which is worth a ticket rather than a paragraph put back
 * without being asked for.
 */
export function CommandLineSection(props: {
  status: CommandLineStatus;
  onStatus: (status: CommandLineStatus) => void;
}) {
  const { installing, refusal, install } = useInstall(props.onStatus);
  const label = actionLabel(props.status, installing, refusal !== undefined);
  const { dot } = STATES[props.status.state];
  return (
    <>
      <div className="cli-head">
        <div className="cli-head-text">
          <div className="cli-name">
            <span
              className={dot ? `cli-dot ${dot}` : "cli-dot"}
              aria-hidden="true"
            />
            <code>longclaw</code>
            <span className="kind">command-line interface</span>
          </div>
          <p className="settings-subhead">{whatItDoes()}</p>
        </div>
        {label && (
          <button
            tabIndex={0}
            type="button"
            className="primary"
            disabled={installing}
            onClick={() => void install()}
          >
            {label}
          </button>
        )}
      </div>
      <InstallBody status={props.status} refusal={refusal} surface="pane" />
      <AskAgain status={props.status} />
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
 *
 * It also stays up after the install **lands**, which is new: the title becomes
 * the answer and the one button left reads `Done`. LC-233 closed the dialog on
 * success, so the only evidence that anything had happened was the dialog
 * disappearing — the same thing that happened when you declined.
 */
export function CommandLineOffer(props: {
  status: CommandLineStatus;
  onStatus: (status: CommandLineStatus) => void;
  /** Answered. The caller records that this Mac has been asked, and says which
   *  way it went — the two are different sentences and different toasts. */
  onDismiss: (outcome: "installed" | "skipped") => void;
}) {
  const { installing, refusal, install } = useInstall(props.onStatus);
  const [installed, setInstalled] = useState(false);
  const label = actionLabel(props.status, installing, refusal !== undefined);

  let title: ReactNode = "Use LongClaw with Agents";
  if (installed) {
    title = (
      <span className="cli-title-done">
        <span className="cli-check" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 14 14">
            <path
              d="M3 7.4 L5.9 10.2 L11 4.4"
              fill="none"
              stroke="var(--lc-on-accent-human)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <code>longclaw</code> is on your PATH
        </span>
      </span>
    );
  }

  return (
    <ConfirmDialog
      className="wide"
      title={title}
      body={
        <>
          {!installed && <p>{whatItDoes()}</p>}
          <InstallBody
            status={props.status}
            refusal={refusal}
            surface="dialog"
            installed={installed}
          />
        </>
      }
      // Three shapes, and each is a different question. Answered: one primary
      // reading `Done`, and no way out beside it, because there is nothing left
      // to decline. Nothing to press: `Close` alone. Otherwise the decision,
      // both halves of it together, dismissal weakest.
      confirmLabel={installed ? "Done" : label}
      confirmTone="primary"
      confirmDisabled={installing}
      onConfirm={
        installed
          ? () => props.onDismiss("installed")
          : () => void install().then((done) => done && setInstalled(true))
      }
      cancelLabel={installed ? null : label ? "Skip for now" : "Close"}
      // `Esc` and a click past the dialog both land here, including after the
      // install has already landed — the cancel *button* is gone by then, the
      // two gestures are not. Reporting `skipped` there would raise the skipped
      // toast over a command that is on `PATH`.
      onCancel={() => props.onDismiss(installed ? "installed" : "skipped")}
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
  return !alreadyPrompted && STATES[status.state].offer;
}

/**
 * The gear menu's hint for the `Command line tool` row: the answer, when there
 * is one.
 *
 * `null` for `unavailable`, deliberately. The row read `not set up` there — a
 * dev window's honest state — which named a thing to do that cannot be done,
 * and pressing it landed on a pane saying there is nothing to install.
 */
export function commandLineHint(
  status: CommandLineStatus | undefined,
): string | null {
  if (!status) return null;
  if (status.state === "linked") return "on PATH";
  if (status.state === "unavailable") return null;
  return "not set up";
}
