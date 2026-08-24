import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';

/**
 * The one raster the site needs: iOS home-screen icons ignore SVG. It is
 * generated from the same geometry as the SVG favicon, so there is no PNG
 * checked in that can drift from the mark.
 */
const SIZE = 180;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
<rect width="180" height="180" rx="40" fill="#B45F06"/>
<g transform="translate(38 40) scale(1.04)" fill="#FFFFFF">
<path d="M0 0 50 30.07 100 0 96.61 18.67 55.98 43.05 50 53.07 44.02 43.05 3.39 18.67Z"/>
<path d="M14.03 29.84A43.74 43.74 0 1 0 85.97 29.84L73.83 37.14A29.65 29.65 0 1 1 26.17 37.14Z"/>
<path d="M50 55.92 43.95 60.93 50 73.72 56.05 60.93Z"/>
</g></svg>`;

export const GET: APIRoute = () => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
