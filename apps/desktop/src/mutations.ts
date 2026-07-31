/**
 * One way to run a change to a ticket: render it now, write it in the
 * background, and tell the truth about the disk afterwards.
 *
 * Three rules shape it:
 *
 * - Optimistic first. `apply` renders the final state before the write leaves,
 *   and returns the function that puts it back. Nothing in the UI waits on IPC.
 * - A failed write reverts. `states.md:64-67` would keep the optimistic value
 *   visible and mark it unsaved; V0-17's gate says revert and say so, and the
 *   gate wins. The danger toast names the failure and offers Retry.
 * - Undo is a mutation. The inverse goes out through the ordinary write path
 *   (`edit_ticket`), so there is no undo IPC call and no second write path to
 *   keep honest. Undo mutations carry no `undo` of their own: the scope is the
 *   inverse of the last mutation, not a history stack
 *   (`data-requirements.md:121`).
 *
 * The store is separate from `useLongClawStore` on purpose. That one is a cache
 * of what is on disk (ADR 0006); this one is session UI that never survives a
 * reload and never claims to be a fact about a file.
 */

import { create } from "zustand";
import { normalizeError } from "./errors";
import type { AppError, WriteResult } from "./types";

/** The single toast stack: a new mutation supersedes the last one. */
export interface Toast {
  id: number;
  message: string;
  tone: "default" | "danger";
  /** Present while the mutation can still be taken back. `⌘Z` runs this. */
  undo?: () => void;
  /** Present on a failed write, alongside the reverted state. */
  retry?: () => void;
}

export interface Mutation {
  /**
   * The file this write lands in, for the disk-state indicator. A create does
   * not know its path yet; leaving it out makes the indicator say `ticket.md`.
   */
  path?: string;
  /**
   * Renders the final state now. Return the function that puts it back — a
   * failed write calls it. Omit for a change with nothing to show early.
   */
  apply?: () => (() => void) | void;
  /** The write itself, through the ordinary IPC command. */
  write: () => Promise<WriteResult>;
  /** Adopts what actually landed on disk. Runs before the toast is raised. */
  onWritten?: (written: WriteResult) => void;
  /**
   * Toast copy, given what landed — a create only learns its key here. Omit for
   * a mutation that is not destructive-adjacent (`states.md:62`): those get the
   * disk-state indicator and nothing else.
   */
  toast?: (written: WriteResult) => string;
  /**
   * The mutation that takes this one back. Omit and the toast carries no Undo.
   * It is an ordinary mutation, so it gets the same write feedback and its own
   * toast copy.
   */
  undo?: (written: WriteResult) => Mutation;
  /**
   * Failures the caller owns. A conflict is not a failed write — it is a
   * decision the human has to make — so returning true leaves the optimistic
   * state alone and raises no danger toast.
   */
  handles?: (error: AppError) => boolean;
  /** What the danger toast says. Defaults to the error's own message. */
  failure?: (error: AppError) => string;
}

interface MutationState {
  toast?: Toast;
  /** The file a write is in flight for. Undefined means nothing is unsettled. */
  writing?: string;
  /** The file the last write landed in, for the settled `✓` state. */
  settled?: string;
  /** Writes still out. Concurrent writes must not clear each other's spinner. */
  inFlight: number;
  raise: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  beginWrite: (path?: string) => void;
  /** A path means the write landed there; nothing means it never landed. */
  endWrite: (landed?: string) => void;
}

let nextToastId = 1;

export const useMutationStore = create<MutationState>((set) => ({
  inFlight: 0,
  raise: (toast) => set({ toast: { ...toast, id: nextToastId++ } }),
  dismiss: (id) =>
    set((state) => (state.toast?.id === id ? { toast: undefined } : {})),
  beginWrite: (path) =>
    set((state) => ({
      inFlight: state.inFlight + 1,
      writing: path ?? "ticket.md",
    })),
  endWrite: (landed) =>
    set((state) => {
      const inFlight = Math.max(0, state.inFlight - 1);
      return {
        inFlight,
        writing: inFlight === 0 ? undefined : state.writing,
        settled: landed ?? state.settled,
      };
    }),
}));

/** Drops every toast and write mark. For tests and for switching projects. */
export function resetMutations() {
  useMutationStore.setState({
    toast: undefined,
    writing: undefined,
    settled: undefined,
    inFlight: 0,
  });
}

/**
 * Runs one mutation. Resolves with what landed, or `undefined` when the write
 * failed — callers that need to re-read the file should check.
 */
export async function mutate(
  mutation: Mutation,
): Promise<WriteResult | undefined> {
  const revert = mutation.apply?.();
  const store = useMutationStore.getState();
  store.beginWrite(mutation.path);

  try {
    const written = await mutation.write();
    mutation.onWritten?.(written);
    useMutationStore.getState().endWrite(written.ticket.relativePath);
    const message = mutation.toast?.(written);
    if (message) {
      const undo = mutation.undo;
      store.raise({
        message,
        tone: "default",
        undo: undo ? () => void mutate(undo(written)) : undefined,
      });
    }
    return written;
  } catch (error) {
    const normalized = normalizeError(error);
    useMutationStore.getState().endWrite();
    if (mutation.handles?.(normalized)) return undefined;
    revert?.();
    store.raise({
      message: mutation.failure?.(normalized) ?? normalized.message,
      tone: "danger",
      retry: () => void mutate(mutation),
    });
    return undefined;
  }
}
