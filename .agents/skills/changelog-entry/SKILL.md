---
name: changelog-entry
description: Add or revise a release entry on longclaw.io/changelog. Use when a LongClaw version ships, when release notes change and the published changelog needs to follow, or when the user asks to write up what changed in a release.
---

Changelog entries are Markdown in `apps/website/src/content/changelog/`, one
file per release, named for the version. They render newest first on a single
page, and the version is the anchor (`0.1.0` → `#v0-1-0`).

**Read [`apps/website/README.md`](../../../apps/website/README.md)** for the
content model and the rules the site is built to.

## The release notes are the source

`docs/release-notes/<version>.md` is where a release is written up. The
changelog entry is the **published form of that file**, not a second account of
the release. Derive it; do not compose it independently, and do not let the two
drift.

## Do not publish ahead of the release

**An entry must not claim a release that has not happened.** Shipping a
changelog entry for a release nobody can download is the single worst thing this
skill can do: every Download CTA on the site points at
`SITE.download`, and a changelog row for a version that is not behind it makes
the whole page a liar.

`docs/release-notes/<version>.md` is the tell. Check before writing:

- Is the release note still `status: draft`?
- Does its acceptance record still name open blockers?
- Is the artefact published — the `.dmg` in `apps/website/public/downloads/`
  and attached to the release — with a matching `sha256`?

If any answer is wrong, say so and stop.

**Writing the entry on the release branch is the exception, and it is how 0.1.0
shipped.** The entry, the release notes and the artefact land in one branch, so
during that branch the third answer is legitimately "not yet". What must not
happen is the *merge*: nothing goes to `main` until the build exists, because
merging is what publishes. If you are on such a branch, say which one and carry
on; if you are on `main`, the three questions are the gate and they bind.

## Adding an entry

Create `src/content/changelog/<version>.md`:

```yaml
---
version: "0.1.0"          # bare, no v — the v is presentation
title: The local core     # a short name for the release
date: 2026-08-22
limitations: "One line, mid-dot separated. Omit the field if there are none."
requirements: "macOS 13+ · Apple Silicon"
---

- One bullet per user-visible change, in the docs voice.
- Written from what the user can now do, not from what was implemented.
```

The body is a plain Markdown list; the page styles it with the design's mid-dot
bullets. `limitations` renders in its own bordered block, `requirements` as the
mono line beneath.

## Writing the bullets

- **User-visible changes only.** A refactor with no observable effect is not a
  changelog line.
- **What it does, not what was built.** "Watch the project folder, so an edit
  made by an agent appears without a refresh" — not "added a file watcher".
- **Keep the known limitations honest.** They are the part a reader trusts you
  for. Carry them across from the release notes rather than trimming them.
- No marketing adjectives, no emoji, no exclamation marks.

## Verify

```sh
npm run site:verify
```

Then check the rendered page: the entry appears newest first, the version anchor
resolves (`/changelog#v0-1-0`), the limitations block renders, and
`/changelog/rss.xml` includes it.
