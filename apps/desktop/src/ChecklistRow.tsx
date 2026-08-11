/**
 * What a checklist row's own controls are, wherever the row is drawn (LC-215).
 *
 * The same split `checklistOrder.ts` makes for the drag: two surfaces draw a
 * checklist — the ticket panel, whose rows are items on disk, and the create
 * panel, whose rows are strings that have not been written yet — and rewording
 * or removing a row has to look and read the same in both, or the same two
 * buttons would mean two different gestures depending on whether the ticket
 * existed yet.
 *
 * What differs between them is what a commit *does*: the panel writes an edit
 * against an item id, and create replaces a string in an array. Neither of those
 * is here. The callbacks are.
 *
 * What must not differ is what a gesture *means*, and there is one rule both
 * callers keep: an empty field leaves the row as it was. A field is where words
 * are changed and `✕` is where a row is removed, so a field that also deleted
 * would be two gestures wearing one control.
 */

import { useRef, useState } from "react";
import { PencilGlyph } from "./PencilGlyph";

/**
 * A row's two controls, quiet until the row is hovered or something in it holds
 * focus — the treatment the drag grip beside them already has, for the same
 * reason: six rows each showing two buttons is a wall of chrome over what is
 * meant to read as a list.
 *
 * Both are real Tab stops rather than pointer-only affordances. Create's rows
 * have carried a named Remove as a stop since before this, and a row whose
 * gestures were reachable only through a key nobody wrote down is the shape
 * `keyboard-focus-map.md:11-12` exists to refuse.
 *
 * Named for the row they act on, like the board column's `+`: "Edit" six times
 * over says nothing about which row was reached.
 */
export function RowActions(props: {
  text: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="row-actions">
      <button
        type="button"
        tabIndex={0}
        className="ghost row-edit"
        title={`Edit ${props.text}`}
        aria-label={`Edit ${props.text}`}
        onClick={props.onEdit}
      >
        <PencilGlyph />
      </button>
      <button
        type="button"
        tabIndex={0}
        className="ghost row-remove"
        title={`Remove ${props.text}`}
        aria-label={`Remove ${props.text}`}
        onClick={props.onRemove}
      >
        ✕
      </button>
    </span>
  );
}

/**
 * One row, being retyped in place.
 *
 * The text lives here rather than in the surface above, so a keystroke
 * re-renders one row instead of the whole list — the same reason the composer's
 * draft does not sit in the store.
 *
 * `Enter` commits and `Esc` abandons, which is the title field's contract
 * (`keyboard-focus-map.md:80-81`) and the one a human arrives already knowing.
 * Blur commits too: a field left by clicking elsewhere has been left, and losing
 * what was typed to a stray click is the worse of the two failures.
 */
export function RowEditor(props: {
  text: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(props.text);
  /**
   * Whether this field has already answered, either way.
   *
   * Three things end an edit and two of them arrive together: committing moves
   * focus — the panel's removal sends it to the add-row, and the row behind the
   * field is replaced — so the blur lands *after* the submit that caused it.
   * Without this the row would be written twice, and `Esc` would be followed by
   * the blur committing what it just abandoned.
   */
  const done = useRef(false);
  function once(answer: () => void) {
    if (done.current) return;
    done.current = true;
    answer();
  }
  return (
    <form
      className="row-edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        once(() => props.onCommit(draft));
      }}
    >
      <input
        className="row-edit-field"
        // The row it stands in for is the thing being named, so the field
        // carries the name the button that opened it did.
        aria-label={`Edit ${props.text}`}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          // Stopped here: the panel's own `Esc` closes the panel, and a field
          // being abandoned is not the panel being closed
          // (`keyboard-focus-map.md:16-23`).
          event.stopPropagation();
          once(props.onCancel);
        }}
        onBlur={() => once(() => props.onCommit(draft))}
      />
    </form>
  );
}
