/**
 * What the keyboard is pointed at, for every handler that has to care.
 *
 * The rule it started as is `keyboard-focus-map.md:13-15`: single-key shortcuts
 * suspend while an input has focus, and chords do not. It lives here rather
 * than inside a surface because four handlers ask it — the board, the list, the
 * panel, and the global `C` — and when it was an ad-hoc `closest()` call in one
 * component the others disagreed with it.
 *
 * `⌘Z` asks a second question of the same target (LC-220), and it is here for
 * the reason the first one is: two `closest()` calls, in two modules, over two
 * hand-written selectors is the drift this module was made to end. One
 * vocabulary of what a field is, and the questions differ where they mean to.
 */

/**
 * Everything a keystroke could be typed into or swallowed by.
 *
 * Deliberately wide: `S` must not type an `s` into a box, whatever the box is
 * for, so a checkbox and a `select` belong here as much as a text field does.
 */
const EDITABLE = "input, textarea, select, [contenteditable=true]";

/**
 * The `input` types that hold text, and so hold a native undo stack — which in
 * this app is `text`, and a bare `<input>`, which reports itself as one.
 * `<textarea>` never reaches this list: it is not an `input`, so it is taken by
 * the element check rather than by a type.
 *
 * Named rather than excluded, because the two lists fail in opposite
 * directions: a type missing from this one costs that field its own undo, while
 * a checkbox missing from a list of what to *skip* is LC-220 again. It names
 * what the app ships rather than what it might, so **a search, number or email
 * box added later has to be added here** — the failure is the recoverable one,
 * but it is still a failure.
 */
const TEXTUAL = new Set(["text"]);

/** Single-key shortcuts are inactive while the user is editing a control. */
export function singleKeyShortcutAllowed(target: EventTarget | null): boolean {
  return !(target instanceof HTMLElement && target.closest(EDITABLE));
}

/**
 * The text field this target sits in, if it is in one at all — the narrower
 * question, for the one key a control can *own* rather than merely swallow.
 *
 * A checkbox is why the two differ. Ticking a checklist row leaves focus on the
 * box, and `states.md:62-63` names **check** among the mutations that "raise a
 * toast with **Undo ⌘Z**", so asking `input` whole stood the app's most-offered
 * undo down for a control with no undo of its own to stand down for (LC-220).
 * A `select` is out for the same reason, and holds no text besides.
 */
export function textFieldAt(target: EventTarget | null): Element | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  const field = target.closest(EDITABLE);
  if (!field || field instanceof HTMLSelectElement) return undefined;
  if (field instanceof HTMLInputElement && !TEXTUAL.has(field.type)) {
    return undefined;
  }
  return field;
}

/**
 * A chord, taking `⌘` or `Ctrl` alike. One convention for the whole app, which
 * is what plan 24 asked for: `⌘K`, `⌘F`, `⌘Z` and `⌘↵` all read the event the
 * same way, so a Ctrl keyboard reaches every one of them or none.
 */
export function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

/**
 * The digit of a `⌘1`…`⌘9` press, or `undefined` for anything that is not one
 * (LC-230).
 *
 * It reads the modifiers exactly as `isChord` does — `⌘` or `Ctrl` alike —
 * because a second way to spell a chord is the drift this module was made to
 * end. It is a separate function rather than nine `isChord` calls because the
 * caller wants the *number*, and nine calls would be nine places to get the
 * convention wrong.
 *
 * `0` is not in the range: there is no zeroth row, and a chord that quietly
 * rounded to the first would be worse than one that does nothing.
 */
export function chordDigit(event: KeyboardEvent): number | undefined {
  if (!(event.metaKey || event.ctrlKey)) return undefined;
  if (!/^[1-9]$/.test(event.key)) return undefined;
  return Number(event.key);
}
