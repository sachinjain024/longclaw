/**
 * The menu a right-click on a ticket opens, on both surfaces (LC-222).
 *
 * The same three steps `TicketMetaMenu` takes — find the ticket by key, build
 * the rows, hand the anchor over — with one difference that is the whole of the
 * component: this one opens **where the pointer was**, not under a control. So
 * it places itself against the viewport rather than against an anchor, and it
 * still hands focus back to the card afterwards, because the card is where the
 * person was standing whatever they used to get here.
 *
 * It writes nothing to disk. Every row raises what it means to `App`, which
 * owns `mutate()`. Copying the key is the one action it does itself: it needs
 * nothing but the ticket, and the clipboard is not the disk. Copying the *path*
 * does go up, because a path needs the project's folder and neither surface
 * holds one — which is the same reason the board raises status and priority.
 */

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { copyToClipboard } from "./clipboard";
import { MenuList } from "./MenuList";
import { POPOVER_GAP, useFocusReturn, usePointPlacement } from "./popover";
import type { Point } from "./popover";
import { ticketMenuItems } from "./ticketMenu";
import type {
  IndexedTicket,
  TicketPriority,
  TicketRow,
  TicketStatus,
} from "./types";

/**
 * The ticket a context menu is open on, and where it was asked for. The point
 * is absent when the keyboard opened it, which has no pointer to read.
 */
export interface ContextMenuTarget {
  key: string;
  point?: Point;
}

/**
 * Where a keyboard-opened menu goes: under the card, left edges aligned, which
 * is `usePopoverPlacement`'s placement expressed as a point so that one path
 * does the flipping for both.
 */
function below(anchor: HTMLElement | null): Point {
  const box = anchor?.getBoundingClientRect();
  if (!box) return { x: 0, y: 0 };
  return { x: box.left, y: box.bottom + POPOVER_GAP };
}

/**
 * The ticket a press names, and where it was pressed — or nothing, for a press
 * that landed on the board's background, a column header or a gap. Shared by
 * both surfaces so a right-click cannot come to mean two different things
 * (`TicketMetaMenu` exists for the same reason).
 */
export function contextMenuTarget(
  event: ReactMouseEvent,
  selector: string,
): ContextMenuTarget | undefined {
  const on = (event.target as HTMLElement).closest?.(selector) as
    HTMLElement | undefined;
  const key = on?.dataset.ticketKey;
  if (key === undefined) return undefined;
  return { key, point: { x: event.clientX, y: event.clientY } };
}

/**
 * Whether a key press asks for the menu. Both of them: macOS and Windows send
 * `Shift`+`F10` from any keyboard, and a keyboard with the dedicated key sends
 * `ContextMenu`. Nothing else opens it, and neither is a chord this app has
 * spent on anything else.
 */
export function opensContextMenu(event: {
  key: string;
  shiftKey: boolean;
}): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

export function TicketContextMenu(props: {
  target: ContextMenuTarget;
  /** Every row the surface holds, the same list the `S`/`P` menu reads. */
  tickets: TicketRow[];
  /** The card or row it belongs to, and the element focus returns to. */
  anchor: HTMLElement | null;
  onOpen: (key: string) => void;
  onChangeStatus: (ticket: IndexedTicket, next: TicketStatus) => void;
  onChangePriority: (ticket: IndexedTicket, next: TicketPriority) => void;
  onArchive: (ticket: IndexedTicket) => void;
  onCopyPath: (ticket: TicketRow) => void;
  onClose: () => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const origin = useRef<Point | undefined>(undefined);
  // Read once, on the way up: the pointer has moved on by the time anything
  // renders, and a card underneath a menu can be re-sorted out from under it by
  // the menu's own pick.
  if (!origin.current)
    origin.current = props.target.point ?? below(props.anchor);
  const position = usePointPlacement(origin.current, popover);
  useFocusReturn(props.anchor);

  const ticket = props.tickets.find(
    (candidate) => candidate.key === props.target.key,
  );
  if (!ticket) return null;
  // Narrowed once rather than in each row: the rows a degraded file has no
  // business being offered are not built for it at all (`ticketMenu.tsx`).
  const indexed = ticket.state === "indexed" ? ticket : undefined;

  /** Every row is one action and then the menu, gone. */
  function ran(action: () => void) {
    action();
    props.onClose();
  }

  const items = ticketMenuItems(ticket, {
    onOpen: () => ran(() => props.onOpen(props.target.key)),
    onChangeStatus: (next) =>
      ran(() => indexed && props.onChangeStatus(indexed, next)),
    onChangePriority: (next) =>
      ran(() => indexed && props.onChangePriority(indexed, next)),
    onArchive: () => ran(() => indexed && props.onArchive(indexed)),
    onCopyKey: () =>
      ran(
        () =>
          void copyToClipboard(ticket.key, {
            done: `${ticket.key} copied`,
            failed: `Could not copy ${ticket.key}`,
          }),
      ),
    onCopyPath: () => ran(() => props.onCopyPath(ticket)),
  });

  return (
    <MenuList
      label={`${ticket.key} actions`}
      items={items}
      position={position}
      popoverRef={popover}
      // No anchor: a menu opened at the pointer has no trigger to toggle, so a
      // press on the card it belongs to is a dismissal like any other
      // (`popover.ts` — the exclusion exists for triggers).
      onDismiss={props.onClose}
    />
  );
}
