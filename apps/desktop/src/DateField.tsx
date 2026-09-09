/**
 * A date, as one control with two ways in (LC-227).
 *
 * A Field the caret sits in, and a calendar joined to its right edge — joined
 * rather than beside it, because they are not two controls: the picker writes
 * through the same normalisation the typed grammar does, and a gap between them
 * would say otherwise.
 *
 * Three pieces of state, and the first is the one a naive version leaves out.
 * What the file says and what is in the field are different things and neither
 * derives from the other: the text survives a refusal, because **what is
 * refused is not destroyed**, and the value is a day whose own display would
 * move if it were parsed back (`5 Sep` shown for a past date reads as next
 * year). That is the whole reason this is a Field in the `CONTEXT.md` sense
 * rather than a picker with a text decoration.
 *
 * The grammar lives in `properties.ts` and is tested there. Nothing here
 * decides what a date means; this decides *when* to ask — on commit, Enter or
 * blur, never per keystroke, because `28 Se` is not a state worth reporting on.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { classes } from "./classes";
import { fieldCommitted } from "./fieldUndo";
import {
  addDays,
  addMonths,
  daysBetween,
  echoDate,
  fieldDate,
  fromIso,
  monthName,
  parseDate,
  startOfDay,
  toIso,
} from "./properties";
import {
  useDismissOnPressOutside,
  useFocusReturn,
  belowAnchor,
  usePointPlacement,
  type Point,
} from "./popover";

/** Stated rather than measured: the placement right-aligns before it renders. */
const PICKER_WIDTH = 236;

/**
 * What the field shows for what the file says.
 *
 * A value this app cannot read is shown exactly as the file spells it —
 * invariant 16, the same posture `is_label_slug` takes toward a slug an agent
 * already wrote. A field is not where a ticket's own data gets corrected.
 */
function display(value: string | undefined, now: number): string {
  if (!value) return "";
  const day = fromIso(value);
  return day ? fieldDate(day, now) : value;
}

export function DateField(props: {
  /** Names the field and its calendar: `Due`, `Start`. */
  label: string;
  /** What the file says — not necessarily a date this app can read. */
  value: string | undefined;
  /** The day the grammar resolves against: the panel's `today`, in epoch ms. */
  now: number;
  /** A resolved day as `YYYY-MM-DD`, or `undefined` to clear. */
  onCommit: (iso: string | undefined) => void;
}) {
  const shown = display(props.value, props.now);
  const [text, setText] = useState(shown);
  const [refused, setRefused] = useState<string>();
  const [picking, setPicking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // The file is the source of truth and can change under an open panel — a
  // write lands, an undo runs, the context menu sets the same property. Adjust
  // during render rather than in an effect, so the field never paints a frame
  // of the value it no longer has.
  const [held, setHeld] = useState(shown);
  if (held !== shown) {
    setHeld(shown);
    setText(shown);
    setRefused(undefined);
  }

  const parsed = parseDate(text, props.now);
  // Dirty is the whole of "is there anything to commit". Comparing the *text*
  // to what the field came showing, rather than comparing parsed days, is what
  // stops a blur on an untouched field rewriting `28 Sep 2026` into
  // `2026-09-28` — which would be the field correcting the file, on a gesture
  // nobody meant as an edit.
  const dirty = text.trim() !== shown.trim();

  function commit() {
    if (!dirty) {
      setRefused(undefined);
      return;
    }
    if (parsed.kind === "refused") {
      setRefused(parsed.why);
      return;
    }
    setRefused(undefined);
    const next = parsed.kind === "date" ? toIso(parsed.date) : undefined;
    // Typing `2026-09-28` into a field showing `28 Sep` is a different string
    // and the same day. `TicketDocument::apply` refuses an edit that changes
    // nothing; this is the surface not asking for one.
    if (next === props.value) {
      setText(shown);
      return;
    }
    write(next);
  }

  /**
   * Ask for the write, and say the box is no longer holding an edit of its own.
   *
   * `Enter` commits without moving the caret and, on the ordinary path, without
   * changing the text: `28 Sep` typed on 8 September is still `28 Sep` after
   * the write. Nothing the tracker watches has changed, so `⌘Z` would stay the
   * field's and the toast this raises would offer an Undo nobody could reach
   * (`fieldUndo.ts`, LC-220). Reached only from the two paths that write, which
   * is what leaves a refusal's text the person's own to take back.
   */
  function write(iso: string | undefined) {
    fieldCommitted();
    props.onCommit(iso);
  }

  /** A day the picker chose, which has already been through the grammar. */
  function pick(iso: string | undefined) {
    setPicking(false);
    setRefused(undefined);
    if (iso === props.value) {
      setText(shown);
      return;
    }
    // The picker took the focus off the field, so the record is already gone.
    // Through `write` anyway: what spends the edit is the write, not the focus.
    write(iso);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // `⌘↵` creates from anywhere on both create surfaces, and "anywhere"
    // includes a field whose text is not in the draft yet: this one parses on
    // Enter or blur, so a date typed and then committed with `⌘↵` would be
    // dropped by the very gesture meant to keep everything. The field takes the
    // first press and commits; a second one creates. With nothing to commit it
    // passes straight through, which is every press in the panel, where the
    // binding belongs to no one.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && dirty) {
      event.preventDefault();
      event.stopPropagation();
      commit();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    // The trigger beside it is not a tab stop, so this is the calendar's
    // keyboard path (`keyboard-focus-map.md`).
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPicking(true);
    }
  }

  // The echo is confirmation, not validation: it appears the moment typed text
  // resolves and nothing ever goes red mid-word. It earns its place on the year
  // rule alone — a form with no year means the nearest future occurrence, so on
  // 5 Oct `28 Sep` is silently next year, and this is where that stops being
  // silent. Only while dirty: a field at rest would otherwise wear a second
  // copy of its own value.
  const echo =
    refused === undefined && dirty && parsed.kind === "date"
      ? echoDate(parsed.date)
      : undefined;

  return (
    <>
      <div
        className={classes("date-field", refused !== undefined && "unresolved")}
        ref={box}
      >
        <input
          tabIndex={0}
          ref={input}
          value={text}
          aria-label={props.label}
          placeholder="28 Sep"
          onChange={(event) => {
            setText(event.target.value);
            // A refusal is about text that is no longer there.
            setRefused(undefined);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
        <button
          type="button"
          tabIndex={-1}
          className="date-trigger"
          aria-haspopup="dialog"
          aria-expanded={picking}
          aria-label={`${props.label} calendar`}
          onClick={() => setPicking((open) => !open)}
        >
          <CalendarGlyph />
        </button>
      </div>
      {refused !== undefined ? (
        <p className="date-note">{refused}</p>
      ) : (
        echo && (
          <p className="date-echo">
            → <strong>{echo}</strong>
          </p>
        )
      )}
      {picking && (
        <DatePicker
          label={props.label}
          picked={parsed.kind === "date" ? parsed.date : undefined}
          now={props.now}
          field={box.current}
          returnTo={input.current}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/**
 * The app's first two-dimensional popover, and its tallest — six weeks of grid,
 * a header and a Clear row.
 *
 * Two consequences. It is right-aligned on the field, which `belowAnchor` does
 * for "a trigger at the window's far edge" and which a date field in a
 * right-hand rail is; and it is lifted into view, because a rail row six down
 * an 800px panel puts its Clear row past the bottom of the window.
 *
 * The grid is one tab stop with the cursor moving inside it, the way a board
 * column's cards do: 42 stops in a popover would be a month to Tab across.
 */
export function DatePicker(props: {
  label: string;
  /** The day the field currently resolves to, marked and opened on. */
  picked: Date | undefined;
  now: number;
  /** The field's box: what this right-aligns on, and what must not dismiss it. */
  field: HTMLElement | null;
  /** Where focus goes when it closes. */
  returnTo: HTMLElement | null;
  /** A context menu opens at the pointer rather than under a date field. */
  origin?: Point;
  onPick: (iso: string | undefined) => void;
  onClose: () => void;
}) {
  const today = startOfDay(props.now);
  const popover = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(props.picked ?? today);

  useFocusReturn(props.returnTo);
  const position = usePointPlacement(
    props.origin ?? belowAnchor(props.field, PICKER_WIDTH) ?? { x: 8, y: 8 },
    popover,
  );
  useDismissOnPressOutside({
    popover,
    anchor: props.field,
    onDismiss: props.onClose,
  });

  const cell = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    cell.current?.focus();
  }, [cursor]);

  // Monday first, derived rather than picked: the app has no locale to ask, the
  // canonical on-disk form is ISO 8601, and ISO 8601's week starts on Monday.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
      return;
    }
    // Header and Clear buttons own Enter/Space; only a day moves the cursor.
    if (!(event.target as HTMLElement).classList.contains("date-cell")) return;
    event.stopPropagation();
    // Up and down mean a week here, which is the one thing this popover does
    // that none of the app's menus do.
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in step) {
      event.preventDefault();
      setCursor((day) => addDays(day, step[event.key]));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setCursor((day) => addMonths(day, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onPick(toIso(cursor));
      return;
    }
  }

  return (
    <div
      className="menu-popover date-picker"
      role="dialog"
      aria-label={`${props.label} calendar`}
      ref={popover}
      style={position}
      onKeyDown={onKeyDown}
    >
      <div className="date-picker-head">
        <strong>
          {monthName(cursor)} {cursor.getFullYear()}
        </strong>
        <button
          type="button"
          tabIndex={0}
          className="date-step"
          aria-label="Previous month"
          onClick={() => setCursor((day) => addMonths(day, -1))}
        >
          ‹
        </button>
        <button
          type="button"
          tabIndex={0}
          className="date-step"
          aria-label="Next month"
          onClick={() => setCursor((day) => addMonths(day, 1))}
        >
          ›
        </button>
      </div>
      <div className="date-grid">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          <span className="dow" key={day}>
            {day}
          </span>
        ))}
        {days.map((day) => {
          const here = daysBetween(cursor, day) === 0;
          return (
            <button
              key={toIso(day)}
              type="button"
              className={classes(
                "date-cell",
                day.getMonth() !== cursor.getMonth() && "adjacent",
                // Today and the value are two marks because a ticket due today
                // wears both on one cell.
                daysBetween(today, day) === 0 && "now",
                props.picked &&
                  daysBetween(props.picked, day) === 0 &&
                  "picked",
              )}
              tabIndex={here ? 0 : -1}
              ref={here ? cell : undefined}
              aria-label={echoDate(day)}
              onFocus={() => setCursor(day)}
              onClick={() => props.onPick(toIso(day))}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      {/* Clearing is a first-class act and is not the same as never set: on
          disk both are no key, so the distinction lives in the edit command.
          A tab stop too: the context menu's calendar has no field to empty. */}
      <button
        type="button"
        tabIndex={0}
        className="date-clear"
        onClick={() => props.onPick(undefined)}
      >
        Clear
      </button>
    </div>
  );
}

/**
 * The mark that says *this is a date*, exported because the context menu's two
 * date rows wear it too (LC-227) — used from where it is drawn rather than
 * copied, which is the rule `TicketMenuGlyphs.tsx` states for a mark that has
 * grown a second caller.
 */
export function CalendarGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="11"
        height="10"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M1.5 5.5 h11 M4.5 1.5 v2 M9.5 1.5 v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
