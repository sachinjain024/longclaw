import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readActiveProjectId,
  readProjectWorkspaces,
  rememberActiveProject,
  rememberProjectWorkspaces,
} from "./workspacePreferences";

describe("workspace preferences", () => {
  let held: Map<string, string>;

  beforeEach(() => {
    held = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => held.get(key) ?? null,
        setItem: (key: string, value: string) => held.set(key, value),
        removeItem: (key: string) => held.delete(key),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("round-trips the opaque active-project hint and workspace record", () => {
    rememberActiveProject("project-b");
    rememberProjectWorkspaces({
      "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
    });

    expect(readActiveProjectId()).toBe("project-b");
    expect(readProjectWorkspaces()).toEqual({
      "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
    });
  });

  it("keeps only fields whose values belong to the current vocabulary", () => {
    held.set(
      "longclaw.projectWorkspaces",
      JSON.stringify({
        good: { view: "board", ordering: "priority", filterQuery: "open" },
        stale: { view: "grid", ordering: "newest", filterQuery: 42 },
        partial: { view: "list", future: true },
        scalar: "manual",
      }),
    );

    expect(readProjectWorkspaces()).toEqual({
      good: { view: "board", ordering: "priority", filterQuery: "open" },
      partial: { view: "list" },
    });
  });

  it("migrates the legacy ordering record once and removes its stale key", () => {
    held.set(
      "longclaw.boardOrdering",
      JSON.stringify({ alpha: "manual", beta: "future" }),
    );

    expect(readProjectWorkspaces()).toEqual({
      alpha: { ordering: "manual" },
    });
    expect(held.has("longclaw.boardOrdering")).toBe(false);
    expect(JSON.parse(held.get("longclaw.projectWorkspaces")!)).toEqual({
      alpha: { ordering: "manual" },
    });
  });

  it("falls back safely when storage is malformed or unavailable", () => {
    held.set("longclaw.projectWorkspaces", "not json");
    expect(readProjectWorkspaces()).toEqual({});

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });
    expect(readActiveProjectId()).toBeUndefined();
    expect(readProjectWorkspaces()).toEqual({});
    expect(() => rememberActiveProject("project-a")).not.toThrow();
    expect(() => rememberProjectWorkspaces({})).not.toThrow();
  });

  /**
   * The shape above is a getter that throws. This is the other one, and the one
   * that actually happens: the global is defined and answers `undefined`, which
   * is what Node hands a process without `--localstorage-file` and what a host
   * with web storage switched off looks like. Every call was a `TypeError` into
   * the same catches as a refused write, which is how an entire environment's
   * silent no-op went unnoticed for a release (LC-161).
   */
  it("treats a host with no web storage as a session that cannot persist", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined,
    });

    expect(readActiveProjectId()).toBeUndefined();
    expect(readProjectWorkspaces()).toEqual({});
    expect(() => rememberActiveProject("project-a")).not.toThrow();
    expect(() =>
      rememberProjectWorkspaces({ alpha: { view: "list" } }),
    ).not.toThrow();
  });
});
