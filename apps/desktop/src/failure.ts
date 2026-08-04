/**
 * How a failure is presented, wherever it surfaces.
 *
 * ADR 0010 gives every expected failure a code, a message, `recoverable`, and a
 * little context. What the surfaces did with that was show the code — the error
 * banner's heading was `error.code.replaceAll("_", " ")`, so a read-only project
 * folder announced itself as *permission denied* over a sentence Rust had
 * written for a log. A file that cannot be written is an ordinary thing to
 * happen to a files-on-disk app, and it has to read like one (V0-29).
 *
 * The division of labour: Rust says what happened and to which file, because it
 * is the only layer that knows. This says what to do about it, because that is a
 * product decision, and it says it from `context.cause` rather than by matching
 * on the system's prose.
 */

import { FAILURE_CAUSES, type AppError, type FailureCause } from "./types";

/**
 * The cause the error carries, if it carries one this build knows.
 *
 * Derived from `FAILURE_CAUSES` rather than repeating its members, so a cause
 * added on the Rust side is a one-line change here and not a silent gap: the
 * fixture pin catches the list, and `failureRecovery`'s exhaustive record
 * refuses to compile until the new cause has copy.
 */
function causeOf(error: AppError): FailureCause | undefined {
  const cause = error.context?.cause;
  return FAILURE_CAUSES.find((known) => known === cause);
}

/** A human title, so no surface has to fall back to printing the code. */
export function failureTitle(error: AppError): string {
  switch (error.code) {
    case "permission_denied":
    case "io":
      return "That file could not be written";
    case "conflict":
      return "Changed on disk";
    case "project_unavailable":
      return "Project folder not found";
    case "invalid_project":
      return "Not a LongClaw project";
    case "ticket_not_found":
      return "Ticket not found";
    case "parse_failed":
      return "That file could not be read";
    case "unsupported_version":
      return "Newer format";
    case "cancelled":
      return "Cancelled";
    default:
      return "Something went wrong";
  }
}

/**
 * What the human can do about it, for the causes the error names.
 *
 * Deliberately silent when `cause` is absent: inventing a recovery for a failure
 * nobody classified sends people to check permissions on a file whose volume was
 * unplugged. Silence leaves Retry, which is honest.
 */
export function failureRecovery(error: AppError): string | undefined {
  const cause = causeOf(error);
  if (cause === undefined) return undefined;
  const recovery: Record<FailureCause, string> = {
    readOnly:
      "Give yourself write access to it and to its folder, then try again.",
    noSpace: "Free some space on the volume, then try again.",
    missing: "Check whether it was moved or renamed, then try again.",
  };
  return recovery[cause];
}

/** The file this failure is about, when the error names one. */
export function failurePath(error: AppError): string | undefined {
  return error.context?.path;
}

/**
 * What the app promises about the bytes — and only what it can promise. A save
 * that failed while restoring what it displaced kept those bytes beside the
 * ticket, and saying "nothing was written" there would be a lie.
 */
export function failureGuarantee(error: AppError): string | undefined {
  const preserved = error.context?.preservedPath;
  if (preserved)
    return `The bytes this save displaced were kept at ${preserved}.`;
  if (!error.recoverable) return undefined;
  return "The file was left as it was.";
}

/** The message a surface shows: what happened, and what to do about it. */
export function failureMessage(error: AppError): string {
  const recovery = failureRecovery(error);
  return recovery ? `${error.message} ${recovery}` : error.message;
}
