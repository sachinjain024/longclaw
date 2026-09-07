/**
 * How a project's folder is *shown*. Never how it is stored, copied or opened:
 * every function here returns display text, and the value behind it — the full
 * absolute path — stays whole in the chip's `title` and in what a click puts on
 * the clipboard.
 *
 * Two steps, in this order. `tildeAbbreviate` spends the home directory, which
 * is free: `~` is shorter and says more. `splitPath` then says where the rest
 * may be spent if the box is too narrow to hold it — but does not spend it,
 * because only the laid-out box knows whether anything has to give.
 */

/**
 * Abbreviate a home-relative path to `~/…` for display. The clause lives in
 * LC-68, which carries D-06's remaining work; `cc_ui_diffs.md` § Step 2 was the
 * original citation and was deleted 2026-08-07.
 * Only the actual home directory — supplied by the native layer — is
 * abbreviated. The clipboard and tooltip keep the full absolute path.
 */
export function tildeAbbreviate(path: string, home: string | null): string {
  if (!home) return path;
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  return path;
}

/**
 * The path split where the middle elision happens: everything up to the last
 * separator, and the last segment with the separator still on it.
 *
 * **The elision is CSS's, not this function's.** The head is the part that may
 * be ellipsized and the tail is the part that never is — the last folder is
 * what identifies the project, and `~/Developer/…` is the same on every path in
 * this app, so the head is what gets cut into. Rendering them as two spans lets
 * the box do the cutting: the head shrinks and takes an ellipsis exactly when
 * the text is wider than the panel, at whatever width the panel currently is.
 *
 * **This replaces a character cap, and the cap is why.** The chip is mono, so a
 * character count *is* a pixel count — but only against one box, and there is
 * more than one box. The column is 165px above 980px and 145px at 980 and
 * below — `styles.css`'s one side-panel breakpoint —
 * and a single constant measured against the narrower one left 25px of the
 * wider one empty at every window anybody actually uses. Six derivations of
 * that constant were wrong before this one: 22 characters in a box calculated
 * at 140 and measured at 123; 25 in a box of 157, over by a pixel; 24 in a box
 * with the settings gear hanging over the end of it; 18 taken at 1180, which
 * clipped at 900; 16 against a chip held clear of a gear that has since moved;
 * and 21, which fit the narrowest box and no other. The seventh derivation is
 * not to derive one — `probe:header` now checks that the chip reaches the
 * column's edge rather than that its text fits a number (LC-239w).
 *
 * A path with no separator at all is all tail, which is the honest reading:
 * there is no head to spend.
 */
export function splitPath(text: string): { head: string; tail: string } {
  const cut = text.lastIndexOf("/");
  if (cut <= 0) return { head: "", tail: text };
  return { head: text.slice(0, cut), tail: text.slice(cut) };
}
