import type { TicketStatus } from "./types";
import { tokenName } from "./StatusDot";

/**
 * The board column header's dot — the prototype's plain filled 8px mark
 * (LC-223, item 22). Not a StatusDot variant: the header text beside it is
 * the identity, so this glyph carries no ring/dash geometry — and it is
 * registered with `glyph-drift-guard.mjs` as its own master (`column-dot`)
 * rather than riding as an eighth shape in the status family.
 */
export function ColumnDot(props: { status: TicketStatus }) {
  return (
    <svg
      className={`status-dot status-${tokenName(props.status)}`}
      width={8}
      height={8}
      viewBox="0 0 8 8"
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}
