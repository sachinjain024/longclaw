/**
 * Where the webview loads an attachment from (LC-206).
 *
 * The bytes are served by a URI scheme Rust owns
 * (`core/attachment_scheme.rs`), which answers only for a registered image or
 * video inside its own ticket's `attachments/` folder. A URL names the project
 * by id, the ticket by key and the record's `file`, each segment encoded on its
 * own so a name cannot turn into a path.
 *
 * The scheme's name is spelled in three places — here, `ATTACHMENT_SCHEME` in
 * Rust, and the CSP in `tauri.conf.json` — and `attachmentSrc.test.ts` holds
 * this one to the CSP.
 */
export const ATTACHMENT_SCHEME = "longclaw-attachment";

/**
 * The URL for one attachment. `file` is the record's own `file`, which always
 * begins `attachments/`; anything else has no URL, because the scheme would
 * refuse it anyway.
 */
export function attachmentSrc(
  projectId: string,
  ticketKey: string,
  file: string,
): string | undefined {
  const name = file.startsWith("attachments/")
    ? file.slice("attachments/".length)
    : undefined;
  if (name === undefined || name === "" || name.includes("/")) return undefined;
  const segments = [projectId, ticketKey, "attachments", name].map(
    encodeURIComponent,
  );
  return `${ATTACHMENT_SCHEME}://localhost/${segments.join("/")}`;
}
