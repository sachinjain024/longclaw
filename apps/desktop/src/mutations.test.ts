/**
 * The seam every ticket mutation runs through, on its own.
 *
 * The call sites prove the product behaviour; these prove the contract later
 * surfaces are going to build against — that `apply` runs before the write,
 * that a failure reverts and says so, that a conflict is left to its owner, and
 * that undo is an ordinary mutation rather than a second write path.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mutate, resetMutations, useMutationStore } from "./mutations";
import type { WriteResult } from "./types";

function written(overrides?: { path?: string; hash?: string }): WriteResult {
  return {
    ticket: {
      state: "indexed",
      key: "LC-1",
      id: "019c8c7e",
      title: "Prove the round trip",
      status: "todo",
      priority: "none",
      labels: [],
      createdAt: "2026-07-31T09:00:00Z",
      updatedAt: "2026-07-31T09:00:00Z",
      checkedCount: 0,
      checklistCount: 0,
      commentCount: 0,
      attachmentCount: 0,
      contentHash: overrides?.hash ?? "hash-1",
      relativePath: overrides?.path ?? ".longclaw/tickets/LC-1/ticket.md",
    },
    generation: 2,
    changes: [],
  };
}

beforeEach(resetMutations);

describe("running a mutation", () => {
  it("applies before the write leaves and reports the file it is writing", async () => {
    const applied: string[] = [];
    let settle: (result: WriteResult) => void = () => {};
    const running = mutate({
      path: ".longclaw/tickets/LC-1/ticket.md",
      apply: () => {
        applied.push("apply");
        return () => applied.push("revert");
      },
      write: () =>
        new Promise<WriteResult>((resolve) => {
          settle = resolve;
        }),
    });

    expect(applied).toEqual(["apply"]);
    expect(useMutationStore.getState().writing).toBe(
      ".longclaw/tickets/LC-1/ticket.md",
    );

    settle(written());
    await running;

    expect(applied).toEqual(["apply"]);
    expect(useMutationStore.getState().writing).toBeUndefined();
    expect(useMutationStore.getState().settled).toBe(
      ".longclaw/tickets/LC-1/ticket.md",
    );
  });

  it("reverts a failed write and raises a danger toast that can retry it", async () => {
    const revert = vi.fn();
    const write = vi
      .fn()
      .mockRejectedValueOnce({
        code: "io",
        message: "No space left on device",
        recoverable: true,
      })
      .mockResolvedValueOnce(written());

    await mutate({ apply: () => revert, write });

    expect(revert).toHaveBeenCalledTimes(1);
    const toast = useMutationStore.getState().toast;
    expect(toast).toMatchObject({
      tone: "danger",
      message: "No space left on device",
    });
    // Nothing landed, so the settled `✓` must not claim a file.
    expect(useMutationStore.getState().settled).toBeUndefined();

    toast?.retry?.();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  });

  it("leaves a handled failure to its owner, reverting nothing", async () => {
    const revert = vi.fn();
    const handles = vi.fn().mockReturnValue(true);

    const result = await mutate({
      apply: () => revert,
      write: () =>
        Promise.reject({
          code: "conflict",
          message: "The file changed on disk",
          recoverable: true,
        }),
      handles,
    });

    expect(result).toBeUndefined();
    expect(handles).toHaveBeenCalledWith(
      expect.objectContaining({ code: "conflict" }),
    );
    expect(revert).not.toHaveBeenCalled();
    expect(useMutationStore.getState().toast).toBeUndefined();
  });

  it("never offers Retry for a conflict, because the hash it would re-send is stale", async () => {
    const revert = vi.fn();
    const review = vi.fn();
    const write = vi.fn().mockRejectedValue({
      code: "conflict",
      // What Rust actually sends now: the fact, and no button it cannot show.
      message: "LC-1 changed on disk. Your version was not written over it.",
      recoverable: true,
      context: {
        ticketKey: "LC-1",
        expectedHash: "hash-1",
        actualHash: "hash-2",
        conflictingActorType: "agent",
        conflictingActorName: "Claude",
      },
    });

    await mutate({ apply: () => revert, write, review });

    // Unhandled, so it is still a refused write: the optimistic state goes back.
    expect(revert).toHaveBeenCalledTimes(1);
    const toast = useMutationStore.getState().toast;
    expect(toast?.tone).toBe("danger");
    expect(toast?.retry).toBeUndefined();
    expect(toast?.message).toContain("LC-1 changed on disk");
    expect(toast?.message).toContain("Claude (agent)");
    // The banner's buttons are not on screen out here, so the copy must not
    // send anybody looking for them (V0-29).
    expect(toast?.message).not.toContain("Reload");
    expect(toast?.message).not.toContain("keep your version");

    toast?.review?.();
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({ code: "conflict" }),
    );
    // And it never re-sent anything.
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("says a conflict plainly when the error names no actor and no key", async () => {
    await mutate({
      write: () =>
        Promise.reject({
          code: "conflict",
          message: "This ticket's file was removed while you were saving.",
          recoverable: true,
        }),
    });

    const toast = useMutationStore.getState().toast;
    expect(toast?.retry).toBeUndefined();
    // No `review`, so the toast offers nothing but dismissal rather than a
    // button that goes nowhere.
    expect(toast?.review).toBeUndefined();
    // The error knew something the frontend does not — the file was *removed*,
    // not edited — so the composer keeps its sentence rather than flattening it
    // into a generic one.
    expect(toast?.message).toBe(
      "This ticket's file was removed while you were saving.",
    );
  });

  it("raises no toast for a mutation that is not destructive-adjacent", async () => {
    await mutate({ write: () => Promise.resolve(written()) });

    expect(useMutationStore.getState().toast).toBeUndefined();
  });

  it("runs undo as an ordinary mutation, with its own toast and no undo of its own", async () => {
    const inverse = vi.fn().mockResolvedValue(written({ hash: "hash-2" }));

    await mutate({
      write: () => Promise.resolve(written()),
      toast: (result) => `${result.ticket.key} created`,
      undo: (result) => ({
        write: () => inverse(result.ticket.contentHash),
        toast: () => `${result.ticket.key} archived`,
      }),
    });

    const created = useMutationStore.getState().toast;
    expect(created?.message).toBe("LC-1 created");
    created?.undo?.();

    await vi.waitFor(() =>
      expect(useMutationStore.getState().toast?.message).toBe("LC-1 archived"),
    );
    // The inverse went out against the hash the first write left behind.
    expect(inverse).toHaveBeenCalledWith("hash-1");
    // Undo is the last step, not a stack: there is nothing to redo.
    expect(useMutationStore.getState().toast?.undo).toBeUndefined();
  });

  /**
   * V0-29. `permission_denied` and `io` kept Retry, correctly, and said only
   * what Rust said. A read-only folder is an ordinary thing to happen, and the
   * toast has to say what to do about it.
   */
  it("tells a write failure what to do about itself, and keeps Retry", async () => {
    await mutate({
      write: () =>
        Promise.reject({
          code: "permission_denied",
          message:
            "Saving ticket failed for ticket.md. The file or the folder it is in is read-only.",
          recoverable: true,
          context: {
            path: "/projects/app/.longclaw/tickets/LC-1/ticket.md",
            fileName: "ticket.md",
            cause: "readOnly",
          },
        }),
    });

    const toast = useMutationStore.getState().toast;
    expect(toast?.tone).toBe("danger");
    expect(toast?.message).toContain("ticket.md");
    expect(toast?.message).toContain("read-only");
    expect(toast?.message).toContain("Give yourself write access");
    // Nothing about the file changed, so re-sending the same edit is right.
    expect(toast?.retry).toBeTruthy();
  });

  it("offers no recovery for a failure nothing classified", async () => {
    await mutate({
      write: () =>
        Promise.reject({
          code: "io",
          message: "Saving ticket failed for ticket.md. the volume was ejected.",
          recoverable: true,
          context: { path: "/projects/app/.longclaw/tickets/LC-1/ticket.md" },
        }),
    });

    const toast = useMutationStore.getState().toast;
    expect(toast?.message).toBe(
      "Saving ticket failed for ticket.md. the volume was ejected.",
    );
    expect(toast?.retry).toBeTruthy();
  });

  it("keeps the indicator busy until the last concurrent write settles", async () => {
    let settleFirst: (result: WriteResult) => void = () => {};
    const first = mutate({
      path: "a/ticket.md",
      write: () =>
        new Promise<WriteResult>((resolve) => {
          settleFirst = resolve;
        }),
    });
    const second = mutate({
      path: "b/ticket.md",
      write: () => Promise.resolve(written({ path: "b/ticket.md" })),
    });

    await second;
    expect(useMutationStore.getState().writing).toBe("b/ticket.md");

    settleFirst(written({ path: "a/ticket.md" }));
    await first;
    expect(useMutationStore.getState().writing).toBeUndefined();
  });
});
