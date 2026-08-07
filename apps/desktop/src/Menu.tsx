/**
 * The anchored popover behind status, priority, ordering and labels.
 *
 * `screen-specs.md:239-247` specifies one menu for all four, so this is one
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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

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
  /** What the menu hangs off and returns focus to: a trigger, or a board card. */
  anchor: HTMLElement | null;
  onPick: (id: T) => void;
  onClose: () => void;
}

/** How far below the anchor the popover sits. */
const GAP = 4;

export function Menu<T extends string>(props: MenuProps<T>) {
  const { anchor, multiple, onClose } = props;
  const popover = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const first = props.options.findIndex((option) =>
    props.selected.includes(option.id),
  );
  const [active, setActive] = useState(first === -1 ? 0 : first);

  // Where focus goes when the menu closes, read before the menu takes it. The
  // anchor is the answer whenever there is one; what had focus at the moment of
  // opening is the honest fallback. A card that has since scrolled out of its
  // column is not somewhere to send anything.
  const returnTo = useRef<HTMLElement | null | undefined>(undefined);
  if (returnTo.current === undefined) {
    returnTo.current = anchor ?? (document.activeElement as HTMLElement | null);
  }
  useEffect(
    () => () => {
      const element = returnTo.current;
      if (element?.isConnected) element.focus();
    },
    [],
  );

  useLayoutEffect(() => {
    rows.current[active]?.focus();
  }, [active]);

  // Anchored, not attached: the popover is fixed to the viewport so a column's
  // own scrolling cannot carry it away from the card it belongs to. Measured
  // once, when it opens — the same capture-on-open `returnTo` above does, and
  // for a related reason.
  //
  // A multi-select menu stays up while its own picks change the row underneath
  // it. The labels row grows a chip per tick and the `+ add` this hangs off is
  // last in that row (D-3C), so it moves right by a chip every time — and
  // re-measuring on each render would walk the popover sideways, out from under
  // the pointer that is still ticking rows.
  const placed = useRef<{ top: number; left: number } | undefined>(undefined);
  if (!placed.current && anchor) {
    const rect = anchor.getBoundingClientRect();
    placed.current = { top: rect.bottom + GAP, left: rect.left };
  }
  const position = placed.current;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover.current?.contains(target)) return;
      // The anchor is excluded so that a trigger's own click toggles the menu
      // shut instead of closing it and immediately reopening it.
      if (returnTo.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  function pick(id: T) {
    props.onPick(id);
    if (!multiple) onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const count = props.options.length;
    const step =
      event.key === "ArrowDown" || event.key === "j"
        ? 1
        : event.key === "ArrowUp" || event.key === "k"
          ? -1
          : 0;
    if (step !== 0) {
      event.preventDefault();
      // Wraps at both ends (`keyboard-focus-map.md:122`).
      setActive((index) => (index + step + count) % count);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
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
      className="menu-popover"
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
    </div>
  );
}

/**
 * The mark that says a value is a menu and not a chip (`screen-specs.md:172-176`,
 * D-3B). Without it Status and Priority read as static until the pointer is
 * already on them, which is no help to anyone who has not put it there.
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
   * (`keyboard-focus-map.md:66-69`). Omitted, the trigger owns its own state —
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
