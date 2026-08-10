/**
 * The empty-project invitation (`states.md:28-35`, `screen-specs.md:161-163`,
 * prototype.js `guideCardHTML`).
 *
 * It used to be a full-width dashed panel that stood *instead of* the board —
 * six columns replaced by one box, in the one state the spec is most explicit
 * about: the app never hides the workspace (D-20/LC-86). So it is a card now,
 * and both surfaces keep their scaffold around it.
 *
 * Two things it deliberately is not. It carries no `New ticket` button, because
 * the header two rows up already has one and a second filled accent on an empty
 * screen makes the invitation compete with itself — the `C` chip says the same
 * thing quietly (D-24/LC-87). And it names no path: the path is in the header,
 * and printing it here wrapped a raw absolute path over two lines and stranded
 * the sentence's period alone on a third (D-25/LC-88).
 *
 * The whole card is the control, as it is in the prototype, so the invitation
 * and the thing it invites you to press are one target rather than a paragraph
 * beside a button.
 */

import { classes } from "./classes";

export function GuideCard(props: {
  /**
   * Which frame it is standing in. `card` is the board's: the Todo column's one
   * card, dashed, in place of the cards that column has none of. `panel` is the
   * list's: the same invitation with no frame of its own, because the list's
   * card frame is already drawn around it (D-26/LC-89).
   */
  variant: "card" | "panel";
  onCreate: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={0}
      className={classes(
        "guide-card",
        props.variant === "panel" && "guide-panel",
      )}
      // Named for what pressing it does. Without this the accessible name is
      // the whole card — the heading and the line of copy read out as a label.
      aria-label="Create your first ticket"
      aria-keyshortcuts="C"
      onClick={props.onCreate}
    >
      <strong>Create your first ticket</strong>
      <span>Title it, give it a checklist, point an agent at the folder.</span>
      {/* Decorative, like the header button's: the chip is the reminder and
          `aria-keyshortcuts` is what announces the key (LC-71). */}
      <kbd className="kbd-chip guide-kbd" aria-hidden="true">
        C
      </kbd>
    </button>
  );
}
