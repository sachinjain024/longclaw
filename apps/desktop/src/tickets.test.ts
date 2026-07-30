import { describe, expect, it } from "vitest";
import { STATUSES, checklistFromLines } from "./tickets";

describe("typed checklist input", () => {
  it("takes one item per line and drops the empty ones", () => {
    expect(
      checklistFromLines("Parse the file\n\n  Render the row  \n"),
    ).toEqual(["Parse the file", "Render the row"]);
  });

  it("accepts a pasted Markdown task list", () => {
    expect(checklistFromLines("- [ ] First\n- [x] Second\n* Third")).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("returns nothing for text with no items", () => {
    expect(checklistFromLines("   \n\n")).toEqual([]);
  });
});

describe("status vocabulary", () => {
  it("matches the fixed v0 set in board order", () => {
    expect(STATUSES.map((status) => status.id)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "canceled",
    ]);
  });
});
