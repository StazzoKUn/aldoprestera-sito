import type { APIRoute } from 'astro';
import { currentUser, json } from '../../../lib/gestione';

export const prerender = false;

/** GET: chi è collegato (401 se nessuno): serve al pannello per sapere se rimandare al login */
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const utente = await currentUser(cookies);
    return utente ? json({ ok: true, utente }) : json({ ok: false }, 401);
  } catch (err) {
    console.error('[gestione] verifica sessione', err);
    return json({ ok: false, error: 'Servizio non disponibile.' }, 503);
  }
};
