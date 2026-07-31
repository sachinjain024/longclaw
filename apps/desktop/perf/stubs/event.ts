/** Stands in for `@tauri-apps/api/event`: one listener, driven by the harness. */

import { bridge } from "../bridge";
import type { StreamEnvelope } from "../../src/types";

export type UnlistenFn = () => void;

export async function listen<T>(
  _name: string,
  handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> {
  bridge.emit = (envelope: StreamEnvelope) =>
    handler({ payload: envelope as T });
  return () => {
    bridge.emit = () => {};
  };
}
