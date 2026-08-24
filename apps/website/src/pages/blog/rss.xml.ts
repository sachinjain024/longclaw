import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE, SITE_URL } from '../../lib/site';

export async function GET() {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: `${SITE.name} blog`,
    description: 'What changed in LongClaw, and why it works the way it does.',
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      author: post.data.author,
      link: `/blog/${post.id}`,
    })),
    customData: '<language>en</language>',
  });
}
