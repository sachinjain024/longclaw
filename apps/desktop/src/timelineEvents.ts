/**
 * What one activity record means, decided before anything is drawn.
 *
 * Two questions, and they are separate. **What shape is this entry** — a message
 * with an avatar and a body, or a compact change line — is decided by the
 * record's kind. **What does this change say** is decided by the field, one
 * sentence at a time.
 *
 * Neither answer belongs in a component. A `FieldChange.field` is a wire value
 * an external writer chose: `status`, or `checklist.ck_7d2a.checked`, or a key
 * this build has never seen. Turning that into something a human reads is the
 * work, and it is worth being able to enumerate it in a test without a DOM.
 *
 * Attribution is not decided here. `attribution.ts` owns who an actor is, and an
 * actor with no record is `unknown` and never an agent.
 */

import { UNATTRIBUTED_CHANGE } from "./attribution";
import { resolveLabel, type LabelColor } from "./labels";
import { priorityLabel, PRIORITIES, statusLabel, STATUSES } from "./tickets";
import type {
  ActivityEvent,
  ActivityKind,
  ChecklistItem,
  FieldChange,
  Label,
  TicketPriority,
  TicketStatus,
} from "./types";

/** The kinds this build has a treatment for. Rust preserves any other. */
const KNOWN_KINDS = ["create", "update", "comment", "external_change"];

/**
 * A message carries a body and the full per-voice anatomy; a change carries a
 * glyph and a line (`components.md:226-238`).
 *
 * An unfamiliar kind is a message, deliberately. It is the shape that shows the
 * most — actor, badge, provenance, and the whole body — so a kind this build
 * cannot interpret still puts everything its author wrote on screen.
 */
export function entryShape(kind: ActivityKind): "message" | "change" {
  return kind === "create" || kind === "update" || kind === "external_change"
    ? "change"
    : "message";
}

/** The kind itself when this build does not know it, so the meta can say so. */
export function unfamiliarKind(kind: ActivityKind): string | undefined {
  return KNOWN_KINDS.includes(kind) ? undefined : kind;
}

/**
 * By `occurred_at`, with `id` as the deterministic tie-breaker
 * (`file_format.md:194`). Sorted here rather than trusted from the file: the
 * stream is merged from whatever wrote last, and two writers can disagree about
 * append order.
 */
export function sortActivity(
  events: readonly ActivityEvent[],
): ActivityEvent[] {
  return [...events].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
}

/** The glyph a change line wears, in the vocabulary the rest of the app uses. */
export type ChangeGlyph =
  | { kind: "status"; status: TicketStatus }
  | { kind: "priority"; priority: TicketPriority }
  | { kind: "label"; color: LabelColor }
  | { kind: "char"; value: string };

export interface ChangeLine {
  glyph: ChangeGlyph;
  /**
   * The raw field path, for a key this build does not interpret. It is the only
   * honest thing to show for one, so it is shown — as a code chip, the same way
   * an undefined label slug is rendered as itself.
   */
  code?: string;
  /** The sentence, with no actor in it: the entry supplies the subject. */
  text: string;
  /** True for the one line that reports a change nothing claimed. */
  warn?: boolean;
}

export interface ChangeContext {
  /** Definitions, so a label change names the label and not its slug. */
  labels?: Record<string, Label>;
  /** The ticket's checklist, so `checklist.<id>.checked` can name the item. */
  checklist?: readonly ChecklistItem[];
}

const CHECKLIST_FIELD = /^checklist\.(.+)\.(checked|added)$/;

/**
 * Every line one record puts on screen.
 *
 * A `create` leads with its own sentence; an `external_change` nobody claimed
 * leads with the warn line `states.md:172` specifies. A record with no changes
 * at all still says something, because an empty entry reads as a bug.
 */
export function changeLines(
  event: ActivityEvent,
  context: ChangeContext = {},
): ChangeLine[] {
  const lines = event.changes.map((change) => describeChange(change, context));
  if (event.kind === "create") {
    return [{ glyph: char("✦"), text: "created this ticket" }, ...lines];
  }
  if (event.kind === "external_change" && event.actor.type === "unknown") {
    return [
      { glyph: char("⚠"), text: UNATTRIBUTED_CHANGE, warn: true },
      ...lines,
    ];
  }
  if (lines.length > 0) return lines;
  return [{ glyph: char("•"), text: "updated this ticket" }];
}

/**
 * One `FieldChange`, as a sentence.
 *
 * The fields are what `TicketDocument::apply` writes (`core/ticket.rs:561`) plus
 * whatever an external writer chose. `description` arrives with no `from` and no
 * `to` because the diff is not tracked, which is why it reads as an event rather
 * than a diff — the expandable diff is deferred (`components.md:234-238`).
 */
export function describeChange(
  change: FieldChange,
  context: ChangeContext = {},
): ChangeLine {
  const { field, from, to } = change;

  if (field === "title") {
    return {
      glyph: char("✎"),
      text:
        to === undefined ? "changed the title" : `renamed this to ${quote(to)}`,
    };
  }
  if (field === "status" && isStatus(to)) {
    return {
      glyph: { kind: "status", status: to },
      text: `moved this to ${statusLabel(to)}`,
    };
  }
  if (field === "priority" && isPriority(to)) {
    return {
      glyph: { kind: "priority", priority: to },
      text: `set priority to ${priorityLabel(to)}`,
    };
  }
  if (field === "labels") {
    return describeLabels(from, to, context);
  }
  if (field === "rank") {
    return to === undefined
      ? { glyph: char("↕"), text: "cleared the manual order" }
      : { glyph: char("↕"), text: "reordered this by hand" };
  }
  if (field === "archived_at") {
    return to === undefined
      ? { glyph: char("⊞"), text: "unarchived this" }
      : { glyph: char("⊟"), text: "archived this" };
  }
  if (field === "description") {
    // The spec's own words, so the timeline and the spec cannot drift apart.
    return { glyph: char("✎"), text: "edited the description" };
  }
  const checklist = CHECKLIST_FIELD.exec(field);
  if (checklist) {
    return describeChecklist(checklist[1], checklist[2], to, context);
  }
  return describeUnknownField(field, from, to);
}

function describeLabels(
  from: string | undefined,
  to: string | undefined,
  context: ChangeContext,
): ChangeLine {
  const before = slugs(from);
  const after = slugs(to);
  const added = after.filter((slug) => !before.includes(slug));
  const removed = before.filter((slug) => !after.includes(slug));
  const moved = [...added, ...removed];
  const glyph: ChangeGlyph =
    moved.length === 0
      ? char("◇")
      : {
          kind: "label",
          color: resolveLabel(moved[0], context.labels ?? {}).color,
        };
  const phrases = [
    added.length > 0 ? `added ${names(added, context)}` : "",
    removed.length > 0 ? `removed ${names(removed, context)}` : "",
  ].filter(Boolean);
  if (phrases.length === 0) return { glyph, text: "changed the labels" };
  const noun = moved.length === 1 ? "label" : "labels";
  return { glyph, text: `${phrases.join(", ")} ${noun}` };
}

function describeChecklist(
  itemId: string,
  what: string,
  to: string | undefined,
  context: ChangeContext,
): ChangeLine {
  const item = context.checklist?.find((entry) => entry.id === itemId);
  if (what === "added") {
    const text = to ?? item?.text;
    return {
      glyph: char("+"),
      text:
        text === undefined
          ? "added a checklist item"
          : `added ${quote(text)} to the checklist`,
    };
  }
  const verb = to === "true" ? "checked" : "unchecked";
  const glyph = to === "true" ? char("✓") : char("○");
  return {
    glyph,
    text:
      item === undefined
        ? `${verb} a checklist item`
        : `${verb} ${quote(item.text)}`,
  };
}

/**
 * A key this build does not interpret. The path is kept, because for a field
 * nobody here has a name for it is the only thing that is actually true.
 */
function describeUnknownField(
  field: string,
  from: string | undefined,
  to: string | undefined,
): ChangeLine {
  if (to !== undefined && from !== undefined) {
    return {
      glyph: char("•"),
      code: field,
      text: `changed from ${quote(from)} to ${quote(to)}`,
    };
  }
  if (to !== undefined)
    return { glyph: char("•"), code: field, text: `set to ${quote(to)}` };
  if (from !== undefined) {
    return {
      glyph: char("•"),
      code: field,
      text: `cleared, was ${quote(from)}`,
    };
  }
  return { glyph: char("•"), code: field, text: "changed" };
}

function char(value: string): ChangeGlyph {
  return { kind: "char", value };
}

/** Curly, because a title can contain a straight quote of its own. */
function quote(value: string): string {
  return `“${value}”`;
}

/** `apply` writes a label list as `a, b`; an empty list is no labels at all. */
function slugs(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function names(list: string[], context: ChangeContext): string {
  return list
    .map((slug) => resolveLabel(slug, context.labels ?? {}).name)
    .join(" and ");
}

function isStatus(value: string | undefined): value is TicketStatus {
  return STATUSES.some((option) => option.id === value);
}

function isPriority(value: string | undefined): value is TicketPriority {
  return PRIORITIES.some((option) => option.id === value);
}
