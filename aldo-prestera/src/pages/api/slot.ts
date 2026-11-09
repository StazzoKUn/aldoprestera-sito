import type { APIRoute } from 'astro';
import { availableSlots } from '../../lib/slots';

export const prerender = false;

/** GET /api/slot?mode=consegna → slot ancora prenotabili oggi (nessun limite di ordini per fascia) */
export const GET: APIRoute = ({ url }) => {
  const mode = url.searchParams.get('mode') === 'asporto' ? 'asporto' : 'consegna';
  const slots = availableSlots(mode, new Date(), import.meta.env.DEV);
  return new Response(JSON.stringify({ slots }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
