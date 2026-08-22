/**
 * What right-clicking a ticket offers (LC-222).
 *
 * A pure function of the ticket, deliberately: the board and the list both open
 * this menu, and two lists built in two places are two lists that drift. It is
 * the same bargain `metaOptions.tsx` strikes for the status and priority rows —
 * which are exactly what this reuses for its two submenus, so the values a card
 * can be moved to are the values the panel offers, always.
 *
 * The ticket asked for three rows: a status submenu, a priority submenu, and the
 * file path. It also asked *what else*, and the answer is bounded by a rule —
 * only actions the app already has, reachable from somewhere else, so the menu
 * is a shortcut rather than a second place where things are decided. That admits
 * archiving it (the palette) and copying the key (the panel's chip). It excludes
 * labels, which no surface but the panel can write today, and deleting, which
 * the app does not do at all.
 *
 * An `Open ticket` row was here and came off: the card is a `<button>` and a
 * left-click on it already opens the panel, so the row spent the top of the
 * menu — and its first keyboard stop — on the one action a person right-clicking
 * a ticket has demonstrably not chosen. A degraded file keeps its `Open file`,
 * which is not the same offer: the row it belongs to opens a raw file view, and
 * that row is the only other thing the menu has to say.
 *
 * Nothing here writes. Every row raises what it means to `App`, which owns
 * `mutate()`, exactly as the `S`/`P` menu does.
 */

import { FolderGlyph } from "./FolderGlyph";
import type { MenuItem } from "./MenuList";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import { isArchived, priorityLabel, statusLabel } from "./tickets";
import { ArchiveGlyph, CopyGlyph, OpenGlyph } from "./TicketMenuGlyphs";
import type { TicketPriority, TicketRow, TicketStatus } from "./types";

/** What the rows raise. The surface wires each to `App` and closes the menu. */
export interface TicketMenuActions {
  /** The degraded menu's `Open file`, which is the only row that still opens. */
  onOpen: () => void;
  onChangeStatus: (next: TicketStatus) => void;
  onChangePriority: (next: TicketPriority) => void;
  onArchive: () => void;
  onCopyKey: () => void;
  onCopyPath: () => void;
}

export function ticketMenuItems(
  ticket: TicketRow,
  run: TicketMenuActions,
): MenuItem[] {
  const copyPath: MenuItem = {
    kind: "action",
    id: "copy-path",
    label: "Copy file path",
    glyph: <FolderGlyph />,
    run: run.onCopyPath,
  };

  // A file that would not read has no status to move, no priority to set, no
  // archived flag to turn over and no key worth copying — its `key` is the
  // directory's name, which nothing has vetted. What it has is a path, and a
  // path is most of the reason to right-click one.
  if (ticket.state === "degraded") {
    return [
      {
        kind: "action",
        id: "open",
        label: "Open file",
        glyph: <OpenGlyph />,
        run: run.onOpen,
      },
      { kind: "rule", id: "open-rule" },
      copyPath,
    ];
  }

  return [
    {
      kind: "submenu",
      id: "status",
      label: "Move to",
      glyph: <StatusDot status={ticket.status} decorative />,
      hint: statusLabel(ticket.status),
      items: STATUS_OPTIONS.map((option) => ({
        kind: "choice",
        id: `status-${option.id}`,
        label: option.label,
        glyph: option.glyph,
        checked: option.id === ticket.status,
        run: () => run.onChangeStatus(option.id),
      })),
    },
    {
      kind: "submenu",
      id: "priority",
      label: "Priority",
      glyph: <PriorityGlyph priority={ticket.priority} decorative />,
      hint: priorityLabel(ticket.priority),
      items: PRIORITY_OPTIONS.map((option) => ({
        kind: "choice",
        id: `priority-${option.id}`,
        label: option.label,
        glyph: option.glyph,
        checked: option.id === ticket.priority,
        run: () => run.onChangePriority(option.id),
      })),
    },
    { kind: "rule", id: "archive-rule" },
    {
      kind: "action",
      id: "archive",
      // Named for what pressing it does, not for what is true now — the same
      // way the project menu's star row is.
      label: isArchived(ticket) ? "Unarchive ticket" : "Archive ticket",
      glyph: <ArchiveGlyph />,
      run: run.onArchive,
    },
    { kind: "rule", id: "copy-rule" },
    {
      kind: "action",
      id: "copy-key",
      label: "Copy key",
      glyph: <CopyGlyph />,
      // Mono, the way a key is set everywhere else it is shown: on the card,
      // on the panel's chip, in the palette's search rows.
      hint: <code>{ticket.key}</code>,
      run: run.onCopyKey,
    },
    copyPath,
  ];
}
