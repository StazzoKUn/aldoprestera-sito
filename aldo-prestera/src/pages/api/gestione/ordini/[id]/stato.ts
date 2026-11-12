import type { APIRoute } from 'astro';
import { cardToDecisionOrder, emailFailed, sendDecision } from '../../../../../lib/decisione';
import { json, pannello, type Scheda } from '../../../../../lib/gestione';
import { MOTIVI_RIFIUTO } from '../../../../../lib/motivi';
import { call } from '../../../../../lib/ordini-api';

export const prerender = false;

/**
 * POST { stato: 'accettato' | 'rifiutato' | 'consegnato', motivo? }
 * "consegnato → accettato" (Annulla / correzione) si chiede con stato 'accettato'.
 * L'email al cliente parte solo quando l'ordine passa da ricevuto ad accettato o rifiutato.
 */
export const POST: APIRoute = async (ctx) => {
  const id = ctx.params.id ?? '';
  if (!/^\d{1,19}$/.test(id)) return json({ ok: false, error: 'Ordine non valido.' }, 404);
  let body: { stato?: unknown; motivo?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }
  const stato = body.stato;
  const motivo = typeof body.motivo === 'string' ? body.motivo : undefined;
  if (stato !== 'accettato' && stato !== 'rifiutato' && stato !== 'consegnato') return json({ ok: false, error: 'Stato non valido.' }, 400);
  if (stato === 'rifiutato' && (!motivo || !(MOTIVI_RIFIUTO as readonly string[]).includes(motivo))) return json({ ok: false, error: 'Scegli un motivo di rifiuto.' }, 400);

  return pannello(ctx, { write: true }, async (session) => {
    const res = await call<{ stato_precedente: string; ordine: Scheda }>(`/gestione/ordini/${id}/stato`, {
      method: 'POST',
      body: { stato, ...(stato === 'rifiutato' ? { motivo } : {}) },
      session,
    });
    const o = res.ordine;
    // La scelta di Aldo è già salvata: se l'email fallisce resta valida e il pannello mostra "Email non inviata"
    if (res.stato_precedente === 'ricevuto' && (o.stato === 'accettato' || o.stato === 'rifiutato')) {
      const logoUrl = ctx.site ? new URL('/email/logo-chiaro.png', ctx.site).href : undefined;
      await sendDecision(
        cardToDecisionOrder(o, ctx.site),
        o.stato === 'accettato' ? { kind: 'accettato' } : { kind: 'rifiutato', reason: o.motivo_stato ?? '' },
        logoUrl,
      );
    }
    return { ordine: { ...o, email_non_inviata: emailFailed.has(o.numero_ordine) } };
  });
};
