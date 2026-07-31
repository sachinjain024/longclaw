/** Stands in for `@tauri-apps/plugin-dialog`; the harness never opens a folder. */

export async function open(): Promise<string | null> {
  return null;
}
