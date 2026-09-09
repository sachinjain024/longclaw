/**
 * The estimate, under whichever system the project is on (LC-227).
 *
 * One property with three shapes, because `estimate` holds a different kind of
 * value under each system: a scale is a short fixed set and is a segment, a
 * duration is a number and a unit and is a field beside a menu.
 *
 * The segment is the appearance row's control rather than a new one — the app
 * already has "pick one of a small fixed set, laid out horizontally", and a
 * second would be a second thing to learn. It leads with `—`, because absent is
 * a value a scale has to be able to say and the dash is the word the app
 * already uses for it (`priority: none` draws that glyph today). Without it the
 * only way back out of an estimate would be a menu the segment does not have.
 */

import { useState } from "react";
import { MenuButton } from "./Menu";
import { classes } from "./classes";
import { fieldCommitted } from "./fieldUndo";
import { estimateScale, readEstimate, splitDuration } from "./properties";
import type { EstimateConfig } from "./types";

/** What `m h d w` are called where a person has to choose between them. */
const UNITS = [
  { id: "m", label: "Minutes" },
  { id: "h", label: "Hours" },
  { id: "d", label: "Days" },
  { id: "w", label: "Weeks" },
];

export function EstimateControl(props: {
  /** What the file says — not necessarily a value this system reads. */
  value: string | undefined;
  config: EstimateConfig;
  /** A value this system reads, or `undefined` to clear. */
  onCommit: (value: string | undefined) => void;
}) {
  const read = readEstimate(props.value, props.config);
  return (
    <>
      {/* Invariant 16 on screen: switching systems rewrites no ticket, so a
          value written under the old one has to render as something. It is
          drawn in full and only marked as unreadable, the way an undefined
          label slug is — and the control stays below it, because a ticket
          nobody can re-estimate is the worse failure. */}
      {read?.kind === "foreign" && (
        <span
          className="estimate-foreign"
          title="Written under another system, and kept"
        >
          {read.text}
        </span>
      )}
      {props.config.system === "duration" ? (
        <DurationControl {...props} />
      ) : (
        <ScaleControl {...props} />
      )}
    </>
  );
}

function ScaleControl(props: {
  value: string | undefined;
  config: EstimateConfig;
  onCommit: (value: string | undefined) => void;
}) {
  const scale = estimateScale(props.config);
  const known = readEstimate(props.value, props.config)?.kind === "known";
  const set = (next: string | undefined) => {
    if (next !== props.value) props.onCommit(next);
  };
  return (
    <div className="scale-segment" role="group" aria-label="Estimate">
      <button
        type="button"
        tabIndex={0}
        className={classes("none", !props.value && "selected")}
        aria-pressed={!props.value}
        aria-label="No estimate"
        onClick={() => set(undefined)}
      >
        —
      </button>
      {scale.map((id) => {
        // A foreign value leaves every cell unpressed, which is the honest
        // reading: nothing on this scale is what the ticket says.
        const on = known && id === props.value;
        return (
          <button
            key={id}
            type="button"
            tabIndex={0}
            className={classes("", on && "selected")}
            aria-pressed={on}
            onClick={() => set(id)}
          >
            {props.config.system === "tshirt" ? id.toUpperCase() : id}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A number and a unit. `1d4h` is not a duration — one number, one unit — so
 * there is nothing here that could express one.
 */
function DurationControl(props: {
  value: string | undefined;
  config: EstimateConfig;
  onCommit: (value: string | undefined) => void;
}) {
  const parts = splitDuration(props.value);
  const [amount, setAmount] = useState(parts?.amount ?? "");
  const [unit, setUnit] = useState(parts?.unit ?? "h");

  // The file can change under an open panel, the same way it can under a date
  // field. Adjusted during render so no frame paints the value it no longer has.
  const [held, setHeld] = useState(props.value);
  if (held !== props.value) {
    setHeld(props.value);
    setAmount(splitDuration(props.value)?.amount ?? "");
    if (splitDuration(props.value)) setUnit(splitDuration(props.value)!.unit);
  }

  /** What this field would write, and whether that is what the draft holds. */
  const built = amount.trim() ? `${amount.trim()}${unit}` : undefined;

  function commit(nextAmount: string, nextUnit: string) {
    const text = nextAmount.trim();
    if (!text) {
      if (props.value !== undefined) write(undefined);
      return;
    }
    const built = `${text}${nextUnit}`;
    // Validated through the same reader every other surface uses rather than a
    // second opinion about what a duration is. A refusal keeps the text: the
    // person is mid-edit, and this is a number that is not finished — and it is
    // still their `⌘Z` to spend, because nothing was written for a toast to
    // offer it back (`fieldUndo.ts`).
    if (readEstimate(built, props.config)?.kind !== "known") return;
    if (built !== props.value) write(built);
  }

  /**
   * Ask for the write, and say the box is no longer holding an edit of its own.
   *
   * `DateField` does this for the same reason and in the same place: `Enter`
   * writes without moving the caret, so nothing the tracker watches changes and
   * `⌘Z` would stay the field's while the toast on screen offered it (LC-220).
   */
  function write(next: string | undefined) {
    fieldCommitted();
    props.onCommit(next);
  }

  return (
    <div className="estimate-duration">
      <input
        tabIndex={0}
        className="input compact mono"
        value={amount}
        aria-label="Estimate amount"
        placeholder="0"
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          // The rule `DateField` keeps, for the same reason: `⌘↵` creates from
          // anywhere on both create surfaces, so a number typed and not yet
          // committed has to be taken here before the surface behind this acts
          // on a draft that does not carry it.
          if ((event.metaKey || event.ctrlKey) && built !== props.value) {
            event.stopPropagation();
          }
          commit(amount, unit);
        }}
        onBlur={() => commit(amount, unit)}
      />
      <MenuButton
        label="Estimate unit"
        options={UNITS}
        value={unit}
        onPick={(next) => {
          setUnit(next);
          // A unit picked with a number already in the field is an edit, not a
          // preference: `2h` → Days means 2d, now, without a second gesture.
          if (amount.trim()) commit(amount, next);
        }}
      />
    </div>
  );
}
