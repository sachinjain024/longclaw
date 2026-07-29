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

export interface AppError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  context?: Record<string, string>;
}

export interface ProjectReference {
  id: string;
  name: string;
  rootPath: string;
  theme: string;
  reachable: boolean;
}

export interface ActorSummary {
  type: "human" | "agent" | "unknown";
  name?: string;
}

export type TicketStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "canceled";

export interface TicketView {
  key: string;
  title: string;
  status: TicketStatus;
  checkedCount: number;
  checklistCount: number;
  contentHash: string;
  relativePath: string;
  degraded: boolean;
  diagnostic?: string;
  lastActor?: ActorSummary;
}

export interface ProjectSnapshot {
  project: ProjectReference;
  tickets: TicketView[];
  generation: number;
  rebuiltInMs: number;
}

export interface SearchResult {
  tickets: TicketView[];
  elapsedMs: number;
}

export interface WriteTicketTitleRequest {
  projectId: string;
  ticketKey: string;
  title: string;
  expectedHash: string;
}

export interface WriteResult {
  ticket: TicketView;
  generation: number;
  atomicRename: boolean;
  watcherEchoSuppressed: boolean;
}

export type ProjectEvent =
  | {
      type: "ticketChanged";
      data: {
        ticket: TicketView;
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
