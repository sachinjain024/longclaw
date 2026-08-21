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

import { useCallback, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { copyToClipboard } from "./clipboard";
import { MenuList } from "./MenuList";
import { belowAnchor, useFocusReturn, usePointPlacement } from "./popover";
import type { Point } from "./popover";
import { itemFor } from "./rovingFocus";
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

/**
 * Everything a surface needs to hold a context menu, held once.
 *
 * The board and the list each grew the same four pieces of this — the open
 * target, the press that opens it, the key that opens it, and the anchor it
 * hangs off — and written twice they were already different: one handed the
 * closing menu the key it had acted on and the other handed it nothing, so the
 * board bumped focus to whatever card the arrows had last left behind. That is
 * the drift `TicketMetaMenu` was extracted to prevent, one gesture later.
 *
 * The surface still renders the menu itself: which callbacks it forwards is the
 * one thing the two surfaces genuinely say differently.
 */
export function useTicketContextMenu(props: {
  /** The scroller or grid the rows live in, for finding the anchor by key. */
  root: React.RefObject<HTMLElement | null>;
  /** `.ticket-row` on the board, `.list-row` on the list. */
  selector: string;
  /** The surface's roving focus, asked for the row by key once the menu goes. */
  requestFocus: (key?: string) => void;
}) {
  const { root, selector, requestFocus } = props;
  const [target, setTarget] = useState<ContextMenuTarget>();

  /**
   * A right-click on a row, and only on a row. The press is read where it
   * landed rather than against the roving key, for the reason the keys are: a
   * row can be pressed without ever having been focused. Anywhere else — a
   * column header, a gap, the background — is left to the platform's own menu,
   * which is not a surface's to swallow.
   */
  const onContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      const on = (event.target as HTMLElement).closest?.(selector) as
        HTMLElement | undefined;
      const key = on?.dataset.ticketKey;
      if (key === undefined) return;
      event.preventDefault();
      setTarget({ key, point: { x: event.clientX, y: event.clientY } });
    },
    [selector],
  );

  /** The keyboard path, which has no pointer to place the menu by. */
  const openOn = useCallback((key: string) => setTarget({ key }), []);

  const close = useCallback(() => {
    setTarget(undefined);
    // Asked for by key: a pick re-sorts the surface under the menu, and the
    // press that opened it may have landed on a row that never held focus.
    requestFocus(target?.key);
  }, [requestFocus, target?.key]);

  return {
    target,
    onContextMenu,
    openOn,
    close,
    anchor: target
      ? (itemFor(root.current, selector, target.key) ?? null)
      : null,
    /**
     * What makes a second right-click a second menu. Everything inside is
     * captured when it mounts — the point it is placed at, the element focus
     * goes back to — so a menu asked for on another row while one is up has to
     * be a new component rather than the old one handed new props.
     */
    instance: target
      ? `${target.key}@${target.point ? `${target.point.x},${target.point.y}` : "keyboard"}`
      : "",
  };
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
  // the menu's own pick. Once per *menu* — the surface keys this component on
  // the target, so a right-click on another row mounts a new one.
  if (!origin.current)
    origin.current = props.target.point ??
      belowAnchor(props.anchor) ?? { x: 0, y: 0 };
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
