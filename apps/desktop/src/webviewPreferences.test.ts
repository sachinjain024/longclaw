import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { webviewPreferences } from "./webviewPreferences";

/**
 * The bridge off webview storage (LC-150). What is asserted here is only that
 * the old keys are read into the shape the file has — the vocabulary is checked
 * where the document is adopted (`devicePreferences.test.ts`), because a
 * document from storage and a document from disk are equally untrusted and one
 * validator is one place to state what this build knows.
 */
describe("what the last build left in webview storage", () => {
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

  it("reads the three keys the app used to write", () => {
    held.set("longclaw.appearance", "light");
    held.set("longclaw.activeProject", "project-b");
    held.set(
      "longclaw.projectWorkspaces",
      JSON.stringify({
        "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
      }),
    );

    expect(webviewPreferences()).toEqual({
      appearance: "light",
      activeProjectId: "project-b",
      projectWorkspaces: {
        "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
      },
    });
  });

  /**
   * Before LC-49 ordering was a key of its own, and that migration never
   * reached a file. A board left on Manual two schemas ago crosses both steps
   * in one read, and a project whose workspace already states an ordering keeps
   * the one it states.
   */
  it("folds the ordering key two schemas ago into the workspace record", () => {
    held.set(
      "longclaw.projectWorkspaces",
      JSON.stringify({ beta: { view: "list", ordering: "priority" } }),
    );
    held.set(
      "longclaw.boardOrdering",
      JSON.stringify({ alpha: "manual", beta: "manual" }),
    );

    expect(webviewPreferences()).toEqual({
      projectWorkspaces: {
        alpha: { ordering: "manual" },
        beta: { view: "list", ordering: "priority" },
      },
    });
  });

  it("reads nothing from a store that is empty or malformed", () => {
    expect(webviewPreferences()).toEqual({});

    held.set("longclaw.projectWorkspaces", "not json");
    expect(webviewPreferences()).toEqual({});
  });

  it("reads nothing from a store that refuses", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });

    expect(webviewPreferences()).toEqual({});
  });

  /**
   * The shape above is a getter that throws. This is the other one, and the one
   * that actually happens: the global is defined and answers `undefined`, which
   * is what Node hands a process without `--localstorage-file` and what a host
   * with web storage switched off looks like. Every call was a `TypeError` into
   * the same catches as a refused write, which is how an entire environment's
   * silent no-op went unnoticed for a release (LC-161).
   */
  it("treats a host with no web storage as a host that kept nothing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined,
    });

    expect(webviewPreferences()).toEqual({});
  });
});
