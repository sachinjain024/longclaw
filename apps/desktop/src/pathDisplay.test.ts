import { describe, expect, it } from "vitest";
import { splitPath, tildeAbbreviate } from "./pathDisplay";

describe("tildeAbbreviate", () => {
  it("abbreviates only the actual home directory", () => {
    expect(tildeAbbreviate("/Users/sachin/dev/fixture", "/Users/sachin")).toBe(
      "~/dev/fixture",
    );
    expect(tildeAbbreviate("/Users/sachin", "/Users/sachin")).toBe("~");
    // A prefix is not a parent: `/Users/sachina` is somebody else.
    expect(tildeAbbreviate("/Users/sachina/dev", "/Users/sachin")).toBe(
      "/Users/sachina/dev",
    );
    expect(tildeAbbreviate("/Volumes/Backup/longclaw", "/Users/sachin")).toBe(
      "/Volumes/Backup/longclaw",
    );
  });

  it("leaves everything alone when the native layer has no home to give", () => {
    expect(tildeAbbreviate("/Users/sachin/dev", null)).toBe(
      "/Users/sachin/dev",
    );
  });
});

describe("splitPath", () => {
  it("splits at the last separator, keeping it on the tail", () => {
    expect(splitPath("~/Developer/work/acme-corp/longclaw-fixture")).toEqual({
      head: "~/Developer/work/acme-corp",
      tail: "/longclaw-fixture",
    });
  });

  it("gives the identifying folder to the tail, which never gets cut", () => {
    // The head is `~/Developer/…`, which is the same on every path in this app;
    // the last folder is the one that says which project this is. CSS shrinks
    // the head and never the tail, so this split is what decides that.
    const { tail } = splitPath("~/Developer/work/acme-corp/longclaw-fixture");
    expect(tail).toBe("/longclaw-fixture");
  });

  it("returns the whole thing as tail when there is no head to spend", () => {
    expect(splitPath("~")).toEqual({ head: "", tail: "~" });
    expect(splitPath("fixture")).toEqual({ head: "", tail: "fixture" });
    // A leading separator is not a head: there is nothing before it to cut.
    expect(splitPath("/fixture")).toEqual({ head: "", tail: "/fixture" });
    expect(splitPath("")).toEqual({ head: "", tail: "" });
  });

  it("rejoins to exactly what it was handed", () => {
    // The split is a display detail and never a change of value: the chip's
    // `title` and its clipboard both carry the full path, and these two halves
    // have to be that same string with nothing added or dropped.
    const paths = [
      "~/Developer/work/acme-corp/longclaw-fixture-project",
      "/Volumes/Backup Drive/archive/2025/longclaw",
      "~/Documents/Screenshots and scratch/longclaw-two",
      "~/Documents/🦉🦉🦉/owl-project-folder",
      "/",
      "//",
      "~",
      "",
    ];
    for (const path of paths) {
      const { head, tail } = splitPath(path);
      expect(head + tail, path).toBe(path);
    }
  });

  it("does not cut a character in half", () => {
    // A folder with an emoji in its name is unusual and entirely legal, and the
    // split falls on a separator rather than on a count — so unlike the
    // character cap this replaced, there is no surrogate pair to land inside.
    const { head, tail } = splitPath("~/Documents/🦉🦉🦉/owl-project-folder");
    expect(head).toBe("~/Documents/🦉🦉🦉");
    expect(tail).toBe("/owl-project-folder");
    expect(head + tail).not.toContain("\uFFFD");
  });
});
