import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

/**
 * The roadmap is designed but unpublished, so it is disallowed here as well as
 * being noindex and absent from the sitemap.
 */
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /roadmap

Sitemap: ${SITE_URL}/sitemap-index.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
