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
 * that is what this measures rather than guessing from focus. A field is asked
 * one question: *is what is on screen still what the person typed?*
 *
 * - Never typed in since it took focus → nothing to take back, the app's.
 * - Typed in, and the text is still theirs → the field's, including text they
 *   then deleted themselves; the undo stack outlives an empty box.
 * - Typed in, and something else has since set the value → the app's. A
 *   programmatic reset does not fire `input`, so a value that no longer matches
 *   what the last keystroke left is the app having cleared the box underneath.
 *
 * The record lives only while the caret is in the field, and a blur ends it.
 * That is a choice, and it is not what a native text field does — a real undo
 * stack survives a blur. It is right here because these fields are drafts over
 * a file rather than documents: the panel re-seeds every one of them from what
 * was read, and a title that has already been written is a stack describing an
 * edit the app has committed. Letting it claim the key after the write would
 * take the toast's own Undo away from the gesture that raised it.
 */

/** What the last keystroke left in the field the caret is in. */
let typed: { field: Element; value: string | undefined } | undefined;

const FIELDS = "input, textarea, [contenteditable=true]";

/**
 * The `input` types that hold text, and so hold an undo stack.
 *
 * `singleKeyShortcutAllowed` asks `input` whole, which is right for the
 * single-key rule — `S` must not type an `s`, whatever the box is for. It is
 * wrong for `⌘Z`, and a checkbox is why: ticking a checklist row leaves focus
 * on the box, and `states.md:62` names **check** as one of the mutations that
 * raises **Undo ⌘Z**, so the app's most-offered undo was standing down for a
 * control with no undo of its own to stand down for (LC-220).
 */
const TEXTUAL = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
]);

/** The value to compare against later, or `undefined` where there is none. */
function valueOf(field: Element): string | undefined {
  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement
    ? field.value
    : undefined;
}

/** The text field this element sits in, if it is in one at all. */
function textFieldAt(target: HTMLElement): Element | undefined {
  const field = target.closest(FIELDS);
  if (!field) return undefined;
  if (field instanceof HTMLInputElement && !TEXTUAL.has(field.type)) {
    return undefined;
  }
  return field;
}

/**
 * Watches the caret and the keystrokes under it. Install once, for as long as
 * the app can raise a toast; the listeners are on `document` because the fields
 * that matter are spread across four surfaces and two of them are modals.
 */
export function trackFieldEdits(): () => void {
  // A new field starts with no edit of its own, whatever the last one had.
  const onFocus = () => {
    typed = undefined;
  };
  const onInput = (event: Event) => {
    const field = event.target;
    if (!(field instanceof Element)) return;
    typed = { field, value: valueOf(field) };
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("input", onInput);
  return () => {
    typed = undefined;
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
  if (!(target instanceof HTMLElement)) return false;
  const field = textFieldAt(target);
  if (!field || field !== typed?.field) return false;
  // A `contenteditable` has no `value` to compare, so an edit in one is taken
  // at its word — the app never resets one under the caret.
  return typed.value === undefined || typed.value === valueOf(field);
}
