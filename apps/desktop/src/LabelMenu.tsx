/**
 * The labels row: the chips a ticket carries, and the popover that changes them.
 *
 * The same anchored menu as status, priority and ordering
 * (`screen-specs.md:239-247`), with `multiple` — so a row ticks and the menu
 * stays open, because picking labels is rarely picking one. The rows are every
 * definition the project has, plus any slug this ticket carries that the project
 * does not define, so an undefined slug can always be taken off again.
 *
 * It never edits a slug. A slug is what the ticket stores, so it is immutable;
 * renaming a label happens to the definition, in project settings.
 */

import { useRef, useState } from "react";
import { LabelChip, LabelDot } from "./LabelChip";
import { labelOptions, resolveLabels, toggleLabel } from "./labels";
import type { ResolvedLabel } from "./labels";
import { Menu } from "./Menu";
import type { MenuOption } from "./Menu";
import type { Label } from "./types";

/**
 * The `+` on the dashed chip. Decorative — the button says `add` beside it, and
 * a glyph that repeated the word would say it twice (`accessibility.md`).
 */
function PlusGlyph() {
  return (
    <svg
      className="plus-glyph"
      width="13"
      height="13"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M7 2.5 V11.5 M2.5 7 H11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LabelMenuButton(props: {
  slugs: readonly string[];
  definitions: Record<string, Label>;
  /** The whole new list, and the label the tick was on. Labels replace whole. */
  onToggle: (next: string[], toggled: ResolvedLabel) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  /**
   * The slugs the menu opened on, so its rows hold still while it is open. An
   * undefined slug is a row only because the ticket carries it; unticking one
   * would otherwise delete the row out from under the pointer, and take the only
   * way of putting it back with it.
   */
  const [openedOn, setOpenedOn] = useState<readonly string[]>();
  const open = openedOn !== undefined;
  const carried = resolveLabels(props.slugs, props.definitions);
  const rows = labelOptions(
    [...(openedOn ?? []), ...props.slugs],
    props.definitions,
  );
  const options: MenuOption<string>[] = rows.map((label) => ({
    id: label.slug,
    label: label.name,
    glyph: <LabelDot color={label.color} />,
  }));

  return (
    <>
      {/* The chips are the value and the dashed chip is the control (D-3C).
          They were one button, which made every chip a click target that
          opened the same menu and left the empty row saying `None` — a word
          reporting an absence, where the prototype puts an invitation. */}
      {/* A `div`, not a `span`: `.meta-grid > span` is the row's *label*
          column, and this is a value cell. */}
      <div className="meta-labels">
        {carried.map((label) => (
          <LabelChip key={label.slug} label={label} />
        ))}
        <button
          tabIndex={0}
          type="button"
          className="label-chip addable"
          ref={trigger}
          aria-haspopup="menu"
          aria-expanded={open}
          // The chips beside it are the value, and a control named `add` would
          // leave that unsaid for anyone who cannot see them — so the name says
          // the value, as it did when the chips were inside the button. It also
          // keeps the name honest about what the menu does, which is add *and*
          // take off.
          aria-label={`Labels: ${
            carried.length === 0
              ? "none"
              : carried.map((label) => label.name).join(", ")
          }`}
          onClick={() => setOpenedOn((was) => (was ? undefined : props.slugs))}
        >
          <PlusGlyph />
          add
        </button>
      </div>
      {open && (
        <Menu
          label="Labels"
          options={options}
          selected={props.slugs}
          multiple
          anchor={trigger.current}
          onPick={(slug) => {
            const toggled = rows.find((row) => row.slug === slug);
            if (!toggled) return;
            props.onToggle(toggleLabel(props.slugs, slug), toggled);
          }}
          onClose={() => setOpenedOn(undefined)}
        />
      )}
    </>
  );
}
