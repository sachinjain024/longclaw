/**
 * A ticket's attachments where its text links them (LC-206, stories 12-17, 30
 * and 50): an image across the column that opens the in-app viewer, a video
 * that never plays by itself, a chip for everything else that opens the file
 * in its default app, and a word in place of a link whose file is not there.
 *
 * Which of those a link becomes is `markdown.ts`'s answer; this file only
 * draws it. Every byte comes through the URI scheme Rust owns
 * (`attachmentSrc.ts`), and every reach for the disk — Open, Show in Finder —
 * names the record's `file` and leaves the proof to Rust.
 *
 * The copy is the deck settled in LC-206 (`render.*` and `viewer.*`).
 */

import { useRef } from "react";
import { createPortal } from "react-dom";
import { attachmentSrc } from "./attachmentSrc";
import { holdFocus, useModalEntry } from "./modalFocus";
import type {
  AttachmentIndex,
  AttachmentNode,
  UnavailableAttachmentNode,
} from "./markdown";
import type { Attachment } from "./types";

/**
 * What rendered text needs to draw its ticket's attachments: where they are,
 * which are live, and what pressing one does. The panel builds it; a surface
 * that is not a ticket's own text passes none, and its links stay refused.
 */
export interface TicketAttachments {
  projectId: string;
  ticketKey: string;
  index: AttachmentIndex;
  /** The in-app viewer, for an image. */
  onView: (attachment: Attachment) => void;
  /** The default macOS app, for anything. */
  onOpen: (attachment: Attachment) => void;
  /** Finder, with the file selected. */
  onReveal: (attachment: Attachment) => void;
}

/**
 * A size as the chip and the viewer state it: decimal units, because the limit
 * is stated as 10 MB in decimal megabytes (`attachments.rs`) and a file just
 * under it must not read as "9.5 MB" here and "10.0 MB" in the refusal.
 */
export function describeSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** `render.chip.meta`: `{type} · {size}`. */
function metaOf(attachment: Attachment): string {
  return `${attachment.mediaType} · ${describeSize(attachment.size)}`;
}

export function AttachmentNodeView({
  node,
  scope,
}: {
  node: AttachmentNode;
  scope: TicketAttachments;
}) {
  const { attachment } = node;
  const src = attachmentSrc(scope.projectId, scope.ticketKey, attachment.file);
  if (node.kind === "image" && src !== undefined) {
    // A button, because pressing it does something: the viewer (story 14).
    // The frame spans the column and the picture keeps its own ratio inside it.
    return (
      <button
        type="button"
        tabIndex={0}
        className="md-attachment-image"
        aria-label={`${node.alt}, image. Open full size`}
        onClick={() => scope.onView(attachment)}
      >
        <img src={src} alt={node.alt} />
      </button>
    );
  }
  if (node.kind === "video" && src !== undefined) {
    // `controls` and no `autoplay`, ever (review 1, D3). `metadata` loads the
    // first frame and the length, not the film.
    return (
      <video
        className="md-attachment-video"
        src={src}
        controls
        preload="metadata"
        aria-label={`${attachment.name}, video`}
      />
    );
  }
  return (
    <button
      type="button"
      tabIndex={0}
      className="attachment-chip"
      aria-label={`${attachment.name}, ${attachment.mediaType}, ${describeSize(attachment.size)}. Opens in its default app`}
      title="Open in the default app"
      onClick={() => scope.onOpen(attachment)}
    >
      <DocGlyph />
      <span className="name">{attachment.name}</span>
      <span className="meta">{metaOf(attachment)}</span>
    </button>
  );
}

/**
 * A link whose file is not there, kept as one word rather than dropped
 * (story 30). Not a button: there is nothing to open. The file's name is in
 * the accessible name and the title.
 */
export function UnavailableAttachmentView({
  node,
}: {
  node: UnavailableAttachmentNode;
}) {
  return (
    <span
      className="attachment-chip unavailable"
      role="img"
      aria-label={
        node.removed
          ? `${node.name}, removed from this ticket`
          : `${node.name}, unavailable`
      }
      title={`${node.name} — not attached to this ticket, or its file is missing`}
    >
      <WarnGlyph />
      <span className="name">{node.removed ? "Removed" : "Unavailable"}</span>
    </span>
  );
}

/**
 * The in-app viewer (story 14): one image at the size the window allows, with
 * the two ways out to macOS beside it.
 *
 * Portalled to the document, because the ticket panel is a size container and
 * so the containing block of anything fixed inside it — a scrim drawn there
 * would cover the panel and not the window. The rest is the focus map's rules
 * for a modal (`modalFocus.ts`): focus moves in, is held until the viewer
 * closes, and goes back to the image that opened it; `Esc` closes and stops
 * there.
 */
export function AttachmentViewer({
  attachment,
  scope,
  onClose,
}: {
  attachment: Attachment;
  scope: TicketAttachments;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const src = attachmentSrc(scope.projectId, scope.ticketKey, attachment.file);

  useModalEntry(() => close.current);

  /**
   * The scrim and the space around the picture, not the picture or the
   * header: a click past the image is a click away from it.
   */
  function closeOnBackdrop(event: React.MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      ref={dialog}
      className="attachment-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      onClick={closeOnBackdrop}
      onKeyDown={(event) => {
        // Nothing under a modal hears a key: the panel closes on `Esc` and
        // binds `S` and `P` on the document, and the toast's ⌘Z would undo a
        // write the human cannot see from here.
        event.stopPropagation();
        if (event.key === "Tab") {
          holdFocus(dialog, event);
          return;
        }
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <strong>{attachment.name}</strong>
        <span className="meta">{metaOf(attachment)}</span>
        <button
          type="button"
          tabIndex={0}
          className="secondary small"
          onClick={() => scope.onOpen(attachment)}
        >
          Open
        </button>
        <button
          type="button"
          tabIndex={0}
          className="secondary small"
          onClick={() => scope.onReveal(attachment)}
        >
          Show in Finder
        </button>
        <button
          ref={close}
          type="button"
          tabIndex={0}
          className="secondary small"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <figure onClick={closeOnBackdrop}>
        {src !== undefined && <img src={src} alt={attachment.name} />}
      </figure>
    </div>,
    document.body,
  );
}

function DocGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 1.5h4.6l2.4 2.4v8.6h-7z" />
      <path d="M8 1.5V4h2.5M5 7h4M5 9.2h4" />
    </svg>
  );
}

function WarnGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.8 12.6 11.8H1.4z" />
      <path d="M7 5.6v3M7 10.2v.01" strokeLinecap="round" />
    </svg>
  );
}
