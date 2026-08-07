/**
 * The confirm a destructive action goes behind (`screen-specs.md:277-278`).
 *
 * There is one destructive-looking action in v0 — **Remove from app** — and it
 * fired on the first click, from a red button, with its guarantee unstated
 * (D-44, LC-144). The dialog exists to say the guarantee at the moment it is
 * doubted: the folder and every ticket file in it stay on disk, and the only
 * thing removed is this app's reference to them.
 *
 * Focus opens on **Cancel**, deliberately: `Enter` on a dialog nobody read is
 * how a confirm becomes the click it was meant to interrupt. The rest is the
 * focus map's rules for a modal — focus is held until the dialog is dismissed
 * and returned to whatever opened it (`keyboard-focus-map.md:16-23`) — and `Esc`
 * cancels, stopping there rather than walking on to the surface behind it, which
 * is the rung the menus own too.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ProjectReference } from "./types";

export function ConfirmDialog(props: {
  title: string;
  /** Why this is safe, in the caller's words: it knows what it is removing. */
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Entry and exit in one place, and in this order deliberately: whatever raised
  // the dialog is read *before* focus moves into it, so the ref holds the opener
  // rather than the button this effect is about to focus. An `autoFocus` on
  // Cancel would have run first and left this reading itself.
  //
  // Rule 3 owns the return. A confirmed removal takes its own opener off the
  // screen with it, and focusing an element that is no longer in the document
  // does nothing — which is the right answer, not a special case.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    cancel.current?.focus();
    return () => opener?.focus();
  }, []);

  /**
   * Rule 5: a modal holds focus until it is dismissed. Without this, `Tab` off
   * the danger button walks straight into the screen the dialog is asking about.
   */
  function holdFocus(event: React.KeyboardEvent) {
    const stops = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>("button") ?? [],
    );
    if (stops.length === 0) return;
    event.preventDefault();
    const here = stops.indexOf(document.activeElement as HTMLElement);
    const next = here + (event.shiftKey ? -1 : 1);
    stops[(next + stops.length) % stops.length].focus();
  }

  return (
    // Clicking away is the same answer as Cancel, which is how the prototype's
    // scrim behaves (`prototype.js` — `overlay-dismiss`). Only the scrim itself:
    // a click inside the dialog is not a click past it.
    <div
      className="modal-scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onCancel();
      }}
    >
      <div
        ref={dialog}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            holdFocus(event);
            return;
          }
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          props.onCancel();
        }}
      >
        <h2 id={titleId}>{props.title}</h2>
        <div className="confirm-body">{props.body}</div>
        <div className="confirm-actions">
          <button
            ref={cancel}
            tabIndex={0}
            className="secondary"
            type="button"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            tabIndex={0}
            className="danger"
            type="button"
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What **Remove from app** asks before it does anything, from either of the two
 * places that offer it (`screen-specs.md:275-278`).
 *
 * One component rather than one per surface, because the guarantee is the point:
 * the same action must not repeat it in two different sets of words, and it must
 * not be stated on one screen and skipped on the other — which is what happened
 * while the settings panel's copy of the button went straight through.
 *
 * It lives beside the dialog it fills in rather than in `App`, because the
 * second caller is the settings dialog (LC-129) and a component reaching back
 * into `App` for it would be an import cycle.
 */
export function RemoveProjectConfirm(props: {
  project: ProjectReference;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      title={`Remove “${props.project.name}” from LongClaw?`}
      body={
        <p>
          The folder <code>{props.project.rootPath}</code> and every ticket file
          in it <strong>stay on disk, untouched</strong>. You can open it again
          anytime.
        </p>
      }
      confirmLabel="Remove from app"
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  );
}
