import { describe, expect, it } from "vitest";
import tauriConfig from "../src-tauri/tauri.conf.json";
import { ATTACHMENT_SCHEME, attachmentSrc } from "./attachmentSrc";

describe("attachmentSrc", () => {
  it("names the project, the ticket and the file, each encoded alone", () => {
    expect(
      attachmentSrc(
        "proj-1",
        "LC-206",
        "attachments/att_7d2a-failure state.png",
      ),
    ).toBe(
      "longclaw-attachment://localhost/proj-1/LC-206/attachments/att_7d2a-failure%20state.png",
    );
  });

  it("has no URL for anything that is not a file in attachments/", () => {
    for (const file of [
      "ticket.md",
      "attachments/",
      "attachments/sub/x.png",
      "../attachments/x.png",
    ]) {
      expect(attachmentSrc("p", "LC-1", file), file).toBeUndefined();
    }
  });

  it("is a scheme the window's CSP lets an image and a video load from", () => {
    const csp = tauriConfig.app.security.csp;
    expect(csp).toMatch(new RegExp(`img-src[^;]*${ATTACHMENT_SCHEME}:`));
    expect(csp).toMatch(new RegExp(`media-src[^;]*${ATTACHMENT_SCHEME}:`));
  });
});
