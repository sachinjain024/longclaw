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
 *   gate wins. The danger toast names the failure and offers Retry — except on
 *   a conflict, where the hash the retry would re-send is stale by definition.
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
import { failureMessage, failureRecovery } from "./failure";
import type { AppError, WriteResult } from "./types";

/**
 * A failed write says what to do about it, whether or not the caller wrote its
 * own copy. A caller's `failure` is about *this* mutation — "the ticket could
 * not be created" — and the recovery is about the file underneath it, so the
 * two compose rather than one replacing the other.
 */
function withRecovery(error: AppError, own?: string): string {
  if (own === undefined) return failureMessage(error);
  const recovery = failureRecovery(error);
  return recovery ? `${own} ${recovery}` : own;
}

/** The single toast stack: a new mutation supersedes the last one. */
export interface Toast {
  id: number;
  message: string;
  tone: "default" | "danger";
  /** Present while the mutation can still be taken back. `⌘Z` runs this. */
  undo?: () => void;
  /**
   * Present on a failed write, alongside the reverted state — but never on a
   * conflict. A mutation re-sends the `expectedHash` it was built from, which a
   * conflict has already proved stale, so Retry there is a button that cannot
   * succeed.
   */
  retry?: () => void;
  /** A conflict's honest offer instead: look at the file as it now reads. */
  review?: () => void;
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
  /**
   * Where an unhandled conflict sends the human. `handles` is for a surface that
   * resolves conflicts itself; this is for a mutation raised outside one — a
   * card's priority, an archive, a reorder — where the only honest next action
   * is to show the ticket as the file now reads it and let them decide. Omit and
   * the conflict toast states the fact and offers nothing but dismissal.
   */
  review?: (error: AppError) => void;
}

/**
 * What a conflict says, wherever it landed.
 *
 * One composer, because the same typed error used to read two ways: Rust wrote
 * banner-shaped copy naming Reload and Keep mine, and the board — which has
 * neither button — had to invent its own wording (V0-29). Now the error states
 * the fact, this adds the actor when the context names one, and the *actions*
 * are the surface's: the panel's banner offers the choice, the toast offers
 * Open ticket.
 *
 * It reads `message` rather than rebuilding a sentence from `context`, because
 * whoever raised the error knows what happened to the file — "removed while you
 * were saving" is not "changed on disk", and a composer working from context
 * alone would flatten one into the other.
 */
export function conflictMessage(error: AppError): string {
  const key = error.context?.ticketKey;
  const name = error.context?.conflictingActorName;
  const type = error.context?.conflictingActorType;
  const fact =
    error.message.trim() ||
    `${key ?? "The file"} changed on disk. Your version was not written over it.`;
  if (!name) return fact;
  return `${fact} Last edited by ${name}${type ? ` (${type})` : ""}.`;
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
    // A conflict is the one failure re-sending cannot fix: the mutation holds
    // the hash it was built from, and a conflict means the disk has already
    // moved past it. Re-reading the hash here would write over whatever changed
    // the file, which is the loss the check exists to prevent
    // (`mvp_plan_order.md` § Step 14), so the offer is to go and look instead.
    const conflict = normalized.code === "conflict";
    store.raise({
      message: conflict
        ? conflictMessage(normalized)
        : withRecovery(normalized, mutation.failure?.(normalized)),
      tone: "danger",
      retry: conflict ? undefined : () => void mutate(mutation),
      review:
        conflict && mutation.review
          ? () => mutation.review?.(normalized)
          : undefined,
    });
    return undefined;
  }
}
