/**
 * The designed acknowledgement of an external file edit.
 *
 * A change that arrives from disk is never a silent re-render: the row that
 * changed carries who changed it and how long ago, until a human has looked at it
 * or the window has passed. Attribution comes only from the actor records in the
 * file — this module never infers an actor from the fact that a file moved, which
 * is why an unattributed change reads as "actor unknown" rather than as an agent.
 */

import {
  actorGlyph,
  UNATTRIBUTED_CHANGE,
  UNATTRIBUTED_CHANGE_BRIEF,
  UNKNOWN_ACTOR_LABEL,
} from "./attribution";
import type { Actor, ChecklistItem } from "./types";

/** How long an unreviewed external change stays acknowledged (states.md). */
export const ACKNOWLEDGEMENT_WINDOW_MS = 120_000;

export interface ExternalMark {
  /** Taken from a record this change appended, never guessed. */
  actorType: "agent" | "human" | "unknown";
  actorLabel: string;
  /** When the app observed the change, in epoch milliseconds. */
  at: number;
}

export type ExternalMarks = Record<string, ExternalMark>;

/**
 * `actor` is the one Rust attributed to *this* change — the actor of a record
 * that was not in the file before. Deliberately not the ticket's newest record:
 * a person editing in an editor appends nothing, and reading the newest record
 * would credit them to whichever agent wrote last.
 */
export function externalMark(
  actor: Actor | undefined,
  observedAt: number,
): ExternalMark {
  if (actor?.type === "agent") {
    return {
      actorType: "agent",
      actorLabel: actor.name ?? actor.id ?? "an agent",
      at: observedAt,
    };
  }
  if (actor?.type === "human") {
    return { actorType: "human", actorLabel: "a person", at: observedAt };
  }
  return {
    actorType: "unknown",
    actorLabel: UNKNOWN_ACTOR_LABEL,
    at: observedAt,
  };
}

/** True while the change still deserves the acknowledgement treatment. */
export function isAcknowledged(
  mark: ExternalMark | undefined,
  now: number,
): boolean {
  return mark !== undefined && now - mark.at < ACKNOWLEDGEMENT_WINDOW_MS;
}

/**
 * How long the pulse runs: `--lc-motion-pulse-duration` twice over, which is the
 * two beats `--lc-motion-pulse-iterations` asks for.
 */
export const PULSE_MS = 1_800;

/**
 * True only while the pulse is still the truth.
 *
 * The pulse is a CSS animation, and a CSS animation restarts whenever its element
 * mounts. A board column renders only the cards it can show, so a card scrolled
 * out and back is a fresh mount — without this, the product's signature moment
 * would replay every time a row came back into view, for a change the human saw
 * two minutes ago. The ring and the footer stay; they are still true. The pulse
 * is the part that says *just now*.
 */
export function isPulsing(
  mark: ExternalMark | undefined,
  now: number,
): boolean {
  return isAcknowledged(mark, now) && now - (mark?.at ?? 0) < PULSE_MS;
}

/**
 * The card footer line. An unattributed change gets the warn glyph and says so
 * instead of borrowing the agent's voice.
 *
 * Every form carries the age, including the unattributed one: *when* is the half
 * of the acknowledgement that is true whether or not anything claimed the write,
 * and the line that dropped it was the only one on the board that could not say
 * how stale it was (LC-147). It is also the shortest form, because it is the one
 * with no actor to name — see `UNATTRIBUTED_CHANGE_BRIEF`.
 */
export function acknowledgement(mark: ExternalMark, now: number): string {
  const glyph = actorGlyph(mark.actorType);
  const age = describeAge(mark.at, now);
  if (mark.actorType === "unknown") {
    return `${glyph} ${UNATTRIBUTED_CHANGE_BRIEF} · ${age}`;
  }
  if (mark.actorType === "human") {
    return `${glyph} changed on disk · ${age} · via file edit`;
  }
  return `${glyph} updated by ${mark.actorLabel} · ${age} · via file edit`;
}

/**
 * The same acknowledgement where there is room for a sentence — the panel's
 * banner, which is as wide as the panel.
 *
 * Only the unattributed line differs, because it is the only one the card had to
 * abbreviate. Shortening it everywhere would have been the card's 264px deciding
 * what a surface eight times its width is allowed to say (LC-147).
 */
export function acknowledgementInFull(mark: ExternalMark, now: number): string {
  if (mark.actorType !== "unknown") return acknowledgement(mark, now);
  const age = describeAge(mark.at, now);
  return `${actorGlyph(mark.actorType)} ${UNATTRIBUTED_CHANGE} · ${age}`;
}

/** Prose, and the one age that does not fit the row's column. */
const JUST_NOW = "just now";

export function describeAge(at: number, now: number): string {
  const seconds = Math.floor(Math.max(0, now - at) / 1_000);
  if (seconds < 1) return JUST_NOW;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * The same age, in the fixed 46px right-aligned slot a list row ends with
 * (`screen-specs.md:141-146`).
 *
 * Every age that vocabulary produces is two or three characters wide except one:
 * `just now` wrapped onto a second line in that slot and made those rows visibly
 * taller than their neighbours. Prose keeps the longer form — the timeline entry
 * and the card's acknowledgement line are sentences, and a sentence saying `now`
 * reads as a truncation — so this is one substitution over one vocabulary rather
 * than a second way of naming ages.
 */
export function describeAgeInSlot(at: number, now: number): string {
  const age = describeAge(at, now);
  return age === JUST_NOW ? "now" : age;
}

/** Returns the same map when nothing decayed, so a sweep costs no re-render. */
export function pruneMarks(marks: ExternalMarks, now: number): ExternalMarks {
  const keys = Object.keys(marks);
  const kept = keys.filter((key) => isAcknowledged(marks[key], now));
  if (kept.length === keys.length) return marks;
  return Object.fromEntries(kept.map((key) => [key, marks[key]]));
}

/**
 * Checklist ids an external write just ticked, so the panel can show those rows
 * with the agent treatment rather than re-rendering the whole list as new.
 */
export function newlyChecked(
  before: ChecklistItem[],
  after: ChecklistItem[],
): string[] {
  const wasChecked = new Map(
    before.filter((item) => item.id).map((item) => [item.id, item.checked]),
  );
  return after
    .filter(
      (item) => item.id && item.checked && wasChecked.get(item.id) === false,
    )
    .map((item) => item.id as string);
}
