// Sessione di Aldo lato sito: cookie, controllo dell'Origin e verifica presso ordini-api.
// Il browser parla solo con /api/gestione/*: il token di sessione sta nel cookie HttpOnly
// e viene inoltrato all'API dal server del sito (header X-Sessione).
import type { AstroCookies } from 'astro';
import { ApiError, call } from './ordini-api';

export const COOKIE = 'aldo_sessione';
const TRENTA_GIORNI = 30 * 24 * 3600;

export interface Utente {
  id: string;
  username: string;
  nome: string;
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

export const setSessionCookie = (cookies: AstroCookies, token: string) =>
  cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !import.meta.env.DEV, // fuori dallo sviluppo solo su HTTPS
    path: '/',
    maxAge: TRENTA_GIORNI,
  });

export const clearSessionCookie = (cookies: AstroCookies) => cookies.delete(COOKIE, { path: '/' });

/** Le richieste che scrivono devono arrivare dal sito stesso (difesa extra oltre a SameSite=Strict) */
export const originOk = (request: Request) => {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
};

/** Scheda ordine restituita da ordini-api per il pannello (importi in euro, id come stringa) */
export interface Scheda {
  id: string;
  numero_ordine: string;
  stato: 'ricevuto' | 'accettato' | 'consegnato' | 'rifiutato' | 'annullato' | 'bozza';
  motivo_stato: string | null;
  scaduto: boolean;
  modalita: 'consegna' | 'asporto';
  orario_richiesto: string;
  creato_il: string;
  aggiornato_il: string;
  nome_cliente: string;
  telefono_cliente: string;
  cliente_email: string;
  metodo_pagamento: string;
  indirizzo: string | null;
  citofono: string | null;
  note: string | null;
  righe: { id: string; nome_prodotto: string; quantita: number; prezzo_unitario: number; totale_riga: number }[];
  costo_consegna: number;
  totale: number;
}

/**
 * Esegue un'azione del pannello: controlla l'Origin (se scrive) e la sessione nel cookie, poi
 * traduce gli errori di ordini-api in risposte chiare (401 sessione scaduta, 400/404/409 con il
 * messaggio dell'API, altrimenti 503 generico: dettagli solo nei log).
 */
export async function pannello(
  ctx: { request: Request; cookies: AstroCookies },
  opts: { write?: boolean },
  run: (session: string) => Promise<unknown>,
): Promise<Response> {
  if (opts.write && !originOk(ctx.request)) return json({ ok: false, error: 'Richiesta non valida.' }, 403);
  const session = ctx.cookies.get(COOKIE)?.value;
  if (!session) return json({ ok: false, error: 'Accesso richiesto.' }, 401);
  try {
    return json({ ok: true, ...((await run(session)) as object) });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return json({ ok: false, error: 'Sessione scaduta: accedi di nuovo.' }, 401);
      if ([400, 404, 409].includes(err.status)) return json({ ok: false, error: err.apiMessage ?? 'Operazione non valida.' }, err.status);
    }
    console.error('[gestione] errore', err);
    return json({ ok: false, error: 'Servizio non disponibile.' }, 503);
  }
}

/** Utente della sessione nel cookie, o null (sessione assente, scaduta o API non raggiungibile → errore) */
export async function currentUser(cookies: AstroCookies): Promise<Utente | null> {
  const token = cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    return await call<Utente>('/accesso/me', { session: token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
