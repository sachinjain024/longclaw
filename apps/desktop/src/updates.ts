/**
 * Every user-facing string the update path puts on screen or reads out loud,
 * and the small decisions the pane needs that are not markup (LC-256a).
 *
 * **The copy deck is the source, not a transcription of one.** The deck was
 * settled in the ticket, from the prototype, and the prototype's own rule is
 * that the scenes read the deck rather than being typed out beside it — because
 * a stale copy line reads exactly like a fresh one. The same rule applies once
 * the copy reaches `src/`: `UpdatesPane.tsx` renders from this object, its test
 * asserts against this object, and the ids here are the ids the ticket's deck
 * uses, so a review reply saying `updates.pane.restart.blocked → …` names one
 * place to change.
 *
 * **No ellipsis on a label.** `docs/design/foundations/components.md` § Do /
 * don't carries the rule: a trailing `…` promises a dialog, and none of these
 * opens one. The dots survive only on an in-flight frame — `Checking…`,
 * `Downloading…`, `Restarting…` — where they are a state rather than a promise.
 *
 * **The release notes are not in here.** They come from the manifest, which the
 * release script takes from `docs/release-notes`, so the app and the site's
 * changelog cannot disagree about what changed.
 */

import { UPDATE_FAILURE_REASONS, type UpdateFailureReason } from "./types";

/**
 * The deck. `{version}`, `{age}`, `{date}`, `{received}` and `{total}` are
 * filled at render by the helpers below rather than by string replacement at
 * the call site, so a placeholder that loses its filler is a type error.
 */
export const UPDATE_COPY = {
  /** The settings side nav's row, between `Command line` and `Danger zone`. */
  nav: {
    label: "Updates",
    /** Visually hidden, on the nav row, when an update is waiting. The dot
     *  beside it is decorative: colour is never the only channel. */
    available: "An update is available",
  },
  /** The side panel's foot, which always names the running version. */
  footer: {
    version: (version: string) => `LongClaw ${version}`,
    update: "Update",
    updateAria: (version: string) => `Update to LongClaw ${version}`,
  },
  pane: {
    version: (version: string) => `LongClaw ${version}`,
    automaticLabel: "Check for updates automatically",
    automaticNote:
      "Once a day, and when the app opens. The check fetches one file from LongClaw’s GitHub release and sends nothing about you or your projects.",
    check: "Check now",
    checking: "Checking…",
    last: (age: string) => `Last checked ${age}`,
    never: "Not checked yet",
    upToDate: "You’re on the latest version.",
    availableTitle: (version: string) => `${version} is available`,
    availableDate: (date: string) => `Released ${date}`,
    /** The first press. It downloads; `Restart to update` is what updates. */
    download: "Update",
    progress: (received: string, total: string) =>
      `Downloading… ${received} of ${total}`,
    /** Above the restart button. The pane needs something visible saying the
     *  file is whole; the live region alone was heard and not seen. */
    ready: "Downloaded and verified.",
    restart: "Restart to update",
    restartBlocked: "Waiting for a save to finish.",
    restarting: "Restarting…",
    checkFailed: "Couldn’t check for updates.",
    verifyFailed: "The download couldn’t be verified and was discarded.",
    downloadFailed: "The download didn’t finish.",
    /** The file arrived and verified; putting it in place did not work. Its own
     *  sentence because it is the opposite news from `downloadFailed`, and
     *  wearing that one sent every reader of LC-265y at the network. */
    installFailed: "The update couldn’t be installed.",
    retry: "Try again",
    downloadPage: "Open the download page",
    unavailable:
      "This build can’t check for updates. That is what a npm run dev window looks like; an app built from the .dmg can.",
  },
  /** Announced once each. Nothing outside the pane says these in print. */
  live: {
    available: (version: string) =>
      `LongClaw ${version} is available. Open Settings, then Updates.`,
    ready: (version: string) =>
      `LongClaw ${version} is downloaded. Restart to update.`,
    blocked: "Restart is waiting for a save to finish.",
  },
} as const;

/**
 * Whether an error's `context.reason` is one this build knows.
 *
 * Derived from the tuple in `types.ts`, which is derived from Rust's own
 * `UpdateFault::ALL` through the shared fixture. A reason this build does not
 * recognise is treated as no reason at all — the pane falls back to *couldn't
 * check*, which is true of every unknown failure and promises nothing.
 */
export function isUpdateFailureReason(
  value: unknown,
): value is UpdateFailureReason {
  return (UPDATE_FAILURE_REASONS as readonly string[]).includes(
    value as string,
  );
}

/** The reason an update error carries, or `undefined` if it carries none. */
export function updateFailureReason(
  error: unknown,
): UpdateFailureReason | undefined {
  const context = (error as { context?: Record<string, string> } | undefined)
    ?.context;
  const reason = context?.reason;
  return isUpdateFailureReason(reason) ? reason : undefined;
}

/**
 * The sentence for one reason.
 *
 * Three of the eight share *couldn't check*, and deliberately: offline, a
 * proxy that answered instead, and a manifest this build cannot read are one
 * thing to the person sitting there — the check did not work — and three
 * sentences would be three explanations of a network they cannot see. The
 * three that do get their own words are the three about a *file*: one that
 * would not verify, one that did not arrive, and one that arrived whole and
 * could not be put in place.
 */
export function updateFailureSentence(
  reason: UpdateFailureReason | undefined,
): string {
  switch (reason) {
    case "badSignature":
      return UPDATE_COPY.pane.verifyFailed;
    case "corruptDownload":
      return UPDATE_COPY.pane.downloadFailed;
    case "installFailed":
      return UPDATE_COPY.pane.installFailed;
    case "unavailable":
      return UPDATE_COPY.pane.unavailable;
    case "writeInFlight":
      return UPDATE_COPY.pane.restartBlocked;
    case "offline":
    case "blocked":
    case "badManifest":
    case undefined:
      return UPDATE_COPY.pane.checkFailed;
  }
}

/**
 * How long ago, in the words the pane uses.
 *
 * Coarse on purpose. The question `Last checked` answers is "is this roughly
 * current", and a minute count invites a reader to watch it — which is a thing
 * to watch for a check that is supposed to be beneath notice.
 */
export function describeAge(
  checkedAt: string | undefined,
  now: number = Date.now(),
): string {
  if (!checkedAt) return UPDATE_COPY.pane.never;
  const then = Date.parse(checkedAt);
  if (Number.isNaN(then)) return UPDATE_COPY.pane.never;
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return UPDATE_COPY.pane.last("just now");
  if (minutes < 60) {
    return UPDATE_COPY.pane.last(
      `${minutes} minute${minutes === 1 ? "" : "s"} ago`,
    );
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return UPDATE_COPY.pane.last(`${hours} hour${hours === 1 ? "" : "s"} ago`);
  }
  const days = Math.floor(hours / 24);
  return UPDATE_COPY.pane.last(`${days} day${days === 1 ? "" : "s"} ago`);
}

/**
 * A byte count as the progress frame reads it.
 *
 * Megabytes and one decimal, because the artefact is tens of megabytes and a
 * figure that changes every frame in its last digit is motion rather than
 * information.
 */
export function describeBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${megabytes.toFixed(1)} MB`;
}

/**
 * How long a scheduled slot is, in the frontend's own reckoning.
 *
 * The same 24 hours Rust enforces, and stated in both places on purpose: the
 * frontend decides *when* to ask because ADR 0012 keeps Rust out of the
 * preferences document, and Rust refuses a second request inside a slot because
 * a schedule that lived only in a webview would be a schedule a reload resets.
 * Neither is the other's backstop; they are the same rule held at both ends.
 */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a scheduled check is due.
 *
 * The automatic preference is checked **here, before the request**, which is
 * what ADR 0014 means by the preference being honoured before the first
 * request rather than after one: with the check off, nothing is ever asked,
 * and the runtime audit's third phase is what records that.
 */
export function isCheckDue(
  automatic: boolean,
  lastCheckedAt: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!automatic) return false;
  if (!lastCheckedAt) return true;
  const then = Date.parse(lastCheckedAt);
  if (Number.isNaN(then)) return true;
  return now - then >= CHECK_INTERVAL_MS;
}
