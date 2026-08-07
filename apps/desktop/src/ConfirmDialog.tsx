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
 * how a confirm becomes the click it was meant to interrupt. `Esc` cancels and
 * stops there rather than reaching the surface behind it, which is the same rule
 * the menus follow (`keyboard-focus-map.md:19-31`).
 */
import { useId, type ReactNode } from "react";

export function ConfirmDialog(props: {
  title: string;
  /** Why this is safe, in the caller's words: it knows what it is removing. */
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <div className="modal-scrim" role="presentation">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
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
            tabIndex={0}
            className="secondary"
            type="button"
            autoFocus
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
