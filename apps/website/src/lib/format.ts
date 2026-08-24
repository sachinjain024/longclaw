/** Dates read as "22 Aug 2026" everywhere on the site — the design's format. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** "0.1.0" → "v0-1-0", the changelog's anchor id. */
export function versionAnchor(version: string): string {
  return `v${version.replace(/\./g, '-')}`;
}
