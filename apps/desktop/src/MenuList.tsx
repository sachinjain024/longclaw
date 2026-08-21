/**
 * The menu of mixed rows: actions, choices, captions, rules, and a submenu.
 *
 * It was written for the settings menus (LC-208) and lived inside them until a
 * ticket's context menu wanted the same three things — a row that runs and
 * closes, a row that shows which value is set, and a nested list of a field's
 * values (LC-222). `Menu` is still its own component and still should be: it is
 * a flat list of one field's values with one `selected` array, and it holds the
 * `S`/`P` menu on both surfaces. This is the shape for a list that mixes kinds.
 *
 * It knows nothing about what a row does. Every caller hands it rows and a way
 * out; `SettingsMenu` builds the gear's and the `⋮`'s, `ticketMenu.tsx` builds
 * a ticket's.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { classes } from "./classes";
import { useDismissOnPressOutside } from "./popover";

/**
 * One row. `action` runs and closes, `choice` runs and stays — the difference
 * between opening a section and trying a preset against the board behind the
 * menu, which is the whole reason the theme rows are in a menu at all.
 */
export type MenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      glyph?: ReactNode;
      /** The quiet right-hand note: a count, a shortcut, the current value. */
      hint?: ReactNode;
      danger?: boolean;
      run: () => void;
    }
  | {
      kind: "choice";
      id: string;
      label: string;
      glyph?: ReactNode;
      checked: boolean;
      run: () => void;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
      glyph?: ReactNode;
      hint?: ReactNode;
      items: MenuItem[];
    }
  | { kind: "group"; id: string; label: string }
  | { kind: "rule"; id: string };

/**
 * How wide a submenu is, as `.menu-popover .menu-sub` sets it. Stated here
 * because deciding which side one opens on is arithmetic, and arithmetic needs
 * the number before the element exists — the same bargain `usePopoverPlacement`
 * strikes with the gear's 236px.
 */
const SUBMENU_WIDTH = 200;

/** Rows the arrow keys stop on. Captions and rules are read, not landed on. */
function isStop(item: MenuItem) {
  return (
    item.kind === "action" || item.kind === "choice" || item.kind === "submenu"
  );
}

/**
 * The popover, and the only place in this file that knows about focus.
 *
 * It is recursive: a `submenu` row renders another one beside itself, which
 * takes focus while it is up and hands it back to the row it came from. That is
 * what makes `ArrowLeft`, `Escape` and click-away land on **one** rung each —
 * the nested list stops the events it answers, so the list behind it never sees
 * them (`keyboard-focus-map.md:19-21` — the ladder walks one rung at a time).
 */
export function MenuList(props: {
  label: string;
  items: MenuItem[];
  /** Fixed viewport coordinates. The root has them; a submenu is placed in CSS. */
  position?: { top: number; left: number };
  /** `Escape`, `ArrowLeft`, or a pick: what takes this list down. */
  onDismiss: () => void;
  /** The control this list hangs off, excluded from click-away (`popover.ts`). */
  anchor?: HTMLElement | null;
  /** A submenu, which owes `ArrowLeft` a step back rather than a close. */
  nested?: boolean;
  /** A submenu with no room to its parent's right, opening on the other side. */
  left?: boolean;
  /**
   * The popover element, for a caller that has to measure it — the context
   * menu, which cannot know where to put a list until it knows how tall it is
   * (`popover.ts`). Everything else lets this list keep its own.
   */
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const stops = props.items.filter(isStop);
  const ownPopover = useRef<HTMLDivElement>(null);
  const popover = props.popoverRef ?? ownPopover;
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [openSub, setOpenSub] = useState<string>();
  /** Whether that submenu opens to the left; see `enter`. */
  const [subLeft, setSubLeft] = useState(false);
  const { onDismiss } = props;

  useLayoutEffect(() => {
    // Only while this list owns focus: a parent whose submenu is up must not
    // pull focus back out of it on every render.
    if (openSub === undefined) rows.current[active]?.focus();
  }, [active, openSub]);

  function move(step: number) {
    setActive((index) => (index + step + stops.length) % stops.length);
  }

  /**
   * Steps into a submenu row, from `ArrowRight` or from a click — and decides
   * which side it opens on.
   *
   * A submenu sits at `left: 100%` of its parent, which is fine for a menu hung
   * under a gear in the middle of a header and not fine for one opened at the
   * pointer: a right-click on a card in the board's last column puts the parent
   * against the right edge of the window, and the submenu's rows land outside
   * it. Measured on the way in, once, for the same reason placement is measured
   * once — the parent is not going to move while its own submenu is up.
   */
  function enter(id: string) {
    const box = popover.current?.getBoundingClientRect();
    setSubLeft(
      box !== undefined && box.right + SUBMENU_WIDTH > window.innerWidth,
    );
    setOpenSub(id);
  }

  /**
   * Steps back out. Focus is inside the list that is going away, and the effect
   * above is what puts it back — `openSub` is one of its dependencies precisely
   * so that closing a submenu re-focuses the row it belongs to, in the same
   * commit rather than a frame later.
   */
  const leave = useCallback(() => setOpenSub(undefined), []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // A submenu is up and owns the keyboard; it stops what it answers.
    if (openSub !== undefined) return;
    const item = stops[active];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "ArrowRight" && item?.kind === "submenu") {
      event.preventDefault();
      event.stopPropagation();
      enter(item.id);
      return;
    }
    if (event.key === "Escape" || (event.key === "ArrowLeft" && props.nested)) {
      event.preventDefault();
      // The press this list answered is spent: `App`'s own `Esc` ladder and the
      // list behind this one must not also take a layer down.
      event.stopPropagation();
      onDismiss();
    }
  }

  useDismissOnPressOutside({
    popover,
    anchor: props.anchor ?? null,
    onDismiss,
    // Click-away belongs to the outermost list only. A press inside a submenu
    // is inside this one too, since the submenu is rendered within it.
    enabled: !props.nested,
  });

  let index = -1;
  return (
    <div
      // `menu-hinted` widens the root list: these rows carry a trailing hint
      // (`name · key · folder`, `Graphite · System`, a ticket's key) that the
      // status and priority menus have no equivalent of, and at the shared
      // 220px the hint sat on top of the label.
      className={classes(
        "menu-popover",
        props.nested ? "menu-sub" : "menu-hinted",
        props.nested && props.left && "menu-sub-left",
      )}
      role="menu"
      aria-label={props.label}
      ref={popover}
      style={props.position}
      onKeyDown={onKeyDown}
    >
      {props.items.map((item) => {
        if (item.kind === "rule")
          return <hr key={item.id} className="menu-rule" />;
        if (item.kind === "group")
          return (
            <p key={item.id} className="menu-caption">
              {item.label}
            </p>
          );
        index += 1;
        const at = index;
        const checked = item.kind === "choice" ? item.checked : undefined;
        return (
          <div
            key={item.id}
            className={item.kind === "submenu" ? "menu-anchor" : undefined}
          >
            <button
              // Never a submit: the gear sits in a header and the `⋮` sits in a
              // row, and neither is a form today — but `Menu` learned this the
              // hard way and the rule is cheap to keep.
              type="button"
              className={
                item.kind === "action" && item.danger
                  ? "menu-row danger"
                  : "menu-row"
              }
              role={item.kind === "choice" ? "menuitemradio" : "menuitem"}
              aria-checked={checked}
              aria-haspopup={item.kind === "submenu" ? "menu" : undefined}
              aria-expanded={
                item.kind === "submenu" ? openSub === item.id : undefined
              }
              tabIndex={at === active ? 0 : -1}
              ref={(element) => {
                rows.current[at] = element;
              }}
              onFocus={() => setActive(at)}
              onClick={() => {
                if (item.kind === "submenu") {
                  enter(item.id);
                  return;
                }
                item.run();
                // A choice stays: the menu is how presets are tried against the
                // board behind it. An action has opened something, so it goes.
                if (item.kind === "action") onDismiss();
              }}
            >
              {item.glyph && <span className="menu-glyph">{item.glyph}</span>}
              <span className="menu-label">{item.label}</span>
              {item.kind !== "choice" && item.hint && (
                <span className="menu-hint">{item.hint}</span>
              )}
              {item.kind === "submenu" && <SubmenuChevron />}
              {checked && (
                <span className="menu-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
            {item.kind === "submenu" && openSub === item.id && (
              <MenuList
                nested
                left={subLeft}
                label={item.label}
                items={item.items}
                onDismiss={leave}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Decorative: `aria-haspopup` on the row says the same thing, and better. */
function SubmenuChevron() {
  return (
    <svg
      className="menu-chevron"
      width="11"
      height="11"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M5 3 L9.5 7 L5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
