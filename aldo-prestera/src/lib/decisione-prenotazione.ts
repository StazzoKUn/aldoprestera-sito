// Email al cliente per le decisioni di Aldo sulle prenotazioni (dal pannello): conferma, rifiuto, annullo.
// Se l'email fallisce la scelta di Aldo resta valida e il pannello mostra "Email non inviata".
import { reservationUrl, sendReservationDecision } from './decisione';
import type { SchedaPrenotazione } from './gestione';
import type { ReservationDecision } from './notify-prenotazione';
import { whenLabel } from './prenotazione';

/** Manda l'email per lo stato in cui si trova ora la prenotazione; `previous` è lo stato prima della decisione */
export function notifyReservation(
  c: SchedaPrenotazione,
  previous: 'richiesta' | 'confermata',
  base: URL | undefined,
): Promise<boolean> {
  if (c.stato === 'richiesta') return Promise.resolve(true);
  const decision: ReservationDecision =
    c.stato === 'confermata'
      ? { kind: 'confermata' }
      : c.stato === 'annullata'
        ? { kind: 'annullata' }
        : { kind: 'rifiutata', reason: c.motivo_stato ?? 'La pizzeria non ha potuto rispondere' };
  const logoUrl = base ? new URL('/email/logo-chiaro.png', base).href : undefined;
  return sendReservationDecision(
    c.codice_pubblico,
    {
      name: c.nome_cliente,
      email: c.cliente_email,
      people: c.persone,
      when: whenLabel(c.inizio),
      notes: c.note,
      statusUrl: reservationUrl(c.codice_pubblico, base),
      previous,
    },
    decision,
    logoUrl,
  );
}
