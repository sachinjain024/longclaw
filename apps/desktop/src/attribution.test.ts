import { describe, expect, it } from "vitest";
import {
  actorGlyph,
  actorName,
  eventProse,
  externalEditConflict,
  wearsAgentAccent,
} from "./attribution";
import type { ActivityEvent, TicketDetail } from "./types";

function event(actor: ActivityEvent["actor"]): ActivityEvent {
  return {
    id: "evt_1",
    kind: "update",
    occurredAt: "2026-07-29T09:12:31Z",
    actor,
    changes: [],
    body: "",
  };
}

function detail(activity: ActivityEvent[]): TicketDetail {
  return {
    key: "LC-1",
    relativePath: ".longclaw/tickets/LC-1/ticket.md",
    contentHash: "newer-hash",
    byteLength: 100,
    readOnly: false,
    raw: "",
    rawTruncated: false,
    missingAttachments: [],
    orphanAttachments: [],
    ticket: {
      id: "id",
      key: "LC-1",
      title: "T",
      status: "todo",
      priority: "p2",
      labels: [],
      createdAt: "2026-07-29T00:00:00Z",
      updatedAt: "2026-07-29T09:12:31Z",
      description: "",
      checklist: [],
      attachments: [],
      activity,
      historyIncomplete: false,
      unknownKeys: [],
      recordDiagnostics: [],
    },
  };
}

describe("presenting an actor", () => {
  it("names one only from the record", () => {
    expect(actorName(event({ type: "agent", name: "Claude Code" }))).toBe(
      "Claude Code",
    );
    expect(actorName(event({ type: "agent", id: "cursor" }))).toBe("cursor");
    expect(actorName(event({ type: "agent" }))).toBe("An agent");
    expect(actorName(event({ type: "unknown" }))).toBe("Unknown actor");
    expect(actorName(event({ type: "human", id: "local" }))).toBe("You");
  });

  it("gives an unattributed change the agent accent, and a person's none", () => {
    expect(wearsAgentAccent("agent")).toBe(true);
    expect(wearsAgentAccent("unknown")).toBe(true);
    expect(wearsAgentAccent("human")).toBe(false);
  });

  it("uses one glyph per actor kind everywhere", () => {
    expect(actorGlyph("agent")).toBe("❯");
    expect(actorGlyph("unknown")).toBe("⚠");
    expect(actorGlyph("human")).toBe("•");
  });

  it("drops the record's own heading and keeps the prose", () => {
    expect(
      eventProse("### Claude Code updated this ticket\n\nMoved it to review."),
    ).toBe("Moved it to review.");
    expect(eventProse("### You created this ticket")).toBe("");
    expect(eventProse("No heading at all")).toBe("No heading at all");
    expect(eventProse("### Lead\n\nBody\n\n#### Detail")).toBe(
      "Body\n\n#### Detail",
    );
  });
});

describe("the conflict raised when disk moves under an open draft", () => {
  it("names who changed the file, from the newest record", () => {
    const error = externalEditConflict(
      detail([
        event({ type: "human", id: "local" }),
        event({ type: "agent", id: "claude-code", name: "Claude Code" }),
      ]),
    );

    expect(error.code).toBe("conflict");
    expect(error.recoverable).toBe(true);
    expect(error.context).toMatchObject({
      ticketKey: "LC-1",
      actualHash: "newer-hash",
      conflictingActorType: "agent",
      conflictingActorName: "Claude Code",
    });
  });

  it("claims no actor when the file records none", () => {
    const error = externalEditConflict(detail([]));

    expect(error.context?.conflictingActorName).toBeUndefined();
    expect(error.context?.conflictingActorType).toBeUndefined();
    expect(error.context?.ticketKey).toBe("LC-1");
  });
});
