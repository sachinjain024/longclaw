/**
 * The claim these cover is the one LC-150 and LC-151 are about: a choice made in
 * one process is the choice the next process comes up with. The seam is the
 * document that crosses IPC, so a fake backend that keeps it is the whole
 * fixture — and a relaunch is this module forgetting what it holds and reading
 * that document again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  readActiveProjectId,
  readAppearance,
  readProjectWorkspaces,
  rememberActiveProject,
  rememberAppearance,
  rememberProjectWorkspaces,
  resetDevicePreferences,
  restoreDevicePreferences,
} from "./devicePreferences";
import { useLongClawStore } from "./state";

vi.mock("./api", () => ({
  readPreferences: vi.fn(),
  writePreferences: vi.fn(),
}));

/** The file, as far as this suite is concerned. */
let disk: Record<string, unknown> | undefined;

/** What a relaunch is: nothing held, and the same document on disk. */
async function relaunch() {
  resetDevicePreferences();
  await restoreDevicePreferences();
}

/**
 * Waits for the fire-and-forget writes to land. What settles them is the
 * document reaching disk, not the first call: a burst sends one write and then
 * one more when it settles, so a test that waited for a call could read the
 * first of the two.
 */
async function landed(document: Record<string, unknown>) {
  await vi.waitFor(() => expect(disk).toEqual(document));
}

beforeEach(() => {
  disk = undefined;
  resetDevicePreferences();
  useLongClawStore.setState({ appearance: "system" });
  vi.mocked(api.readPreferences).mockImplementation(async () => disk ?? {});
  vi.mocked(api.writePreferences).mockImplementation(async (document) => {
    disk = document;
  });
});

afterEach(() => {
  vi.clearAllMocks();
  useLongClawStore.setState({ appearance: "system" });
});

describe("what one process chose, the next process comes up with", () => {
  it("carries the appearance, the open project and every workspace across", async () => {
    await restoreDevicePreferences();
    rememberAppearance("light");
    rememberActiveProject("project-b");
    rememberProjectWorkspaces({
      "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
    });
    await landed({
      appearance: "light",
      activeProjectId: "project-b",
      projectWorkspaces: {
        "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
      },
    });

    await relaunch();

    expect(readAppearance()).toBe("light");
    expect(readActiveProjectId()).toBe("project-b");
    expect(readProjectWorkspaces()).toEqual({
      "project-b": { view: "list", ordering: "manual", filterQuery: "mine" },
    });
  });

  /**
   * The appearance is the one value the store has to be holding before the
   * first render: `App` stamps the root from it, and an effect that put it
   * there would be a paint late and would record the launch default over what
   * was just read — which is the loss LC-150 reported.
   */
  it("puts the appearance back in the store before anything renders", async () => {
    disk = { appearance: "dark" };

    await restoreDevicePreferences();

    expect(useLongClawStore.getState().appearance).toBe("dark");
  });

  it("leaves the store alone when nothing was ever chosen", async () => {
    await restoreDevicePreferences();

    expect(useLongClawStore.getState().appearance).toBe("system");
    expect(readActiveProjectId()).toBeUndefined();
    expect(readProjectWorkspaces()).toEqual({});
  });
});

describe("a document is untrusted, wherever it came from", () => {
  it("keeps only fields whose values belong to the current vocabulary", async () => {
    disk = {
      appearance: "sepia",
      activeProjectId: 42,
      projectWorkspaces: {
        good: { view: "board", ordering: "priority", filterQuery: "open" },
        stale: { view: "grid", ordering: "newest", filterQuery: 42 },
        partial: { view: "list", future: true },
        scalar: "manual",
      },
    };

    await restoreDevicePreferences();

    expect(readAppearance()).toBeUndefined();
    expect(readActiveProjectId()).toBeUndefined();
    expect(readProjectWorkspaces()).toEqual({
      good: { view: "board", ordering: "priority", filterQuery: "open" },
      partial: { view: "list" },
    });
  });

  it("treats a document that is not an object as no document at all", async () => {
    vi.mocked(api.readPreferences).mockResolvedValue([
      "light",
    ] as unknown as Record<string, unknown>);

    await restoreDevicePreferences();

    expect(readProjectWorkspaces()).toEqual({});
  });

  /**
   * A host that answers no commands — a browser tab, a harness with no backend
   * — is a session that cannot restore and can still record. It is what webview
   * storage did on a host without it, and the one behaviour worth keeping.
   */
  it("degrades to a session that cannot persist when the host has no backend", async () => {
    vi.mocked(api.readPreferences).mockRejectedValue(new Error("no backend"));
    vi.mocked(api.writePreferences).mockRejectedValue(new Error("no backend"));

    await restoreDevicePreferences();
    expect(readAppearance()).toBeUndefined();

    expect(() => rememberAppearance("dark")).not.toThrow();
    expect(readAppearance()).toBe("dark");
    await vi.waitFor(() => expect(api.writePreferences).toHaveBeenCalled());
  });
});

describe("the choices the last build left in webview storage", () => {
  it("adopts them once and writes them where they will survive", async () => {
    localStorage.setItem("longclaw.appearance", "light");
    localStorage.setItem("longclaw.activeProject", "project-b");
    localStorage.setItem(
      "longclaw.projectWorkspaces",
      JSON.stringify({ "project-b": { view: "list" } }),
    );
    // Two schemas ago ordering was its own key, and that migration never
    // reached a file — so it is still carried, in one step.
    localStorage.setItem(
      "longclaw.boardOrdering",
      JSON.stringify({ "project-a": "manual", "project-b": "manual" }),
    );

    await restoreDevicePreferences();
    await landed({
      appearance: "light",
      activeProjectId: "project-b",
      projectWorkspaces: {
        "project-a": { ordering: "manual" },
        "project-b": { view: "list", ordering: "manual" },
      },
    });
    localStorage.clear();
    await relaunch();

    expect(readAppearance()).toBe("light");
    expect(readActiveProjectId()).toBe("project-b");
    expect(readProjectWorkspaces()).toEqual({
      "project-a": { ordering: "manual" },
      "project-b": { view: "list", ordering: "manual" },
    });
  });

  it("never overwrites what is already on disk", async () => {
    disk = { appearance: "dark" };
    localStorage.setItem("longclaw.appearance", "light");

    await restoreDevicePreferences();

    expect(readAppearance()).toBe("dark");
    expect(api.writePreferences).not.toHaveBeenCalled();
  });

  /**
   * A document can be empty because somebody emptied it: deleting the file is
   * the supported way to start over, and the user guide says so. A migration
   * that ran on every empty document would hand the old choices back on the
   * next launch, which is a reset that does not stay reset.
   */
  it("consumes the old keys, so starting over stays started over", async () => {
    localStorage.setItem("longclaw.appearance", "light");
    localStorage.setItem("longclaw.activeProject", "project-b");

    await restoreDevicePreferences();
    await landed({
      appearance: "light",
      activeProjectId: "project-b",
      projectWorkspaces: {},
    });
    expect(localStorage.getItem("longclaw.appearance")).toBeNull();
    expect(localStorage.getItem("longclaw.activeProject")).toBeNull();

    // The whole file, deleted, the way the user guide describes.
    disk = undefined;
    await relaunch();

    expect(readAppearance()).toBeUndefined();
    expect(readActiveProjectId()).toBeUndefined();
  });

  /**
   * The other half of that: keys are consumed only once what they held is
   * somewhere else. A host that refuses the write must not also be a host that
   * empties the only copy.
   */
  it("keeps them where the write they were carried into was refused", async () => {
    vi.mocked(api.writePreferences).mockRejectedValue(new Error("no backend"));
    localStorage.setItem("longclaw.appearance", "light");

    await restoreDevicePreferences();

    expect(api.writePreferences).toHaveBeenCalled();
    expect(localStorage.getItem("longclaw.appearance")).toBe("light");
  });
});

describe("writes", () => {
  it("says nothing to the backend when the choice has not changed", async () => {
    disk = { appearance: "light", activeProjectId: "project-a" };
    await restoreDevicePreferences();

    rememberAppearance("light");
    rememberActiveProject("project-a");
    rememberProjectWorkspaces(readProjectWorkspaces());

    expect(api.writePreferences).not.toHaveBeenCalled();
  });

  /**
   * A burst — the filter changes on every keystroke — sends one write and then
   * one more with whatever the burst settled on, rather than a write per
   * change. What must not happen is the last change being the one that is
   * dropped, since it is the one the human just made.
   */
  it("coalesces a burst without losing the change that ended it", async () => {
    await restoreDevicePreferences();

    rememberProjectWorkspaces({ alpha: { filterQuery: "a" } });
    rememberProjectWorkspaces({ alpha: { filterQuery: "ab" } });
    rememberProjectWorkspaces({ alpha: { filterQuery: "abc" } });

    await vi.waitFor(() =>
      expect(disk?.projectWorkspaces).toEqual({
        alpha: { filterQuery: "abc" },
      }),
    );
    expect(vi.mocked(api.writePreferences).mock.calls.length).toBeLessThan(3);
  });
});
