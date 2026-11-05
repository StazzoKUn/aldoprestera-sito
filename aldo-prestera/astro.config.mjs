// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';

// Sito statico; solo /api/ordine gira sul server (prerender = false).
export default defineConfig({
  site: 'https://www.aldoprestera.it',
  integrations: [preact()],
  adapter: node({ mode: 'standalone' }),
});
