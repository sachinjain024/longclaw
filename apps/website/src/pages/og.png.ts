import type { APIRoute } from 'astro';
import { renderOgImage } from '../lib/og';
import { SITE } from '../lib/site';

/** The site-wide share card, used by every page that has no card of its own. */
export const GET: APIRoute = async () => {
  const png = await renderOgImage({
    title: 'Local-first issue tracker for AI coding agents.',
    subtitle: SITE.description,
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
