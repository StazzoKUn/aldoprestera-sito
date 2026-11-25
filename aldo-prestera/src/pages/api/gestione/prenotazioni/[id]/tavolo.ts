import type { APIRoute } from 'astro';
import { json, pannello, type SchedaPrenotazione } from '../../../../../lib/gestione';
import { call } from '../../../../../lib/ordini-api';

export const prerender = false;

/** POST { tavolo_note: string | null } — promemoria libero di Aldo (es. "T3+T4 uniti"); non vincola niente e non manda email */
export const POST: APIRoute = async (ctx) => {
  const id = ctx.params.id ?? '';
  if (!/^\d{1,19}$/.test(id)) return json({ ok: false, error: 'Prenotazione non valida.' }, 404);
  let body: { tavolo_note?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }
  const nota = body.tavolo_note;
  if (nota !== null && typeof nota !== 'string') return json({ ok: false, error: 'Nota non valida.' }, 400);
  if (typeof nota === 'string' && nota.trim().length > 100) return json({ ok: false, error: 'Nota troppo lunga (massimo 100 caratteri).' }, 400);

  return pannello(ctx, { write: true }, async (session) => {
    const p = await call<SchedaPrenotazione>(`/gestione/prenotazioni/${id}/tavolo`, {
      method: 'PATCH',
      body: { tavolo_note: nota },
      session,
    });
    return { prenotazione: p };
  });
};
