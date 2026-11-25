import type { APIRoute } from 'astro';
import { reservationEmailFailed } from '../../../lib/decisione';
import { notifyReservation } from '../../../lib/decisione-prenotazione';
import { pannello, type SchedaPrenotazione } from '../../../lib/gestione';
import { call } from '../../../lib/ordini-api';

export const prerender = false;

interface Lista {
  da_confermare: SchedaPrenotazione[];
  confermate: SchedaPrenotazione[];
  chiuse: SchedaPrenotazione[];
  appena_scadute: string[];
}

/**
 * GET: le liste delle prenotazioni (da oggi in avanti), aggiornate ogni 3 s dal browser.
 * L'API fa scadere le richieste con orario passato: per quelle scadute proprio ora parte qui l'email di rifiuto.
 */
export const GET: APIRoute = (ctx) =>
  pannello(ctx, {}, async (session) => {
    const data = await call<Lista>('/gestione/prenotazioni', { session });
    for (const id of data.appena_scadute) {
      const c = data.chiuse.find((p) => p.id === id);
      if (c) await notifyReservation(c, 'richiesta', ctx.site);
    }
    const mark = (p: SchedaPrenotazione) => ({ ...p, email_non_inviata: reservationEmailFailed.has(p.codice_pubblico) });
    return {
      da_confermare: data.da_confermare.map(mark),
      confermate: data.confermate.map(mark),
      chiuse: data.chiuse.map(mark),
    };
  });
