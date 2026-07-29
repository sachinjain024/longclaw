/**
 * The IPC contract, mirroring `src-tauri/src/core/model.rs`.
 *
 * `tests/fixtures/ipc-contract.json` pins the wire shapes on the Rust side, so a
 * change there has to be reflected here.
 */

export type ErrorCode =
  | "cancelled"
  | "invalid_project"
  | "project_unavailable"
  | "ticket_not_found"
  | "parse_failed"
  | "unsupported_version"
  | "conflict"
  | "permission_denied"
  | "io"
  | "internal";

/** Expected failures cross IPC as a closed tagged shape (ADR 0010). */
export interface AppError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  /**
   * Small string values for recovery UI: `ticketKey`, `path`, `expectedHash`,
   * `actualHash`, `conflictingActorType`, `conflictingActorName`, `conflictingAt`.
   */
  context?: Record<string, string>;
}

/** Why a file, or one record inside it, could not be read. */
export interface Diagnostic {
  code: ErrorCode;
  message: string;
  /** 1-based line in the file, for the raw-file view. */
  line?: number;
}

export interface ProjectReference {
  id: string;
  name: string;
  rootPath: string;
  /** The immutable prefix of every ticket key in this project. */
  key: string;
  theme: string;
  /** False when the folder has moved or gone. The project stays listed. */
  reachable: boolean;
}

export type ActorType = "human" | "agent" | "unknown";

export interface Actor {
  type: ActorType;
  id?: string;
  name?: string;
}

export type TicketStatus =
  "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";

export type TicketPriority = "urgent" | "p1" | "p2" | "p3" | "p4" | "none";

export type ActivityKind =
  "create" | "update" | "comment" | "external_change" | (string & {});

export interface FieldChange {
  field: string;
  from?: string;
  to?: string;
}

export interface ActivitySummary {
  id: string;
  kind: ActivityKind;
  occurredAt: string;
  actor: Actor;
}

export interface ActivityEvent extends ActivitySummary {
  changes: FieldChange[];
  body: string;
}

export interface ChecklistItem {
  /** Absent until LongClaw adopts a task an agent appended. */
  id?: string;
  text: string;
  checked: boolean;
}

export interface Attachment {
  id: string;
  file: string;
  name: string;
  mediaType: string;
  size: number;
  addedAt: string;
  addedBy: Actor;
}

/** A readable ticket row. */
export interface IndexedTicket {
  state: "indexed";
  key: string;
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  labels: string[];
  // No assignee: local projects have none and no v0 surface renders one
  // (ADR 0001). The field is preserved on disk, not carried on the row.
  rank?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  checkedCount: number;
  checklistCount: number;
  commentCount: number;
  attachmentCount: number;
  lastActivity?: ActivitySummary;
  /** The hash an edit must carry back to be saved. */
  contentHash: string;
  relativePath: string;
  /** Embedded records that could not be read. The ticket is still usable. */
  recordDiagnostics?: Diagnostic[];
}

/** A ticket file that could not be read. It keeps its place in the project. */
export interface DegradedTicket {
  state: "degraded";
  /** The ticket directory's name: a degraded file has no trustworthy key. */
  key: string;
  contentHash: string;
  relativePath: string;
  byteLength: number;
  /** True for a newer format version, where there is nothing to fix. */
  readOnly: boolean;
  diagnostic: Diagnostic;
}

export type TicketRow = IndexedTicket | DegradedTicket;

/** The full record behind the ticket panel, read fresh from disk. */
export interface TicketDetail {
  key: string;
  relativePath: string;
  contentHash: string;
  byteLength: number;
  readOnly: boolean;
  ticket?: Ticket;
  diagnostic?: Diagnostic;
  /** The file as it is on disk, for the raw-file view. */
  raw: string;
  rawTruncated: boolean;
  /** Registry entries whose bytes are gone; their metadata is preserved. */
  missingAttachments: string[];
  /** Files with no registry entry. Recoverable, never deleted. */
  orphanAttachments: string[];
}

export interface Ticket {
  id: string;
  key: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string;
  labels: string[];
  rank?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  description: string;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  activity: ActivityEvent[];
  /**
   * True when the ticket's state is newer than its newest activity entry: someone
   * changed it without narrating the change. State stands; the history is simply
   * incomplete and is never rolled back to match.
   */
  historyIncomplete: boolean;
  /** Frontmatter keys this build does not interpret and preserves. */
  unknownKeys: string[];
  recordDiagnostics: Diagnostic[];
}

export interface ProjectSnapshot {
  project: ProjectReference;
  tickets: TicketRow[];
  generation: number;
  rebuiltInMs: number;
}

export interface SearchResult {
  tickets: TicketRow[];
  elapsedMs: number;
}

/** Absent fields are left alone, which is what keeps a write from touching them. */
export interface TicketEdit {
  title?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  labels?: string[];
  rank?: string;
  archived?: boolean;
  description?: string;
  checklist?: { itemId: string; checked: boolean }[];
  addChecklistItems?: string[];
  comment?: string;
}

export interface EditTicketRequest {
  projectId: string;
  ticketKey: string;
  /** The hash the edit started from. A different hash on disk is a conflict. */
  expectedHash: string;
  edit: TicketEdit;
}

export interface CreateTicketRequest {
  projectId: string;
  title: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  checklist?: string[];
}

export interface WriteResult {
  ticket: TicketRow;
  generation: number;
  changes: FieldChange[];
}

export type ProjectEvent =
  | {
      type: "ticketChanged";
      data: {
        ticket: TicketRow;
        source: "external";
        coalescedEvents: number;
        detectedInMs: number;
      };
    }
  | {
      type: "ticketRemoved";
      data: { ticketKey: string; source: "external" };
    }
  | {
      type: "indexRebuilt";
      data: { snapshot: ProjectSnapshot; reason: "manual" | "resume" };
    }
  | {
      type: "projectUnavailable";
      data: { rootPath: string };
    };

export interface StreamEnvelope {
  contractVersion: 1;
  sequence: number;
  projectId: string;
  emittedAt: string;
  event: ProjectEvent;
}

export type StreamFrame =
  | {
      event: "started";
      data: { streamId: string; kind: "architecture-probe" };
    }
  | {
      event: "chunk";
      data: { streamId: string; sequence: number; bytes: number[] };
    }
  | {
      event: "finished";
      data: { streamId: string; exitCode: number };
    };

export interface VisibleUiProbe {
  projectId: string;
  rowCount: number;
  rowTitles: string[];
  lastSequence: number;
  traceText: string;
  viewportWidth: number;
  viewportHeight: number;
}
