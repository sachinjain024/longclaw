import { create } from "zustand";
import type {
  AppError,
  ProjectReference,
  ProjectSnapshot,
  StreamEnvelope,
  StreamFrame,
  TicketView,
} from "./types";

interface SpikeState {
  projects: ProjectReference[];
  activeProjectId?: string;
  tickets: TicketView[];
  generation: number;
  lastSequence: number;
  lastEvent?: StreamEnvelope;
  streamFrames: StreamFrame[];
  loading: boolean;
  error?: AppError;
  setProjects: (projects: ProjectReference[]) => void;
  applySnapshot: (snapshot: ProjectSnapshot) => void;
  applyEvent: (envelope: StreamEnvelope) => void;
  applyLocalWrite: (ticket: TicketView, generation: number) => void;
  appendStreamFrame: (frame: StreamFrame) => void;
  clearStreamFrames: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: AppError) => void;
}

const byKey = (a: TicketView, b: TicketView) =>
  a.key.localeCompare(b.key, undefined, { numeric: true });

export const useSpikeStore = create<SpikeState>((set, get) => ({
  projects: [],
  tickets: [],
  generation: 0,
  lastSequence: 0,
  streamFrames: [],
  loading: false,
  setProjects: (projects) => set({ projects }),
  applySnapshot: (snapshot) =>
    set((state) => {
      const switchingProject =
        state.activeProjectId !== snapshot.project.id;
      return {
        activeProjectId: snapshot.project.id,
        tickets: [...snapshot.tickets].sort(byKey),
        generation: snapshot.generation,
        lastSequence: switchingProject ? 0 : state.lastSequence,
        lastEvent: switchingProject ? undefined : state.lastEvent,
        error: undefined,
      };
    }),
  applyEvent: (envelope) => {
    const state = get();
    if (envelope.sequence <= state.lastSequence) return;
    if (
      state.activeProjectId &&
      envelope.projectId !== state.activeProjectId
    ) {
      return;
    }

    const event = envelope.event;
    if (event.type === "ticketChanged") {
      set({
        tickets: [
          ...state.tickets.filter(
            (ticket) => ticket.key !== event.data.ticket.key,
          ),
          event.data.ticket,
        ].sort(byKey),
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
  applyLocalWrite: (ticket, generation) =>
    set((state) => ({
      tickets: [
        ...state.tickets.filter((item) => item.key !== ticket.key),
        ticket,
      ].sort(byKey),
      generation,
      error: undefined,
    })),
  appendStreamFrame: (frame) =>
    set((state) => ({ streamFrames: [...state.streamFrames, frame] })),
  clearStreamFrames: () => set({ streamFrames: [] }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
