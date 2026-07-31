import { describe, expect, it } from "vitest";
import {
  FRESH_WINDOW_MS,
  acknowledgement,
  describeAge,
  externalMark,
  freshlyChecked,
  isFresh,
  pruneMarks,
} from "./freshness";
import type { Actor, ChecklistItem } from "./types";

const AT = 1_800_000_000_000;

/**
 * The actor Rust attributed to an observed change. `undefined` is the shape of
 * "this change appended no record", which is what a hand edit in an editor looks
 * like — and the case the mark must not fill in.
 */
function attributed(type: Actor["type"], name?: string): Actor {
  return { type, name };
}

describe("acknowledging an external change", () => {
  it("names the agent the file said made the change", () => {
    const mark = externalMark(attributed("agent", "Claude Code"), AT);

    expect(mark).toEqual({
      actorType: "agent",
      actorLabel: "Claude Code",
      at: AT,
    });
    expect(acknowledgement(mark, AT + 12_000)).toBe(
      "❯ updated by Claude Code · 12s · via file edit",
    );
  });

  it("never invents attribution for a change that carries none", () => {
    const unattributed = externalMark(undefined, AT);
    const unknown = externalMark(attributed("unknown"), AT);

    expect(unattributed).toMatchObject({ actorType: "unknown" });
    expect(unknown).toMatchObject({ actorType: "unknown" });
    expect(acknowledgement(unattributed, AT)).toBe(
      "⚠ file changed on disk — actor unknown",
    );
  });

  it("keeps a human file edit out of the agent treatment", () => {
    const mark = externalMark(attributed("human"), AT);

    expect(mark).toMatchObject({ actorType: "human" });
    expect(acknowledgement(mark, AT + 3_000)).toBe(
      "• changed on disk · 3s · via file edit",
    );
  });

  it("acknowledges a file it cannot read without claiming who wrote it", () => {
    // A file this build cannot parse has no records to attribute from, so Rust
    // sends no attribution at all.
    const mark = externalMark(undefined, AT);

    expect(mark).toMatchObject({ actorType: "unknown" });
  });

  it("decays two minutes after the last write, and never before", () => {
    const mark = externalMark(attributed("agent", "Claude Code"), AT);

    expect(isFresh(mark, AT + FRESH_WINDOW_MS - 1)).toBe(true);
    expect(isFresh(mark, AT + FRESH_WINDOW_MS)).toBe(false);
  });

  it("drops decayed marks so the board stops paying for them", () => {
    const marks = {
      "LC-1": externalMark(attributed("agent", "Claude Code"), AT),
      "LC-2": externalMark(attributed("agent", "Claude Code"), AT - 200_000),
    };

    expect(Object.keys(pruneMarks(marks, AT))).toEqual(["LC-1"]);

    // A map with nothing to drop comes back as the same object, so a periodic
    // sweep does not re-render the board for no reason.
    const stillFresh = { "LC-1": marks["LC-1"] };
    expect(pruneMarks(stillFresh, AT)).toBe(stillFresh);
  });

  it("reads ages the way the timeline does", () => {
    expect(describeAge(AT, AT + 400)).toBe("just now");
    expect(describeAge(AT, AT + 12_000)).toBe("12s");
    expect(describeAge(AT, AT + 185_000)).toBe("3m");
    expect(describeAge(AT, AT + 7_400_000)).toBe("2h");
    // A clock that moved backwards must not print a negative age.
    expect(describeAge(AT, AT - 5_000)).toBe("just now");
  });
});

describe("checklist items an external write just checked", () => {
  const before: ChecklistItem[] = [
    { id: "ck_1", text: "Parse metadata", checked: true },
    { id: "ck_2", text: "Render the ticket", checked: false },
    { id: "ck_3", text: "Ship it", checked: false },
  ];

  it("reports only the items that flipped to checked", () => {
    const after: ChecklistItem[] = [
      { id: "ck_1", text: "Parse metadata", checked: true },
      { id: "ck_2", text: "Render the ticket", checked: true },
      { id: "ck_3", text: "Ship it", checked: false },
    ];

    expect(freshlyChecked(before, after)).toEqual(["ck_2"]);
  });

  it("ignores unchecking, new items, and items with no id", () => {
    const after: ChecklistItem[] = [
      { id: "ck_1", text: "Parse metadata", checked: false },
      { id: "ck_2", text: "Render the ticket", checked: false },
      { id: "ck_3", text: "Ship it", checked: false },
      { text: "Appended by an agent", checked: true },
    ];

    expect(freshlyChecked(before, after)).toEqual([]);
  });
});
