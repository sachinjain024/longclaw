/**
 * Every fact about the site that more than one page needs, in one place.
 *
 * Copy claims here are sourced from the repo (README.md, docs/vision.md,
 * docs/user-guide.md, docs/release-notes/v0.1.0.md) via
 * docs/design/website-content-brief.md. The honesty constraints in §6 of that
 * brief apply: nothing here may promise what v0.1.0 does not do.
 */

export const SITE_URL = 'https://longclaw.io';

export const SITE = {
  name: 'LongClaw',
  /** Used as the default <title> suffix and in structured data. */
  tagline: 'Local-first issue tracker for AI coding agents',
  description:
    'LongClaw is a local-first project manager for humans and AI agents. Tickets are plain Markdown files in your repo — humans plan, agents execute and write their context back to the same record. macOS, open source, no account.',
  locale: 'en',
  /** Shown in the mono small print under every download CTA. */
  requirements: 'macOS 13+ · Apple Silicon · no account required',
  repo: 'https://github.com/sachinjain024/longclaw',
  /**
   * Where every Download CTA goes. Site-hosted rather than the GitHub release,
   * for two reasons recorded in website-content-brief.md §7: a releases page is
   * a list of artefacts shown to someone who has already said which one they
   * want, and this URL survives LC-204's transfer of the repository, after
   * which every `github.com/sachinjain024/…` link depends on a redirect GitHub
   * owns. The file is committed at `public/downloads/`, so it ships with the
   * site and is served from the same origin.
   *
   * **Site-relative on purpose.** An absolute `https://longclaw.io/…` here works
   * in production and nowhere else: every Download button on a local preview or
   * a branch build would leave for the live site, so the one control that
   * matters most is the one nobody can test before shipping it. Relative, the
   * button resolves against whatever origin is serving the page. Where a full
   * URL is genuinely needed — the `SoftwareApplication` structured data a
   * machine reads — compose it with `absolute()`, which leaves asset paths
   * unslashed.
   *
   * Changing the version means replacing the file, this line, `downloadSha256`
   * and `version` together. They are four spellings of one fact and there is no
   * guard that holds them to each other yet.
   */
  download: '/downloads/LongClaw_0.2.0_aarch64.dmg',
  downloadFile: 'LongClaw_0.2.0_aarch64.dmg',
  /** `shasum -a 256` of the file above, so a reader can check what they got. */
  downloadSha256: '24bcd926965b86b3a11d437890358da7901d983413fce6c8e90df6bfa85302e9',
  /** The canonical release record — notes, checksum, source tarballs. No CTA
      points here; it is for people who want the tag rather than the app. */
  releases: 'https://github.com/sachinjain024/longclaw/releases/tag/v0.2.0',
  license: 'MPL 2.0',
  licenseUrl: 'https://github.com/sachinjain024/longclaw/blob/main/LICENSE',
  contact: 'sachinjain.hq@gmail.com',
  author: 'Sachin Jain',
  version: '0.2.0',
} as const;

/** Primary navigation, in header order. */
export const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/docs/cli', label: 'CLI' },
  { href: '/blog', label: 'Blog' },
  { href: '/changelog', label: 'Changelog' },
] as const;

/**
 * The docs sidebar. Order here is the reading order, and `next`/`previous`
 * links at the foot of each page are derived from it — so adding a page means
 * adding one entry, not editing three files.
 */
export const DOCS_NAV = [
  { href: '/docs', label: 'Getting started' },
  { href: '/docs/project-folder', label: 'Your project folder' },
  { href: '/docs/what-a-ticket-is', label: 'What a ticket is' },
  { href: '/docs/ticket-properties', label: 'Ticket properties' },
  { href: '/docs/backups', label: 'Backups and version control' },
  { href: '/docs/working-with-agents', label: 'Working with agents' },
  { href: '/docs/troubleshooting', label: 'When something goes wrong' },
  { href: '/docs/file-format', label: 'File format reference' },
  { href: '/docs/cli', label: 'CLI' },
] as const;

export type DocsNavEntry = (typeof DOCS_NAV)[number];

/** Neighbours of `href` in the docs reading order, for the page-foot links. */
export function docsNeighbours(href: string): {
  previous?: DocsNavEntry;
  next?: DocsNavEntry;
} {
  const i = DOCS_NAV.findIndex((entry) => entry.href === href);
  if (i === -1) return {};
  return { previous: DOCS_NAV[i - 1], next: DOCS_NAV[i + 1] };
}

/**
 * Absolute URL for `path`, for canonical links and structured data.
 *
 * Pages build to directories, so the URL that actually serves is the one with
 * the trailing slash — `/docs` 301s to `/docs/`, and the sitemap emits the
 * slashed form. A canonical pointing at the redirecting form makes the two
 * signals disagree, so the slash is added here.
 *
 * Anything carrying a file extension is an asset (`/og.png`) and is left alone.
 */
export function absolute(path: string): string {
  const isAsset = /\.[a-z0-9]+$/i.test(path);
  const normalised = isAsset || path.endsWith('/') ? path : `${path}/`;
  return new URL(normalised, SITE_URL).href;
}
