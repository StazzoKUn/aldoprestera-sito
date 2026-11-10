import type { APIRoute } from 'astro';
import { cardToDecisionOrder, emailFailed, sendDecision } from '../../../../lib/decisione';
import { pannello, type Scheda } from '../../../../lib/gestione';
import { call } from '../../../../lib/ordini-api';

export const prerender = false;

/** GET ?q=numero|nome|telefono&data=AAAA-MM-GG&page=1: storico con ricerca */
export const GET: APIRoute = (ctx) =>
  pannello(ctx, {}, async (session) => {
    const src = ctx.url.searchParams;
    const qs = new URLSearchParams();
    const q = src.get('q')?.slice(0, 100);
    const data = src.get('data');
    const page = src.get('page');
    if (q) qs.set('q', q);
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) qs.set('data', data);
    if (page && /^\d{1,4}$/.test(page)) qs.set('page', page);
    const res = await call<{ data: Scheda[]; pagination: unknown; appena_scaduti: string[] }>(`/gestione/ordini/storico?${qs}`, { session });
    const logoUrl = ctx.site ? new URL('/email/logo-chiaro.png', ctx.site).href : undefined;
    for (const id of res.appena_scaduti) {
      const c = res.data.find((o) => o.id === id);
      if (c) await sendDecision(cardToDecisionOrder(c), { kind: 'rifiutato', reason: c.motivo_stato ?? 'La pizzeria non ha potuto rispondere' }, logoUrl);
    }
    return { ordini: res.data.map((o) => ({ ...o, email_non_inviata: emailFailed.has(o.numero_ordine) })), pagination: res.pagination };
  });
