---
name: product-docs
description: Write or revise a page of LongClaw's product documentation on longclaw.io/docs — getting started, the project folder, tickets, backups, agents, troubleshooting, the file format or the CLI reference. Use when the user wants to add a docs page, rewrite one, or bring the published docs back in step with the repo after a behaviour change.
---

Docs pages are Markdown in `apps/website/src/content/docs/`. One file is one
page. `index.mdx` is `/docs`; every other filename is its slug.

**Read [`apps/website/README.md`](../../../apps/website/README.md)** for the
directory map and the rules the whole site is built to.

## The repo is the source, the site is the published form

Every claim on a docs page must be traceable to a file in this repository:

| Page | Source |
|---|---|
| Getting started | `docs/release-notes/<version>.md` |
| Project folder, tickets, backups, agents, troubleshooting | `docs/user-guide.md` |
| File format reference | `docs/file_format.md` |
| CLI | `README.md` CLI section, `docs/agents/issue-tracker.md`, ADR 0011 |

Where the two disagree, **the repo is right and the site is stale**. Do not
invent behaviour, soften a limitation, or describe something you have not found
in the source. If the source itself is wrong, fix it there first — that has
happened twice, and both times the site would have repeated the error.

**This is the failure mode to watch for.** A repo doc changes and the published
page silently keeps saying the old thing. Nothing catches it. When you are asked
to update docs after a behaviour change, grep the site content for the old claim
rather than only adding the new one.

## Adding a page

1. Create `src/content/docs/<slug>.mdx`:

   ```yaml
   ---
   title: What the page is about
   description: One sentence. Doubles as the meta description and the page's lead paragraph, so write it to work as both.
   eyebrow: Guide
   navLabel: Shorter sidebar label   # optional; defaults to title
   ---
   ```

2. Add one entry to `DOCS_NAV` in `src/lib/site.ts`, at the right point in the
   reading order.

That is all. The route, the sidebar entry, the on-this-page rail, the
previous/next links, the breadcrumb and the structured data all derive from
those two things.

## Writing one

- **Start at `##`.** The `h1` and the lead come from the frontmatter; a second
  `h1` in the body breaks the heading order the audit checks.
- **Voice:** calm, precise, honest — the voice already in `docs/user-guide.md`.
  Short declarative sentences, second person, sentence case. No hype, no
  exclamation marks, no emoji.
- **Be honest about limits.** "That is not a mode; it is what the app is capable
  of" is the register. Say what v0.1.0 does not do rather than omitting it.
- **Mono for anything file-native** — paths, ticket IDs, flags, commands.

Components available in `.mdx`, imported with a relative path from
`src/components/`:

- `<FileTree lines={[…]} />` — a mono tree. Notes align into a computed column;
  never hand-space them.
- `<CommandBlock cmd desc output id />` — a terminal block with a copy button.
- `<Callout tone="warning|note" label>` — a quiet bordered note, not an alarm.

## Verify

```sh
npm run site:verify
```

Then read the rendered page. Check the sidebar entry, the on-this-page rail, the
previous/next links at the foot, and that every code block and tree renders as
one block rather than one line per span.
