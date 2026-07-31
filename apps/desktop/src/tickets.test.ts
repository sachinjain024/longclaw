import { describe, expect, it } from "vitest";
import { STATUSES } from "./tickets";

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
