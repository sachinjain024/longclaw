/**
 * Every field a change can name, as the sentence it becomes.
 *
 * The first table is the enumeration V0-13's must-pass asks for: every `field`
 * value `TicketDocument::apply` can write (`core/ticket.rs:561-691`), including
 * the two dotted checklist paths and the `description` change that carries
 * neither a `from` nor a `to`. If `apply` grows a field, it belongs here — a
 * missing row shows up as a raw wire value on screen, which is the failure this
 * item exists to end.
 */

import { describe, expect, it } from "vitest";
import ipcContractJson from "../src-tauri/tests/fixtures/ipc-contract.json";
import {
  changeLines,
  describeChange,
  entryShape,
  sortActivity,
  unfamiliarKind,
} from "./timelineEvents";
import type { ActivityEvent, ActivityKind, FieldChange, Label } from "./types";

const LABELS: Record<string, Label> = {
  backend: { name: "backend", color: "blue" },
  infra: { name: "Infrastructure", color: "orange" },
};

const CONTEXT = {
  labels: LABELS,
  checklist: [
    { id: "ck_1", text: "Add the retry policy", checked: true },
    { id: "ck_2", text: "Add metrics", checked: false },
  ],
};

describe("every field apply() can write", () => {
  const fields: [string, FieldChange, string][] = [
    [
      "title",
      { field: "title", from: "Old name", to: "New name" },
      "renamed this to “New name”",
    ],
    [
      "status",
      { field: "status", from: "todo", to: "in_progress" },
      "moved this to In Progress",
    ],
    [
      "priority",
      { field: "priority", from: "none", to: "urgent" },
      "set priority to Urgent",
    ],
    [
      "labels, one added",
      { field: "labels", from: "", to: "backend" },
      "added backend label",
    ],
    [
      "labels, one removed",
      { field: "labels", from: "backend, infra", to: "backend" },
      "removed Infrastructure label",
    ],
    [
      "labels, both at once",
      { field: "labels", from: "infra", to: "backend" },
      "added backend, removed Infrastructure labels",
    ],
    [
      "labels, a slug the project does not define",
      { field: "labels", from: "", to: "spike" },
      "added spike label",
    ],
    ["rank, set", { field: "rank", to: "0|hzzzzz:" }, "reordered this by hand"],
    [
      "rank, cleared",
      { field: "rank", from: "0|hzzzzz:" },
      "cleared the manual order",
    ],
    [
      "archived_at, set",
      { field: "archived_at", to: "2026-08-01T12:00:00Z" },
      "archived this",
    ],
    [
      "archived_at, cleared",
      { field: "archived_at", from: "2026-08-01T12:00:00Z" },
      "unarchived this",
    ],
    // `apply` records a description change with no from and no to, because the
    // diff is not tracked. The expandable diff is deferred (`components.md:234-238`).
    ["description", { field: "description" }, "edited the description"],
    [
      "checklist.<id>.checked",
      { field: "checklist.ck_2.checked", from: "false", to: "true" },
      "checked “Add metrics”",
    ],
    [
      "checklist.<id>.checked, unticked",
      { field: "checklist.ck_1.checked", from: "true", to: "false" },
      "unchecked “Add the retry policy”",
    ],
    [
      "checklist.<id>.added",
      { field: "checklist.ck_9.added", to: "Write the migration" },
      "added “Write the migration” to the checklist",
    ],
    [
      "checklist.<id>.moved",
      { field: "checklist.ck_1.moved", from: "1", to: "2" },
      "moved “Add the retry policy”",
    ],
  ];

  it.each(fields)("says a %s change in words", (_name, change, sentence) => {
    expect(describeChange(change, CONTEXT).text).toBe(sentence);
  });

  it("never leaves a raw field path in a sentence it understands", () => {
    for (const [, change] of fields) {
      const line = describeChange(change, CONTEXT);
      // No code chip: that is reserved for a key with no sentence of its own.
      expect(line.code).toBeUndefined();
      // And no dotted path, which is the shape a checklist field arrives in.
      expect(line.text).not.toMatch(/\w+\.\w+/);
      // Nor a wire enum value, which is what `status todo → in_review` was.
      expect(line.text).not.toMatch(/\b\w+_\w+\b/);
    }
  });

  it("carries the app's own glyph for the fields that have one", () => {
    expect(
      describeChange({ field: "status", to: "done" }, CONTEXT).glyph,
    ).toEqual({
      kind: "status",
      status: "done",
    });
    expect(
      describeChange({ field: "priority", to: "p1" }, CONTEXT).glyph,
    ).toEqual({
      kind: "priority",
      priority: "p1",
    });
    expect(
      describeChange({ field: "labels", to: "infra" }, CONTEXT).glyph,
    ).toEqual({
      kind: "label",
      color: "orange",
    });
  });

  it("falls back to a plain glyph for a value outside the enum", () => {
    // A newer writer's status is preserved on disk; the dot has no colour for
    // it, so the line keeps the value rather than mislabelling it.
    const line = describeChange({
      field: "status",
      from: "todo",
      to: "triaged",
    });
    expect(line.glyph).toEqual({ kind: "char", value: "•" });
    expect(line.code).toBe("status");
    expect(line.text).toBe("changed from “todo” to “triaged”");
  });

  it("names a checklist item the ticket no longer carries without guessing", () => {
    const line = describeChange(
      { field: "checklist.ck_gone.checked", from: "false", to: "true" },
      CONTEXT,
    );
    expect(line.text).toBe("checked a checklist item");
  });
});

/**
 * The other half of the enumeration, and the half that cannot go stale.
 *
 * `core::ticket::tests::json_contract_applied_field_changes` applies an edit
 * touching every field and asserts the serialized result equals this fixture.
 * So a field added to `apply` lands here, and lands here as a failure: the
 * frontend has to be given a sentence for it before the gate goes green again.
 */
describe("the fields Rust actually emits", () => {
  const emitted = (ipcContractJson as { appliedFieldChanges: FieldChange[] })
    .appliedFieldChanges;

  it("has a sentence for every one of them, with no path left on screen", () => {
    expect(emitted.length).toBeGreaterThan(0);
    for (const change of emitted) {
      const line = describeChange(change, CONTEXT);
      expect(
        line.code,
        `${change.field} fell through to its raw path`,
      ).toBeUndefined();
      expect(line.text).not.toBe("");
    }
  });
});

describe("a field this build does not interpret", () => {
  it("keeps the path, because it is the only true thing about it", () => {
    const line = describeChange({
      field: "x_extension.owner",
      from: "alice",
      to: "bob",
    });
    expect(line.code).toBe("x_extension.owner");
    expect(line.text).toBe("changed from “alice” to “bob”");
  });

  it.each([
    [{ field: "x_new" }, "changed"],
    [{ field: "x_new", to: "yes" }, "set to “yes”"],
    [{ field: "x_new", from: "yes" }, "cleared, was “yes”"],
  ])("reads %o as a sentence", (change, sentence) => {
    expect(describeChange(change).text).toBe(sentence);
  });
});

function event(over: Partial<ActivityEvent> & { kind: ActivityKind }) {
  return {
    id: "evt_1",
    occurredAt: "2026-08-01T11:00:00Z",
    actor: { type: "human" as const, id: "local" },
    changes: [],
    body: "",
    ...over,
  };
}

describe("what shape a kind takes", () => {
  it.each([
    ["comment", "message"],
    ["create", "change"],
    ["update", "change"],
    ["external_change", "change"],
    // The open tail of `ActivityKind`. A message shows the most, so an
    // uninterpretable record still puts everything its author wrote on screen.
    ["deployed", "message"],
    ["", "message"],
  ])("renders %s as a %s", (kind, shape) => {
    expect(entryShape(kind)).toBe(shape);
  });

  it.each([
    ["comment", undefined],
    ["create", undefined],
    ["update", undefined],
    ["external_change", undefined],
    ["deployed", "deployed"],
  ])("names %s as unfamiliar: %s", (kind, named) => {
    expect(unfamiliarKind(kind)).toBe(named);
  });
});

describe("what a record says when it records nothing", () => {
  it("gives a create its own line", () => {
    expect(changeLines(event({ kind: "create" }))).toEqual([
      { glyph: { kind: "char", value: "✦" }, text: "created this ticket" },
    ]);
  });

  it("gives an update with no changes something to say", () => {
    expect(changeLines(event({ kind: "update" }))[0].text).toBe(
      "updated this ticket",
    );
  });

  it("leads an unclaimed external change with the warn line", () => {
    const lines = changeLines(
      event({
        kind: "external_change",
        actor: { type: "unknown" },
        changes: [{ field: "title", to: "Renamed in an editor" }],
      }),
    );
    expect(lines[0]).toEqual({
      glyph: { kind: "char", value: "⚠" },
      text: "file changed on disk — actor unknown",
      warn: true,
    });
    expect(lines[1].text).toBe("renamed this to “Renamed in an editor”");
  });

  it("does not add the warn line when the file did name an actor", () => {
    const lines = changeLines(
      event({
        kind: "external_change",
        actor: { type: "agent", name: "Claude Code" },
        changes: [{ field: "description" }],
      }),
    );
    expect(lines.map((line) => line.text)).toEqual(["edited the description"]);
  });
});

describe("the order of the stream", () => {
  it("sorts by occurredAt, with id as the deterministic tie-break", () => {
    const sorted = sortActivity([
      event({
        id: "evt_z",
        kind: "comment",
        occurredAt: "2026-08-01T11:00:00Z",
      }),
      event({
        id: "evt_b",
        kind: "comment",
        occurredAt: "2026-08-01T10:00:00Z",
      }),
      event({
        id: "evt_a",
        kind: "comment",
        occurredAt: "2026-08-01T10:00:00Z",
      }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual([
      "evt_a",
      "evt_b",
      "evt_z",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const events = [
      event({
        id: "evt_z",
        kind: "comment",
        occurredAt: "2026-08-01T11:00:00Z",
      }),
      event({
        id: "evt_a",
        kind: "comment",
        occurredAt: "2026-08-01T10:00:00Z",
      }),
    ];
    sortActivity(events);
    expect(events.map((entry) => entry.id)).toEqual(["evt_z", "evt_a"]);
  });
});
