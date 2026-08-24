import type { APIRoute } from 'astro';
import { type CollectionEntry, getCollection } from 'astro:content';
import { renderOgImage } from '../../../lib/og';

/** A share card per blog post, so a shared post shows its own headline. */
export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const post = (props as { post: CollectionEntry<'blog'> }).post;
  const png = await renderOgImage({
    eyebrow: 'Blog',
    title: post.data.title,
    subtitle: post.data.description,
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
