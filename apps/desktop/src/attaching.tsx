/**
 * Attaching a file where it is being written about (LC-206, stories 1-11,
 * 21-23, 51, 52, 60): ⌘V of a copied file, a drop onto the field, or the
 * toolbar's Attach button, in the description editor and the comment composer.
 *
 * One hook for every field, because the gesture is the same everywhere and
 * only the write differs: a placeholder goes in at the caret, a row under the
 * field says the file is on its way, and when the write comes back the
 * placeholder becomes the link — or goes, and the row says why. The field
 * stays the human's the whole time; nothing here blocks typing.
 *
 * Files are written one at a time, in the order they arrived. Each one changes
 * `ticket.md`, so the next has to be sent against the hash the last one left.
 *
 * The copy is the deck settled in LC-206 (`attach.*`, `refuse.*`).
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import { describeSize } from "./AttachmentView";
import { normalizeError } from "./errors";
import type { AppError, Attachment, ChosenFile } from "./types";

/** The limit Rust enforces, stated so an over-limit paste is not sent at all. */
export const ATTACHMENT_SIZE_LIMIT = 10_000_000;

/**
 * One file on its way in: bytes the webview holds (a paste or a drop), or a
 * file the open panel answered with, which the webview knows only by the
 * token Rust handed it — never by its path.
 */
export type AttachSource =
  | { kind: "file"; file: File; name: string; size: number; image: boolean }
  | {
      kind: "chosen";
      token: string;
      name: string;
      size: number;
      image: boolean;
    };

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|tiff?|webp|avif|heic|heif|svg)$/i;

export function fromFile(file: File): AttachSource {
  return {
    kind: "file",
    file,
    name: file.name,
    size: file.size,
    image: file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name),
  };
}

export function fromChosen(chosen: ChosenFile): AttachSource {
  return {
    kind: "chosen",
    token: chosen.token,
    name: chosen.name,
    size: chosen.size,
    image: IMAGE_EXTENSION.test(chosen.name),
  };
}

/** Link text that cannot close the brackets it sits in. */
function linkText(name: string): string {
  return name.replace(/[\\[\]]/g, (char) => `\\${char}`);
}

/**
 * What lands in the Markdown: an image link for a picture and an ordinary link
 * for anything else (`attach.link.image`, `attach.link.file`). The record's
 * `file` is always `attachments/<sanitized name>`, so it needs no brackets.
 */
export function attachmentLink(attachment: Attachment): string {
  const text = `[${linkText(attachment.name)}](./${attachment.file})`;
  return attachment.mediaType.startsWith("image/") ? `!${text}` : text;
}

/** `attach.placeholder.image` / `attach.placeholder.file`. */
export function placeholderFor(source: AttachSource): string {
  const text = `[Attaching ${linkText(source.name)}…]()`;
  return source.image ? `!${text}` : text;
}

/** One row under the field: a file in flight, landed, or refused. */
export interface AttachRow {
  id: number;
  name: string;
  state: "pending" | "done" | "refused";
  size?: number;
  message?: string;
  hint?: string;
}

/** What each refusal adds on its second line (`refuse.*.hint`). */
const REFUSAL_HINTS: Partial<Record<AppError["code"], string>> = {
  too_large: "Trim or compress it, or put it somewhere else and link to it.",
  unsupported_media_type:
    "LongClaw checks what a file contains, not just its name.",
  conflict:
    "The file stays on disk. You can re-attach it from References later.",
};

/** `refuse.stale`: Rust's own sentence is about the hash, not the file. */
function refusalMessage(error: AppError, name: string, ticketKey: string) {
  if (error.code === "conflict") {
    return `${ticketKey} changed on disk before ${name} could be added.`;
  }
  return error.message;
}

/** `attach.status.summary`, said once a drop of several files settles. */
export function attachSummary(ok: number, total: number): string {
  return `${ok} of ${total} files attached. ${total - ok} could not be.`;
}

/**
 * Where a field's files go: written into the ticket now, or — on a create
 * surface, where there is no ticket yet — held for after Create (story 40),
 * with nothing put into the field.
 */
export type FileDestination =
  | { attach: (source: AttachSource) => Promise<Attachment>; hold?: never }
  | { hold: (sources: AttachSource[]) => void; attach?: never };

export function useAttaching(
  options: {
    ticketKey: string;
    field: RefObject<HTMLTextAreaElement | null>;
    value: string;
    onChange: (value: string) => void;
  } & FileDestination,
) {
  const [rows, setRows] = useState<AttachRow[]>([]);
  const [summary, setSummary] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const nextId = useRef(0);
  // The field's value as of the last render: a write that comes back after
  // the human typed must edit what is there now, not what was there then.
  const latest = useRef(options.value);
  latest.current = options.value;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** The file in flight, so a second gesture queues behind the first. */
  const queue = useRef<Promise<void>>(Promise.resolve());
  /**
   * Which ticket the queue is working for. Files still waiting when the field
   * moves to another ticket are dropped rather than written into it.
   */
  const generation = useRef(0);
  /**
   * The value this hook last put in the field. Anything else arriving is the
   * human's own edit — the view moving on — which is when a landed row has
   * said its piece and goes, never to come back (story 60).
   */
  const written = useRef(options.value);
  /** Where the caret goes once a replacement has rendered. */
  const caret = useRef<[number, number]>(undefined);
  /**
   * Whether the field is still on screen. A file that lands after its editor
   * was cancelled is still attached — it lists in References — but its link
   * has no field left to go into, and must not write a draft back.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (options.value === written.current) return;
    written.current = options.value;
    setRows((current) => current.filter((row) => row.state !== "done"));
  }, [options.value]);

  useEffect(() => {
    generation.current += 1;
    setRows([]);
    setSummary("");
  }, [options.ticketKey]);

  // A replacement re-renders a controlled field, and WebKit puts the caret at
  // the end when it does; the human may be mid-word somewhere else entirely.
  useLayoutEffect(() => {
    const range = caret.current;
    const field = options.field.current;
    if (!range || !field) return;
    caret.current = undefined;
    if (document.activeElement === field) {
      field.setSelectionRange(range[0], range[1]);
    }
  }, [options.value, options.field]);

  function update(id: number, change: Partial<AttachRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change } : row)),
    );
  }

  /** Puts `next` in the field, keeping the caret where the human left it. */
  function put(next: string, at: number, removed: number, added: number) {
    const field = optionsRef.current.field.current;
    if (field) {
      const shift = (point: number) =>
        point >= at + removed ? point - removed + added : Math.min(point, at);
      caret.current = [shift(field.selectionStart), shift(field.selectionEnd)];
    }
    latest.current = next;
    written.current = next;
    optionsRef.current.onChange(next);
  }

  /** Replaces one placeholder, wherever the typing since has moved it. */
  function replace(placeholder: string, text: string) {
    if (!mounted.current) return;
    const value = latest.current;
    const at = value.indexOf(placeholder);
    if (at === -1) return;
    put(
      value.slice(0, at) + text + value.slice(at + placeholder.length),
      at,
      placeholder.length,
      text.length,
    );
  }

  /**
   * Takes a refused file's placeholder out, with the line break that kept it
   * apart from its neighbour — otherwise a drop of three with one refused
   * leaves an empty line where it stood.
   */
  function remove(placeholder: string) {
    const value = latest.current;
    for (const spaced of [`${placeholder}\n`, `\n${placeholder}`]) {
      if (value.includes(spaced)) return replace(spaced, "");
    }
    replace(placeholder, "");
  }

  function refused(source: AttachSource, error: AppError): AttachRow {
    return {
      id: (nextId.current += 1),
      name: source.name,
      state: "refused",
      message: refusalMessage(error, source.name, optionsRef.current.ticketKey),
      hint: REFUSAL_HINTS[error.code],
    };
  }

  function attachFiles(sources: AttachSource[]) {
    if (sources.length === 0) return;
    const { field, attach, hold } = optionsRef.current;
    if (hold) {
      // Refused now rather than after Create, when there would be no field
      // left to say it under (story 21).
      const refusals = sources.map(tooLarge);
      setRows((current) => [
        ...current,
        ...sources.flatMap((source, index) => {
          const refusal = refusals[index];
          return refusal ? [refused(source, refusal)] : [];
        }),
      ]);
      hold(sources.filter((_, index) => !refusals[index]));
      return;
    }

    // Placeholders go in at the caret, one per line, so the links land in the
    // sentence that was being written (story 7).
    const placeholders = sources.map(placeholderFor);
    const value = latest.current;
    const start = field.current?.selectionStart ?? value.length;
    const end = field.current?.selectionEnd ?? value.length;
    const inserted = placeholders.join("\n");
    put(
      value.slice(0, start) + inserted + value.slice(end),
      start,
      end - start,
      inserted.length,
    );

    const started: AttachRow[] = sources.map((source) => ({
      id: (nextId.current += 1),
      name: source.name,
      state: "pending",
      size: source.size,
    }));
    setRows((current) => [
      ...current.filter((row) => row.state === "refused"),
      ...started,
    ]);
    setSummary("");

    // The ticket and the write are the ones this gesture was made against,
    // captured now: a file still queued when the field moves to another
    // ticket must not be written into that one.
    const mine = generation.current;
    let landed = 0;
    sources.forEach((source, index) => {
      const row = started[index];
      queue.current = queue.current.then(async () => {
        if (generation.current !== mine) return;
        try {
          const refusal = tooLarge(source);
          if (refusal) throw refusal;
          const attachment = await attach(source);
          if (generation.current !== mine) return;
          replace(placeholders[index], attachmentLink(attachment));
          update(row.id, { state: "done" });
          landed += 1;
        } catch (error) {
          if (generation.current !== mine) return;
          remove(placeholders[index]);
          const normalized = normalizeError(error);
          update(row.id, {
            state: "refused",
            message: refusalMessage(
              normalized,
              source.name,
              optionsRef.current.ticketKey,
            ),
            hint: REFUSAL_HINTS[normalized.code],
          });
        }
        if (index === sources.length - 1 && sources.length > 1) {
          setSummary(attachSummary(landed, sources.length));
        }
      });
    });
  }

  /** A paste of plain text is left to the field; only files are taken. */
  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    attachFiles(files.map(fromFile));
  }

  function carriesFiles(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  const dropHandlers = {
    onDragOver(event: DragEvent) {
      if (!carriesFiles(event)) return;
      // Accepting the drag is what makes the drop arrive; the copy effect is
      // what it does — the file stays where it came from.
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    },
    onDragLeave(event: DragEvent) {
      const into = event.relatedTarget;
      if (into instanceof Node && event.currentTarget.contains(into)) return;
      setDropActive(false);
    },
    onDrop(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDropActive(false);
      attachFiles(Array.from(event.dataTransfer.files).map(fromFile));
    },
  };

  return {
    rows,
    summary,
    dropActive,
    /**
     * A file still copying. Its placeholder is in the field, and a save or a
     * post now would write `[Attaching…]()` into the ticket for good.
     */
    pending: rows.some((row) => row.state === "pending"),
    attachFiles,
    onPaste,
    dropHandlers,
    dismiss: (id: number) =>
      setRows((current) => current.filter((row) => row.id !== id)),
  };
}

/** Refused here, before ten megabytes and more cross the bridge for nothing. */
function tooLarge(source: AttachSource): AppError | undefined {
  if (source.size <= ATTACHMENT_SIZE_LIMIT) {
    return undefined;
  }
  return {
    code: "too_large",
    message: `${source.name} is ${describeSize(source.size)}. Attachments can be up to 10 MB.`,
    recoverable: true,
  };
}

/** The rows under the field. The list is the live region (story 51). */
export function AttachStatus(props: {
  rows: AttachRow[];
  summary: string;
  onDismiss: (id: number) => void;
}) {
  return (
    <>
      {/* Mounted empty, so the first row is announced: a live region that
          arrives already holding its words is often not read (story 51). */}
      <ul
        className="attach-status"
        role="status"
        aria-live="polite"
        hidden={props.rows.length === 0}
      >
        {props.rows.map((row) => (
          <li key={row.id} className={row.state}>
            {row.state === "pending" && (
              <i className="attach-spinner" aria-hidden="true" />
            )}
            {row.state === "done" && <CheckGlyph />}
            <span>
              {row.state === "pending" &&
                `Attaching ${row.name} · ${describeSize(row.size ?? 0)}…`}
              {row.state === "done" && `Attached ${row.name}`}
              {row.state === "refused" && (
                <>
                  {row.message}
                  {row.hint && <span className="hint">{row.hint}</span>}
                </>
              )}
            </span>
            {row.state === "refused" && (
              <button
                type="button"
                tabIndex={0}
                aria-label="Dismiss"
                onClick={() => props.onDismiss(row.id)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* A live region by `aria-live` alone: the toast stack is the page's
          one `status`, and this is the field's quiet second voice. */}
      <span className="visually-hidden" aria-live="polite">
        {props.summary}
      </span>
    </>
  );
}

/** Inside the field while files are dragged over it (`attach.drop.*`). */
export function DropLabel(props: { ticketKey: string }) {
  return (
    <div className="drop-label" aria-hidden="true">
      <PaperclipGlyph size={12} />
      <span>
        Drop to attach to {props.ticketKey}{" "}
        <small>Images, text and video, up to 10 MB each</small>
      </span>
    </div>
  );
}

export function PaperclipGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="formatting-glyph attach-glyph"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m11.3 6.6-4.6 4.6a2.6 2.6 0 0 1-3.7-3.7l4.9-4.9a1.7 1.7 0 0 1 2.4 2.4L5.6 9.7a.8.8 0 0 1-1.1-1.1l4.2-4.2" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 7.4 2.6 2.6L11 4.4" />
    </svg>
  );
}

/**
 * The create surfaces' tray (story 40, `create.held`): what will be attached
 * once Create has written the ticket, one chip per file, each with a way to
 * think better of it.
 */
export function HeldFiles(props: {
  files: AttachSource[];
  onRemove: (index: number) => void;
}) {
  if (props.files.length === 0) return null;
  return (
    <p className="held-files">
      Attached when the ticket is created:
      {props.files.map((source, index) => (
        <span className="attachment-chip" key={`${source.name}-${index}`}>
          <span className="name">{source.name}</span>
          {source.kind === "file" && (
            <span className="meta">{describeSize(source.size)}</span>
          )}
          <button
            type="button"
            tabIndex={0}
            aria-label={`Don’t attach ${source.name}`}
            onClick={() => props.onRemove(index)}
          >
            ✕
          </button>
        </span>
      ))}
    </p>
  );
}
