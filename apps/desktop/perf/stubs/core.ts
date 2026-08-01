/**
 * Stands in for `@tauri-apps/api/core` so the real `App` renders in a browser.
 *
 * Only the commands the board path uses answer; anything else throws, so a
 * measurement can never quietly pass through a command this harness invented.
 */

import { bridge, markLoaded } from "../bridge";
import { PROJECT, detail, snapshot } from "../fixture";
import type { VisibleUiProbe } from "../../src/types";

/** `?tickets=N` shrinks the board, so a number can be shown to scale with it. */
const requested = Number(
  new URLSearchParams(window.location.search).get("tickets"),
);
const board = snapshot(
  Number.isFinite(requested) && requested > 0 ? requested : undefined,
);

export class Channel<T> {
  onmessage: (message: T) => void = () => {};
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (command === "list_projects") return [PROJECT] as T;
  if (command === "open_project" || command === "rebuild_index") {
    return board as T;
  }
  // The theme matrix (V0-37) opens the panel and raises the error banner.
  if (command === "read_ticket") return detail(args?.ticketKey as string) as T;
  if (command === "update_project_name") {
    throw Object.assign(
      new Error("Project file is read-only in this harness"),
      { code: "permission_denied", recoverable: true },
    );
  }
  if (command === "report_visible_ui") {
    bridge.probes.push({
      at: performance.now(),
      probe: args?.probe as VisibleUiProbe,
    });
    markLoaded();
    return undefined as T;
  }
  throw new Error(`the performance harness does not serve ${command}`);
}
