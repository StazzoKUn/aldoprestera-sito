// Conseguenze delle decisioni sull'ordine (accettato, rifiutato, scaduto) lato sito:
// l'email al cliente e il ricordo di quelle non partite.
import { fullAddress, orderHours } from '../data/site';
import { sendDecisionEmail, type Decision, type DecisionOrder } from './notify';
import type { Scheda } from './gestione';
import { sendReservationEmail, type ReservationDecision, type ReservationEmail } from './notify-prenotazione';
import type { PublicOrder, PublicReservation } from './ordini-api';
import { whenLabel } from './prenotazione';

/**
 * Numeri d'ordine per cui l'email al cliente NON è partita (il pannello mostra "Email non inviata").
 * Sta in memoria: si perde al riavvio del sito, scelta presa il 2026-11-09 (niente colonna in DB).
 */
export const emailFailed = new Set<string>();

/** Orario richiesto "HH:MM" nel fuso della pizzeria */
export const slotLabel = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: orderHours.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Manda l'email di decisione e ricorda se è fallita */
export async function sendDecision(o: DecisionOrder, d: Decision, logoUrl?: string): Promise<boolean> {
  const sent = await sendDecisionEmail(o, d, logoUrl);
  if (sent) emailFailed.delete(o.number);
  else emailFailed.add(o.number);
  return sent;
}

/** Indirizzo della pagina di stato /ordine/<codice>, o undefined se manca il codice o l'URL del sito */
export const statusUrl = (code: string | undefined, base: URL | undefined) =>
  code && base ? new URL(`/ordine/${encodeURIComponent(code)}`, base).href : undefined;

/** Dati per l'email di decisione dalla scheda ordine del pannello (indirizzo di consegna compreso) */
export const cardToDecisionOrder = (c: Scheda, base?: URL): DecisionOrder => ({
  statusUrl: statusUrl(c.codice_pubblico, base),
  number: c.numero_ordine,
  mode: c.modalita,
  slot: slotLabel(c.orario_richiesto),
  name: c.nome_cliente,
  email: c.cliente_email,
  lines: c.righe.map((r) => ({ qty: r.quantita, name: r.nome_prodotto, total: r.totale_riga })),
  fee: c.costo_consegna,
  total: c.totale,
  pay: c.metodo_pagamento,
  where:
    c.modalita === 'consegna'
      ? [c.indirizzo ?? 'Consegna a domicilio', c.citofono ? `citofono ${c.citofono}` : ''].filter(Boolean).join(' · ')
      : `Ritiro in pizzeria: ${fullAddress}`,
});

/* ---------- Prenotazioni tavolo ---------- */

/**
 * Codici pubblici delle prenotazioni per cui l'email al cliente NON è partita (il pannello mostrerà "Email non inviata").
 * Sta in memoria come per gli ordini: si perde al riavvio del sito.
 */
export const reservationEmailFailed = new Set<string>();

/** Manda l'email di decisione della prenotazione e ricorda se è fallita */
export async function sendReservationDecision(
  code: string,
  o: ReservationEmail,
  d: ReservationDecision,
  logoUrl?: string,
): Promise<boolean> {
  const sent = await sendReservationEmail(o, d, logoUrl);
  if (sent) reservationEmailFailed.delete(code);
  else reservationEmailFailed.add(code);
  return sent;
}

/** Indirizzo della pagina di stato /prenotazione/<codice> */
export const reservationUrl = (code: string | undefined, base: URL | undefined) =>
  code && base ? new URL(`/prenotazione/${encodeURIComponent(code)}`, base).href : undefined;

/** Email di rifiuto per una richiesta scaduta proprio ora (i dati vengono dalla lettura pubblica dell'API) */
export function notifyReservationExpired(code: string, v: PublicReservation, logoUrl?: string, base?: URL): Promise<boolean> {
  const c = v.contatto;
  if (!c) return Promise.resolve(true);
  return sendReservationDecision(
    code,
    {
      name: c.nome,
      email: c.email,
      people: v.persone,
      when: whenLabel(v.inizio),
      notes: v.note,
      statusUrl: reservationUrl(code, base),
      previous: 'richiesta',
    },
    { kind: 'rifiutata', reason: v.motivo_stato ?? 'La pizzeria non ha potuto rispondere' },
    logoUrl,
  );
}

/** Email di rifiuto per un ordine scaduto proprio ora (i dati vengono dalla lettura pubblica dell'API) */
export function notifyExpired(v: PublicOrder, logoUrl?: string, base?: URL): Promise<boolean> {
  const c = v.contatto;
  if (!c) return Promise.resolve(true);
  return sendDecision(
    {
      statusUrl: statusUrl(v.codice, base),
      number: v.numero_ordine,
      mode: v.modalita,
      slot: slotLabel(v.orario_richiesto),
      name: c.nome,
      email: c.email,
      lines: v.righe.map((r) => ({ qty: r.quantita, name: r.nome_prodotto, total: r.totale_riga })),
      fee: v.costo_consegna,
      total: v.totale,
      pay: v.metodo_pagamento,
      where: v.modalita === 'consegna' ? 'Consegna a domicilio' : `Ritiro in pizzeria: ${fullAddress}`,
    },
    { kind: 'rifiutato', reason: v.motivo_stato ?? 'La pizzeria non ha potuto rispondere' },
    logoUrl,
  );
}
