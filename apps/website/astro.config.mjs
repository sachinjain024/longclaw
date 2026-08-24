// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

import { SITE_URL } from './src/lib/site.ts';

// Static output for GitHub Pages, served from the apex domain in public/CNAME.
// `base` stays '/' — every internal link in the site is written root-relative.
export default defineConfig({
  site: SITE_URL,
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [
    mdx(),
    sitemap({
      // The roadmap is designed but deliberately unpublished (LC-205 §4.6):
      // it must not appear in the sitemap or be indexed.
      filter: (page) => !page.includes('/roadmap'),
    }),
  ],
  markdown: {
    // One dark theme in both appearances, on purpose: a code block on this
    // site is terminal chrome, and the design keeps that chrome dark whichever
    // appearance the page is in. A light/dark theme pair would put light
    // syntax colours on the dark block. Vesper is the warm-neutral one, which
    // sits with ochre rather than fighting it.
    shikiConfig: { theme: 'vesper', wrap: false },
    // Astro already slugs headings; this makes the slug clickable so a section
    // of the docs can be linked to without hunting for the id.
    processor: unified({
      rehypePlugins: [
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { class: 'heading-anchor', 'aria-label': 'Link to this section' },
            content: { type: 'text', value: '#' },
          },
        ],
      ],
    }),
  },
  devToolbar: { enabled: false },
});
