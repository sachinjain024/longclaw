/**
 * How the app presents an actor, and it presents only what the file recorded.
 *
 * Every surface that distinguishes a human from an agent — timeline entries, the
 * board acknowledgement, the conflict banner — reads the actor from an activity
 * record and nothing else. An observed change with no record is `unknown`, never
 * an agent. Keeping the glyph, the name, and the accent decision here is what
 * stops one surface from disagreeing with another about who did something.
 */

import type { ActivityEvent, ActorType, AppError, TicketDetail } from "./types";

/** What the app calls a change whose file named no actor. */
export const UNKNOWN_ACTOR_LABEL = "actor unknown";

/**
 * The one sentence for an observed change nothing in the file claims
 * (`states.md:172`), for a surface with room to say it: the timeline.
 */
export const UNATTRIBUTED_CHANGE = `file changed on disk — ${UNKNOWN_ACTOR_LABEL}`;

/**
 * The same fact at card width, which is the shorter half of a deliberate pair.
 *
 * The two forms live together because the point is that they are one claim said
 * at two lengths rather than two surfaces knowing different things. A board card
 * is 264px, and the full sentence spent all of it on naming the absence of an
 * actor — it truncated to `…actor unkn…` and pushed out the age, so the row said
 * less than a shorter row would have (LC-147). The warn glyph in front already
 * carries *unattributed*; the words only have to carry *what happened*.
 */
export const UNATTRIBUTED_CHANGE_BRIEF = "file changed";

/**
 * The accent a change wears, decided once from the attribution the file carried.
 *
 * Green is the agent's alone. It used to reach anything that was not a person,
 * so an unclaimed change wore the full agent treatment *and* the warn triangle
 * its glyph gives it — one row speaking two vocabularies about the same event
 * (LC-148). Every surface that shows freshness asks this rather than testing
 * `actorType` itself, which is what keeps the card and the list row agreeing.
 */
export function freshAccentClass(actorType: ActorType): string {
  return `${actorType}-fresh`;
}

export function actorGlyph(actorType: ActorType): string {
  if (actorType === "agent") return "❯";
  return actorType === "unknown" ? "⚠" : "•";
}

/** The timeline's name for an actor. `human` is the local human (ADR 0001). */
export function actorName(event: ActivityEvent): string {
  if (event.actor.type === "agent") {
    return event.actor.name ?? event.actor.id ?? "An agent";
  }
  return event.actor.type === "unknown" ? "Unknown actor" : "You";
}

/**
 * An activity record's Markdown body starts with the heading its author wrote
 * ("### You updated this ticket", or whatever an agent chose). The timeline
 * renders the actor itself, so the heading would repeat it — and an agent's
 * heading is free text that must never become the app's own claim about who did
 * something.
 */
export function eventProse(body: string): string {
  const lines = body.split("\n");
  const start = lines[0]?.startsWith("#") ? 1 : 0;
  return lines.slice(start).join("\n").trim();
}

/**
 * The conflict the app raises itself, when a change lands on disk while a draft
 * is open. Rust raises the same shape when it refuses a stale write; this is the
 * case the app can see coming, before the human presses save.
 */
export function externalEditConflict(detail: TicketDetail): AppError {
  const context: Record<string, string> = {
    ticketKey: detail.key,
    actualHash: detail.contentHash,
  };
  const newest = detail.ticket?.activity.at(-1);
  if (newest) {
    context.conflictingActorType = newest.actor.type;
    context.conflictingAt = newest.occurredAt;
    const name = newest.actor.name ?? newest.actor.id;
    if (name) context.conflictingActorName = name;
  }
  return {
    code: "conflict",
    // The fact, not the offer. `ConflictBanner` renders the choice, and this
    // same error reaches surfaces that have no such choice to render (V0-29).
    // Nothing was refused here — the save has not been attempted — so this says
    // what is true of a draft that is still in hand.
    message: `${detail.key} changed on disk while you were editing. Your unsaved edit is preserved either way.`,
    recoverable: true,
    context,
  };
}
