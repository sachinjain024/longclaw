/**
 * The *Updates* pane (LC-256a, `settingsSections.ts` — `Updates`).
 *
 * The second settings pane that is about the app rather than about this
 * project, and it sits beside the first. It is the only surface in the app that
 * says anything about updates in words: the sidebar footer carries a link and a
 * dot, and the settings nav carries a dot, and everything either of them means
 * is read here.
 *
 * **Consent is two presses.** `Update` downloads, `Restart to update` installs,
 * and neither is ever pressed on somebody's behalf. The first is a deliberate
 * reuse of the word on the footer link, confirmed in review: three controls in
 * one flow carry it, and the first of them downloads rather than updates.
 *
 * **The restart is refused while a ticket write is outstanding, twice.** Here,
 * by holding the button and saying why, which is the experience; and in Rust,
 * from a count kept around the atomic write seams, which is the guarantee
 * (ADR 0009). The held button is `aria-disabled` rather than `disabled`, so it
 * keeps its tab stop and a press can announce the reason — a `disabled` button
 * leaves the tab order and nobody hears why.
 *
 * **Failure is quiet and stays in here.** Nothing outside this pane changes
 * when a check fails: no mark, no changed menu row, no toast, no dialog. A
 * machine that has never checked and one that is up to date are
 * indistinguishable everywhere else (ADR 0014, D10).
 *
 * Every string comes from `updates.ts`, which is the settled copy deck. Nothing
 * user-facing is typed in this file.
 */

import { useCallback, useId, useState } from "react";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  openDownloadPage,
} from "./api";
import {
  readAutomaticUpdateCheck,
  readLastUpdateCheck,
  rememberAutomaticUpdateCheck,
  rememberUpdateCheck,
} from "./devicePreferences";
import { MarkdownView } from "./MarkdownView";
import { useMutationStore } from "./mutations";
import {
  UPDATE_COPY,
  describeAge,
  describeBytes,
  updateFailureReason,
  updateFailureSentence,
} from "./updates";
import type { UpdateFailureReason, UpdateStatus } from "./types";

/**
 * What the pane shows before an answer arrives, and on a host that never
 * answers at all — a browser tab, the perf harness, a `vitest` render.
 *
 * `unavailable`, for the same reason `UNREAD_COMMAND_LINE` is: it is the
 * truthful answer to both, and a spinner would be a promise that something is
 * coming.
 */
export const UNREAD_UPDATE_STATUS: UpdateStatus = {
  state: "unavailable",
  currentVersion: "",
  available: null,
  downloaded: false,
};

/** What the pane is doing right now, which is not the same as what it knows. */
type Activity = "idle" | "checking" | "downloading" | "restarting";

/**
 * Which press failed, so `Try again` repeats *that* one.
 *
 * Tracked rather than inferred from the status: a check can fail while a
 * version is already pending, and a retry inferred from "there is an update"
 * would download instead of re-checking — a button that does something other
 * than what just failed.
 */
type FailedAt = "check" | "download" | "restart";

/** How far a download has got. `total` is absent where the host did not say. */
type Progress = { received: number; total: number | null };

/**
 * The pane's own work, held here rather than in the app.
 *
 * A failure is local state, the way the command-line refusal is: it belongs
 * beside the button it is about, and the app's error banner would be a sentence
 * about updates on a surface that is not this one — which is the thing D10
 * forbids.
 */
function useUpdateWork(onStatus: (status: UpdateStatus) => void) {
  const [activity, setActivity] = useState<Activity>("idle");
  const [progress, setProgress] = useState<Progress>();
  const [failure, setFailure] = useState<UpdateFailureReason | undefined>();
  const [failedAt, setFailedAt] = useState<FailedAt | undefined>();
  const [announcement, setAnnouncement] = useState("");

  const check = useCallback(
    async (force: boolean) => {
      setActivity("checking");
      setFailedAt(undefined);
      setFailure(undefined);
      try {
        const status = await checkForUpdate(force);
        // Only a success moves the record. A machine offline for a week must
        // read as last checked a week ago, never as up to date just now.
        rememberUpdateCheck();
        onStatus(status);
        if (status.state === "available" && status.available) {
          setAnnouncement(UPDATE_COPY.live.available(status.available.version));
        }
      } catch (error) {
        setFailure(updateFailureReason(error));
        setFailedAt("check");
      } finally {
        setActivity("idle");
      }
    },
    [onStatus],
  );

  const download = useCallback(async () => {
    setActivity("downloading");
    setFailedAt(undefined);
    setFailure(undefined);
    setProgress({ received: 0, total: null });
    try {
      const status = await downloadUpdate((frame) => {
        if (frame.event === "progress") setProgress(frame.data);
      });
      onStatus(status);
      if (status.available) {
        setAnnouncement(UPDATE_COPY.live.ready(status.available.version));
      }
    } catch (error) {
      setFailure(updateFailureReason(error));
      setFailedAt("download");
    } finally {
      setActivity("idle");
      setProgress(undefined);
    }
  }, [onStatus]);

  const restart = useCallback(async () => {
    setActivity("restarting");
    setFailedAt(undefined);
    setFailure(undefined);
    try {
      // Never returns when it works: the process is replaced.
      await installUpdate();
    } catch (error) {
      const reason = updateFailureReason(error);
      setFailure(reason);
      setFailedAt("restart");
      if (reason === "writeInFlight") setAnnouncement(UPDATE_COPY.live.blocked);
      setActivity("idle");
    }
  }, []);

  return {
    activity,
    progress,
    failure,
    failedAt,
    announcement,
    check,
    download,
    restart,
  };
}

/** The bar, and the frame that says what it is a bar of. */
function DownloadProgress(props: { progress: Progress }) {
  const { received, total } = props.progress;
  const fraction = total && total > 0 ? Math.min(1, received / total) : 0;
  return (
    <div className="upd-progress">
      <div className="upd-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <p className="upd-frame">
        {UPDATE_COPY.pane.progress(
          describeBytes(received),
          total === null ? "…" : describeBytes(total),
        )}
      </p>
    </div>
  );
}

/**
 * What to do when the in-app update could not finish.
 *
 * Two buttons, always together: trying again is the cheap answer and the
 * download page is the one that always works. A failure with only a retry is a
 * dead end on a network that is not coming back.
 */
function FailureActions(props: {
  reason: UpdateFailureReason | undefined;
  onRetry: () => void;
}) {
  return (
    <>
      <p className="upd-refusal">{updateFailureSentence(props.reason)}</p>
      <div className="upd-actions">
        <button
          tabIndex={0}
          type="button"
          className="secondary"
          onClick={props.onRetry}
        >
          {UPDATE_COPY.pane.retry}
        </button>
        <button
          tabIndex={0}
          type="button"
          className="ghost"
          onClick={() => void openDownloadPage()}
        >
          {UPDATE_COPY.pane.downloadPage}
        </button>
      </div>
    </>
  );
}

/** The version on offer, what changed in it, and the two presses. */
function AvailableUpdate(props: {
  status: UpdateStatus;
  work: ReturnType<typeof useUpdateWork>;
  writesInFlight: number;
}) {
  const release = props.status.available;
  const work = props.work;
  if (!release) return null;
  const held = props.writesInFlight > 0;
  return (
    <section className="upd-available">
      <h3 className="upd-title">
        {UPDATE_COPY.pane.availableTitle(release.version)}
      </h3>
      {release.date && (
        <p className="upd-date">
          {UPDATE_COPY.pane.availableDate(release.date)}
        </p>
      )}
      {release.notes && (
        <MarkdownView
          className="upd-notes"
          source={release.notes}
          headingOffset={3}
        />
      )}

      {work.activity === "downloading" && work.progress && (
        <DownloadProgress progress={work.progress} />
      )}

      {/* A check can fail while a version is already pending, so the retry
          repeats the press that failed rather than the one the state implies. */}
      {work.failedAt ? (
        <FailureActions
          reason={work.failure}
          onRetry={() => {
            if (work.failedAt === "check") void work.check(true);
            else if (work.failedAt === "restart") void work.restart();
            else void work.download();
          }}
        />
      ) : props.status.downloaded ? (
        <>
          <p className="upd-ready">{UPDATE_COPY.pane.ready}</p>
          <div className="upd-actions">
            <button
              tabIndex={0}
              type="button"
              className="primary"
              // `aria-disabled`, not `disabled`: the button keeps its tab stop
              // so a press can announce why it is being held.
              aria-disabled={held || work.activity === "restarting"}
              onClick={() => {
                if (work.activity === "restarting") return;
                void work.restart();
              }}
            >
              {work.activity === "restarting"
                ? UPDATE_COPY.pane.restarting
                : UPDATE_COPY.pane.restart}
            </button>
            {held && (
              <span className="why">{UPDATE_COPY.pane.restartBlocked}</span>
            )}
          </div>
        </>
      ) : (
        work.activity !== "downloading" && (
          <div className="upd-actions">
            <button
              tabIndex={0}
              type="button"
              className="primary"
              onClick={() => void work.download()}
            >
              {UPDATE_COPY.pane.download}
            </button>
          </div>
        )
      )}
    </section>
  );
}

export function UpdatesSection(props: {
  status: UpdateStatus;
  onStatus: (status: UpdateStatus) => void;
}) {
  const work = useUpdateWork(props.onStatus);
  const writesInFlight = useMutationStore((state) => state.inFlight);
  const [automatic, setAutomatic] = useState(readAutomaticUpdateCheck);
  const toggleId = useId();
  const unavailable = props.status.state === "unavailable";

  return (
    <>
      <div className="upd-head">
        <div className="upd-head-text">
          <p className="upd-version">
            {UPDATE_COPY.pane.version(props.status.currentVersion)}
          </p>
          {!unavailable && (
            <p className="settings-subhead">
              {describeAge(readLastUpdateCheck())}
            </p>
          )}
        </div>
        {/* Hidden rather than disabled where there is no updater: a control
            that cannot do the thing it names reads as broken, which is the
            correct reading. The sentence below says why instead. */}
        {!unavailable && (
          <button
            tabIndex={0}
            type="button"
            className="secondary"
            disabled={work.activity === "checking"}
            onClick={() => void work.check(true)}
          >
            {work.activity === "checking"
              ? UPDATE_COPY.pane.checking
              : UPDATE_COPY.pane.check}
          </button>
        )}
      </div>

      {/* Polite rather than assertive: none of this is urgent, and it replaces
          text a reader may be part-way through. The same choice the write toast
          and the label editor make. */}
      <div aria-live="polite">
        {unavailable && (
          <p className="upd-state">{UPDATE_COPY.pane.unavailable}</p>
        )}
        {!unavailable &&
          work.failedAt &&
          props.status.state !== "available" && (
            <FailureActions
              reason={work.failure}
              onRetry={() => void work.check(true)}
            />
          )}
        {!unavailable &&
          !work.failedAt &&
          props.status.state === "upToDate" &&
          readLastUpdateCheck() && (
            <p className="upd-state">{UPDATE_COPY.pane.upToDate}</p>
          )}
        <span className="visually-hidden">{work.announcement}</span>
      </div>

      {props.status.state === "available" && (
        <AvailableUpdate
          status={props.status}
          work={work}
          writesInFlight={writesInFlight}
        />
      )}

      {!unavailable && (
        <div className="upd-auto">
          <div className="cli-ask-again">
            <input
              type="checkbox"
              tabIndex={0}
              id={toggleId}
              checked={automatic}
              onChange={(event) => {
                rememberAutomaticUpdateCheck(event.target.checked);
                setAutomatic(event.target.checked);
              }}
            />
            <label htmlFor={toggleId}>{UPDATE_COPY.pane.automaticLabel}</label>
          </div>
          <p className="upd-auto-note">{UPDATE_COPY.pane.automaticNote}</p>
        </div>
      )}
    </>
  );
}
