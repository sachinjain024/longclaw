/**
 * Putting something on the clipboard, and saying so.
 *
 * Three places already did this by hand — the header's project path, the ticket
 * panel's key chip, and now the context menu's two copy rows (LC-222) — and all
 * three had the same four lines: `writeText`, a toast on the way out, a danger
 * toast when the browser refuses, and a `void` at the call site because none of
 * them has anything to await.
 *
 * The refusal is the part worth having once. `navigator.clipboard` rejects on a
 * document that is not focused and is absent outright over plain HTTP, so a copy
 * that silently did nothing is a real state, and a person who pressed a row
 * named *Copy* and got nothing has no way to tell that from a copy that worked.
 */

import { useMutationStore } from "./mutations";

/**
 * Copies, and raises the toast either way. Resolves when the toast is up, so a
 * test can await it; nothing in the UI does.
 */
export async function copyToClipboard(
  text: string,
  copy: { done: string; failed: string },
): Promise<void> {
  const raise = useMutationStore.getState().raise;
  try {
    await navigator.clipboard.writeText(text);
    raise({ message: copy.done, tone: "default" });
  } catch {
    raise({ message: copy.failed, tone: "danger" });
  }
}
