/**
 * The two surfaces that report a write: the disk-state indicator and the toast.
 *
 * They own their own timers rather than the store, so both are cleaned up on
 * unmount and both are drivable with fake timers. The undo key lives here too,
 * because undo is paired with the toast (`keyboard-focus-map.md:30`) — when the
 * toast goes, so does the offer.
 */

import { useEffect, useState } from "react";
import { useMutationStore } from "./mutations";
import { isChord, singleKeyShortcutAllowed } from "./keyContext";

/**
 * How long a write may stay unsettled before it may spin. Below this the text
 * alone reports it: a spinner on every keystroke-fast write reads as slowness
 * the app does not have (`states.md:56-58`).
 */
const SPINNER_DELAY_MS = 500;

/** Toast auto-dismiss (`components.md:213-215`). */
const TOAST_MS = 5_000;

/**
 * How long the settled `✓` stands. `states.md:178-180` has the panel show it
 * *briefly*, and a mark that never expires is the thing LC-69 removed under
 * another name: the last write of the session still on screen an hour later,
 * for a file the user may have navigated away from. It matches the toast
 * because both report the same event.
 */
const SETTLED_MS = TOAST_MS;

/**
 * `screen-specs.md:51-52` and `states.md:180` both name a file rather than a
 * path — `writing ticket.md…`, `✓ ticket.md`. The store keeps the
 * project-relative path, because that is what identifies *which* write; this
 * line only has to say which file it landed in.
 */
function fileName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * The honest surface of optimistic UI: the mutated element already shows its
 * final state, and this says what the disk is actually doing.
 *
 * It reports only what is happening or what just landed
 * (`screen-specs.md:50-53`). With no write, no read and no `idle` file to name,
 * it renders nothing at all — the `● watching` chip it replaced in the content
 * header was steady-state dev telemetry rather than designed chrome (LC-69).
 *
 * `busy` is a read the app is waiting on. A write outranks it, because the
 * write is the user's own action and the one whose durability is in question.
 */
export function WriteIndicator(props: {
  idle?: string;
  busy?: "reading" | "reconciling";
  className?: string;
}) {
  const writing = useMutationStore((state) => state.writing);
  const settled = useMutationStore((state) => state.settled);
  const [slow, setSlow] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!writing) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [writing]);

  // Keyed on `writing` as well as `settled`, so a second write to the same file
  // — where `settled` never changes value — still gets a fresh mark.
  useEffect(() => {
    setStale(false);
    if (!settled || writing) return;
    const timer = setTimeout(() => setStale(true), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [settled, writing]);

  const className = props.className ?? "disk-path";
  if (writing) {
    return (
      <code className={`${className} writing`}>
        {slow && (
          <span className="write-spinner" aria-hidden="true">
            ⟳
          </span>
        )}
        writing {fileName(writing)}…
      </code>
    );
  }
  // No spinner here: the 500ms spinner is the unsettled-write promise
  // (`states.md:56-58`), and a read is not a write.
  if (props.busy) {
    return <code className={className}>{props.busy}</code>;
  }
  // A settled mark for someone else's file is not this surface's news. The
  // comparison stays on the full path, which is what identifies the file.
  if (
    settled &&
    !stale &&
    (props.idle === undefined || settled === props.idle)
  ) {
    return (
      <code className={`${className} settled`}>✓ {fileName(settled)}</code>
    );
  }
  if (!props.idle) return null;
  return <code className={className}>{props.idle}</code>;
}

export function ToastStack() {
  const toast = useMutationStore((state) => state.toast);
  const dismiss = useMutationStore((state) => state.dismiss);

  // A danger toast carries the only Retry — or, on a conflict, the only way to
  // go and look — and reports state that was taken back under the user, so it
  // waits to be read rather than expiring on its own.
  const expires = toast && toast.tone !== "danger";
  useEffect(() => {
    if (!toast || !expires) return;
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, expires, dismiss]);

  const undo = toast?.undo;
  const toastId = toast?.id;
  useEffect(() => {
    if (!undo || toastId === undefined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // `⌘`/`Ctrl` alike, the convention plan 24 picked for every chord.
      if (!isChord(event, "z")) return;
      // ⌘Z inside a field is the field's own undo, not the app's.
      if (!singleKeyShortcutAllowed(event.target)) return;
      event.preventDefault();
      dismiss(toastId);
      undo();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, toastId, dismiss]);

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toast && (
        <div className={toast.tone === "danger" ? "toast danger" : "toast"}>
          <span className="toast-message">{toast.message}</span>
          {toast.undo && (
            <button
              tabIndex={0}
              className="toast-action"
              onClick={() => {
                dismiss(toast.id);
                toast.undo?.();
              }}
            >
              Undo <kbd>⌘Z</kbd>
            </button>
          )}
          {toast.retry && (
            <button
              tabIndex={0}
              className="toast-action"
              onClick={() => {
                dismiss(toast.id);
                toast.retry?.();
              }}
            >
              Retry
            </button>
          )}
          {toast.review && (
            <button
              tabIndex={0}
              className="toast-action"
              onClick={() => {
                dismiss(toast.id);
                toast.review?.();
              }}
            >
              Open ticket
            </button>
          )}
          {toast.tone === "danger" && (
            <button
              tabIndex={0}
              className="toast-dismiss"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
