/**
 * Which of the two undos `⌘Z` means, when the caret is inside a text field.
 *
 * `keyboard-focus-map.md:13-15` keeps the chords live everywhere "except where
 * the OS owns them (e.g. `⌘Z` inside a focused text field is the field's
 * undo)", and reading that as *any focused field* is what LC-220 is about. The
 * app's own gestures end by putting focus in a control that has no undo to
 * defend: quick create's **Create more** clears the title and focuses it again,
 * removing a checklist row hands focus to the add-row because it is the one
 * control always there, and ticking a row leaves focus on the box that was
 * ticked. All three raise a toast saying **Undo ⌘Z**, and in all three the key
 * did nothing — an offer on screen and unreachable, which is worse than no
 * offer at all.
 *
 * The OS owns the key while the field has an edit of its own to give back, and
 * that is what this measures rather than guessing from focus. *Which* controls
 * can hold such an edit is `keyContext.ts`'s to say — this module is the state
 * that has to be watched to answer for one. A field is asked one question:
 * *is what is on screen still what the person typed?*
 *
 * - Never typed in since it took focus → nothing to take back, the app's.
 * - Typed in, and the text is still theirs → the field's, including text they
 *   then deleted themselves; the undo stack outlives an empty box.
 * - Typed in, and something else has since set the value → the app's. A
 *   programmatic reset does not fire `input`, so a value that no longer matches
 *   what the last keystroke left is the app having cleared the box underneath.
 *
 * One record, for the field the caret is in — taking focus elsewhere replaces
 * it, and it is only ever read for the field the keystroke actually landed in,
 * so a record left behind by a blur to nothing can never answer for anybody.
 * That a field loses its claim by being left is a choice, and not what a native
 * one does: a real undo stack survives a blur. It is right here because these
 * are drafts over a file rather than documents — the panel re-seeds every one
 * of them from what was read, so a title that has already been written is a
 * stack describing an edit the app has committed, and letting it claim the key
 * back would take Undo from the toast of the very gesture that raised it.
 *
 * One tracker, for the app's one `ToastStack` (`App.tsx:2091`). A second live
 * instance would install a second pair of listeners and the first to unmount
 * would clear the record the other was still reading, so this is a constraint
 * rather than a component that happens to be mounted once.
 *
 * What it does not attempt: choosing between two *different* undoable things.
 * A gesture that clears a field while an unrelated toast is still up — posting
 * a comment during another mutation's five seconds — hands `⌘Z` to that toast,
 * because the toast is the offer on screen and `keyboard-focus-map.md:30`
 * pairs the key to it. That is the last mutation, which is the whole scope
 * (`data-requirements.md:121`); the comment's own text is not a mutation and
 * has no inverse to be.
 */

import { textFieldAt } from "./keyContext";

/**
 * Where the last keystroke landed, and what it left in the box.
 *
 * The pair is the whole measurement: the field alone would say a keystroke
 * happened somewhere, and the value alone could not say whose. Together they
 * are the claim `fieldOwnsUndo` checks — *this* field, still holding what the
 * person typed into it.
 */
let lastKeystroke: { field: Element; value: string | undefined } | undefined;

/** The value to compare against later, or `undefined` where there is none. */
function valueOf(field: Element): string | undefined {
  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement
    ? field.value
    : undefined;
}

/**
 * Watches the caret and the keystrokes under it. Install once, for as long as
 * the app can raise a toast; the listeners are on `document` because the fields
 * that matter are spread across four surfaces and two of them are modals.
 */
export function trackFieldEdits(): () => void {
  // A new field starts with no edit of its own, whatever the last one had.
  const onFocus = () => {
    lastKeystroke = undefined;
  };
  const onInput = (event: Event) => {
    const field = event.target;
    if (!(field instanceof Element)) return;
    lastKeystroke = { field, value: valueOf(field) };
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("input", onInput);
  return () => {
    lastKeystroke = undefined;
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("input", onInput);
  };
}

/**
 * Whether `⌘Z` belongs to the field the event landed in rather than to the app.
 *
 * False for anything that is not a text field, which is where the app's undo
 * has always run: a card, a button, the board itself.
 */
export function fieldOwnsUndo(target: EventTarget | null): boolean {
  const field = textFieldAt(target);
  if (!field || field !== lastKeystroke?.field) return false;
  // A `contenteditable` has no `value` to compare, so an edit in one is taken
  // at its word — the app never resets one under the caret.
  return (
    lastKeystroke.value === undefined || lastKeystroke.value === valueOf(field)
  );
}
