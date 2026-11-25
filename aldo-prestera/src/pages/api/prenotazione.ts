import type { APIRoute } from 'astro';
import { ApiError, createReservation } from '../../lib/ordini-api';
import {
  validateReservation,
  type ReservationCustomer,
  type ReservationRequest,
  type ReservationResponse,
} from '../../lib/prenotazione';
import { isReservationSlotAvailable, reservationToDate } from '../../lib/prenotazioni-slots';
import { consenti } from '../../lib/ratelimit';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * POST /api/prenotazione — richiesta di prenotazione tavolo.
 * Il server rivalida tutto: il giorno e l'orario devono essere un arrivo ancora prenotabile (site.ts).
 * Nessun limite di coperti: la richiesta resta "in attesa" finché Aldo non risponde.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Anti-spam: limite per IP sull'invio delle richieste
  if (!consenti(`prenotazione:${clientAddress}`, 6, 10 * 60_000)) {
    return json({ ok: false, error: 'Troppi tentativi ravvicinati. Riprova tra qualche minuto o chiamaci.' }, 429);
  }

  let body: Partial<ReservationRequest>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }

  const c = (body.customer ?? {}) as Partial<ReservationCustomer>;
  const data: ReservationRequest = {
    date: str(body.date, 10),
    slot: str(body.slot, 5),
    people: typeof body.people === 'number' ? body.people : NaN,
    customer: { name: str(c.name, 80), phone: str(c.phone, 30), email: str(c.email, 120).trim(), notes: str(c.notes, 500) },
    privacy: body.privacy === true,
  };

  const fields = validateReservation(data);
  if (Object.keys(fields).length) return json({ ok: false, error: 'Controlla i campi evidenziati.', fields }, 422);

  if (!isReservationSlotAvailable(data.date, data.slot, new Date(), import.meta.env.DEV)) {
    return json({ ok: false, error: "L'orario scelto non è più disponibile. Scegline un altro.", fields: { slot: 'Orario non più disponibile.' } }, 409);
  }

  try {
    // Salvata in DB come "richiesta": se fallisce la prenotazione non esiste e non compare ad Aldo
    const saved = await createReservation({
      customer: data.customer,
      people: data.people,
      start: reservationToDate(data.date, data.slot),
    });
    const res: ReservationResponse = { ok: true, code: saved.code };
    return json(res);
  } catch (err) {
    console.error('[prenotazione] salvataggio su ordini-api fallito', err);
    if (err instanceof ApiError && err.status === 400) {
      return json({ ok: false, error: "L'orario scelto non è prenotabile. Scegline un altro." }, 409);
    }
    return json({ ok: false, error: 'Non siamo riusciti a inviare la richiesta. Riprova o chiamaci.' }, 503);
  }
};
