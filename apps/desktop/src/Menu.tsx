/**
 * The anchored popover behind status, priority, ordering and labels.
 *
 * `screen-specs.md:317-325` specifies one menu for all four, so this is one
 * component with no idea which field it is editing: it is handed rows, the values
 * that are currently set, and something to hang off. Single-select picks and
 * closes; multi-select ticks and stays open, which is the only difference between
 * the priority menu and the labels menu.
 *
 * Focus is the part worth being careful about. The menu takes focus when it
 * opens, standing on the value that is already set, and hands it back to the
 * anchor when it closes — including when it closes because the value changed, so
 * a human who pressed `P` on a card is still standing on that card afterwards.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import {
  useDismissOnPressOutside,
  useFocusReturn,
  usePopoverPlacement,
} from "./popover";

export interface MenuOption<T extends string> {
  id: T;
  label: string;
  /** The option's own glyph, the same one it wears wherever else it appears. */
  glyph?: ReactNode;
}

interface MenuProps<T extends string> {
  /** Names the menu for assistive technology: `Priority`, `Labels`. */
  label: string;
  options: MenuOption<T>[];
  /** Every value currently set. Each carries the trailing check. */
  selected: readonly T[];
  /** Ticks rather than picks, and stays open. Labels (V0-10) wants this. */
  multiple?: boolean;
  /** Mono line under the rows, for the ordering menu's view-preference note. */
  footnote?: string;
  /**
   * A control under the rows, rather than another row: LC-236e's define-a-label
   * form, which is a field, a colour and a commit and so cannot be a
   * `MenuOption`. It is outside the roving group's index space — see `stops`.
   */
  footer?: ReactNode;
  /**
   * The footer's own focusable stop, which puts it **in the roving group**: `↓`
   * past the last row reaches it and `↑` from the first row wraps onto it.
   * Without this the footer is a Tab stop only, which leaves `↓` wrapping
   * straight past the one thing in the popover that is not a value.
   *
   * A ref rather than an index because the footer decides what its stop *is* —
   * LC-236e's is the collapsed button while the row is shut and the name field
   * once it is open, and the swap happens without the menu being told.
   */
  footerStop?: RefObject<HTMLElement | null>;
  /**
   * Widens the popover **from the moment it opens**, for a footer that needs
   * more room than a row does. It is a flag rather than a width the footer
   * grows into on its own because `usePopoverPlacement` measures once and
   * clamps nothing (`popover.ts:172`): a popover that widened after placement
   * would run off the right edge in full create and stay there.
   */
  wide?: boolean;
  /** What the menu hangs off and returns focus to: a trigger, or a board card. */
  anchor: HTMLElement | null;
  onPick: (id: T) => void;
  onClose: () => void;
}

export function Menu<T extends string>(props: MenuProps<T>) {
  const { anchor, multiple, onClose } = props;
  const popover = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  /** What the footer occupies, so its own controls can be told from a row. */
  const footerBox = useRef<HTMLDivElement>(null);
  const first = props.options.findIndex((option) =>
    props.selected.includes(option.id),
  );
  /**
   * Which stop the roving group is standing on: a row's index, or the footer.
   *
   * The footer is `"footer"` and not `options.length` because the list grows
   * underneath it. Defining a label from the footer adds a row, and an index
   * that meant *the footer* one render would mean *the last row* the next —
   * which took focus out of the field the moment a definition landed in it.
   */
  const [active, setActive] = useState<number | "footer">(
    props.options.length === 0 && props.footerStop
      ? "footer"
      : first === -1
        ? 0
        : first,
  );

  // Placement, focus return and click-away are the same three every anchored
  // popover in the app does, and live in `popover.ts` since LC-208.
  const returnTo = useFocusReturn(anchor);
  const position = usePopoverPlacement(anchor);
  useDismissOnPressOutside({
    popover,
    // What focus will go back to, which is the anchor whenever there is one —
    // a board card's menu opens with no trigger element, and the card itself
    // is then the thing whose own press must not read as a dismissal.
    anchor: returnTo.current ?? null,
    onDismiss: onClose,
  });

  /** Every stop `↑`/`↓` walks, in the order they are drawn. */
  const stops: (number | "footer")[] = [
    ...props.options.map((_, index) => index),
    ...(props.footerStop ? (["footer"] as const) : []),
  ];

  const { footerStop } = props;
  useLayoutEffect(() => {
    // Read through the ref at the moment focus moves, never captured during a
    // render: the element behind it does not exist yet on the first one, and
    // it is swapped for another when the define row expands.
    if (active === "footer") footerStop?.current?.focus();
    else rows.current[active]?.focus();
    // Only when the stop itself changes. The list growing under a stop that
    // has not moved is not a reason to take focus off it — defining a label
    // adds a row, and that must not pull the caret out of the field that
    // just defined it.
  }, [active, footerStop]);

  function pick(id: T) {
    props.onPick(id);
    if (!multiple) onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    /**
     * A field in the footer owns every key typed into it, and this handler is
     * on the popover, so without this line the menu takes them: `j` and `k`
     * steer the list — they are letters in `Jack` — the arrows move the active
     * row instead of the caret, and `Enter` and `Escape` are the menu's rather
     * than the row's. The footer stops the ones it acts on itself.
     */
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (stops.length === 0) return;
    const step =
      event.key === "ArrowDown" || event.key === "j"
        ? 1
        : event.key === "ArrowUp" || event.key === "k"
          ? -1
          : 0;
    if (step !== 0) {
      event.preventDefault();
      // Wraps at both ends (`keyboard-focus-map.md:139`), over the rows and
      // the footer alike — `↓` past the last label reaches the define row,
      // which is the one thing in this popover that is not a value.
      setActive((standing) => {
        const at = stops.indexOf(standing);
        return stops[(at + step + stops.length) % stops.length];
      });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      /**
       * Never the footer's. Its controls are real buttons — a submit, a colour
       * trigger — and this handler is on the popover, so both of these would
       * otherwise `preventDefault()` the activation and pick a *label* instead.
       *
       * The roving index is not enough to decide it. It only reads `"footer"`
       * when the arrows put it there, and a row opened with the pointer leaves
       * it standing on whatever it was: `Enter` on **Add label** ticked the
       * first label in the menu and swallowed the write. So the question is
       * where the press came from, which the DOM answers directly.
       */
      if (
        active === "footer" ||
        footerBox.current?.contains(event.target as Node)
      ) {
        return;
      }
      // Taken here rather than left to the button's own activation, so a pick is
      // one code path whether it came from the keyboard or the pointer.
      event.preventDefault();
      pick(props.options[active].id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // Escape stops here rather than closing the panel behind the menu.
      event.stopPropagation();
      onClose();
    }
  }

  const role = multiple ? "menuitemcheckbox" : "menuitemradio";
  return (
    <div
      className={props.wide ? "menu-popover menu-wide" : "menu-popover"}
      role="menu"
      aria-label={props.label}
      ref={popover}
      style={position}
      onKeyDown={onKeyDown}
    >
      {props.options.map((option, index) => {
        const checked = props.selected.includes(option.id);
        return (
          <button
            key={option.id}
            // A menu row is never a submit: quick create's status trigger sits
            // inside a form, and a bare `<button>` there would create a ticket.
            type="button"
            className="menu-row"
            role={role}
            aria-checked={checked}
            tabIndex={index === active ? 0 : -1}
            ref={(element) => {
              rows.current[index] = element;
            }}
            onFocus={() => setActive(index)}
            onClick={() => pick(option.id)}
          >
            {option.glyph && <span className="menu-glyph">{option.glyph}</span>}
            <span className="menu-label">{option.label}</span>
            {checked && (
              <span className="menu-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
      {props.footnote && <p className="menu-footnote">{props.footnote}</p>}
      {props.footer && (
        <div ref={footerBox}>
          {/* Only where there is something to divide. A rule under nothing is
              a line across the top of the footer. */}
          {props.options.length > 0 && <hr className="menu-rule" />}
          {props.footer}
        </div>
      )}
    </div>
  );
}

/**
 * The mark that says a value is a menu and not a chip (`screen-specs.md:227-228`,
 * D-3B — the table's own `:172-176` predates an edit to that file). Without it
 * Status and Priority read as static until the pointer is already on them,
 * which is no help to anyone who has not put it there.
 *
 * Decorative: `aria-haspopup` on the trigger is what says the same thing to
 * assistive technology, and it says it better.
 */
function ChevronGlyph() {
  return (
    <svg
      className="menu-chevron"
      width="11"
      height="11"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M4.5 2.5 L9.5 7 L4.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A trigger that shows the value and opens the menu on it: the meta rows in the
 * ticket panel, where the menu has something to hang off that is not a card.
 */
export function MenuButton<T extends string>(props: {
  label: string;
  options: MenuOption<T>[];
  value: T;
  footnote?: string;
  onPick: (id: T) => void;
  /**
   * Opened from outside the trigger: the `S`/`P` single-key path, which acts on
   * the open ticket while focus is somewhere else in the panel entirely
   * (`keyboard-focus-map.md:72-75`). Omitted, the trigger owns its own state —
   * every other caller wants that and should not have to hold one.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    props.onOpenChange?.(next);
  };
  const current = props.options.find((option) => option.id === props.value);
  return (
    <>
      <button
        tabIndex={0}
        type="button"
        className="menu-trigger"
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${props.label}: ${current?.label ?? props.value}`}
        onClick={() => setOpen(!open)}
      >
        {current?.glyph && <span className="menu-glyph">{current.glyph}</span>}
        <span>{current?.label ?? props.value}</span>
        <ChevronGlyph />
      </button>
      {open && (
        <Menu
          label={props.label}
          options={props.options}
          selected={[props.value]}
          footnote={props.footnote}
          anchor={trigger.current}
          onPick={props.onPick}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
