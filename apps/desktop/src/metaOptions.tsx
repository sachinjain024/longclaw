/**
 * The status and priority rows every menu in the app is built from.
 *
 * Every menu row carries the option's own glyph (`screen-specs.md:320-321`), and the
 * status menu's glyph is the coloured dot. Built once, here rather than in a
 * surface: the rows never differ per ticket, and the panel, the create surface
 * and quick create must not be able to disagree about what the options are.
 */

import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import { PRIORITIES, STATUSES } from "./tickets";

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
