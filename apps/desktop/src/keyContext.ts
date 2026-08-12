/**
 * The one rule every single-key shortcut in the app rests on
 * (`keyboard-focus-map.md:13-15`): single-key shortcuts suspend while an input
 * has focus, and chords do not.
 *
 * It lives here rather than inside a surface because four handlers ask it —
 * the board, the list, the panel, and the global `C` — and when it was an
 * ad-hoc `closest()` call in one component the others disagreed with it.
 */

/**
 * Single-key shortcuts are inactive while the user is editing a control.
 *
 * `⌘Z` asks `fieldUndo.ts` instead, and the difference is deliberate: this one
 * asks whether a keystroke would be *typed*, which any focusable control can
 * do something with, while undo asks whether the field has an edit to take
 * back — a question a checkbox and an untouched box both answer no to (LC-220).
 */
export function singleKeyShortcutAllowed(target: EventTarget | null): boolean {
  return !(
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable=true]")
  );
}

/**
 * A chord, taking `⌘` or `Ctrl` alike. One convention for the whole app, which
 * is what plan 24 asked for: `⌘K`, `⌘F`, `⌘Z` and `⌘↵` all read the event the
 * same way, so a Ctrl keyboard reaches every one of them or none.
 */
export function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}
