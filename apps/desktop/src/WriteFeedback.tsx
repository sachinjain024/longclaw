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

/**
 * How long a write may stay unsettled before it may spin. Below this the text
 * alone reports it: a spinner on every keystroke-fast write reads as slowness
 * the app does not have (`states.md:56-58`).
 */
const SPINNER_DELAY_MS = 500;

/** Toast auto-dismiss (`components.md:213-215`). */
const TOAST_MS = 5_000;

/**
 * The honest surface of optimistic UI: the mutated element already shows its
 * final state, and this says what the disk is actually doing.
 */
export function WriteIndicator(props: { idle?: string; className?: string }) {
  const writing = useMutationStore((state) => state.writing);
  const settled = useMutationStore((state) => state.settled);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!writing) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [writing]);

  const className = props.className ?? "disk-path";
  if (writing) {
    return (
      <code className={`${className} writing`}>
        {slow && (
          <span className="write-spinner" aria-hidden="true">
            ⟳
          </span>
        )}
        writing {writing}…
      </code>
    );
  }
  // A settled mark for someone else's file is not this surface's news.
  if (settled && (props.idle === undefined || settled === props.idle)) {
    return <code className={`${className} settled`}>✓ {settled}</code>;
  }
  if (!props.idle) return null;
  return <code className={className}>{props.idle}</code>;
}

export function ToastStack() {
  const toast = useMutationStore((state) => state.toast);
  const dismiss = useMutationStore((state) => state.dismiss);

  // A danger toast carries the only Retry and reports state that was taken back
  // under the user, so it waits to be read rather than expiring on its own.
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
      if (!event.metaKey || event.key.toLowerCase() !== "z") return;
      // ⌘Z inside a field is the field's own undo, not the app's.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }
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
              className="toast-action"
              onClick={() => {
                dismiss(toast.id);
                toast.retry?.();
              }}
            >
              Retry
            </button>
          )}
          {toast.tone === "danger" && (
            <button
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
