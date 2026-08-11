import { useEffect, useRef } from "react";

/**
 * Grows a textarea to the height of its own text.
 *
 * Every title and composer in the app lost the native resize grabber (LC-107,
 * LC-108, LC-153): the prototype has no such handle anywhere, and a grabber on
 * a title is an affordance for a problem — a title too tall for its box — that
 * the field should never hand to the human in the first place. Taking the
 * handle away makes the height the field's own job, which is what this does, by
 * the same measurement the prototype uses (`prototype.js:1714-1717`): let the
 * box collapse to nothing, then take the content's height back off it.
 *
 * It lives here rather than in `TicketPanel`, which is where it was written,
 * because the create panel's title is the same field wearing the same
 * `.panel-title` rule — and `resize: none` without one of these is a field that
 * clips, which is worse than the grabber. `scripts/field-guard.mjs` holds the
 * pair.
 */
/**
 * The field's own top and bottom borders, which `scrollHeight` does not count.
 *
 * The stylesheet is `box-sizing: border-box`, so a height set to `scrollHeight`
 * alone leaves the *content* box short by exactly the borders — and a field two
 * pixels short scrolls its own last line out of sight for as long as there is
 * text in it. Every field this hook drove was borderless until LC-201 put a
 * bordered description in quick create, which is why it has never shown; the
 * composer has carried the same two pixels since it was written.
 */
function borders(element: HTMLTextAreaElement): number {
  const style = getComputedStyle(element);
  return (
    (parseFloat(style.borderTopWidth) || 0) +
    (parseFloat(style.borderBottomWidth) || 0)
  );
}

export function useAutoGrow(value: string) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      // jsdom has no layout, so `scrollHeight` is 0 under test. Pinning the
      // field to nothing would be worse than leaving the stylesheet to size it.
      if (element.scrollHeight > 0) {
        element.style.height = `${element.scrollHeight + borders(element)}px`;
      }
    };
    fit();
    // The text is not the only thing that decides how tall it has to be: the
    // panel is a percentage of the window, so narrowing the window rewraps the
    // same characters onto more lines. Without this the height stays where the
    // last keystroke left it — and `.panel-title` hides its overflow, so the
    // title would clip silently, which is the failure taking the resize
    // grabber away was supposed to make impossible.
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [value]);
  return field;
}
