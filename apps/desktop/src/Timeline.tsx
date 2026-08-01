/**
 * The merged timeline: human and agent records in one chronological stream, told
 * apart by treatment rather than separated into two lists.
 *
 * Two entry shapes, and the record's kind picks one. A **message** — a comment,
 * or a kind this build does not know — gets the full per-voice anatomy from
 * `components.md:195-206`: avatar or tile, name, `AGENT` badge, meta, body. A
 * **change** gets what `components.md:207` asks for instead: a single glyph and
 * one line, with the actor's name in its own accent colour and no avatar.
 *
 * `states.md:169` describes an agent's external mutation as carrying the tile
 * avatar, the rail, the `AGENT` badge and the `via file edit` meta, which the
 * compact form does not. The reading taken here is that `components.md` is the
 * layout and `states.md` is the provenance rule, so a change entry keeps the
 * rail and the meta and drops the 26px tile. That is why every kind still
 * satisfies V0-13's must-pass.
 *
 * **The badge stays on a change entry** even though `components.md:207` says
 * "one line". It costs no line — it sits inline beside the actor — and it is
 * the only channel on a change entry that says *agent* in words. The rail and
 * the accent name are colour, which D11's CVD policy will not let carry a
 * distinction alone, and the name itself is a name: `sachin` and `Claude Code`
 * are both just strings until something states the role. A run of agent status
 * changes is exactly where "distinguish agent activity from human activity" has
 * to land, so it lands there. See plan 19's amendment for the argument.
 *
 * Nothing here decides who an actor is; `attribution.ts` does. Nothing here
 * decides what a field change says; `timelineEvents.ts` does.
 */

import { actorGlyph, actorName, eventProse } from "./attribution";
import { describeAge } from "./freshness";
import { LabelDot } from "./LabelChip";
import { MarkdownView } from "./MarkdownView";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import type { ChangeGlyph } from "./timelineEvents";
import {
  changeLines,
  entryShape,
  sortActivity,
  unfamiliarKind,
} from "./timelineEvents";
import type { ActivityEvent, ChecklistItem, Label } from "./types";

interface TimelineProps {
  events: ActivityEvent[];
  now: number;
  /** Definitions, so a label change names the label rather than its slug. */
  labels?: Record<string, Label>;
  /** The ticket's checklist, so a tick can name the item it ticked. */
  checklist?: ChecklistItem[];
  /**
   * A comment the human just posted, still being written. Posting is optimistic
   * (`screen-specs.md:193`), so it is on screen before the file has it — but it
   * is not a record yet, and it says so rather than pretending to be one.
   */
  pendingComment?: string;
}

export function Timeline(props: TimelineProps) {
  const context = { labels: props.labels, checklist: props.checklist };
  return (
    <ol className="timeline">
      {sortActivity(props.events).map((event) => (
        <TimelineEntry
          key={event.id}
          event={event}
          now={props.now}
          context={context}
        />
      ))}
      {props.pendingComment !== undefined && (
        <PendingComment body={props.pendingComment} />
      )}
    </ol>
  );
}

function TimelineEntry({
  event,
  now,
  context,
}: {
  event: ActivityEvent;
  now: number;
  context: { labels?: Record<string, Label>; checklist?: ChecklistItem[] };
}) {
  const actorType = event.actor.type;
  const shape = entryShape(event.kind);
  const prose = eventProse(event.body);
  const meta = [
    describeAge(Date.parse(event.occurredAt), now),
    // Where the change came from, not just when. An external change says it
    // whoever wrote it: the file is the only place it can have come from.
    actorType === "human" && event.kind !== "external_change"
      ? ""
      : "via file edit",
    // The app does not silently file an unfamiliar kind under one it knows.
    unfamiliarKind(event.kind) === undefined
      ? ""
      : `recorded as “${event.kind}”`,
  ]
    .filter(Boolean)
    .join(" · ");

  const className = [
    "timeline-entry",
    shape,
    actorType === "agent" ? "agent" : "",
    actorType === "unknown" ? "unattributed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = prose && (
    <MarkdownView
      source={prose}
      headingOffset={3}
      className="markdown entry-body"
    />
  );

  if (shape === "message") {
    return (
      <li className={className}>
        <div className="entry-heading">
          <span
            className={
              actorType === "human" ? "actor-tile" : `actor-tile ${actorType}`
            }
            aria-hidden="true"
          >
            {actorGlyph(actorType)}
          </span>
          <strong>{actorName(event)}</strong>
          {actorType === "agent" && <span className="agent-badge">AGENT</span>}
          <span className="entry-meta">{meta}</span>
        </div>
        {body}
      </li>
    );
  }

  const lines = changeLines(event, context);
  return (
    <li className={className}>
      <ul className="entry-changes">
        {lines.map((line, index) => (
          <li key={index} className={line.warn ? "warn" : undefined}>
            <ChangeGlyphMark glyph={line.glyph} />
            {/* Named once, on the first line: the lines below share the
                subject. A warn line already names the absence of one. */}
            {index === 0 && !line.warn && (
              <strong className="change-actor">{actorName(event)}</strong>
            )}
            {index === 0 && !line.warn && actorType === "agent" && (
              <span className="agent-badge">AGENT</span>
            )}
            {line.code && <code>{line.code}</code>}
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      <p className="entry-meta change-meta">{meta}</p>
      {body}
    </li>
  );
}

/** 12px, and never the only channel: every line says its meaning in words. */
function ChangeGlyphMark({ glyph }: { glyph: ChangeGlyph }) {
  if (glyph.kind === "status") {
    return <StatusDot status={glyph.status} small decorative />;
  }
  if (glyph.kind === "priority") {
    return <PriorityGlyph priority={glyph.priority} small decorative />;
  }
  if (glyph.kind === "label") {
    return <LabelDot color={glyph.color} small />;
  }
  return (
    <span className="change-glyph" aria-hidden="true">
      {glyph.value}
    </span>
  );
}

function PendingComment({ body }: { body: string }) {
  return (
    <li className="timeline-entry message pending">
      <div className="entry-heading">
        <span className="actor-tile" aria-hidden="true">
          {actorGlyph("human")}
        </span>
        <strong>You</strong>
        {/* Said in words, so the dimming is not carrying it alone. */}
        <span className="entry-meta">just now · posting</span>
      </div>
      <MarkdownView
        source={body}
        headingOffset={3}
        className="markdown entry-body"
      />
    </li>
  );
}
