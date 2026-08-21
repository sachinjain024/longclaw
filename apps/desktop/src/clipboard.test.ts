import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";
import { resetMutations, useMutationStore } from "./mutations";

describe("copying to the clipboard", () => {
  beforeEach(() => resetMutations());
  afterEach(() => vi.restoreAllMocks());

  it("writes the text and says it went", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyToClipboard("LC-1", { done: "LC-1 copied", failed: "no" });

    expect(writeText).toHaveBeenCalledWith("LC-1");
    expect(useMutationStore.getState().toast).toMatchObject({
      message: "LC-1 copied",
      tone: "default",
    });
  });

  it("says so in the danger tone when the browser refuses", async () => {
    // A document that is not focused rejects, and a copy that quietly did
    // nothing is indistinguishable from one that worked.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await copyToClipboard("LC-1", {
      done: "LC-1 copied",
      failed: "Could not copy LC-1",
    });

    expect(useMutationStore.getState().toast).toMatchObject({
      message: "Could not copy LC-1",
      tone: "danger",
    });
  });
});
