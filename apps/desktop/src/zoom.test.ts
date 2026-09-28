// @vitest-environment jsdom
/**
 * The chords, the menu and the relaunch (LC-258c). The seam is the two
 * commands and the one event that cross IPC — the level itself is Rust's
 * (`zoom.rs`), so a fake backend that walks a ladder is the whole fixture.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  readAppearance,
  readZoom,
  rememberZoom,
  resetDevicePreferences,
  restoreDevicePreferences,
} from "./devicePreferences";
import type { ZoomIntent } from "./api";
import { installZoom, restoreZoom, zoomIntent } from "./zoom";

vi.mock("./api", () => ({
  readPreferences: vi.fn(),
  writePreferences: vi.fn(),
  zoomApp: vi.fn(),
  restoreZoomLevel: vi.fn(),
  listenForZoomRequests: vi.fn(),
}));

/** Enough of the backend's ladder to tell one step from two. */
const LADDER = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
let level = 100;
let disk: Record<string, unknown> | undefined;
let menu: ((intent: ZoomIntent) => void) | undefined;
let uninstall: (() => void) | undefined;

function press(
  key: string,
  modifiers: KeyboardEventInit = { metaKey: true },
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

function chord(key: string, modifiers: KeyboardEventInit = { metaKey: true }) {
  return new KeyboardEvent("keydown", { key, ...modifiers });
}

beforeEach(() => {
  level = 100;
  disk = undefined;
  menu = undefined;
  resetDevicePreferences();
  vi.mocked(api.readPreferences).mockImplementation(async () => disk ?? {});
  vi.mocked(api.writePreferences).mockImplementation(async (document) => {
    disk = structuredClone(document);
  });
  vi.mocked(api.zoomApp).mockImplementation(async (intent) => {
    const at = LADDER.indexOf(level);
    if (intent === "reset") level = 100;
    if (intent === "in") level = LADDER[Math.min(at + 1, LADDER.length - 1)];
    if (intent === "out") level = LADDER[Math.max(at - 1, 0)];
    return level;
  });
  vi.mocked(api.restoreZoomLevel).mockImplementation(async (wanted) =>
    LADDER.includes(wanted) ? (level = wanted) : null,
  );
  vi.mocked(api.listenForZoomRequests).mockImplementation(async (handler) => {
    menu = handler;
    return () => {
      menu = undefined;
    };
  });
});

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("zoomIntent", () => {
  it("reads ⌘= as zoom in, since + is ⇧= on a US layout", () => {
    expect(zoomIntent(chord("="))).toBe("in");
  });

  it("reads ⌘+ as zoom in too, shifted or from a layout with its own + key", () => {
    expect(zoomIntent(chord("+", { metaKey: true, shiftKey: true }))).toBe(
      "in",
    );
    expect(zoomIntent(chord("+"))).toBe("in");
  });

  it("reads ⌘- as zoom out and ⌘0 as actual size", () => {
    expect(zoomIntent(chord("-"))).toBe("out");
    expect(zoomIntent(chord("0"))).toBe("reset");
  });

  it("reads ⌘0 by its key on a layout where 0 is shifted", () => {
    expect(zoomIntent(chord("à", { metaKey: true, code: "Digit0" }))).toBe(
      "reset",
    );
    expect(zoomIntent(chord("à", { code: "Digit0" }))).toBeUndefined();
  });

  it("takes Ctrl as it takes ⌘, as every chord in the app does", () => {
    expect(zoomIntent(chord("=", { ctrlKey: true }))).toBe("in");
    expect(zoomIntent(chord("-", { ctrlKey: true }))).toBe("out");
    expect(zoomIntent(chord("0", { ctrlKey: true }))).toBe("reset");
  });

  it("leaves the bare keys to whatever they type", () => {
    expect(zoomIntent(chord("=", {}))).toBeUndefined();
    expect(zoomIntent(chord("-", {}))).toBeUndefined();
    expect(zoomIntent(chord("0", {}))).toBeUndefined();
  });

  it("is not a project chord: ⌘1 stays LC-230's", () => {
    expect(zoomIntent(chord("1"))).toBeUndefined();
  });
});

describe("installZoom", () => {
  it("steps the app on each chord and remembers where it landed", async () => {
    uninstall = installZoom();

    expect(press("=").defaultPrevented).toBe(true);
    press("=");
    await vi.waitFor(() => expect(readZoom()).toBe(125));
    expect(api.zoomApp).toHaveBeenNthCalledWith(1, "in");

    press("-");
    await vi.waitFor(() => expect(readZoom()).toBe(110));
    await vi.waitFor(() => expect(disk).toMatchObject({ zoom: 110 }));
  });

  it("returns to actual size and records that as nothing chosen", async () => {
    uninstall = installZoom();
    press("=");
    await vi.waitFor(() => expect(disk).toMatchObject({ zoom: 110 }));

    press("0");

    await vi.waitFor(() => expect(readZoom()).toBeUndefined());
    await vi.waitFor(() => expect(disk).not.toHaveProperty("zoom"));
  });

  /** `⌘-` in the filter field is zoom, not a character. */
  it("zooms from inside a text field, and the field gets no keystroke", async () => {
    uninstall = installZoom();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();

    const event = press("-", { metaKey: true }, field);

    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(readZoom()).toBe(90));
  });

  /** Capture phase: a surface that stops its own keys cannot swallow zoom. */
  it("is not stopped by a surface that stops propagation", async () => {
    uninstall = installZoom();
    const editor = document.createElement("div");
    editor.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.append(editor);

    press("=", { metaKey: true }, editor);

    await vi.waitFor(() => expect(readZoom()).toBe(110));
  });

  it("leaves a press that is not a zoom chord alone", () => {
    uninstall = installZoom();

    expect(press("=", {}).defaultPrevented).toBe(false);
    expect(press("k").defaultPrevented).toBe(false);
    expect(api.zoomApp).not.toHaveBeenCalled();
  });

  /** The View menu sends the intent; the path from there is the chord's. */
  it("takes the View menu's request through the same path", async () => {
    uninstall = installZoom();
    await vi.waitFor(() => expect(menu).toBeDefined());

    menu!("in");
    menu!("in");

    await vi.waitFor(() => expect(readZoom()).toBe(125));
    expect(api.zoomApp).toHaveBeenCalledTimes(2);
  });

  it("stops listening when uninstalled", async () => {
    installZoom()();

    press("=");

    await vi.waitFor(() => expect(menu).toBeUndefined());
    expect(api.zoomApp).not.toHaveBeenCalled();
  });

  /** One press, one step: presses are sent in order, so the level
   *  remembered is the last one the backend answered with. */
  it("remembers the last press's level when presses overlap", async () => {
    uninstall = installZoom();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const walk = vi.mocked(api.zoomApp).getMockImplementation()!;
    vi.mocked(api.zoomApp).mockImplementationOnce(async (intent) => {
      await held;
      return walk(intent);
    });

    press("=");
    press("=");
    press("=");
    release();

    await vi.waitFor(() => expect(readZoom()).toBe(150));
    expect(level).toBe(150);
  });

  it("keeps the session working when the backend refuses", async () => {
    uninstall = installZoom();
    vi.mocked(api.zoomApp).mockRejectedValueOnce(new Error("no webview"));

    press("=");
    press("=");

    await vi.waitFor(() => expect(readZoom()).toBe(110));
  });
});

describe("restoreZoom", () => {
  it("puts back the level the last launch left", async () => {
    disk = { projectWorkspaces: {}, zoom: 150 };
    await restoreDevicePreferences();

    await restoreZoom();

    expect(api.restoreZoomLevel).toHaveBeenCalledWith(150);
    expect(level).toBe(150);
    expect(readZoom()).toBe(150);
  });

  it("asks nothing of a launch that never zoomed", async () => {
    await restoreDevicePreferences();

    await restoreZoom();

    expect(api.restoreZoomLevel).not.toHaveBeenCalled();
  });

  /** A level this build's ladder does not have is dropped, not carried. */
  it("drops a remembered level the backend does not recognise", async () => {
    disk = { projectWorkspaces: {}, zoom: 105 };
    await restoreDevicePreferences();

    await restoreZoom();

    expect(readZoom()).toBeUndefined();
    await vi.waitFor(() => expect(disk).not.toHaveProperty("zoom"));
    expect(level).toBe(100);
  });

  it("keeps the level when the host cannot answer, and does not throw", async () => {
    disk = { projectWorkspaces: {}, zoom: 150 };
    await restoreDevicePreferences();
    vi.mocked(api.restoreZoomLevel).mockRejectedValueOnce(new Error("no host"));

    await expect(restoreZoom()).resolves.toBeUndefined();
    expect(readZoom()).toBe(150);
  });
});

describe("the zoom preference", () => {
  it("is dropped on read when it is not a whole percentage", async () => {
    for (const zoom of ["150", 1.5, -100, 0, null, 99999]) {
      resetDevicePreferences();
      disk = { projectWorkspaces: {}, zoom };
      await restoreDevicePreferences();
      expect(readZoom()).toBeUndefined();
    }
  });

  /** Actual size is the default, and a default is not a decision. */
  it("writes nothing for actual size on a launch that chose nothing", async () => {
    rememberZoom(100);

    expect(readZoom()).toBeUndefined();
    expect(api.writePreferences).not.toHaveBeenCalled();
  });

  /** A document holding only a zoom is not an empty one, or the webview
   *  storage migration would replace it on the next launch. */
  it("counts as something restored", async () => {
    disk = { projectWorkspaces: {}, zoom: 125 };
    localStorage.setItem("longclaw.appearance", "dark");

    await restoreDevicePreferences();

    expect(readZoom()).toBe(125);
    expect(readAppearance()).toBeUndefined();
  });
});
