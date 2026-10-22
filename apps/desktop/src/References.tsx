/**
 * The References section (LC-206, stories 18-20, 26, 29, 31-33, 53-55): every
 * file a ticket holds and every doc it points at, in one list between
 * Description and Checklist.
 *
 * Collapsed by default behind a heading that carries the count, so a ticket
 * with references costs the panel one line until it is asked for; the panel
 * opens it when a file lands. Five rows, then _View all_ — the broken rows
 * count toward the five, and a row that just landed is shown past them.
 *
 * Which rows there are is `referenceRows`, a function of what the detail read
 * returned; this file draws them. Every action is the panel's, handed in: the
 * section neither reads nor writes on its own.
 *
 * The copy is the deck settled in LC-206 (`section.*`, `row.*`, `state.*`,
 * `doc.meta`, `menu.*`).
 */

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { describeAge } from "./acknowledgement";
import { actorLabel } from "./attribution";
import { attachmentSrc } from "./attachmentSrc";
import type { TicketAttachments } from "./AttachmentView";
import {
  DocGlyph,
  FilmGlyph,
  LinkedDocGlyph,
  WarnGlyph,
  describeSize,
  metaOf,
} from "./AttachmentView";
import { PaperclipGlyph } from "./attaching";
import { classes } from "./classes";
import { attachmentKind } from "./markdown";
import { ChevronGlyph } from "./Menu";
import type { MenuItem } from "./MenuList";
import { MenuList } from "./MenuList";
import { useFocusReturn, usePopoverPlacement } from "./popover";
import { KebabGlyph } from "./SettingsGlyphs";
import type {
  ActivityEvent,
  Attachment,
  OrphanAttachment,
  TicketDetail,
  TicketReference,
} from "./types";

/** How many rows show before _View all_ (review 1, E3). */
const SHOWN = 5;

/** How wide a row's menu is, so it can hang right-aligned from its `⋮`. */
const MENU_WIDTH = 220;

/** The Add menu carries a hint on each row, so it is wider (review 3). */
const ADD_MENU_WIDTH = 280;

/**
 * One line of the section. Files first, in registry order, with the missing
 * where they fall; then the files no record names; then the docs.
 */
export type ReferenceRow = FileRow | OrphanRow | DocRow;

type FileRow = {
  kind: "file";
  key: string;
  attachment: Attachment;
  /** Registered, and its bytes are gone. */
  missing: boolean;
  /** The comment that links it, for _Added in a comment_. */
  comment?: string;
};

export type OrphanRow = {
  kind: "orphan";
  key: string;
  orphan: OrphanAttachment;
  /** The name it had when it was removed, or its file's own. */
  name: string;
  /** When a removal the activity recorded left it here. */
  removedAt?: string;
};

type DocRow = {
  kind: "doc";
  key: string;
  reference: TicketReference;
  /** Its path no longer resolves: moved, renamed or deleted. */
  missing: boolean;
  /** Kept by an absolute path, because it is not in the project folder. */
  outside: boolean;
};

/** The section's rows, from what one detail read returned. */
export function referenceRows(detail: TicketDetail): ReferenceRow[] {
  const ticket = detail.ticket;
  if (!ticket) return [];
  const files: ReferenceRow[] = ticket.attachments.map((attachment) => ({
    kind: "file",
    key: attachment.id,
    attachment,
    missing: detail.missingAttachments.includes(attachment.id),
    comment: ticket.description.includes(attachment.file)
      ? undefined
      : commentLinking(ticket.activity, attachment.file),
  }));
  const orphans: ReferenceRow[] = detail.orphanAttachments.map((orphan) => {
    const removal = removalOf(ticket.activity, orphan.file);
    return {
      kind: "orphan",
      key: orphan.file,
      orphan,
      name: removal?.name ?? fileName(orphan.file),
      removedAt: removal?.at,
    };
  });
  const docs: ReferenceRow[] = ticket.references.map((reference) => ({
    kind: "doc",
    key: reference.id,
    reference,
    missing: detail.missingReferences.includes(reference.id),
    // The format stores a path inside the project relative to it, and only
    // one outside it absolute — so the shape of the path is the answer.
    outside: reference.path.startsWith("/"),
  }));
  return [...files, ...orphans, ...docs];
}

/**
 * The earliest comment whose words link the file — the one it came in with.
 * A link is how a comment carries a file, so it is also how one is found; the
 * caller asks only when the description does not link it, since a file that
 * came in there and was mentioned later did not come in through a comment.
 */
function commentLinking(
  activity: ActivityEvent[],
  file: string,
): string | undefined {
  return activity
    .filter((event) => event.kind === "comment" && event.body.includes(file))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0]?.id;
}

/**
 * The latest removal of the record an orphan was. An attachment's file starts
 * with its id (`file_format.md`), and the removal recorded the id and the name.
 */
function removalOf(
  activity: ActivityEvent[],
  file: string,
): { name?: string; at: string } | undefined {
  const name = fileName(file);
  let found: { name?: string; at: string } | undefined;
  for (const event of activity) {
    for (const change of event.changes) {
      const id = /^attachments\.(.+)\.removed$/.exec(change.field)?.[1];
      if (!id || !name.startsWith(`${id}-`)) continue;
      if (found && Date.parse(found.at) >= Date.parse(event.occurredAt)) {
        continue;
      }
      found = {
        name: typeof change.from === "string" ? change.from : undefined,
        at: event.occurredAt,
      };
    }
  }
  return found;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** What a row is called: its record's name, or its file's. */
export function rowName(row: ReferenceRow): string {
  if (row.kind === "file") return row.attachment.name;
  if (row.kind === "orphan") return row.name;
  return fileName(row.reference.path);
}

export function References(props: {
  rows: ReferenceRow[];
  open: boolean;
  onToggle: () => void;
  /** Rows that just landed, shown even past the five. */
  landed: string[];
  /** Rows an external write added, worn with the acknowledgement's accent. */
  acknowledged: string[];
  accentClass?: string;
  now: number;
  attachments: TicketAttachments;
  /** Settles when the write and the read after it have. */
  onRemove: (row: ReferenceRow) => Promise<void>;
  onReattach: (row: OrphanRow) => void;
  onGoToComment: (eventId: string) => void;
  /** The Add menu's two rows: copy a file in, or point at one where it is. */
  onAttach: () => void;
  onAddReference: () => void;
  onOpenReference: (reference: TicketReference) => void;
  onRevealReference: (reference: TicketReference) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [addMenu, setAddMenu] = useState<HTMLElement>();
  const toggle = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ key: string; anchor: HTMLElement }>();
  const { rows } = props;
  const menuRow = rows.find((row) => row.key === menu?.key);
  const shown = showAll
    ? rows
    : rows.filter(
        (row, index) => index < SHOWN || props.landed.includes(row.key),
      );

  return (
    <section className="panel-section references">
      <h3>
        <button
          ref={toggle}
          type="button"
          tabIndex={0}
          className="references-toggle"
          aria-expanded={props.open}
          onClick={props.onToggle}
        >
          <ChevronGlyph />
          References
          <span className="section-count">{rows.length}</span>
        </button>
        {/* Always visible, unlike Description's Edit: a collapsed list has
            nothing under it to hover (review 3). */}
        <button
          type="button"
          tabIndex={0}
          className="ghost small references-add"
          aria-haspopup="menu"
          aria-expanded={addMenu !== undefined}
          onClick={(event) => {
            const anchor = event.currentTarget;
            setAddMenu((open) => (open ? undefined : anchor));
          }}
        >
          <PlusGlyph />
          Add
        </button>
      </h3>
      {addMenu && (
        <AnchoredMenu
          label="Add"
          anchor={addMenu}
          width={ADD_MENU_WIDTH}
          items={[
            {
              kind: "action",
              id: "attach",
              glyph: <PaperclipGlyph size={12} />,
              label: "Attach a file…",
              hint: "Copied into the ticket",
              run: props.onAttach,
            },
            {
              kind: "action",
              id: "reference",
              glyph: <LinkedDocGlyph />,
              label: "Add a reference…",
              hint: "Linked where it is",
              run: props.onAddReference,
            },
          ]}
          onClose={() => setAddMenu(undefined)}
        />
      )}
      {props.open &&
        (rows.length === 0 ? (
          <p className="attachments-empty">
            Nothing here yet. Paste or drop a file into the description or a
            comment, or press Attach. Specs and other docs written for this
            ticket are listed here too.
          </p>
        ) : (
          <>
            <ul className="attachments">
              {shown.map((row) => (
                <Row
                  key={row.key}
                  row={row}
                  now={props.now}
                  scope={props.attachments}
                  acknowledged={
                    props.acknowledged.includes(row.key)
                      ? props.accentClass
                      : undefined
                  }
                  menuOpen={menu?.key === row.key}
                  onMenu={(anchor) =>
                    setMenu((current) =>
                      current?.key === row.key
                        ? undefined
                        : { key: row.key, anchor },
                    )
                  }
                  onGoToComment={props.onGoToComment}
                />
              ))}
            </ul>
            {rows.length > SHOWN && (
              <button
                type="button"
                tabIndex={0}
                className="ghost small references-more"
                onClick={() => setShowAll((all) => !all)}
              >
                {showAll ? "Show fewer" : `View all ${rows.length}`}
              </button>
            )}
          </>
        ))}
      {menuRow && menu && (
        <RowMenu
          row={menuRow}
          anchor={menu.anchor}
          scope={props.attachments}
          onRemove={(row) => {
            // The row goes with its record, and its `⋮` with it — so focus,
            // which went back to that `⋮`, would fall to the page. The
            // section's heading is the nearest thing still standing.
            void props.onRemove(row).then(() => {
              if (!toggle.current?.isConnected) return;
              const lost =
                document.activeElement === null ||
                document.activeElement === document.body;
              if (lost) toggle.current.focus();
            });
          }}
          onReattach={props.onReattach}
          onOpenReference={props.onOpenReference}
          onRevealReference={props.onRevealReference}
          onClose={() => setMenu(undefined)}
        />
      )}
    </section>
  );
}

function Row(props: {
  row: ReferenceRow;
  now: number;
  scope: TicketAttachments;
  /** The accent class, when an external write added this row. */
  acknowledged?: string;
  menuOpen: boolean;
  onMenu: (anchor: HTMLElement) => void;
  onGoToComment: (eventId: string) => void;
}) {
  const { row } = props;
  const name = rowName(row);
  const age = (at: string) => describeAge(Date.parse(at), props.now);
  let meta: string;
  let metaTitle: string | undefined;
  let state: string | undefined;
  if (row.kind === "file") {
    const { attachment } = row;
    const who = actorLabel(attachment.addedBy);
    if (row.missing) {
      state = "missing";
      meta = `File not found · ${attachment.mediaType} · ${who} · ${age(attachment.addedAt)}`;
      metaTitle = `Looked for ${attachment.file}`;
    } else {
      meta = `${metaOf(attachment)} · ${who} · ${age(attachment.addedAt)}`;
    }
  } else if (row.kind === "orphan") {
    state = "not attached";
    const facts = [row.orphan.mediaType, describeSize(row.orphan.size)]
      .filter(Boolean)
      .join(" · ");
    meta =
      row.removedAt === undefined
        ? `Found in attachments/ · ${facts}`
        : `Removed ${age(row.removedAt)} — file kept · ${facts}`;
  } else if (row.missing) {
    state = "missing";
    meta = `File not found · ${row.reference.path}`;
  } else {
    const { path, addedBy, addedAt } = row.reference;
    const dir = path.slice(0, path.lastIndexOf("/") + 1);
    meta = [dir, actorLabel(addedBy), age(addedAt)].filter(Boolean).join(" · ");
  }
  // Allowed, and said: an agent or another machine may not find it there.
  const outside = row.kind === "doc" && row.outside && !row.missing;

  return (
    <li
      className={classes(
        "attachment-row",
        (row.kind === "file" || row.kind === "doc") && row.missing && "missing",
        row.kind === "orphan" && "orphan",
        props.acknowledged && "acknowledged",
        props.acknowledged,
      )}
    >
      <span className="attachment-thumb">
        <Thumb row={row} scope={props.scope} />
      </span>
      <span className="attachment-text">
        <span className="attachment-name">
          <strong title={name}>{name}</strong>
          {row.kind === "file" && row.comment && (
            <button
              type="button"
              tabIndex={0}
              className="attachment-source"
              aria-label={`Go to the comment that added ${name}`}
              onClick={() => props.onGoToComment(row.comment!)}
            >
              Added in a comment
            </button>
          )}
        </span>
        <span className="meta" title={metaTitle ?? meta}>
          {meta}
        </span>
      </span>
      {state ? (
        <span className="attachment-state">{state}</span>
      ) : outside ? (
        <span
          className="attachment-state"
          title="This file is not in the project folder, so agents and other machines may not find it."
        >
          outside project
        </span>
      ) : (
        <span />
      )}
      <button
        type="button"
        tabIndex={0}
        className={classes("row-menu-button", props.menuOpen && "open")}
        aria-haspopup="menu"
        aria-expanded={props.menuOpen}
        aria-label={`Actions for ${name}`}
        onClick={(event) => props.onMenu(event.currentTarget)}
      >
        <KebabGlyph />
      </button>
    </li>
  );
}

/** The image itself for a live picture, and a glyph for everything else. */
function Thumb({
  row,
  scope,
}: {
  row: ReferenceRow;
  scope: TicketAttachments;
}) {
  if (row.kind === "doc") return <LinkedDocGlyph />;
  if (row.kind === "file" && row.missing) return <WarnGlyph />;
  const mediaType =
    row.kind === "file" ? row.attachment.mediaType : row.orphan.mediaType;
  const kind = mediaType ? attachmentKind(mediaType) : "file";
  if (row.kind === "file" && kind === "image") {
    const src = attachmentSrc(
      scope.projectId,
      scope.ticketKey,
      row.attachment.file,
    );
    if (src) return <img src={src} alt="" loading="lazy" />;
  }
  return kind === "video" ? <FilmGlyph /> : <DocGlyph />;
}

/** One row's `⋮` menu, with every action the row has (story 55). */
function RowMenu(props: {
  row: ReferenceRow;
  anchor: HTMLElement;
  scope: TicketAttachments;
  onRemove: (row: ReferenceRow) => void;
  onReattach: (row: OrphanRow) => void;
  onOpenReference: (reference: TicketReference) => void;
  onRevealReference: (reference: TicketReference) => void;
  onClose: () => void;
}) {
  const { row, scope } = props;
  const name = rowName(row);
  const remove: MenuItem = {
    kind: "action",
    id: "remove",
    label: "Remove",
    // Nothing is deleted: a file's bytes stay as a not-attached row (review
    // 2). A doc was never copied, so there is no file to say was kept.
    hint: row.kind === "file" ? "File kept" : undefined,
    run: () => props.onRemove(row),
  };
  let items: MenuItem[];
  if (row.kind === "orphan") {
    items = [
      {
        kind: "action",
        id: "reveal",
        label: "Show in Finder",
        run: () => scope.onReveal(row.orphan.file),
      },
      {
        kind: "action",
        id: "reattach",
        label: "Re-attach",
        run: () => props.onReattach(row),
      },
    ];
  } else if (row.kind === "file" && !row.missing) {
    const { attachment } = row;
    const image = attachmentKind(attachment.mediaType) === "image";
    items = [
      image
        ? {
            kind: "action",
            id: "view",
            label: "View",
            run: () => scope.onView(attachment),
          }
        : {
            kind: "action",
            id: "open",
            label: "Open",
            run: () => scope.onOpen(attachment),
          },
      {
        kind: "action",
        id: "reveal",
        label: "Show in Finder",
        run: () => scope.onReveal(attachment.file),
      },
      { kind: "rule", id: "remove-rule" },
      remove,
    ];
  } else if (row.kind === "doc" && !row.missing) {
    const { reference } = row;
    items = [
      {
        kind: "action",
        id: "open",
        label: "Open",
        run: () => props.onOpenReference(reference),
      },
      {
        kind: "action",
        id: "reveal",
        label: "Show in Finder",
        run: () => props.onRevealReference(reference),
      },
      { kind: "rule", id: "remove-rule" },
      remove,
    ];
  } else {
    // A missing file, or a doc that moved: nothing to open or show.
    items = [remove];
  }
  return (
    <AnchoredMenu
      label={`Actions for ${name}`}
      items={items}
      anchor={props.anchor}
      width={MENU_WIDTH}
      onClose={props.onClose}
    />
  );
}

/**
 * A menu hung from the control that opened it, right-aligned to it.
 *
 * Portalled to the document for the reason the viewer is: the panel is a size
 * container, and a popover placed in viewport coordinates inside it would be
 * placed against the panel instead.
 */
function AnchoredMenu(props: {
  label: string;
  items: MenuItem[];
  anchor: HTMLElement;
  width: number;
  onClose: () => void;
}) {
  useFocusReturn(props.anchor);
  const position = usePopoverPlacement(props.anchor, props.width);
  return createPortal(
    <MenuList
      label={props.label}
      items={props.items}
      position={position}
      anchor={props.anchor}
      onDismiss={props.onClose}
    />,
    document.body,
  );
}

function PlusGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 2.5 V11.5 M2.5 7 H11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
