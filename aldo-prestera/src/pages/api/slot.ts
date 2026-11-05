import type { APIRoute } from 'astro';
import { availableSlots, freeSlots, nowInPizzeria } from '../../lib/slots';
import { bookedSlots } from '../../lib/store';

export const prerender = false;

/** GET /api/slot?mode=consegna&pizze=3 → slot ancora prenotabili per quell'ordine */
export const GET: APIRoute = async ({ url }) => {
  const mode = url.searchParams.get('mode') === 'asporto' ? 'asporto' : 'consegna';
  const pizzas = Math.max(0, Math.min(200, Number(url.searchParams.get('pizze')) || 0));
  const now = new Date();
  const booked = await bookedSlots(nowInPizzeria(now).date);
  const slots = freeSlots(availableSlots(mode, now, import.meta.env.DEV), pizzas, booked);
  return new Response(JSON.stringify({ slots }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
