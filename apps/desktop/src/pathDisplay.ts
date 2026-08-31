/**
 * How a project's folder is *shown*. Never how it is stored, copied or opened:
 * every function here returns display text, and the value behind it — the full
 * absolute path — stays whole in the chip's `title` and in what a click puts on
 * the clipboard.
 *
 * Two steps, in this order. `tildeAbbreviate` spends the home directory, which
 * is free: `~` is shorter and says more. `elidePath` spends what is left,
 * which is not free, and so is only asked for by the surface that has to.
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
 * How the cap is spent: six characters of head, one ellipsis, fourteen of tail.
 * The **head** is what gets cut into, deliberately — `~/Developer/…` is the
 * same on every path in this app, and the last segment is the folder that
 * identifies the project. A tail ellipsis would keep exactly the half that says
 * nothing.
 */
export const SIDEBAR_PATH_HEAD = 6;
export const SIDEBAR_PATH_TAIL = 14;

/**
 * The side panel's path box, in characters.
 *
 * A character count rather than a width, and that is exact rather than
 * approximate: the chip is mono, so every glyph is the same 6.3px at 10.5px and
 * a character cap *is* a pixel cap.
 *
 * **The box is 137px at the width where it is smallest**, and 137 / 6.3 is 21.
 * The narrowest box is the one that decides, because this is one constant for
 * every window: the column is 149px of chip at 1180 and 137 below about 900,
 * where the shell squeezes the panel by 12px, and a cap taken from the wide
 * measurement clips at the narrow one — visibly, as a second ellipsis after
 * the first.
 *
 * Every attempt to *derive* this from the panel's width was wrong: 22
 * characters in a box calculated at 140 and measured at 123; 25 in a box of
 * 157, over by a pixel; 24 in a box that turned out to have the settings gear
 * hanging over the end of it; 18 from the box at 1180, which clips at 900; 16
 * against a chip held clear of a gear that has since moved into the name's row
 * and given the width back. So it is measured, and `probe:header` measures it
 * again at every width on every run, because every one of those was invisible
 * except as a second ellipsis on screen (LC-239w).
 *
 * The chip keeps its own `text-overflow: ellipsis` under this, as a backstop
 * rather than as the mechanism: what the cap is for is keeping the *head* of
 * the path on screen, which an ellipsis alone would eat. `probe:header` checks
 * that the two agree at every width from 1440 down to 760.
 */
export const SIDEBAR_PATH_CAP = SIDEBAR_PATH_HEAD + SIDEBAR_PATH_TAIL + 1;

/**
 * `<head>…<tail>`, or the path itself when it already fits.
 *
 * Run over `tildeAbbreviate`'s output, so the `~` is spent before the cap is.
 * The result is never longer than the cap, whatever it is handed — including a
 * path with no separators in it at all, which is why this counts characters
 * rather than walking segments.
 *
 * `Array.from`, not `slice`: a character is not always one code unit, and half
 * a surrogate pair renders as the replacement glyph. A project folder with an
 * emoji in its name is unusual and entirely legal, and cutting one in half is
 * the kind of defect that only ever shows up in somebody else's screenshot.
 * It is the same reason `projectInitial` takes the first *character* rather
 * than the first code unit.
 */
export function elidePath(text: string): string {
  const glyphs = Array.from(text);
  if (glyphs.length <= SIDEBAR_PATH_CAP) return text;
  return (
    glyphs.slice(0, SIDEBAR_PATH_HEAD).join("") +
    "…" +
    glyphs.slice(-SIDEBAR_PATH_TAIL).join("")
  );
}
