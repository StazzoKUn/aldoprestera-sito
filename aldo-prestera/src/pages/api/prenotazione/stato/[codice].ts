import type { APIRoute } from 'astro';
import { notifyReservationExpired } from '../../../../lib/decisione';
import { ApiError, getPublicReservation } from '../../../../lib/ordini-api';
import { consenti } from '../../../../lib/ratelimit';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

/**
 * GET /api/prenotazione/stato/<codice pubblico> — stato per la pagina di attesa (polling).
 * Se la richiesta scade proprio ora (orario passato senza risposta) parte l'email di rifiuto.
 * Risponde solo con stato, motivo e riepilogo; un codice sbagliato dà sempre 404.
 */
export const GET: APIRoute = async ({ params, clientAddress, site }) => {
  if (!consenti(`stato-prenotazione:${clientAddress}`, 60, 60_000)) {
    return json({ ok: false, error: 'Troppe richieste, riprova tra poco.' }, 429);
  }
  const code = params.codice ?? '';
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(code)) return json({ ok: false }, 404);

  try {
    const { contatto, appena_scaduta, ...prenotazione } = await getPublicReservation(code);
    if (appena_scaduta) {
      const logoUrl = site ? new URL('/email/logo-chiaro.png', site).href : undefined;
      // Se l'email fallisce la prenotazione resta rifiutata: l'errore è già nei log e il pannello lo segnala
      await notifyReservationExpired(code, { ...prenotazione, appena_scaduta, contatto }, logoUrl, site);
    }
    return json({ ok: true, prenotazione });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return json({ ok: false }, 404);
    console.error('[prenotazione] stato non disponibile', err);
    return json({ ok: false, error: 'Servizio non disponibile.' }, 503);
  }
};
