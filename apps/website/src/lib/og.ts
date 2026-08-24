import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import { SITE } from './site';

/**
 * Social share cards, rendered at build time.
 *
 * A shared link with no card looks broken, and every raster OG image is a
 * binary in the repo that goes stale the moment the wording changes. So the
 * card is drawn from the same tokens as the site — satori lays it out with the
 * real IBM Plex faces, resvg rasterises it — and the only thing checked in is
 * the code that draws it.
 *
 * The card is always the dark appearance: it reads better against the light
 * chrome of most feeds, and it is the "Dock Night" side of the palette.
 */

const require = createRequire(import.meta.url);

const COLORS = {
  bg: '#14120D',
  card: '#1A1812',
  border: '#2B2820',
  accent: '#E89B2F',
  agent: '#2FBF8F',
  text: '#FAF6EF',
  muted: '#A99C88',
  faint: '#7E7463',
};

/** The owl mark, as a data URI so satori can place it as an image. */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 98.28" fill="${COLORS.accent}"><path d="M0 0 50 30.07 100 0 96.61 18.67 55.98 43.05 50 53.07 44.02 43.05 3.39 18.67Z"/><path d="M14.03 29.84A43.74 43.74 0 1 0 85.97 29.84L73.83 37.14A29.65 29.65 0 1 1 26.17 37.14Z"/><path d="M50 55.92 43.95 60.93 50 73.72 56.05 60.93Z"/></svg>`;
const MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`;

let fontCache: Awaited<ReturnType<typeof loadFonts>> | undefined;

async function loadFonts() {
  // satori reads ttf/otf/woff — not woff2 — so these are the .woff variants
  // that @fontsource ships alongside. They are build-time only and never
  // served to a visitor.
  const files = {
    sans400: '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff',
    sans600: '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff',
    mono400: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
  } as const;

  const [sans400, sans600, mono400] = await Promise.all(
    Object.values(files).map((id) => readFile(require.resolve(id)))
  );

  return [
    { name: 'IBM Plex Sans', data: sans400!, weight: 400 as const, style: 'normal' as const },
    { name: 'IBM Plex Sans', data: sans600!, weight: 600 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: mono400!, weight: 400 as const, style: 'normal' as const },
  ];
}

export interface OgCard {
  /** Small mono label above the headline, e.g. "Docs" or "Changelog". */
  eyebrow?: string;
  title: string;
  subtitle: string;
}

export async function renderOgImage({ eyebrow, title, subtitle }: OgCard): Promise<Buffer> {
  fontCache ??= await loadFonts();

  /* Long titles need to step down a size or they overflow the card. */
  const titleSize = title.length > 58 ? 50 : title.length > 38 ? 58 : 66;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: COLORS.bg,
          padding: '64px 72px',
          fontFamily: 'IBM Plex Sans',
          // A single warm hairline instead of a border box — flat brand.
          borderBottom: `8px solid ${COLORS.accent}`,
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: 16 },
              children: [
                { type: 'img', props: { src: MARK_URI, width: 44, height: 43 } },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 34, fontWeight: 600, color: COLORS.text, letterSpacing: '-0.01em' },
                    children: SITE.name,
                  },
                },
                ...(eyebrow
                  ? [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontFamily: 'IBM Plex Mono',
                            fontSize: 20,
                            letterSpacing: '0.08em',
                            color: COLORS.accent,
                            textTransform: 'uppercase',
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.card,
                            borderRadius: 999,
                            padding: '4px 16px',
                            marginLeft: 8,
                          },
                          children: eyebrow,
                        },
                      },
                    ]
                  : []),
              ],
            },
          },

          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: 24 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: titleSize,
                      fontWeight: 600,
                      color: COLORS.text,
                      lineHeight: 1.1,
                      letterSpacing: '-0.02em',
                      maxWidth: 1000,
                    },
                    children: title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 27, color: COLORS.muted, lineHeight: 1.45, maxWidth: 940 },
                    children: subtitle,
                  },
                },
              ],
            },
          },

          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                fontFamily: 'IBM Plex Mono',
                fontSize: 21,
                color: COLORS.faint,
              },
              children: [
                { type: 'div', props: { style: { color: COLORS.accent }, children: 'longclaw.io' } },
                { type: 'div', props: { children: '·' } },
                { type: 'div', props: { children: SITE.requirements } },
                { type: 'div', props: { children: '·' } },
                { type: 'div', props: { style: { color: COLORS.agent }, children: SITE.license } },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630, fonts: fontCache }
  );

  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
