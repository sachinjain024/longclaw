#!/usr/bin/env node
/**
 * The update manifest, the notes that go in it (LC-256a, D8), and the shape
 * the archive it points at has to have (LC-265y).
 *
 * An installed copy of LongClaw learns that a newer one exists by fetching one
 * static JSON file from the latest GitHub release
 * ([ADR 0014](../../../docs/adr/0014-one-optional-check-for-a-newer-longclaw.md)).
 * This is what writes that file.
 *
 * **It is its own module, and it has a self-test, because a release must never
 * be the first time this code runs.** `release-macos.mjs` is driven by hand,
 * once per version, on one machine, with Apple in the loop — the worst possible
 * place to discover that a notes extractor returns the frontmatter or that a
 * manifest names the wrong platform. Everything here is a pure function of its
 * arguments, so `--self-test` can run all of it in the gate.
 *
 * **The notes come from `docs/release-notes/`, which the site's changelog also
 * follows.** One source, so the sentence the app's Updates pane shows is the
 * sentence the site shows. Retyping them into the manifest is the version of
 * this that drifts.
 *
 * Usage: node scripts/update-manifest.mjs --self-test
 */

import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { gunzipSync, gzipSync } from "node:zlib";

/**
 * The one platform v0 ships, as Tauri's updater names it.
 *
 * One entry, matching the one artefact the release produces. A manifest naming
 * platforms the release does not build would offer an update that 404s.
 */
export const PLATFORM = "darwin-aarch64";

/**
 * The release notes for a version, as prose the pane can render.
 *
 * Three things come off: the YAML frontmatter, which is document metadata and
 * not news; the `# LongClaw x.y.z` title, because the pane already says the
 * version in its own heading and would otherwise say it twice; and the
 * repository-relative links, which resolve to nothing inside an app.
 *
 * What is left is Markdown, which is what the pane renders.
 */
export function releaseNotes(markdown) {
  let text = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  text = text.replace(/^#\s+LongClaw[^\n]*\n/m, "");
  // `[label](../path.md)` becomes `label`: a relative link is a dead link in
  // the pane, and a dead link reads as a broken app rather than as a document
  // that was written for a repository.
  text = text.replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, "$1");
  return text.trim();
}

/**
 * The manifest, exactly as Tauri's updater reads it.
 *
 * `version` carries no leading `v`: the plugin compares it as semver against
 * the running bundle's own version, and `v0.2.0` does not parse.
 */
export function updateManifest({
  version,
  notes,
  signature,
  archiveUrl,
  pubDate,
}) {
  for (const [name, value] of Object.entries({
    version,
    signature,
    archiveUrl,
    pubDate,
  })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`the manifest needs a ${name}`);
    }
  }
  if (version.startsWith("v")) {
    throw new Error(
      `version must be bare semver for the updater to compare it, got ${version}`,
    );
  }
  if (!archiveUrl.startsWith("https://")) {
    throw new Error(`the archive URL must be https, got ${archiveUrl}`);
  }
  return {
    version,
    notes: notes ?? "",
    pub_date: pubDate,
    platforms: {
      [PLATFORM]: { signature, url: archiveUrl },
    },
  };
}

/**
 * Whether a published manifest is the one this release just made.
 *
 * The last step of a release, and the one that catches the failure the whole
 * feature exists to avoid: a release that ships and updates nobody, because the
 * manifest was not refreshed. It is a separate question from "did the upload
 * succeed" — an upload can succeed against the wrong release.
 */
export function manifestNamesVersion(manifest, version) {
  const found = [];
  if (manifest?.version !== version) {
    found.push(
      `the published manifest names version ${manifest?.version ?? "nothing"}, and this release is ${version}`,
    );
  }
  const platform = manifest?.platforms?.[PLATFORM];
  if (!platform) {
    found.push(`the published manifest has no ${PLATFORM} entry`);
  } else {
    if (!platform.url?.includes(version)) {
      found.push(
        `the ${PLATFORM} archive URL does not name this version: ${platform.url}`,
      );
    }
    if (!platform.signature) {
      found.push(`the ${PLATFORM} entry carries no signature`);
    }
  }
  return found;
}

/* ------------------------------------------------- the archive's own shape */

/**
 * Every entry in a `.app.tar.gz`, read the way the updater reads it (LC-265y).
 *
 * **This walks the tar headers itself, and that is the whole point.** Apple's
 * `bsdtar` folds AppleDouble entries — the `._name` files macOS writes to carry
 * a file's extended attributes — back into xattrs as it reads, so `tar tzf`
 * shows an archive full of them as clean. The Rust `tar` crate inside
 * `tauri-plugin-updater` does not: it sees each `._name` as an ordinary file.
 * Checking the release artifact with the same tool that made it is what let
 * 0.3.0 ship an archive no installed copy could extract, so the check has to
 * read the bytes rather than ask macOS.
 *
 * A pax or GNU metadata header (`x`, `g`) is consumed rather than listed, for
 * the same reason a correct reader consumes it. Everything else is a name. A
 * GNU long-name entry (`L`, `././@LongLink`) is *not* handled and would be
 * reported as a stranger at the root: `bsdtar` does not emit one for paths this
 * short, and a release that stops and says so is the safe way to be wrong.
 */
export function tarEntryNames(gzipped) {
  const tar = gunzipSync(gzipped);
  const names = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const block = tar.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) break;
    const field = (start, length) => {
      const raw = block.subarray(start, start + length);
      const end = raw.indexOf(0);
      return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
    };
    const size = Number.parseInt(field(124, 12).trim() || "0", 8) || 0;
    const kind = String.fromCharCode(block[156]);
    if (kind !== "x" && kind !== "g") {
      const name = field(0, 100);
      const prefix = field(345, 155);
      names.push(prefix ? `${prefix}/${name}` : name);
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

/**
 * What is wrong with an update archive's shape, as sentences, or nothing.
 *
 * Two rules, both of which 0.3.0's archive broke and neither of which any
 * command anyone would have run on it would have shown:
 *
 * 1. **No AppleDouble entries.** `tauri-plugin-updater` strips the leading
 *    path component of every entry before extracting it, so `._LongClaw.app` —
 *    one component — becomes the empty path, and the updater tries to unpack a
 *    163-byte file onto its own extraction directory. It fails on the archive's
 *    first entry, and the pane says *The download didn't finish.*
 * 2. **One thing at the root, and it is the bundle.** The same stripping means
 *    the root component is thrown away, so an archive with two of them
 *    interleaves two trees into one directory.
 */
export function archiveComplaints(names, bundleName) {
  const found = [];
  if (names.length === 0) {
    found.push("the archive has no entries at all");
    return found;
  }

  const appleDouble = names.filter((name) =>
    (name.split("/").pop() ?? "").startsWith("._"),
  );
  if (appleDouble.length > 0) {
    found.push(
      `the archive carries ${appleDouble.length} AppleDouble entr${appleDouble.length === 1 ? "y" : "ies"}, starting with \`${appleDouble[0]}\` — ` +
        "the updater cannot extract these and will fail on the first one. " +
        "Pack with COPYFILE_DISABLE=1 in the environment.",
    );
  }

  const roots = [
    ...new Set(names.map((name) => name.split("/")[0]).filter(Boolean)),
  ];
  const strangers = roots.filter((root) => root !== bundleName);
  if (strangers.length > 0) {
    found.push(
      `the archive has more than ${bundleName} at its root: ${strangers.join(", ")}`,
    );
  }
  if (!roots.includes(bundleName)) {
    found.push(`the archive does not contain ${bundleName}`);
  }
  return found;
}

/** Reads the notes file for one version, or dies saying which one is missing. */
export function releaseNotesFor(version, directory) {
  const path = `${directory}/v${version}.md`;
  try {
    return releaseNotes(readFileSync(path, "utf8"));
  } catch {
    throw new Error(
      `no release notes at ${path} — the manifest takes its notes from there, so write them before shipping`,
    );
  }
}

/* ------------------------------------------------------------------ self-test */

if (process.argv.includes("--self-test")) {
  const failures = [];
  const check = (what, condition) => {
    if (!condition) failures.push(what);
  };

  const notes = releaseNotes(
    [
      "---",
      'title: "LongClaw 0.2.0 release notes"',
      "status: published",
      "---",
      "",
      "# LongClaw 0.2.0",
      "",
      "The board remembers its scroll.",
      "",
      "**[How to use it](../user-guide.md)** — project folders.",
      "See [the site](https://longclaw.io) as well.",
      "",
    ].join("\n"),
  );

  check("the frontmatter is not news", !notes.includes("status: published"));
  check(
    "the title is not repeated under the pane's own heading",
    !notes.includes("# LongClaw 0.2.0"),
  );
  check("the prose survives", notes.includes("board remembers its scroll"));
  check(
    "a repository-relative link becomes its label",
    notes.includes("**How to use it**") && !notes.includes("../user-guide.md"),
  );
  check(
    "an absolute link is left alone",
    notes.includes("[the site](https://longclaw.io)"),
  );

  const manifest = updateManifest({
    version: "0.2.0",
    notes,
    signature: "dW50cnVzdGVk",
    archiveUrl:
      "https://github.com/sachinjain024/longclaw/releases/download/v0.2.0/LongClaw.app.tar.gz",
    pubDate: "2026-09-19T00:00:00.000Z",
  });
  check(
    "the manifest names the platform",
    Boolean(manifest.platforms[PLATFORM]),
  );
  check("the manifest carries the notes", manifest.notes === notes);
  check(
    "the published manifest is accepted when it matches",
    manifestNamesVersion(manifest, "0.2.0").length === 0,
  );

  // Both directions. A checker that accepted everything would satisfy the case
  // above just as well as the right one does.
  check(
    "a manifest for another version is caught",
    manifestNamesVersion(manifest, "0.3.0").length > 0,
  );
  check(
    "a manifest with no platform entry is caught",
    manifestNamesVersion({ version: "0.2.0", platforms: {} }, "0.2.0").length >
      0,
  );
  check(
    "a manifest whose URL names another version is caught",
    manifestNamesVersion(
      {
        version: "0.2.0",
        platforms: {
          [PLATFORM]: { signature: "x", url: "https://x/v0.1.0/a.tar.gz" },
        },
      },
      "0.2.0",
    ).length > 0,
  );
  check(
    "an unsigned entry is caught",
    manifestNamesVersion(
      {
        version: "0.2.0",
        platforms: { [PLATFORM]: { url: "https://x/v0.2.0/a.tar.gz" } },
      },
      "0.2.0",
    ).length > 0,
  );

  const refuses = (what, build) => {
    try {
      build();
      failures.push(what);
    } catch {
      // Refused, which is the expectation.
    }
  };
  refuses("a v-prefixed version is refused", () =>
    updateManifest({
      version: "v0.2.0",
      notes,
      signature: "x",
      archiveUrl: "https://x/a.tar.gz",
      pubDate: "now",
    }),
  );
  refuses("a plain-http archive URL is refused", () =>
    updateManifest({
      version: "0.2.0",
      notes,
      signature: "x",
      archiveUrl: "http://x/a.tar.gz",
      pubDate: "now",
    }),
  );
  refuses("a missing signature is refused", () =>
    updateManifest({
      version: "0.2.0",
      notes,
      signature: "",
      archiveUrl: "https://x/a.tar.gz",
      pubDate: "now",
    }),
  );

  /* ---------------------------------------------- the archive's own shape */

  /* A tar written here, header by header, so the reader above is exercised
     against bytes rather than against a mock of itself. */
  const tarOf = (names) => {
    const blocks = names.map((name) => {
      const header = Buffer.alloc(512);
      header.write(name, 0, 100, "utf8");
      header.write("0000644\0", 100, 8, "utf8");
      header.write("0000000\0", 108, 8, "utf8");
      header.write("0000000\0", 116, 8, "utf8");
      header.write("00000000000\0", 124, 12, "utf8");
      header.write("00000000000\0", 136, 12, "utf8");
      header.write(name.endsWith("/") ? "5" : "0", 156, 1, "utf8");
      header.write("ustar\u000000", 257, 8, "utf8");
      header.fill(" ", 148, 156);
      let sum = 0;
      for (const byte of header) sum += byte;
      header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");
      return header;
    });
    return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
  };

  /* A tar built here rather than read from disk, because the point is a reader
     that does not fold AppleDouble entries away — the exact blindness that let
     LC-265y ship. Apple's `tar tzf` would show none of these. */
  const archive = tarOf([
    "._LongClaw.app",
    "LongClaw.app/",
    "LongClaw.app/Contents/",
    "LongClaw.app/Contents/._Info.plist",
    "LongClaw.app/Contents/Info.plist",
  ]);
  check(
    "every entry is seen, AppleDouble included",
    tarEntryNames(archive).length === 5,
  );
  check(
    "the AppleDouble entry is named",
    tarEntryNames(archive).includes("._LongClaw.app"),
  );
  check(
    "an archive carrying AppleDouble entries is refused",
    archiveComplaints(tarEntryNames(archive), "LongClaw.app").length > 0,
  );
  check(
    "the complaint names the entry that breaks extraction first",
    archiveComplaints(tarEntryNames(archive), "LongClaw.app")[0].includes(
      "._LongClaw.app",
    ),
  );
  check(
    "a clean archive is accepted",
    archiveComplaints(
      tarEntryNames(
        tarOf([
          "LongClaw.app/",
          "LongClaw.app/Contents/",
          "LongClaw.app/Contents/Info.plist",
        ]),
      ),
      "LongClaw.app",
    ).length === 0,
  );
  check(
    "a second top-level component is caught",
    archiveComplaints(
      ["LongClaw.app/Contents/Info.plist", "Other.app/Contents/Info.plist"],
      "LongClaw.app",
    ).length > 0,
  );
  check(
    "an archive that does not carry the bundle at all is caught",
    archiveComplaints(["Other.app/Contents/Info.plist"], "LongClaw.app")
      .length > 0,
  );
  check(
    "an empty archive is caught",
    archiveComplaints([], "LongClaw.app").length > 0,
  );

  if (failures.length > 0) {
    console.error(
      `update-manifest --self-test: ${failures.length} failure(s)\n  ${failures.join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log(
    "update-manifest: notes extraction and the manifest shape hold, in both directions",
  );
}
