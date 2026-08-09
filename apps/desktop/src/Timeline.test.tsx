// @vitest-environment jsdom

/**
 * Every event kind, on screen.
 *
 * The must-pass V0-13 has to satisfy is that *each* kind renders with the right
 * actor treatment and the right provenance — so this file is organised by kind
 * rather than by feature, and the unknown kind is a case here rather than an
 * afterthought. `timelineEvents.test.ts` holds the sentence for every field;
 * this one holds what reaches the DOM.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Timeline } from "./Timeline";
import type {
  ActivityEvent,
  ActivityKind,
  ChecklistItem,
  Label,
} from "./types";

afterEach(cleanup);

const NOW = Date.parse("2026-08-01T12:00:00Z");

const LABELS: Record<string, Label> = {
  backend: { name: "backend", color: "blue" },
  infra: { name: "Infrastructure", color: "orange" },
};

const CHECKLIST: ChecklistItem[] = [
  { id: "ck_1", text: "Add the retry policy", checked: true },
  { id: "ck_2", text: "Add metrics", checked: false },
];

function event(over: Partial<ActivityEvent> & { kind: ActivityKind }) {
  return {
    id: "evt_1",
    occurredAt: "2026-08-01T11:59:00Z",
    actor: { type: "human" as const, id: "local" },
    changes: [],
    body: "",
    ...over,
  };
}

const AGENT = {
  type: "agent" as const,
  id: "claude-code",
  name: "Claude Code",
};

function draw(events: ActivityEvent[], pendingComment?: string) {
  return render(
    <Timeline
      events={events}
      now={NOW}
      labels={LABELS}
      checklist={CHECKLIST}
      pendingComment={pendingComment}
    />,
  );
}

/** The one entry on screen, whatever shape it took. */
function entry() {
  const found = document.querySelector(".timeline > li");
  if (!found) throw new Error("no timeline entry rendered");
  return found;
}

describe("a comment", () => {
  it("renders a human's as a plain entry, with no rail and no provenance", () => {
    draw([
      event({
        kind: "comment",
        body: "### You commented\n\nStarting on this.",
      }),
    ]);

    expect(entry().className).not.toContain("agent");
    expect(screen.getByText("You")).toBeTruthy();
    expect(entry().textContent).toContain("Starting on this.");
    // The record's own heading is the author's, never the app's own claim.
    expect(entry().textContent).not.toContain("### You commented");
    expect(entry().textContent).not.toContain("AGENT");
    expect(entry().textContent).not.toContain("via file edit");
  });

  it("renders an agent's with the rail, the badge and the provenance", () => {
    draw([
      event({
        kind: "comment",
        actor: AGENT,
        body: "### Claude Code commented\n\nRetries land in `worker.rs`.",
      }),
    ]);

    expect(entry().className).toContain("agent");
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("AGENT")).toBeTruthy();
    expect(entry().textContent).toContain("via file edit");
  });

  it("renders the body as markdown, because the body is agent-written", () => {
    draw([
      event({
        kind: "comment",
        actor: AGENT,
        body: "### note\n\n1. Read the log\n2. Retry\n\n> permission denied",
      }),
    ]);

    // V0-13 extended the subset for exactly this: an agent's numbered steps
    // were showing as literal `1.` text.
    expect(
      document.querySelectorAll(".timeline ol.markdown-list"),
    ).toHaveLength(1);
    expect(document.querySelectorAll(".timeline blockquote")).toHaveLength(1);
    expect(entry().textContent).toContain("permission denied");
  });
});

describe("a create", () => {
  it("says the ticket was created, in its actor's voice", () => {
    draw([event({ kind: "create", actor: AGENT })]);

    expect(entry().className).toContain("agent");
    expect(entry().textContent).toContain("Claude Code");
    expect(entry().textContent).toContain("created this ticket");
    expect(entry().textContent).toContain("via file edit");
  });
});

describe("an update", () => {
  it("renders one sentence per change, never a field path", () => {
    draw([
      event({
        kind: "update",
        actor: AGENT,
        changes: [
          { field: "status", from: "todo", to: "in_review" },
          { field: "checklist.ck_1.checked", from: "false", to: "true" },
          { field: "description" },
        ],
      }),
    ]);

    const text = entry().textContent ?? "";
    expect(text).toContain("moved this to In Review");
    expect(text).toContain("checked “Add the retry policy”");
    expect(text).toContain("edited the description");
    expect(text).not.toContain("checklist.ck_1.checked");
    expect(text).not.toContain("in_review");
    // The actor is named once, on the first line, in its own accent.
    expect(document.querySelectorAll(".change-actor")).toHaveLength(1);
  });

  it("carries the app's own glyph vocabulary rather than re-describing it", () => {
    draw([
      event({
        kind: "update",
        changes: [
          { field: "status", from: "todo", to: "done" },
          { field: "priority", from: "p3", to: "urgent" },
        ],
      }),
    ]);

    expect(
      document.querySelector(".timeline .status-dot.status-done"),
    ).toBeTruthy();
    expect(document.querySelector(".timeline .priority-glyph")).toBeTruthy();
  });

  it("shows a note written alongside the change", () => {
    draw([
      event({
        kind: "update",
        changes: [{ field: "status", from: "todo", to: "done" }],
        body: "### You updated this ticket\n\nShipped behind the flag.",
      }),
    ]);

    expect(entry().textContent).toContain("moved this to Done");
    expect(entry().textContent).toContain("Shipped behind the flag.");
  });

  it("still says something when a writer recorded no changes at all", () => {
    draw([event({ kind: "update", actor: AGENT })]);

    expect(entry().textContent).toContain("updated this ticket");
  });

  it("carries the badge on a change the same way a comment does", () => {
    draw([
      event({
        kind: "update",
        actor: AGENT,
        changes: [
          { field: "status", from: "todo", to: "done" },
          { field: "priority", from: "p3", to: "urgent" },
        ],
      }),
    ]);

    // `states.md:169` asks for the badge on every external mutation, and it is
    // the only channel that says *agent* in words: the rail and the accent name
    // are colour, and the name itself is a name, not a role.
    expect(screen.getAllByText("AGENT")).toHaveLength(1);
    // Still one line per change — the badge rides the first line beside the
    // actor, so `components.md:234-238`'s compact shape is intact.
    expect(document.querySelectorAll(".entry-changes > li")).toHaveLength(2);
    expect(document.querySelector(".actor-tile")).toBeNull();
  });

  it("gives a human's own change no badge and no provenance", () => {
    draw([
      event({
        kind: "update",
        changes: [{ field: "status", from: "todo", to: "done" }],
      }),
    ]);

    expect(entry().textContent).not.toContain("AGENT");
    expect(entry().textContent).not.toContain("via file edit");
  });
});

describe("an external change", () => {
  it("says the file changed and that no record claims it", () => {
    draw([
      event({
        kind: "external_change",
        actor: { type: "unknown" },
        changes: [{ field: "title", from: "Old", to: "New" }],
      }),
    ]);

    expect(entry().className).toContain("unattributed");
    // The warn glyph is never the only channel: the copy says it in words.
    expect(entry().textContent).toContain(
      "file changed on disk — actor unknown",
    );
    expect(entry().textContent).toContain("renamed this to “New”");
    // Unclaimed is not unprovenanced: the file is still the only place it can
    // have come from, and the meta has to keep saying so.
    expect(entry().textContent).toContain("via file edit");
    // An unattributed change is not an agent's.
    expect(entry().textContent).not.toContain("AGENT");
  });

  it("keeps the provenance even for an actor the file did name", () => {
    draw([event({ kind: "external_change", actor: AGENT })]);

    expect(entry().className).toContain("agent");
    expect(entry().textContent).toContain("via file edit");
    expect(entry().textContent).not.toContain("actor unknown");
    expect(screen.getByText("AGENT")).toBeTruthy();
  });

  it("keeps the provenance when the human's own editor wrote the file", () => {
    draw([
      event({
        kind: "external_change",
        changes: [{ field: "status", from: "todo", to: "done" }],
      }),
    ]);

    // The local human editing `ticket.md` in vim is not the app writing it, and
    // the entry says which one it was. Nothing else marks it: no rail, no
    // badge, no warn.
    expect(entry().className).not.toContain("agent");
    expect(entry().className).not.toContain("unattributed");
    expect(entry().textContent).toContain("via file edit");
    expect(entry().textContent).not.toContain("AGENT");
    expect(entry().textContent).not.toContain("actor unknown");
  });
});

describe("a kind this build does not know", () => {
  it("renders it legibly and says what it was recorded as", () => {
    draw([
      event({
        kind: "deployed",
        actor: AGENT,
        body: "### Claude Code deployed this\n\nRolled out to staging.",
      }),
    ]);

    // Nothing swallowed: the actor, the badge, the provenance and the whole
    // body are all on screen.
    expect(entry().className).toContain("agent");
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("AGENT")).toBeTruthy();
    expect(entry().textContent).toContain("Rolled out to staging.");
    expect(entry().textContent).toContain("via file edit");
    // And the app does not pretend it understood the kind.
    expect(entry().textContent).toContain("recorded as “deployed”");
  });

  it("does not claim a kind it does know", () => {
    draw([event({ kind: "comment", body: "hi" })]);
    expect(entry().textContent).not.toContain("recorded as");
  });
});

describe("the order of the stream", () => {
  it("sorts by time, with the id as the tie-break", () => {
    draw([
      event({
        id: "evt_c",
        kind: "comment",
        occurredAt: "2026-08-01T11:00:00Z",
        body: "third",
      }),
      event({
        id: "evt_b",
        kind: "comment",
        occurredAt: "2026-08-01T10:00:00Z",
        body: "second",
      }),
      event({
        id: "evt_a",
        kind: "comment",
        occurredAt: "2026-08-01T10:00:00Z",
        body: "first",
      }),
    ]);

    const bodies = [...document.querySelectorAll(".timeline > li")].map(
      (node) => node.textContent,
    );
    expect(bodies[0]).toContain("first");
    expect(bodies[1]).toContain("second");
    expect(bodies[2]).toContain("third");
  });
});

describe("a comment that has not reached the disk yet", () => {
  it("appears at the end of the stream, marked as still posting", () => {
    draw(
      [event({ kind: "comment", body: "### You commented\n\nposted" })],
      "typed just now",
    );

    const entries = document.querySelectorAll(".timeline > li");
    expect(entries).toHaveLength(2);
    expect(entries[1].className).toContain("pending");
    expect(entries[1].textContent).toContain("typed just now");
    // Said in words, not by the dimming alone.
    expect(entries[1].textContent).toContain("posting");
  });
});
