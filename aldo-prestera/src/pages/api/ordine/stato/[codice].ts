import type { APIRoute } from 'astro';
import { notifyExpired } from '../../../../lib/decisione';
import { ApiError, getPublicOrder } from '../../../../lib/ordini-api';
import { consenti } from '../../../../lib/ratelimit';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

/**
 * GET /api/ordine/stato/<codice pubblico> — stato per la pagina di attesa (polling ogni 10 s).
 * Applica la scadenza dei 15 minuti: se l'ordine scade proprio ora parte l'email di rifiuto.
 * Risponde solo con stato, motivo e riepilogo; un codice sbagliato dà sempre 404.
 */
export const GET: APIRoute = async ({ params, clientAddress, site }) => {
  if (!consenti(`stato:${clientAddress}`, 60, 60_000)) {
    return json({ ok: false, error: 'Troppe richieste, riprova tra poco.' }, 429);
  }
  const code = params.codice ?? '';
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(code)) return json({ ok: false }, 404);

  try {
    const { contatto, appena_scaduto, ...ordine } = await getPublicOrder(code);
    if (appena_scaduto) {
      const logoUrl = site ? new URL('/email/logo-chiaro.png', site).href : undefined;
      // Se l'email fallisce l'ordine resta rifiutato: l'errore è già nei log e il pannello lo segnala
      await notifyExpired({ ...ordine, codice: code, appena_scaduto, contatto }, logoUrl, site);
    }
    return json({ ok: true, ordine });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return json({ ok: false }, 404);
    console.error('[ordine] stato non disponibile', err);
    return json({ ok: false, error: 'Servizio non disponibile.' }, 503);
  }
};
