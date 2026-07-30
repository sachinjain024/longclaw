/**
 * The merged timeline: human and agent records in one chronological stream, told
 * apart by treatment rather than separated into two lists.
 */

import { actorGlyph, actorName, eventProse } from "./attribution";
import { describeAge } from "./freshness";
import type { ActivityEvent } from "./types";

export function Timeline(props: { events: ActivityEvent[]; now: number }) {
  return (
    <ol className="timeline">
      {props.events.map((event) => (
        <TimelineEntry key={event.id} event={event} now={props.now} />
      ))}
    </ol>
  );
}

function TimelineEntry({ event, now }: { event: ActivityEvent; now: number }) {
  const isAgent = event.actor.type === "agent";
  const prose = eventProse(event.body);
  const age = describeAge(Date.parse(event.occurredAt), now);
  return (
    <li className={isAgent ? "timeline-entry agent" : "timeline-entry"}>
      <div className="entry-heading">
        <span className={isAgent ? "actor-tile agent" : "actor-tile"}>
          {actorGlyph(event.actor.type)}
        </span>
        <strong>{actorName(event)}</strong>
        {isAgent && <span className="agent-badge">AGENT</span>}
        <span className="entry-meta">
          {age}
          {/* Where the change came from, not just when. */}
          {event.actor.type === "human" ? "" : " · via file edit"}
        </span>
      </div>
      {event.changes.length > 0 && (
        <ul className="entry-changes">
          {event.changes.map((change, index) => (
            <li key={`${change.field}-${index}`}>
              <code>{change.field}</code>
              {change.from !== undefined || change.to !== undefined
                ? ` ${change.from ?? "—"} → ${change.to ?? "—"}`
                : " changed"}
            </li>
          ))}
        </ul>
      )}
      {prose && <p className="entry-body">{prose}</p>}
    </li>
  );
}
