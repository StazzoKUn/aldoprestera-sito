import type { APIRoute } from 'astro';
import { availableReservationDays } from '../../lib/prenotazioni-slots';

export const prerender = false;

/** GET /api/prenotazione-slot → giorni prenotabili (oggi + 7) con gli arrivi disponibili. Nessun limite di coperti. */
export const GET: APIRoute = () => {
  const days = availableReservationDays(new Date(), import.meta.env.DEV);
  return new Response(JSON.stringify({ days }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
