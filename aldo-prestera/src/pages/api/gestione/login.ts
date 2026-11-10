import type { APIRoute } from 'astro';
import { json, originOk, setSessionCookie } from '../../../lib/gestione';
import { ApiError, call } from '../../../lib/ordini-api';
import { consenti } from '../../../lib/ratelimit';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!originOk(request)) return json({ ok: false, error: 'Richiesta non valida.' }, 403);
  // Limite per IP (oltre al blocco per account di ordini-api)
  if (!consenti(`login:${clientAddress}`, 10, 15 * 60_000)) {
    return json({ ok: false, error: 'Troppi tentativi, riprova tra qualche minuto.' }, 429);
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return json({ ok: false, error: 'Inserisci utente e password.' }, 400);
  }

  try {
    const res = await call<{ token: string; utente: { nome: string } }>('/accesso/login', {
      method: 'POST',
      body: { username: body.username, password: body.password },
    });
    setSessionCookie(cookies, res.token);
    return json({ ok: true, nome: res.utente.nome });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return json({ ok: false, error: 'Utente o password non corretti.' }, 401);
    if (err instanceof ApiError && err.status === 429) return json({ ok: false, error: 'Troppi tentativi, riprova tra qualche minuto.' }, 429);
    console.error('[gestione] login fallito', err);
    return json({ ok: false, error: 'Servizio non disponibile, riprova.' }, 503);
  }
};
