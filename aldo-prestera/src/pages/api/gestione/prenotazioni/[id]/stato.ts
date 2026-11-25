import type { APIRoute } from 'astro';
import { reservationEmailFailed } from '../../../../../lib/decisione';
import { notifyReservation } from '../../../../../lib/decisione-prenotazione';
import { json, pannello, type SchedaPrenotazione } from '../../../../../lib/gestione';
import { MOTIVI_RIFIUTO_PRENOTAZIONE } from '../../../../../lib/motivi';
import { call } from '../../../../../lib/ordini-api';

export const prerender = false;

/**
 * POST { stato: 'confermata' | 'rifiutata' | 'annullata', motivo? } (il motivo solo per il rifiuto).
 * L'email al cliente parte a ogni cambio di stato, anche se la prenotazione era già confermata:
 * così il cliente riceve sempre la conferma completa della modifica.
 */
export const POST: APIRoute = async (ctx) => {
  const id = ctx.params.id ?? '';
  if (!/^\d{1,19}$/.test(id)) return json({ ok: false, error: 'Prenotazione non valida.' }, 404);
  let body: { stato?: unknown; motivo?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }
  const stato = body.stato;
  const motivo = typeof body.motivo === 'string' ? body.motivo : undefined;
  if (stato !== 'confermata' && stato !== 'rifiutata' && stato !== 'annullata') return json({ ok: false, error: 'Stato non valido.' }, 400);
  if (stato === 'rifiutata' && (!motivo || !(MOTIVI_RIFIUTO_PRENOTAZIONE as readonly string[]).includes(motivo))) {
    return json({ ok: false, error: 'Scegli un motivo di rifiuto.' }, 400);
  }

  return pannello(ctx, { write: true }, async (session) => {
    const res = await call<{ stato_precedente: string; prenotazione: SchedaPrenotazione }>(`/gestione/prenotazioni/${id}/stato`, {
      method: 'POST',
      body: { stato, ...(stato === 'rifiutata' ? { motivo } : {}) },
      session,
    });
    const p = res.prenotazione;
    // La scelta di Aldo è già salvata: se l'email fallisce resta valida e il pannello mostra "Email non inviata"
    await notifyReservation(p, res.stato_precedente === 'confermata' ? 'confermata' : 'richiesta', ctx.site);
    return { prenotazione: { ...p, email_non_inviata: reservationEmailFailed.has(p.codice_pubblico) } };
  });
};
