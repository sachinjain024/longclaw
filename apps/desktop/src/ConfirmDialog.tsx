/**
 * The confirm a destructive action goes behind (`screen-specs.md:335-336`).
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
  /**
   * `ReactNode` rather than a string because one caller's title is the answer
   * rather than the question: the command-line offer swaps its own heading for
   * a check mark and a `<code>` span once the install lands (LC-249a). The
   * accessible name still comes off the `h2`, so what goes in here is what a
   * screen reader reads out.
   */
  title: ReactNode;
  /** Why this is safe, in the caller's words: it knows what it is removing. */
  body: ReactNode;
  /**
   * `null` when there is nothing left to confirm — a dialog whose body holds
   * its own action, or one that has become something to read rather than to
   * answer (`CommandLineInstall.tsx`). Two buttons saying the same thing is
   * what that would otherwise be.
   */
  confirmLabel: string | null;
  /**
   * What the way out is called. `Cancel` is right for a confirm and wrong for a
   * dialog that has already done what it was going to do.
   *
   * `null` removes it, which only a dialog with nothing left to refuse may ask
   * for: the offer after a successful install is one button reading `Done`, and
   * a `Cancel` beside it would offer to undo something this dialog cannot undo.
   * Focus opens on the confirm instead — the same rule, since with one button
   * the safe answer and the only answer are the same button.
   */
  cancelLabel?: string | null;
  /**
   * How the confirm button reads. `danger` is the default because **Remove from
   * app** was the only caller for a while; a dialog that asks *which project* a
   * write lands in is an ordinary choice and must not be dressed as a
   * destructive one (LC-188).
   */
  confirmTone?: "danger" | "primary";
  /** Optional for the same reason `confirmLabel` is nullable: a dialog with no
   *  confirm button has nothing to hand a handler to. */
  onConfirm?: () => void;
  /** The confirm is pressed and its write is out. A frame rather than a stage:
   *  nothing behind it is waiting on the person (LC-249a). */
  confirmDisabled?: boolean;
  /**
   * An extra class on the dialog box. One modifier exists — `wide`, for the
   * offer, whose body carries a terminal block that 420px breaks badly. The
   * base width stays where it is on purpose: the delete confirmations are two
   * sentences and widening them would be widening the wrong dialog.
   */
  className?: string;
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

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
    // Cancel where there is one, and where there is not, the only button there
    // is. `?.` on both rather than a branch: a dialog can have neither — one
    // whose body holds its own action — and focusing nothing is the honest
    // answer there, not an error.
    (cancel.current ?? confirm.current)?.focus();
    return () => opener?.focus();
  }, []);

  /**
   * A control that disables itself under the pointer takes focus with it: the
   * browser blurs a focused element the moment it becomes disabled, and focus
   * lands on the document body — outside the dialog, which is the one place
   * rule 5 says it may never be. So when the confirm comes back, it is given
   * focus back, but only if nothing inside the dialog has it: a person who
   * tabbed to Cancel while the write was out has made a choice, and taking it
   * off them would be worse than the thing this fixes.
   */
  useEffect(() => {
    if (props.confirmDisabled) return;
    if (dialog.current?.contains(document.activeElement)) return;
    confirm.current?.focus();
  }, [props.confirmDisabled]);

  /**
   * Rule 5: a modal holds focus until it is dismissed. Without this, `Tab` off
   * the danger button walks straight into the screen the dialog is asking about.
   *
   * Disabled buttons are not stops. A disabled one is still in the document and
   * `focus()` on it does nothing, so a ring that included it would swallow every
   * other `Tab` while a write is out (LC-249a) — the browser's own ring skips
   * them, and this stands in for the browser's ring.
   */
  function holdFocus(event: React.KeyboardEvent) {
    const stops = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ??
        [],
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
        className={
          props.className
            ? `confirm-dialog ${props.className}`
            : "confirm-dialog"
        }
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
          {props.cancelLabel !== null && (
            <button
              ref={cancel}
              tabIndex={0}
              className="secondary"
              type="button"
              onClick={props.onCancel}
            >
              {props.cancelLabel ?? "Cancel"}
            </button>
          )}
          {props.confirmLabel !== null && (
            <button
              ref={confirm}
              tabIndex={0}
              className={props.confirmTone ?? "danger"}
              type="button"
              disabled={props.confirmDisabled}
              onClick={props.onConfirm}
            >
              {props.confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What **Remove from app** asks before it does anything, from either of the two
 * places that offer it (`screen-specs.md:333-336`).
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
