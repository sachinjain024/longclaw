import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Three Markdown collections back the site's writable surfaces. Docs, blog
 * posts and changelog entries are files, edited the way LongClaw's own tickets
 * are — which is also what makes them cheap for an agent to add to.
 */

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    /** Meta description and the page's lead paragraph. */
    description: z.string(),
    /** Sidebar label, when it should differ from the title. */
    navLabel: z.string().optional(),
    /** Small uppercase mono label above the h1. */
    eyebrow: z.string(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    draft: z.boolean().default(false),
  }),
});

const changelog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/changelog' }),
  schema: z.object({
    /** Bare version, e.g. "0.1.0". The `v` prefix is presentation. */
    version: z.string(),
    title: z.string(),
    date: z.coerce.date(),
    /** One line, shown in its own bordered block. Omit when there are none. */
    limitations: z.string().optional(),
    requirements: z.string().optional(),
  }),
});

export const collections = { docs, blog, changelog };
