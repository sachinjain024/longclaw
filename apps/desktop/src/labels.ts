/**
 * How a label slug becomes something to draw, and how a display name becomes
 * one in the first place.
 *
 * A ticket stores slugs and nothing else (`file_format.md:241-258`), which is
 * what lets a definition be renamed or recoloured without rewriting a single
 * ticket. The cost of that is one lookup, and it has to give an answer for every
 * slug — including one this project defines no label for, because an agent can
 * write one and the file keeps it. So resolution never fails and never drops:
 * an undefined slug is its own display name in the fallback hue.
 *
 * Here rather than in a component so the board, the list rows (V0-14), the panel
 * and the label menu cannot disagree about what a slug looks like — and, since
 * LC-236e, so the two places a label can be *defined* cannot disagree about what
 * key a typed name produces.
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

/**
 * A display name, turned into the key `longclaw.yaml` will hold it under.
 *
 * One function rather than one per surface, because LC-236e puts a define row
 * in the label popover *and* takes the slug field out of the settings add-row:
 * two derivations would mean the same typed name producing two different keys
 * depending on where it was typed.
 *
 * The NFD fold comes first and is load-bearing rather than tidy. An accented
 * letter is punctuation to `[a-z0-9]`, so without it `Café` derives `caf` and
 * `Ünïcode` derives `n-code` — and since the key is read-only (LC-236e's
 * review settled that), a mangled key is not something the person can correct.
 * It cannot rescue a name with no Latin in it at all: `日本語` still derives
 * nothing, which is the dead end that ticket accepted rather than closed. The
 * way out of that one is `longclaw.yaml` itself, or `longclaw label add`.
 *
 * This only *proposes* a key. Rust keeps the grammar (`core/project.rs:349`),
 * which is why `2026 goals` gets as far as `2026-goals` before being refused.
 */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Rust's `is_label_slug` (`core/project.rs:349-359`), mirrored.
 *
 * Not a second authority — the write still asks Rust, and its refusal is still
 * the message. This is here so the define row can grey its own commit and say
 * why while the name is being typed, instead of taking a round trip to learn
 * something already on screen.
 */
export function isLabelSlug(slug: string): boolean {
  return /^[a-z][a-z0-9_-]*$/.test(slug);
}

/**
 * The hue a new definition opens on: the first of the eight this project is not
 * already using, and blue once all eight are taken.
 *
 * Settings opened on `LABEL_COLORS[0]` whatever was already defined, so a
 * project seeded through the app came out all blue and every chip on the board
 * read as the same label at a glance. A hue outside the ramp holds nothing
 * back — Rust's own `slate` default is a theme id rather than one of the eight.
 */
export function nextLabelColor(definitions: Record<string, Label>): LabelColor {
  const used = new Set(
    Object.values(definitions)
      .map((definition) => definition.color)
      .filter(isRampColor),
  );
  return LABEL_COLORS.find((color) => !used.has(color)) ?? LABEL_COLORS[0];
}

/**
 * What a typed name would define, and what is wrong with it.
 *
 * `blank` before anything is typed, `refused` when no key can be made, `taken`
 * when the key it makes is already defined, `ok` when it can be written.
 *
 * There is **one** `refused` for both ways a name fails to make a key — `日本語`
 * derives nothing, `2026 goals` derives `2026-goals`, which is not one — because
 * the row draws them identically. Same sentence, same slot, same tone: there is
 * one thing to do about either and it is the name. `isLabelSlug("")` is false,
 * so the empty derivation falls in here without a branch of its own.
 *
 * `slug` is carried on every state including `taken`, because the refusal has
 * to name the key that collided — and `heldBy` with it, so the message can be
 * written from the state alone. Looking the display name up again at the point
 * of drawing would let the sentence and the state disagree about which map they
 * were decided against.
 */
export interface LabelDefineState {
  slug: string;
  kind: "blank" | "refused" | "taken" | "ok";
  /** The display name already holding `slug`. Only ever set on `taken`. */
  heldBy?: string;
}

export function defineState(
  name: string,
  definitions: Record<string, Label>,
): LabelDefineState {
  const slug = slugFromName(name);
  if (name.trim() === "") return { slug, kind: "blank" };
  if (!isLabelSlug(slug)) return { slug, kind: "refused" };
  const held = definitions[slug];
  if (held) return { slug, kind: "taken", heldBy: held.name };
  return { slug, kind: "ok" };
}

/**
 * The line under the name field, in all four states. It points at the **name**,
 * which is the only thing anyone can change: the key is read-only, so the key a
 * rejected name would have produced is not actionable and is not drawn.
 */
const LABEL_KEY_HINT = "Label key (auto-generated)";
const LABEL_KEY_RULE = "Label Name must start with a letter [a-z]";

/**
 * The key, or the rule that stopped one being made — never both, and never a
 * string that is not a key. The line itself never goes away: an empty line
 * where a key was is the silence LC-236e argues against.
 */
export function labelKeyLine(state: LabelDefineState): {
  text: string;
  tone: "hint" | "key" | "refused";
} {
  if (state.kind === "blank") return { text: LABEL_KEY_HINT, tone: "hint" };
  if (state.kind === "refused")
    return { text: LABEL_KEY_RULE, tone: "refused" };
  return { text: state.slug, tone: "key" };
}

/**
 * The second line, which is only ever a collision.
 *
 * The two slots divide cleanly: the line above says whether a key can be made,
 * and this one says the one thing that can be wrong with a key that *was*. A
 * name that cannot make a key never reaches here — the rule is already on the
 * line above, and repeating it would be one sentence stacked on itself.
 */
export function labelKeyNote(state: LabelDefineState): string | undefined {
  if (state.kind !== "taken") return undefined;
  return `${state.slug} already exists for ${state.heldBy}. Please provide a new Label name.`;
}
