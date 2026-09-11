/**
 * The status, priority and type rows every menu in the app is built from.
 *
 * Every menu row carries the option's own glyph (`screen-specs.md:320-321`), and the
 * status menu's glyph is the coloured dot. Built once, here rather than in a
 * surface: the rows never differ per ticket, and the panel, the create surface
 * and quick create must not be able to disagree about what the options are.
 */

import type { MenuOption } from "./Menu";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import { PRIORITIES, STATUSES } from "./tickets";
import type { Label } from "./types";

export const STATUS_OPTIONS = STATUSES.map((option) => ({
  id: option.id,
  label: option.label,
  glyph: <StatusDot status={option.id} decorative />,
}));

export const PRIORITY_OPTIONS = PRIORITIES.map((option) => ({
  id: option.id,
  label: option.label,
  glyph: <PriorityGlyph priority={option.id} decorative />,
}));

/**
 * The type menu's rows: the project's own values, and a way back out (LC-227).
 *
 * A function where the other two are constants, because this vocabulary is the
 * project's rather than the app's — but it belongs beside them for the reason
 * they are here at all: the panel, full create, quick create and the context
 * menu each offer it, and four spellings of "the values a type may take" is
 * four chances for a surface to offer one the project does not define.
 *
 * `None` is first and carries the empty slug, which is what a surface turns
 * back into a clear — the same distinction `TicketEdit` draws between absent
 * and `null`, at the surface that has to offer it.
 */
export function typeOptions(
  values: Record<string, Label>,
): MenuOption<string>[] {
  return [
    { id: "", label: "None" },
    ...Object.entries(values).map(([slug, label]) => ({
      id: slug,
      label: label.name,
      glyph: <span className={`label-dot label-${label.color}`} />,
    })),
  ];
}
