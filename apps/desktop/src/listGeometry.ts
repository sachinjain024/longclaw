/**
 * Where the issue list's headers and rows sit inside its single scroller.
 *
 * The board is six short scrollers of one thing; the list is one long scroller of
 * two, and its group headers are sticky. Sticky is what decides the shape: a
 * `position: sticky` header has to be a real element in the scroller's flow, so
 * the groups are laid out by the browser at heights this module states, and only
 * the rows inside a group body are placed absolutely.
 *
 * That leaves the arithmetic identical to the board's, which is why there is none
 * of it here: the slots are flattened into strides and handed to
 * `runningOffsets`/`windowFor` in `boardGeometry.ts`. What lives here is the
 * composition — how tall a group is, and which slot is which — and the promise
 * that it matches the stylesheet exactly. A list that guesses jitters as it
 * scrolls, and no jsdom test can see that.
 */

import { indexAt, runningOffsets } from "./boardGeometry";
import type { DropSpot } from "./ticketMove";

/** `--lc-size-row`: the height `.list-row` is pinned to (`screen-specs.md:175`). */
export const ROW_HEIGHT = 36;
/** `--lc-space-7`: the sticky group header (`screen-specs.md:171`). */
export const GROUP_HEADER_HEIGHT = 32;
/** The hairline top and bottom of the group body's `surface` card. */
export const GROUP_BODY_BORDER = 1;
/** `.list-group`'s margin-bottom: the air between one group and the next. */
export const GROUP_GAP = 12;

/**
 * One thing the scroller stacks. `row` is `-1` for a group's header, so a slot
 * range translates straight into "which rows of which group to draw".
 */
export interface ListSlot {
  group: number;
  row: number;
}

export interface ListGeometry {
  slots: ListSlot[];
  /** Running tops over the slots, for `windowFor`. */
  offsets: number[];
}

/**
 * The scroller's slots, in the order it stacks them.
 *
 * A group's height is header + body + gap, and the body's two hairlines belong to
 * it — the top one before its first row, the bottom one after its last. They are
 * folded into the header's stride and the last row's rather than given slots of
 * their own, so that a row's offset stays exactly the top of that row. A group
 * holding nothing draws no body at all, which is only the collapsed Archived
 * group (`screen-specs.md:205-209`): every other group is rendered because it has
 * tickets in it.
 */
export function listGeometry(groups: { tickets: unknown[] }[]): ListGeometry {
  const slots: ListSlot[] = [];
  const strides: number[] = [];
  groups.forEach((group, index) => {
    const rows = group.tickets.length;
    slots.push({ group: index, row: -1 });
    if (rows === 0) {
      strides.push(GROUP_HEADER_HEIGHT + GROUP_GAP);
      return;
    }
    strides.push(GROUP_HEADER_HEIGHT + GROUP_BODY_BORDER);
    for (let row = 0; row < rows; row += 1) {
      slots.push({ group: index, row });
      strides.push(
        row === rows - 1
          ? ROW_HEIGHT + GROUP_BODY_BORDER + GROUP_GAP
          : ROW_HEIGHT,
      );
    }
  });
  return { slots, offsets: runningOffsets(strides) };
}

/**
 * Which group a pointer is over, and which gap between its rows (LC-60).
 *
 * The board reads a drop off one column's offsets and gets a gap; the list has
 * to say which group as well, because its one scroller stacks all of them. It
 * is the same arithmetic either way — the slot under the position, then that
 * slot's own midpoint as the line between its two gaps — which is what keeps a
 * drop answerable for a row 3,000 down that is not in the document.
 *
 * Two positions are not rows and still have to answer. A group's **header** is
 * that group's top edge, so a drop on it lands at gap 0 of the group below the
 * header rather than at the end of the group above — a collapsed Archived group
 * is nothing but a header, and a drop there must not be read as the group
 * before it. The **air between two groups** belongs to the group above, because
 * that is where its last row's stride ends and where the pointer looks like it
 * is.
 */
export function dropAt(
  geometry: ListGeometry,
  position: number,
): DropSpot | undefined {
  const { slots, offsets } = geometry;
  if (slots.length === 0) return undefined;

  const last = offsets[offsets.length - 1];
  const within = Math.max(0, Math.min(position, last));
  const index = indexAt(offsets, within);
  const slot = slots[index];
  if (slot.row < 0) return { group: slot.group, gap: 0 };

  // The row's own middle, not the slot's. A group's last row carries the body's
  // bottom hairline and the air below the group in its stride, so splitting the
  // stride would put the line 6.5px below where the row actually ends — and
  // every group has a last row.
  const middle = offsets[index] + ROW_HEIGHT / 2;
  return { group: slot.group, gap: within < middle ? slot.row : slot.row + 1 };
}

/** A group body's height, which is what the browser lays the next group out from. */
export function groupBodyHeight(rows: number): number {
  return rows * ROW_HEIGHT + 2 * GROUP_BODY_BORDER;
}

/** Where one row sits inside its own group body. */
export function rowTop(index: number): number {
  return index * ROW_HEIGHT;
}
