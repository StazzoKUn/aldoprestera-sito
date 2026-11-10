import type { APIRoute } from 'astro';
import { cardToDecisionOrder, emailFailed, sendDecision } from '../../../lib/decisione';
import { pannello, type Scheda } from '../../../lib/gestione';
import { call } from '../../../lib/ordini-api';

export const prerender = false;

interface Lista {
  da_accettare: Scheda[];
  in_corso: Scheda[];
  chiusi_oggi: Scheda[];
  appena_scaduti: string[];
}

/**
 * GET: le tre liste del pannello (aggiornate ogni 3 s dal browser).
 * L'API applica la scadenza dei 15 minuti: per gli ordini scaduti proprio ora parte qui l'email di rifiuto.
 */
export const GET: APIRoute = (ctx) =>
  pannello(ctx, {}, async (session) => {
    const data = await call<Lista>('/gestione/ordini', { session });
    const logoUrl = ctx.site ? new URL('/email/logo-chiaro.png', ctx.site).href : undefined;
    for (const id of data.appena_scaduti) {
      const c = data.chiusi_oggi.find((o) => o.id === id);
      if (c) await sendDecision(cardToDecisionOrder(c), { kind: 'rifiutato', reason: c.motivo_stato ?? 'La pizzeria non ha potuto rispondere' }, logoUrl);
    }
    const mark = (o: Scheda) => ({ ...o, email_non_inviata: emailFailed.has(o.numero_ordine) });
    return {
      da_accettare: data.da_accettare.map(mark),
      in_corso: data.in_corso.map(mark),
      chiusi_oggi: data.chiusi_oggi.map(mark),
    };
  });
