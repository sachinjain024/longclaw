/**
 * The label chip: a dot and the label's text, on every surface that shows one.
 *
 * The dot is reinforcement and the text is the identifier
 * (`components.md:75-80`), so the text is never dropped — that is what keeps the
 * chip legible for a slug this project defines no label for, and what keeps
 * colour from being the only channel (`components.md:119`).
 */

import { resolveLabels, type LabelColor, type ResolvedLabel } from "./labels";
import type { Label } from "./types";

/** The ramp hue as a class, so the colour itself stays in the stylesheet. */
export function LabelDot(props: { color: LabelColor; small?: boolean }) {
  return (
    <span
      className={`label-dot label-${props.color}${props.small ? " small" : ""}`}
      aria-hidden="true"
    />
  );
}

export function LabelChip(props: { label: ResolvedLabel; small?: boolean }) {
  const { label } = props;
  return (
    <span
      className={[
        "label-chip",
        props.small ? "small" : "",
        label.defined ? "" : "undefined-slug",
      ]
        .filter(Boolean)
        .join(" ")}
      // Said in words rather than by the dashed border alone, and only for the
      // case that needs explaining: the slug is on the ticket, not in the file
      // that names labels.
      title={
        label.defined
          ? undefined
          : `${label.slug} is not defined in longclaw.yaml`
      }
    >
      <LabelDot color={label.color} small={props.small} />
      {label.name}
    </span>
  );
}

/**
 * The chips for one ticket's slugs, in the order the ticket carries them.
 * `limit` is for a footer that must not wrap; leaving it out draws them all.
 */
export function LabelChips(props: {
  slugs: readonly string[];
  definitions: Record<string, Label>;
  limit?: number;
  small?: boolean;
}) {
  const labels = resolveLabels(props.slugs, props.definitions, props.limit);
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((label) => (
        <LabelChip key={label.slug} label={label} small={props.small} />
      ))}
    </>
  );
}
