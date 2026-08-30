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

/**
 * Whether this record is a comment: somebody's words, rather than a report of
 * something that happened to the ticket.
 *
 * It is the one message kind the app writes, and the one the Comments tab is a
 * tab *of* (LC-211). A kind this build does not know is a message too — it is
 * drawn with everything its author wrote — but it is not filed as a comment,
 * because filing an unfamiliar record under a familiar name is the one thing
 * `unfamiliarKind` exists to stop.
 */
export function isComment(kind: ActivityKind): boolean {
  return kind === "comment";
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

const CHECKLIST_FIELD = /^checklist\.(.+)\.(checked|added|moved|text|removed)$/;
/**
 * What a write did to a comment already in the history (LC-241q). `restored`
 * names no record because the one it puts back is a fresh one — the id left
 * with the record it was withdrawn from.
 */
const COMMENT_FIELD = /^comment\.(?:(.+)\.(edited|removed)|(restored))$/;

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
  // What a comment says when it is being described as a change rather than
  // drawn as one: that somebody commented (LC-211). It carries no field changes
  // of its own, so without this it would fall through to "updated this ticket"
  // and describe itself as the wrong thing. The words are the entry's body, and
  // whether they are on screen is the caller's question, not this one's.
  if (isComment(event.kind)) {
    return [{ glyph: char("❝"), text: "commented" }, ...lines];
  }
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
    return describeChecklist(checklist[1], checklist[2], from, to, context);
  }
  const comment = COMMENT_FIELD.exec(field);
  if (comment) {
    return describeComment(comment[2] ?? comment[3]);
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
  from: string | undefined,
  to: string | undefined,
  context: ChangeContext,
): ChangeLine {
  const item = context.checklist?.find((entry) => entry.id === itemId);
  if (what === "text") {
    // The description's glyph, because it is the same news about a smaller
    // thing: somebody changed what a line says.
    const before = from ?? item?.text;
    return {
      glyph: char("✎"),
      text:
        before === undefined || to === undefined
          ? "reworded a checklist item"
          : `reworded ${quote(before)} to ${quote(to)}`,
    };
  }
  if (what === "removed") {
    // The only checklist line whose subject cannot be looked up — the item is
    // out of the list — so the record's `from` is the one thing that still
    // knows what the row said. That is why the removal records it.
    return {
      glyph: char("−"),
      text:
        from === undefined
          ? "removed a checklist item"
          : `removed ${quote(from)} from the checklist`,
    };
  }
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
  if (what === "moved") {
    // The same glyph the manual board order wears, because it is the same news:
    // somebody put something in a different place by hand. The record carries
    // the positions it went between; the sentence names the row, which is what
    // a reader recognises — a number is only meaningful beside the list itself.
    return {
      glyph: char("↕"),
      text:
        item === undefined
          ? "moved a checklist item"
          : `moved ${quote(item.text)}`,
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
 * What a write did to a comment, as a sentence (LC-241q).
 *
 * None of these reaches a timeline entry from a LongClaw write: rewording a
 * comment appends no record, because the record it reworded carries the whole
 * of what happened to it. They are here because the write still reports them —
 * a toast names what it is offering to take back — and because an outside
 * writer may put one in a record of its own, and a raw dotted path on screen is
 * the failure this enumeration exists to prevent.
 *
 * The words themselves are not quoted into any of them. A comment is prose of
 * any length, and a line that swallowed a paragraph would be the one entry in
 * the stream that is not one line.
 */
function describeComment(what: string): ChangeLine {
  if (what === "removed") {
    return { glyph: char("−"), text: "withdrew a comment" };
  }
  if (what === "restored") {
    return { glyph: char("❝"), text: "restored a comment" };
  }
  // Not `reworded`, which is the checklist row's word: this is the word the
  // record itself uses in `edited_at` and the word the entry wears beside its
  // age, and one gesture should not be called two things.
  return { glyph: char("✎"), text: "edited a comment" };
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
