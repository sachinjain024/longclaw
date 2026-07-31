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
 * (`states.md:172`). The board footer and the timeline both say it, and they say
 * it identically because saying it twice differently is how a surface starts
 * implying it knows more than another one does.
 */
export const UNATTRIBUTED_CHANGE = `file changed on disk — ${UNKNOWN_ACTOR_LABEL}`;

/** Agent and unattributed changes wear the agent accent; a person's do not. */
export function wearsAgentAccent(actorType: ActorType): boolean {
  return actorType !== "human";
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
    message:
      "This ticket changed on disk while you were editing. Reload it or keep " +
      "your version, then save again.",
    recoverable: true,
    context,
  };
}
