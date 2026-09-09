/**
 * One opt-in property's control, whichever of the four it is (LC-227).
 *
 * Three surfaces offer the same four controls — the panel's rail, full create
 * and quick create — and what differs between them is only the box a named
 * control is put in. So the switch on *which* property this is lives here,
 * once: a fifth property, or a change to what an estimate is edited with,
 * lands in one place rather than in three that have to be found first. The
 * panel had this switch written out as four gated rows, and copying it into two
 * create surfaces is how three surfaces come to disagree about what a type is.
 *
 * **It does not draw the property's name.** A rail row puts the name above its
 * control, a meta grid puts it in a column beside it, and quick create's row
 * puts it inline — three boxes for one control, and the caller is the one that
 * knows which. What every caller shares is `PROPERTY_LABELS[property].field`,
 * so the name itself is not three spellings either.
 *
 * The value is what the *file* says on the panel and what the *draft* says on a
 * create surface, and neither is parsed here: a value this project's
 * configuration cannot read is drawn as it is written (invariant 16), which is
 * `EstimateControl`'s foreign mark and `DateField`'s untouched text.
 */

import { DateField } from "./DateField";
import { EstimateControl } from "./EstimateControl";
import { MenuButton } from "./Menu";
import { typeOptions } from "./metaOptions";
import { PROPERTY_LABELS } from "./properties";
import type { PropertiesConfig, TicketProperty } from "./types";

export function PropertyControl(props: {
  property: TicketProperty;
  /** The project's configuration, which is what each control is built from. */
  config: PropertiesConfig;
  /** What the ticket says, or what the draft says. Not necessarily readable. */
  value: string | undefined;
  /** The day the date grammar resolves against, injected rather than read. */
  today: number;
  /** A value this project reads, or `undefined` to clear. */
  onCommit: (value: string | undefined) => void;
  /**
   * A count that asks this control to take the caret, forwarded to the date
   * field and to nothing else: the context menu's `Pick a date…` is the only
   * caller, and the two dates are the only rows that offer it (LC-227).
   */
  enter?: number;
}) {
  const name = PROPERTY_LABELS[props.property].field;
  if (props.property === "type") {
    return (
      <MenuButton
        label={name}
        options={typeOptions(props.config.type.values)}
        // A slug nothing defines is still what the file says, and `MenuButton`
        // renders an unmatched value as itself.
        value={props.value ?? ""}
        // `None` carries the empty slug, and a clear is what it means.
        onPick={(next) => props.onCommit(next || undefined)}
      />
    );
  }
  if (props.property === "estimate") {
    return (
      <EstimateControl
        value={props.value}
        config={props.config.estimate}
        onCommit={props.onCommit}
      />
    );
  }
  return (
    <DateField
      label={name}
      value={props.value}
      now={props.today}
      onCommit={props.onCommit}
      enter={props.enter}
    />
  );
}
