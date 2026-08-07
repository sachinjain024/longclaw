/**
 * The failure presentation, and the one thing about it that crosses IPC.
 *
 * `context.cause` is behavior rather than prose — it decides whether a recovery
 * is offered and which one — so the set of values is pinned on both sides of the
 * wire, the same way `appliedFieldChanges` pins what an edit can write.
 */

import { describe, expect, it } from "vitest";
import ipcContractJson from "../src-tauri/tests/fixtures/ipc-contract.json";
import {
  failureGuarantee,
  failureMessage,
  failureRecovery,
  failureTitle,
} from "./failure";
import { FAILURE_CAUSES, type AppError } from "./types";

function failure(context?: Record<string, string>): AppError {
  return {
    code: "permission_denied",
    message: "Saving ticket failed for ticket.md.",
    recoverable: true,
    context,
  };
}

describe("the write-failure cause", () => {
  it("is the set the IPC contract pins", () => {
    const pinned = (ipcContractJson as { writeFailureCauses: string[] })
      .writeFailureCauses;

    expect(FAILURE_CAUSES).toEqual(pinned);
  });

  it("offers a recovery for every cause the contract names", () => {
    for (const cause of FAILURE_CAUSES) {
      expect(failureRecovery(failure({ cause }))).toBeTruthy();
    }
  });

  it("offers none for a cause this build does not know, or for none at all", () => {
    // A newer Rust could send a cause this build has never heard of. Silence
    // leaves Retry, which is honest; a guess would send somebody to check
    // permissions on an ejected volume.
    expect(failureRecovery(failure({ cause: "solarFlare" }))).toBeUndefined();
    expect(failureRecovery(failure())).toBeUndefined();
  });
});

describe("what the app promises about the bytes", () => {
  it("says the file is untouched, and says where when it is not", () => {
    expect(failureGuarantee(failure())).toBe("The file was left as it was.");
    // The one save that leaves something behind says where it left it.
    expect(
      failureGuarantee(
        failure({ preservedPath: "/projects/app/.ticket.md.conflict.bak" }),
      ),
    ).toContain("/projects/app/.ticket.md.conflict.bak");
    // An unrecoverable failure promises nothing rather than guessing.
    expect(
      failureGuarantee({ ...failure(), recoverable: false }),
    ).toBeUndefined();
  });

  it("never presents a bare error code as a title", () => {
    expect(failureTitle(failure())).not.toContain("permission_denied");
    expect(failureTitle(failure())).not.toContain("permission denied");
  });
});

/**
 * LC-145. Rust writes a message as a clause and stops, so three of them joined
 * with a space read as one run-on: *"The selected project folder is no longer
 * available The file was left as it was."*
 */
describe("three sentences read as three sentences", () => {
  it("ends each one, whether or not its writer did", () => {
    expect(
      failureMessage({
        code: "project_unavailable",
        message: "The selected project folder is no longer available",
        recoverable: true,
      }),
    ).toBe(
      "The selected project folder is no longer available. The file was left as it was.",
    );
  });

  it("leaves punctuation the writer supplied alone", () => {
    expect(failureMessage(failure({ cause: "noSpace" }))).toBe(
      "Saving ticket failed for ticket.md. Free some space on the volume, then try again. The file was left as it was.",
    );
  });

  it("ends the caller's own opening sentence too", () => {
    expect(failureMessage(failure(), "The ticket could not be created")).toBe(
      "The ticket could not be created. The file was left as it was.",
    );
  });
});
