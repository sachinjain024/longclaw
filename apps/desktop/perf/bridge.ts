/**
 * The seam between the harness page and the Playwright driver.
 *
 * Everything the driver needs to do — land an external write, read back what the
 * app said it painted — goes through this object on `window`, so the driver never
 * reaches into React or the store.
 */

import type { StreamEnvelope, VisibleUiProbe } from "../src/types";

/**
 * One firing of the app's own `reportVisibleUi` probe (`lib.rs:213`), which runs
 * on an animation frame and reports what is actually on screen. The harness keeps
 * them so a measured paint can be checked against the rows the app claims.
 */
export interface ProbeRecord {
  at: number;
  probe: VisibleUiProbe;
}

export interface PerfBridge {
  /** Resolves once the first snapshot has been applied. */
  loaded: Promise<void>;
  /** Delivers a project event the way the Tauri listener would. */
  emit: (envelope: StreamEnvelope) => void;
  /**
   * Holds every later write open for `ms` before it lands, from now until it is
   * set back to 0.
   *
   * `?slow=N` does the same for a whole run, which is right for looking at the
   * screen a write is on but wrong for a probe that needs one *step* to be slow:
   * `checklist-probe` types two items through a single round trip, and a run
   * that was slow throughout would spend minutes getting there.
   */
  holdWrites: (ms: number) => void;
  probes: ProbeRecord[];
  /**
   * Resolves after the browser has painted the frame that follows this call.
   * A `requestAnimationFrame` callback still runs *before* the paint, so the
   * timer scheduled inside it is the first thing that can observe the pixels.
   */
  afterPaint: () => Promise<number>;
}

declare global {
  interface Window {
    __longclawPerf: PerfBridge;
  }
}

let resolveLoaded: () => void;

export const bridge: PerfBridge = {
  loaded: new Promise<void>((resolve) => {
    resolveLoaded = resolve;
  }),
  emit: () => {
    throw new Error("no project-event listener is registered yet");
  },
  // Replaced by `stubs/core.ts`, which is the half that serves the writes.
  holdWrites: () => {
    throw new Error("the write commands are not served; add `?rw=1`");
  },
  probes: [],
  afterPaint: () =>
    new Promise<number>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(performance.now()), 0);
      });
    }),
};

export function markLoaded() {
  resolveLoaded();
}
