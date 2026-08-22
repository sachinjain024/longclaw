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

import { useCallback, useMemo, useRef, useState } from "react";
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
 * The five things a surface can raise about a ticket but cannot answer.
 *
 * One type rather than five parameters, because they travel together: the board
 * takes them, the list takes them, and the context menu is handed the whole set
 * (`Board`'s own props are these plus the board's).
 */
export interface TicketActions {
  /** Open it in the panel — what a click on the row already does. */
  onSelect: (key: string) => void;
  /** Raised by the `S` menu and by `Move to`. A surface writes nothing. */
  onChangeStatus: (ticket: IndexedTicket, next: TicketStatus) => void;
  /** Raised by the `P` menu and by `Priority`, on the same terms. */
  onChangePriority: (ticket: IndexedTicket, next: TicketPriority) => void;
  /** Raised by the context menu's archive row, which is App's to write. */
  onArchive: (ticket: IndexedTicket) => void;
  /**
   * Raised by the context menu's Copy file path row. The path a row holds is
   * relative to a project folder no surface has ever been told (LC-222).
   */
  onCopyPath: (ticket: TicketRow) => void;
}

/**
 * The whole of a surface's context menu: the press that opens it, the key that
 * opens it, and the menu itself.
 *
 * The board and the list each grew the same pieces of this — the open target,
 * the press, the key, the anchor, and the element — and written twice they were
 * already different: one handed the closing menu the key it had acted on and
 * the other handed it nothing, so the board asked its roving focus for whatever
 * card the arrows had last left behind. That is the drift `TicketMetaMenu` was
 * extracted to prevent, one gesture later, which is why even the element is
 * here rather than in two files that must remember to agree.
 */
export function useTicketContextMenu(props: {
  /** The scroller or grid the rows live in, for finding the anchor by key. */
  root: React.RefObject<HTMLElement | null>;
  /** `.ticket-row` on the board, `.list-row` on the list. */
  selector: string;
  /** Every row the surface holds, the same list the `S`/`P` menu reads. */
  tickets: TicketRow[];
  /** What the rows raise. Both surfaces have these as their own props. */
  actions: TicketActions;
  /** The surface's roving focus, asked for the row by key once the menu goes. */
  requestFocus: (key?: string) => void;
}) {
  const { root, selector, tickets, actions, requestFocus } = props;
  const [target, setTarget] = useState<ContextMenuTarget>();

  /**
   * A right-click on a row, and only on a row. The press is read where it
   * landed rather than against the roving key, for the reason the keys are: a
   * row can be pressed without ever having been focused. Anywhere else — a
   * column header, a gap, the background — is left to the platform's own menu,
   * which is not a surface's to swallow.
   *
   * The exception is a press inside the menu already up. That one is taken and
   * dropped: a menu row is not a row, so nothing would open, and left alone the
   * platform would draw its own menu over ours.
   */
  const onContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      const from = event.target as HTMLElement;
      if (from.closest?.(".menu-popover")) {
        event.preventDefault();
        return;
      }
      const on = from.closest?.(selector) as HTMLElement | undefined;
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
    // Asked for by key rather than left to the popover's own focus return: a
    // pick re-sorts the surface under the menu, and the card the menu was
    // hanging off is not in the document to be focused once it has moved.
    requestFocus(target?.key);
  }, [requestFocus, target?.key]);

  /**
   * Looked up once per menu rather than once per render: the surface re-renders
   * while a menu is up — a write lands, a watcher event arrives — and the
   * anchor is read exactly once, when the menu mounts.
   */
  const anchor = useMemo(
    () =>
      target ? (itemFor(root.current, selector, target.key) ?? null) : null,
    // The key is what makes this a different anchor: `root` and `selector` are
    // fixed for a surface, and the element behind a key is read when the menu
    // opens and not again.
    [target?.key, root, selector],
  );

  // Where the menu goes, decided before it exists: the pointer's own position,
  // or — for the keyboard, which has no pointer — under the row itself. A row
  // that is in neither place is a row there is nowhere to put a menu for, and
  // opening one in the corner of the window would be worse than not opening it.
  const origin = target?.point ?? belowAnchor(anchor);

  return {
    onContextMenu,
    openOn,
    /** Whether one is up, for a surface that has to say so. */
    open: target !== undefined,
    menu:
      target && origin ? (
        <TicketContextMenu
          // A second press is a second menu. Everything inside is captured when
          // it mounts — the point it is placed at, the element focus goes back
          // to — so a menu asked for on another row while one is up has to be a
          // new component rather than the old one handed new props.
          key={`${target.key}@${origin.x},${origin.y}`}
          target={target}
          origin={origin}
          anchor={anchor}
          tickets={tickets}
          actions={actions}
          onClose={close}
        />
      ) : null,
  };
}

function TicketContextMenu(props: {
  target: ContextMenuTarget;
  /** Where it goes: the pointer, or under the row for a keyboard press. */
  origin: Point;
  /** Every row the surface holds, the same list the `S`/`P` menu reads. */
  tickets: TicketRow[];
  /** The card or row it belongs to, and the element focus returns to. */
  anchor: HTMLElement | null;
  actions: TicketActions;
  onClose: () => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const position = usePointPlacement(props.origin, popover);
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

  const act = props.actions;
  const items = ticketMenuItems(ticket, {
    onOpen: () => ran(() => act.onSelect(props.target.key)),
    onChangeStatus: (next) =>
      ran(() => indexed && act.onChangeStatus(indexed, next)),
    onChangePriority: (next) =>
      ran(() => indexed && act.onChangePriority(indexed, next)),
    onArchive: () => ran(() => indexed && act.onArchive(indexed)),
    onCopyKey: () =>
      ran(
        () =>
          void copyToClipboard(ticket.key, {
            done: `${ticket.key} copied`,
            failed: `Could not copy ${ticket.key}`,
          }),
      ),
    onCopyPath: () => ran(() => act.onCopyPath(ticket)),
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
