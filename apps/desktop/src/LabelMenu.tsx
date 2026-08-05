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
      <button
        tabIndex={0}
        type="button"
        className="menu-trigger"
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        // The chips are the value, so the accessible name has to say them.
        aria-label={`Labels: ${
          carried.length === 0
            ? "none"
            : carried.map((label) => label.name).join(", ")
        }`}
        onClick={() => setOpenedOn((was) => (was ? undefined : props.slugs))}
      >
        {carried.length === 0 ? (
          <span className="label-empty">None</span>
        ) : (
          carried.map((label) => <LabelChip key={label.slug} label={label} />)
        )}
      </button>
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
