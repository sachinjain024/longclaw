import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { versionAnchor } from '../../lib/format';
import { SITE, SITE_URL } from '../../lib/site';

export async function GET() {
  const entries = (await getCollection('changelog')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: `${SITE.name} changelog`,
    description: 'Every LongClaw release, in order.',
    site: SITE_URL,
    items: entries.map((entry) => ({
      title: `v${entry.data.version} — ${entry.data.title}`,
      // The body is Markdown; the summary line carries enough for a reader.
      description: entry.data.limitations
        ? `${entry.data.title}. Known limitations: ${entry.data.limitations}`
        : entry.data.title,
      pubDate: entry.data.date,
      link: `/changelog#${versionAnchor(entry.data.version)}`,
    })),
    customData: '<language>en</language>',
  });
}
