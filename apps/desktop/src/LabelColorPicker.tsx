/**
 * The control that picks a label's hue, and the strip of eight behind it.
 *
 * Lifted out of `ProjectSettings.tsx` by LC-236e, unchanged. It was private to
 * the settings panel while settings was the only place a label could be
 * defined; the define row in the labels popover needs the same control, and a
 * menu reaching into a settings panel for it would be the wrong way round.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { FALLBACK_LABEL_COLOR, isRampColor, LABEL_COLORS } from "./labels";
import { useDismissOnPressOutside, useFocusReturn } from "./popover";

/**
 * The colour a label reads as, behind a dropdown (D12, `labels.ts:22-31`).
 *
 * It was eight swatches laid out inline, which is what LC-208 inherited from
 * V0-10 and carried into the new panel unchanged — and a row of eight dots per
 * label is 48 dots down a six-label list, none of which is the answer to
 * "what colour is `design`?". The prototype draws one dot and a chevron, and
 * that is the right trade: the resting state says the colour, and the eight
 * are a decision you have opened rather than a decision on permanent display.
 *
 * What the swatch row *did* get right and this keeps: the OS `<select>` it
 * replaced was one of the two places the app rendered native chrome (D-72),
 * and it named its colours in words while every other surface draws them as
 * dots. Every dot here carries its name for anything that is not looking.
 */
export function LabelColors(props: {
  label: string;
  value: string;
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // A colour the ramp does not hold is still shown and still selected, or
  // renaming a label would silently recolour it. It wears the fallback dot,
  // which is what every other surface draws it as (`labels.ts:40`).
  const hues: readonly string[] = isRampColor(props.value)
    ? LABEL_COLORS
    : [props.value, ...LABEL_COLORS];
  const dot = (hue: string) =>
    `label-dot label-${isRampColor(hue) ? hue : FALLBACK_LABEL_COLOR}`;
  return (
    <span className="label-color-field">
      <button
        tabIndex={0}
        type="button"
        ref={trigger}
        className="label-color-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        // The name carries the value, because the trigger's whole content is a
        // colour: `Color of label design: orange`.
        aria-label={`${props.label}: ${props.value}`}
        onClick={() => setOpen(!open)}
      >
        <span className={dot(props.value)} aria-hidden="true" />
        <ChevronGlyph />
      </button>
      {open && (
        <LabelColorMenu
          label={props.label}
          hues={hues}
          value={props.value}
          anchor={trigger.current}
          dot={dot}
          onPick={(hue) => {
            props.onPick(hue);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * The eight, in one row, as the prototype draws them.
 *
 * A strip rather than a list of named rows: the thing being chosen *is* a
 * colour, so the swatch is the label and a column of colour words would be a
 * worse version of the `<select>` D-72 removed. The names are still there for
 * anything not looking at it — on each dot, not beside it.
 *
 * Roving focus, one tab stop, arrows along the strip, `Esc` back to the
 * trigger: the contract `keyboard-focus-map.md:140-142` gives every menu, on
 * the horizontal axis this one is drawn along.
 */
function LabelColorMenu(props: {
  label: string;
  hues: readonly string[];
  value: string;
  anchor: HTMLElement | null;
  dot: (hue: string) => string;
  onPick: (hue: string) => void;
  onClose: () => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const swatches = useRef<(HTMLButtonElement | null)[]>([]);
  const at = props.hues.indexOf(props.value);
  const [active, setActive] = useState(at === -1 ? 0 : at);
  useFocusReturn(props.anchor);
  useDismissOnPressOutside({
    popover,
    anchor: props.anchor,
    onDismiss: props.onClose,
  });
  useLayoutEffect(() => {
    swatches.current[active]?.focus();
  }, [active]);

  return (
    <div
      className="label-color-menu"
      role="menu"
      aria-label={props.label}
      ref={popover}
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (step !== 0) {
          event.preventDefault();
          event.stopPropagation();
          // Wraps at both ends, as every other menu in the app does.
          setActive(
            (index) => (index + step + props.hues.length) % props.hues.length,
          );
          return;
        }
        if (event.key !== "Escape") return;
        event.preventDefault();
        // Spent here: the panel behind this must not also close.
        event.stopPropagation();
        props.onClose();
      }}
    >
      {props.hues.map((hue, index) => (
        <button
          key={hue}
          type="button"
          role="menuitemradio"
          aria-checked={hue === props.value}
          aria-label={hue}
          tabIndex={index === active ? 0 : -1}
          ref={(element) => {
            swatches.current[index] = element;
          }}
          className={
            hue === props.value
              ? "label-color-swatch selected"
              : "label-color-swatch"
          }
          onFocus={() => setActive(index)}
          onClick={() => props.onPick(hue)}
        >
          <span className={props.dot(hue)} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** The mark that says a control opens something (`components.md` § Menus). */
function ChevronGlyph() {
  return (
    <svg
      className="label-color-chevron"
      width="9"
      height="9"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M3 5 L7 9.5 L11 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
