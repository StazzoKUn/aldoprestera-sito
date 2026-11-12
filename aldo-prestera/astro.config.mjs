// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';

// Sito statico; solo /api/ordine gira sul server (prerender = false).
export default defineConfig({
  // Il sito risponde su aldoprestera.it: www.aldoprestera.it non ha un record DNS (verificato il 2026-11-12).
  // Questo indirizzo finisce anche nei link e nel logo delle email, quindi deve essere raggiungibile.
  site: 'https://aldoprestera.it',
  integrations: [preact()],
  adapter: node({ mode: 'standalone' }),
  // Dietro il proxy di Plesk l'URL pubblico arriva in X-Forwarded-Host/Proto: lo si accetta solo per il nostro dominio
  // (serve al controllo dell'Origin di /api/gestione, vedi src/lib/gestione.ts).
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'www.aldoprestera.it' },
      { protocol: 'https', hostname: 'aldoprestera.it' },
    ],
  },
});
