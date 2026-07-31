import { create } from "zustand";
import type { ExternalMarks } from "./freshness";
import { externalMark, pruneMarks } from "./freshness";
import type {
  AppError,
  ProjectReference,
  ProjectSnapshot,
  StreamEnvelope,
  StreamFrame,
  TicketRow,
} from "./types";

interface LongClawState {
  projects: ProjectReference[];
  activeProjectId?: string;
  appearance: "light" | "dark" | "system";
  tickets: TicketRow[];
  generation: number;
  lastSequence: number;
  lastEvent?: StreamEnvelope;
  /**
   * Changes that arrived from disk and have not been reviewed yet, keyed by
   * ticket. App-authored writes never appear here: the engine suppresses its own
   * writes, so anything in this map came from outside.
   */
  externalMarks: ExternalMarks;
  streamFrames: StreamFrame[];
  loading: boolean;
  /**
   * Set when a project event went missing: the board is stale and cannot be
   * caught up incrementally, because the events that would have caught it up are
   * the ones that were lost.
   *
   * The store only raises the flag. Asking Rust for a snapshot is `App`'s job —
   * the store is a cache, not a second source of truth (ADR 0006) — and
   * `applySnapshot` lowers it again.
   */
  reconciling: boolean;
  error?: AppError;
  setProjects: (projects: ProjectReference[]) => void;
  upsertProject: (project: ProjectReference) => void;
  removeProjectReference: (projectId: string) => void;
  markProjectReachable: (projectId: string, reachable: boolean) => void;
  setActiveProjectId: (projectId?: string) => void;
  setAppearance: (appearance: "light" | "dark" | "system") => void;
  applySnapshot: (snapshot: ProjectSnapshot) => void;
  applyEvent: (envelope: StreamEnvelope, observedAt?: number) => void;
  /**
   * The snapshot `reconciling` asked for could not be fetched. Lowers the flag
   * without adopting a sequence, so the next gap asks once more rather than the
   * app either retrying in a loop or going deaf for the rest of the session.
   */
  reconcileFailed: () => void;
  applyLocalWrite: (ticket: TicketRow, generation: number) => void;
  /** Opening a ticket is the review that decays its acknowledgement. */
  reviewTicket: (ticketKey: string) => void;
  sweepMarks: (now: number) => void;
  appendStreamFrame: (frame: StreamFrame) => void;
  clearStreamFrames: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: AppError) => void;
}

const byKey = (a: TicketRow, b: TicketRow) =>
  a.key.localeCompare(b.key, undefined, { numeric: true });

function without(marks: ExternalMarks, ticketKey: string): ExternalMarks {
  if (!(ticketKey in marks)) return marks;
  const next = { ...marks };
  delete next[ticketKey];
  return next;
}

export const useLongClawStore = create<LongClawState>((set, get) => ({
  projects: [],
  appearance: "system",
  tickets: [],
  generation: 0,
  lastSequence: 0,
  externalMarks: {},
  streamFrames: [],
  loading: false,
  reconciling: false,
  setProjects: (projects) => set({ projects }),
  upsertProject: (project) =>
    set((state) => ({
      projects: [
        ...state.projects.filter((item) => item.id !== project.id),
        project,
      ].sort((left, right) => left.name.localeCompare(right.name)),
    })),
  removeProjectReference: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
      activeProjectId:
        state.activeProjectId === projectId ? undefined : state.activeProjectId,
      tickets: state.activeProjectId === projectId ? [] : state.tickets,
      lastEvent:
        state.activeProjectId === projectId ? undefined : state.lastEvent,
      externalMarks:
        state.activeProjectId === projectId ? {} : state.externalMarks,
      error: state.activeProjectId === projectId ? undefined : state.error,
    })),
  markProjectReachable: (projectId, reachable) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, reachable } : project,
      ),
    })),
  setActiveProjectId: (projectId) =>
    set({
      activeProjectId: projectId,
      tickets: [],
      generation: 0,
      lastSequence: 0,
      lastEvent: undefined,
      externalMarks: {},
      reconciling: false,
      error: undefined,
    }),
  setAppearance: (appearance) => set({ appearance }),
  applySnapshot: (snapshot) =>
    set((state) => {
      const switchingProject = state.activeProjectId !== snapshot.project.id;
      return {
        activeProjectId: snapshot.project.id,
        tickets: [...snapshot.tickets].sort(byKey),
        generation: snapshot.generation,
        // The snapshot's own boundary is what makes recovery converge: it says
        // which events these rows already account for, so the next incremental
        // event is judged against the truth rather than against a high-water mark
        // left behind by whatever we last happened to see. Never move it
        // backwards — an ordinary focus reconcile can carry an older boundary
        // than the events already applied on top of it.
        lastSequence: switchingProject
          ? snapshot.sequence
          : Math.max(state.lastSequence, snapshot.sequence),
        lastEvent: switchingProject ? undefined : state.lastEvent,
        // An index rebuild keeps its acknowledgements: the index is disposable,
        // but what an agent just did to the files is not.
        externalMarks: switchingProject ? {} : state.externalMarks,
        reconciling: false,
        error: undefined,
      };
    }),
  applyEvent: (envelope, observedAt = Date.now()) => {
    const state = get();
    if (envelope.sequence <= state.lastSequence) return;
    if (state.activeProjectId && envelope.projectId !== state.activeProjectId) {
      return;
    }
    // A different project's engine has its own sequence counter starting at zero,
    // which is why the guard above runs first. Reordering these two would make
    // every project switch look like a gap.
    if (state.reconciling) return;
    if (envelope.sequence > state.lastSequence + 1) {
      // An event was lost. Applying the one in hand would write newer state over
      // rows that are already missing a change, so stop applying and let `App`
      // fetch a snapshot. `lastSequence` deliberately does not advance: adopting
      // the new high-water mark is exactly how the change we never saw becomes
      // unrecoverable.
      set({ reconciling: true, loading: true });
      return;
    }

    const event = envelope.event;
    if (event.type === "ticketChanged") {
      const ticket = event.data.ticket;
      set({
        tickets: [
          ...state.tickets.filter((candidate) => candidate.key !== ticket.key),
          ticket,
        ].sort(byKey),
        externalMarks: {
          ...pruneMarks(state.externalMarks, observedAt),
          [ticket.key]: externalMark(ticket, observedAt),
        },
        lastEvent: envelope,
        lastSequence: envelope.sequence,
        error: undefined,
      });
      return;
    }
    if (event.type === "ticketRemoved") {
      set({
        tickets: state.tickets.filter(
          (ticket) => ticket.key !== event.data.ticketKey,
        ),
        externalMarks: without(state.externalMarks, event.data.ticketKey),
        lastEvent: envelope,
        lastSequence: envelope.sequence,
      });
      return;
    }
    if (event.type === "indexRebuilt") {
      set({
        tickets: [...event.data.snapshot.tickets].sort(byKey),
        generation: event.data.snapshot.generation,
        lastEvent: envelope,
        lastSequence: envelope.sequence,
      });
      return;
    }
    set({
      lastEvent: envelope,
      lastSequence: envelope.sequence,
      error: {
        code: "project_unavailable",
        message: `Project folder is unavailable: ${event.data.rootPath}`,
        recoverable: true,
      },
    });
  },
  reconcileFailed: () => set({ reconciling: false, loading: false }),
  applyLocalWrite: (ticket, generation) =>
    set((state) => ({
      tickets: [
        ...state.tickets.filter((item) => item.key !== ticket.key),
        ticket,
      ].sort(byKey),
      generation,
      // The human just wrote this row, so any pending acknowledgement on it has
      // been seen by definition.
      externalMarks: without(state.externalMarks, ticket.key),
      error: undefined,
    })),
  reviewTicket: (ticketKey) =>
    set((state) => ({
      externalMarks: without(state.externalMarks, ticketKey),
    })),
  sweepMarks: (now) =>
    set((state) => {
      const pruned = pruneMarks(state.externalMarks, now);
      return pruned === state.externalMarks ? {} : { externalMarks: pruned };
    }),
  appendStreamFrame: (frame) =>
    set((state) => ({ streamFrames: [...state.streamFrames, frame] })),
  clearStreamFrames: () => set({ streamFrames: [] }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
