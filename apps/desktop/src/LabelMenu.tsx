/**
 * The labels row: the chips a ticket carries, and the popover that changes them.
 *
 * The same anchored menu as status, priority and ordering
 * (`screen-specs.md:317-325`), with `multiple` — so a row ticks and the menu
 * stays open, because picking labels is rarely picking one. The rows are every
 * definition the project has, plus any slug this ticket carries that the project
 * does not define, so an undefined slug can always be taken off again.
 *
 * It never edits a slug. A slug is what the ticket stores, so it is immutable;
 * renaming a label happens to the definition, in project settings. Since
 * LC-236e it can *define* one — which is adding a slug, not renaming one — for
 * the create surfaces, where a project with an empty `labels:` map opened this
 * menu on nothing at all and the only way forward was to abandon the ticket.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { LabelChip, LabelDot } from "./LabelChip";
import { LabelColors } from "./LabelColorPicker";
import { DerivedKey, useLabelDefinition } from "./LabelDefine";
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

/**
 * What the create surfaces hand back when the row commits: the definition to
 * write, and whether it landed. `false` is a refusal Rust made — the surface
 * has already said why — and the row keeps what was typed so it can be edited
 * rather than retyped.
 */
export interface LabelDefinition {
  slug: string;
  name: string;
  color: string;
}

/**
 * The define row, in the popover's footer.
 *
 * Two shapes: a collapsed row that reads `New label`, and the form it opens
 * into. It starts open on a project that defines nothing, because a popover
 * whose only content is a collapsed invitation is a popover that still says
 * nothing, which is the complaint LC-236e opens with.
 *
 * The definition is a **project write and it lands immediately**: someone who
 * defines `infra` here and then abandons the draft has still changed
 * `longclaw.yaml`. That is deliberate. Holding the definition until the ticket
 * is created would make the ticket write conditional on a second write, and
 * leave a chip on screen standing for a label that does not exist yet.
 */
function DefineRow(props: {
  definitions: Record<string, Label>;
  /** Empty project: the row opens expanded, with the caret already in it. */
  startOpen: boolean;
  /** The stop the menu's roving group lands on — see `Menu.footerStop`. */
  stop: React.RefObject<HTMLElement | null>;
  onDefine: (definition: LabelDefinition) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(props.startOpen);
  const field = useRef<HTMLInputElement>(null);
  const definition = useLabelDefinition(props.definitions);
  const { state } = definition;
  /**
   * Set when the row is closed by `Esc`, because closing it unmounts the field
   * that is holding focus. Without this, focus falls to `<body>` — and every
   * key after that, including the next two rungs of the `Esc` ladder, is
   * delivered to nothing: the menu stays up and the modal behind it will not
   * close. Found by `a11y:audit`, which is where a claim about focus belongs.
   */
  const handBack = useRef(false);

  useLayoutEffect(() => {
    // The caret goes into the field the moment the row opens, whether that was
    // a press on the collapsed row or an empty project opening it for you.
    if (expanded) field.current?.focus();
    else if (handBack.current) {
      handBack.current = false;
      props.stop.current?.focus();
    }
    // `props.stop` is a ref: read at the moment focus moves, never captured.
  }, [expanded, props.stop]);

  function collapse() {
    handBack.current = true;
    setExpanded(false);
    definition.reset();
  }

  if (!expanded) {
    return (
      <button
        // A row, so it reads as one more thing the menu offers — but the last
        // one, under a rule, because it is the only one that is not a value.
        type="button"
        className="menu-row"
        tabIndex={-1}
        ref={(element) => {
          props.stop.current = element;
        }}
        onClick={() => setExpanded(true)}
      >
        <span className="menu-glyph">
          <PlusGlyph />
        </span>
        <span className="menu-label">New label</span>
      </button>
    );
  }

  return (
    <form
      className="menu-define"
      onSubmit={(event) => {
        event.preventDefault();
        if (state.kind !== "ok") return;
        void (async () => {
          const written = await props.onDefine({
            slug: state.slug,
            name: definition.name.trim(),
            color: definition.color,
          });
          // Refused: what was typed stays, because the surface has already
          // said why and the fix is an edit rather than a retype.
          if (!written) return;
          // Emptied and still open. Defining one label on an empty project is
          // rarely defining one, and the row that just worked is where the
          // next name goes.
          definition.reset();
          field.current?.focus();
        })();
      }}
      onKeyDown={(event) => {
        // `Menu.onKeyDown` returns early for anything from a field, so the
        // ladder's next rung is this row's to spend (`keyboard-focus-map.md`).
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        collapse();
      }}
    >
      <div className="menu-define-top">
        <input
          className="input compact"
          ref={field}
          value={definition.name}
          aria-label="New label name"
          placeholder="Label name"
          autoComplete="off"
          onChange={(event) => definition.setName(event.target.value)}
        />
        <LabelColors
          label="New label color"
          value={definition.color}
          onPick={definition.setColor}
        />
      </div>
      <DerivedKey state={state} />
      <button
        tabIndex={0}
        type="submit"
        className="secondary small menu-define-commit"
        // Nothing to write, or nothing writable. The line above says which.
        disabled={state.kind !== "ok"}
      >
        Add label
      </button>
    </form>
  );
}

export function LabelMenuButton(props: {
  slugs: readonly string[];
  definitions: Record<string, Label>;
  /** The whole new list, and the label the tick was on. Labels replace whole. */
  onToggle: (next: string[], toggled: ResolvedLabel) => void;
  /**
   * Defines a label from inside the menu and ticks it on, in one gesture
   * (LC-236e). The create surfaces pass it; the ticket panel does not, and its
   * menu has no define row — a ticket already on the board is not the half-typed
   * draft that could not afford the trip to settings.
   */
  onDefine?: (definition: LabelDefinition) => Promise<boolean>;
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
  /** The define row's focusable stop, whichever of its two shapes is drawn. */
  const defineStop = useRef<HTMLElement | null>(null);
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
          // Wide from the moment it opens rather than when the row expands:
          // `usePopoverPlacement` measures once and clamps nothing, so a
          // popover that grew after placement would run off the right edge in
          // full create and stay there.
          wide={props.onDefine !== undefined}
          footerStop={props.onDefine ? defineStop : undefined}
          footer={
            props.onDefine && (
              <DefineRow
                definitions={props.definitions}
                startOpen={options.length === 0}
                stop={defineStop}
                onDefine={async (definition) => {
                  const written = await props.onDefine!(definition);
                  if (!written) return false;
                  // Defined *and* ticked, which is the one gesture this row
                  // exists to be. The tick goes through the same path a press
                  // on a row does, so the draft is updated one way only.
                  props.onToggle(toggleLabel(props.slugs, definition.slug), {
                    slug: definition.slug,
                    name: definition.name,
                    color: definition.color as ResolvedLabel["color"],
                    defined: true,
                  });
                  return true;
                }}
              />
            )
          }
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
