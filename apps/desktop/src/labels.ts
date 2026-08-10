/**
 * How a label slug becomes something to draw.
 *
 * A ticket stores slugs and nothing else (`file_format.md:214-231`), which is
 * what lets a definition be renamed or recoloured without rewriting a single
 * ticket. The cost of that is one lookup, and it has to give an answer for every
 * slug — including one this project defines no label for, because an agent can
 * write one and the file keeps it. So resolution never fails and never drops:
 * an undefined slug is its own display name in the fallback hue.
 *
 * Here rather than in a component so the board, the list rows (V0-14), the panel
 * and the label menu cannot disagree about what a slug looks like.
 */

import type { Label } from "./types";

/**
 * D12's ramp: eight fixed hues, in the order the decision lists them. System
 * tokens, never themed. The green band is deliberately absent — green belongs to
 * the agent — so a definition may not reach for one.
 */
export const LABEL_COLORS = [
  "blue",
  "cyan",
  "purple",
  "pink",
  "red",
  "orange",
  "amber",
  "gray",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/**
 * Where an undefined slug lands, and where a definition lands whose colour this
 * build does not know — including Rust's own `slate` default, which is a theme
 * id rather than a ramp hue. The file is never corrected to match.
 */
export const FALLBACK_LABEL_COLOR: LabelColor = "gray";

export interface ResolvedLabel {
  slug: string;
  /** The definition's display name, or the slug itself when there is none. */
  name: string;
  color: LabelColor;
  /** False when `longclaw.yaml` defines no such slug. Never a reason to hide it. */
  defined: boolean;
}

/** Whether a stored colour is one of the eight, which only the ramp decides. */
export function isRampColor(color: string): color is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(color);
}

export function resolveLabel(
  slug: string,
  definitions: Record<string, Label>,
): ResolvedLabel {
  const definition = definitions[slug];
  if (!definition) {
    return { slug, name: slug, color: FALLBACK_LABEL_COLOR, defined: false };
  }
  return {
    slug,
    name: definition.name,
    color: isRampColor(definition.color)
      ? definition.color
      : FALLBACK_LABEL_COLOR,
    defined: true,
  };
}

/**
 * The chips a surface will draw, in the order the ticket carries them. `limit`
 * is for footers that must not wrap; leaving it out draws them all.
 */
export function resolveLabels(
  slugs: readonly string[],
  definitions: Record<string, Label>,
  limit?: number,
): ResolvedLabel[] {
  const shown = limit === undefined ? slugs : slugs.slice(0, limit);
  return shown.map((slug) => resolveLabel(slug, definitions));
}

/** Every slug that could be ticked: what the project defines, plus what this
 * ticket already carries. An undefined slug is listed so it can be taken off. */
export function labelOptions(
  slugs: readonly string[],
  definitions: Record<string, Label>,
): ResolvedLabel[] {
  const defined = Object.keys(definitions)
    .map((slug) => resolveLabel(slug, definitions))
    .sort((left, right) => left.name.localeCompare(right.name));
  const undefinedSlugs = [...new Set(slugs)]
    .filter((slug) => definitions[slug] === undefined)
    .sort((left, right) => left.localeCompare(right));
  return [
    ...defined,
    ...undefinedSlugs.map((slug) => resolveLabel(slug, definitions)),
  ];
}

/** Toggles one slug, keeping the order the ticket already had. */
export function toggleLabel(slugs: readonly string[], slug: string): string[] {
  return slugs.includes(slug)
    ? slugs.filter((current) => current !== slug)
    : [...slugs, slug];
}

export function sameLabels(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((slug, index) => slug === right[index])
  );
}
