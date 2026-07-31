/**
 * The dot beside the key on a row a change arrived at from disk.
 *
 * Part of the acknowledgement `freshness.ts` describes, and shared by the board
 * card and the list row because the acknowledgement is one designed treatment
 * rather than two: whether it beats is `isPulsing`'s decision, not a surface's,
 * and a surface that answered it differently would be a bug nobody could see.
 *
 * Rendered only while the mark is fresh, which is the caller's condition: the
 * ring and the footer are governed by the same `isFresh` and belong to the row.
 */

import { isPulsing, type ExternalMark } from "./freshness";

export function PulseDot(props: { mark?: ExternalMark; now: number }) {
  return (
    <span
      className={
        isPulsing(props.mark, props.now) ? "pulse-dot pulsing" : "pulse-dot"
      }
      aria-hidden="true"
    />
  );
}
