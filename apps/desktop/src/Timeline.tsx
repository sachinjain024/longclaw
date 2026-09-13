/**
 * The merged timeline: human and agent records in one chronological stream, told
 * apart by treatment rather than separated into two lists.
 *
 * Two entry shapes, and the record's kind picks one. A **message** — a comment,
 * or a kind this build does not know — gets the full per-voice anatomy from
 * `components.md:226-233`: avatar or tile, name, `AGENT` badge, meta, body. A
 * **change** gets what `components.md:234-238` asks for instead: a single glyph and
 * one line, with the actor's name in its own accent colour and no avatar.
 *
 * `states.md:169` describes an agent's external mutation as carrying the tile
 * avatar, the rail, the `AGENT` badge and the `via file edit` meta, which the
 * compact form does not. The reading taken here is that `components.md` is the
 * layout and `states.md` is the provenance rule, so a change entry keeps the
 * rail and the meta and drops the 26px tile. That is why every kind still
 * satisfies V0-13's must-pass.
 *
 * **The badge stays on a change entry** even though `components.md:234-238` says
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

import { useState } from "react";
import { actorGlyph, actorName, eventProse } from "./attribution";
import { describeAge } from "./acknowledgement";
import { LabelDot } from "./LabelChip";
import { MarkdownView } from "./MarkdownView";
import { PencilGlyph } from "./PencilGlyph";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import type { ChangeGlyph } from "./timelineEvents";
import {
  changeLines,
  entryShape,
  isComment,
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
   * (`screen-specs.md:248`), so it is on screen before the file has it — but it
   * is not a record yet, and it says so rather than pretending to be one.
   */
  pendingComment?: string;
  /**
   * Whether a comment is drawn as the one line that says it happened rather
   * than with its body (LC-211).
   *
   * This is what the Activity tab is: the same stream, with the words left to
   * the tab that is about words. It is a property of the *view*, not of the
   * record, which is why it is a prop here and not a kind in
   * `timelineEvents.ts`.
   */
  commentsAsLines?: boolean;
  /**
   * New words for one comment, and the record they replace (LC-241q). Absent
   * where the gesture is not on offer — the Activity tab draws the same records
   * with no composer, and a button that called nothing would be a control that
   * does nothing.
   */
  onEditComment?: (eventId: string, text: string) => void;
  /** The comment to withdraw, by record id. */
  onRemoveComment?: (eventId: string) => void;
}

/**
 * Whether this entry is one the person at the keyboard may rewrite or withdraw
 * (LC-241q).
 *
 * Three things have to be true, and the first two are the interesting ones. It
 * has to be a **comment**: an entry reporting what happened to the ticket is
 * corrected by a later entry and never rewritten, which is what keeps the
 * history honest. And it has to be **theirs**: `actorName` calls exactly this
 * actor "You", so the rule the buttons follow is the rule the name follows —
 * the app never offers to put words in an agent's mouth or take them out of it.
 *
 * The reserved local human is `{ type: human, id: local }` (ADR 0001), and the
 * id is part of the test rather than decoration: Rust refuses any comment whose
 * actor is not the one the write is attributed to, so a button drawn on a
 * looser rule than that is a button that fails when it is pressed.
 */
function isYours(event: ActivityEvent): boolean {
  return (
    isComment(event.kind) &&
    event.actor.type === "human" &&
    event.actor.id === "local"
  );
}

/** Which of the DS's human hue pairs a name wears — stable, so the same
 *  person is the same colour across the record (LC-223, E14). */
function humanHue(name: string): "human-1" | "human-2" {
  const seed = name.length + (name.charCodeAt(0) || 0);
  return seed % 2 === 0 ? "human-1" : "human-2";
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
          commentsAsLines={props.commentsAsLines}
          onEdit={props.onEditComment}
          onRemove={props.onRemoveComment}
        />
      ))}
      {props.pendingComment !== undefined && (
        <PendingComment
          body={props.pendingComment}
          asLine={props.commentsAsLines}
        />
      )}
    </ol>
  );
}

function TimelineEntry({
  event,
  now,
  context,
  commentsAsLines,
  onEdit,
  onRemove,
}: {
  event: ActivityEvent;
  now: number;
  context: { labels?: Record<string, Label>; checklist?: ChecklistItem[] };
  commentsAsLines?: boolean;
  onEdit?: (eventId: string, text: string) => void;
  onRemove?: (eventId: string) => void;
}) {
  const actorType = event.actor.type;
  const [editing, setEditing] = useState(false);
  /**
   * A comment drawn as one line (LC-211). Its body is left out with the shape:
   * a change entry keeps its body — an update carrying a note is that note —
   * but a comment's body *is* the comment, and a line above the whole of it
   * would be the compact form saying the same thing twice.
   */
  const asLine = Boolean(commentsAsLines) && isComment(event.kind);
  const shape = asLine ? "change" : entryShape(event.kind);
  const prose = asLine ? "" : eventProse(event.body);
  const meta = [
    describeAge(Date.parse(event.occurredAt), now),
    // Said, not shown by the words having changed — which nobody watching can
    // see. It sits beside the age rather than replacing it, because when a
    // comment was written and when it was last touched are two facts and the
    // stream is ordered on the first (LC-241q).
    event.editedAt === undefined ? "" : "edited",
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

  /**
   * Whether this entry carries the pencil and the `✕`.
   *
   * `asLine` is in the test because the Activity tab draws a comment as the one
   * line saying it happened: its words are not on screen, and a pencil over
   * words nobody can see would open a field out of nowhere.
   */
  const yours = isYours(event) && !asLine && Boolean(onEdit && onRemove);

  if (shape === "message") {
    return (
      <li className={className}>
        <div className="entry-heading">
          <span
            className={
              actorType === "human"
                ? `actor-tile ${humanHue(actorName(event))}`
                : `actor-tile ${actorType}`
            }
            aria-hidden="true"
          >
            {actorGlyph(actorType)}
          </span>
          <strong>{actorName(event)}</strong>
          {actorType === "agent" && <span className="agent-badge">AGENT</span>}
          <span className="entry-meta">{meta}</span>
          {yours && !editing && (
            <CommentActions
              onEdit={() => setEditing(true)}
              onRemove={() => onRemove?.(event.id)}
            />
          )}
        </div>
        {yours && editing ? (
          <CommentEditor
            text={prose}
            onCommit={(text) => {
              setEditing(false);
              // An unchanged comment is not a write, and an emptied one is not
              // a withdrawal: `✕` is. Rust refuses both, and a refusal is not
              // what closing a field should mean.
              const next = text.trim();
              if (!next || next === prose) return;
              onEdit?.(event.id, next);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          body
        )}
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

/**
 * A comment's own two controls (LC-241q), quiet until the entry is hovered or
 * something in it holds focus — the treatment `RowActions` gives a checklist
 * row, for the same reason: a stream of comments each showing two buttons is a
 * wall of chrome over what is meant to read as a conversation.
 *
 * Both are real Tab stops. WebKit skips a `<button>` entirely with the macOS
 * *Keyboard navigation* setting off, which is its default, so an explicit
 * `tabIndex` is what makes these reachable at all (`npm run check` enforces it).
 *
 * "your comment" rather than the words themselves: a checklist row is one short
 * line and names itself, and a comment is prose of any length. The entries are
 * already distinguished for a screen reader by the author and age above them,
 * and a label that read out a paragraph before saying *Edit* would bury the
 * verb.
 */
function CommentActions(props: { onEdit: () => void; onRemove: () => void }) {
  return (
    <span className="entry-actions">
      <button
        type="button"
        tabIndex={0}
        className="ghost small row-edit"
        title="Edit your comment"
        aria-label="Edit your comment"
        onClick={props.onEdit}
      >
        <PencilGlyph />
      </button>
      <button
        type="button"
        tabIndex={0}
        className="ghost small row-remove"
        title="Delete your comment"
        aria-label="Delete your comment"
        onClick={props.onRemove}
      >
        ✕
      </button>
    </span>
  );
}

/**
 * One comment, being rewritten where it stands.
 *
 * A textarea with two named buttons rather than the checklist row's
 * commit-on-blur field, and the difference is the content: a checklist row is
 * one line, and a comment is prose with newlines in it. `Enter` has to insert
 * one, so it cannot also commit — which leaves `⌘↵`, the chord the composer
 * directly below already takes. Blur cannot commit either, because reaching for
 * the toolbar or the scrollbar mid-paragraph would file the draft.
 *
 * So the way out is stated instead of implied: **Save**, **Cancel**, and `Esc`
 * for the keyboard. `Esc` is stopped here — the panel's own `Esc` closes the
 * panel, and a field being abandoned is not the panel being closed
 * (`keyboard-focus-map.md:16-23`).
 *
 * The draft lives here, so a keystroke re-renders one entry rather than the
 * whole stream.
 */
function CommentEditor(props: {
  text: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(props.text);
  return (
    <form
      className="comment-edit-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        props.onCommit(draft);
      }}
    >
      <textarea
        className="comment-edit-field"
        aria-label="Edit your comment"
        autoFocus
        rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
        value={draft}
        onChange={(change) => setDraft(change.target.value)}
        onKeyDown={(key) => {
          if (key.key === "Escape") {
            key.stopPropagation();
            props.onCancel();
            return;
          }
          if (key.key === "Enter" && (key.metaKey || key.ctrlKey)) {
            key.preventDefault();
            props.onCommit(draft);
          }
        }}
      />
      <div className="comment-edit-actions">
        <button type="submit" tabIndex={0} className="primary small">
          Save
        </button>
        <button
          type="button"
          tabIndex={0}
          className="ghost small"
          onClick={props.onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
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

function PendingComment({ body, asLine }: { body: string; asLine?: boolean }) {
  // Under Activity a comment is the line that says one happened, and the one
  // still being written is no exception: drawn with its body here, it would
  // stand full-height among one-liners and then collapse into one the moment
  // the file came back (LC-211).
  if (asLine) {
    return (
      <li className="timeline-entry change pending">
        <ul className="entry-changes">
          <li>
            <span className="change-glyph" aria-hidden="true">
              ❝
            </span>
            <strong className="change-actor">You</strong>
            <span>commented</span>
          </li>
        </ul>
        {/* Said in words, so the dimming is not carrying it alone. */}
        <p className="entry-meta change-meta">just now · posting</p>
      </li>
    );
  }
  return (
    <li className="timeline-entry message pending">
      <div className="entry-heading">
        <span className={`actor-tile ${humanHue("You")}`} aria-hidden="true">
          {actorGlyph("human")}
        </span>
        <strong>You</strong>
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
