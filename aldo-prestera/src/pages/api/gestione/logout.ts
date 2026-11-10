import type { APIRoute } from 'astro';
import { COOKIE, clearSessionCookie, json, originOk } from '../../../lib/gestione';
import { call } from '../../../lib/ordini-api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!originOk(request)) return json({ ok: false, error: 'Richiesta non valida.' }, 403);
  const token = cookies.get(COOKIE)?.value;
  if (token) await call('/accesso/logout', { method: 'POST', body: {}, session: token }).catch((e) => console.error('[gestione] logout', e));
  clearSessionCookie(cookies);
  return json({ ok: true });
};
