import type { APIRoute } from 'astro';
import { menu } from '../../data/menu';
import { PAYS, computeTotals, validateOrder, type Cart, type Customer, type OrderRequest, type OrderResponse } from '../../lib/order';
import { availableSlots, freeSlots, nowInPizzeria } from '../../lib/slots';
import { bookSlot, bookedSlots, nextOrderNumber, withLock } from '../../lib/store';
import { orderWhatsApp, sendCustomerEmail, sendOrderEmail, type PlacedOrder } from '../../lib/notify';
import { sendWhatsApp } from '../../lib/whatsapp';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

class OrderError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const POST: APIRoute = async ({ request, site }) => {
  let body: Partial<OrderRequest>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }

  // Normalizzazione: il server ricalcola tutto dal menù, non si fida dei prezzi del client
  const ids = new Set(menu.flatMap((c) => c.items.map((i) => i.id)));
  const cart: Cart = {};
  for (const [id, q] of Object.entries(body.cart ?? {})) {
    if (ids.has(id) && Number.isInteger(q) && q > 0 && q <= 50) cart[id] = q;
  }
  const mode = body.mode === 'asporto' ? 'asporto' : 'consegna';
  const isC = mode === 'consegna';
  const pay = PAYS.includes(body.pay as never) ? body.pay! : PAYS[0];
  const c = (body.customer ?? {}) as Partial<Customer>;
  const customer: Customer = {
    name: str(c.name, 80),
    phone: str(c.phone, 30),
    email: str(c.email, 120).trim(),
    zone: isC ? str(c.zone, 40) : '',
    street: isC ? str(c.street, 120) : '',
    number: isC ? str(c.number, 12) : '',
    intercom: isC ? str(c.intercom, 80) : '',
    notes: str(c.notes, 500),
  };
  const slot = str(body.slot, 5);
  const privacy = body.privacy === true;

  const totals = computeTotals(cart, mode, menu, customer.zone);
  const fields = validateOrder({ customer, mode, slot, privacy }, totals);
  if (Object.keys(fields).length) {
    const error = fields.cart && totals.belowMin ? fields.cart : 'Controlla i campi evidenziati.';
    return json({ ok: false, error, fields }, 422);
  }

  // Prenotazione dello slot e comanda, una richiesta alla volta
  let order: PlacedOrder;
  try {
    order = await withLock(async () => {
      const now = new Date();
      const { date } = nowInPizzeria(now);
      const booked = await bookedSlots(date);
      if (!freeSlots(availableSlots(mode, now, import.meta.env.DEV), totals.pizzas, booked).includes(slot)) {
        throw new OrderError("L'orario scelto non è più disponibile. Scegline un altro.", 409, {
          slot: 'Orario non più disponibile.',
        });
      }
      const number = await nextOrderNumber();
      const placed: PlacedOrder = { cart, mode, slot, pay, customer, privacy, number, lines: totals.lines, fee: totals.fee, total: totals.total };
      try {
        await sendOrderEmail(placed);
      } catch (err) {
        console.error(`[ordine] comanda #${number} non inviata`, err);
        throw new OrderError("Non siamo riusciti a inviare l'ordine. Riprova o chiamaci.", 502);
      }
      if (totals.pizzas > 0) await bookSlot(date, slot, totals.pizzas);
      return placed;
    });
  } catch (err) {
    if (err instanceof OrderError) return json({ ok: false, error: err.message, fields: err.fields }, err.status);
    console.error('[ordine] errore inatteso', err);
    return json({ ok: false, error: "Non siamo riusciti a inviare l'ordine. Riprova o chiamaci." }, 500);
  }

  // Canali secondari: non bloccano l'ordine
  const logoUrl = site ? new URL('/email/logo-chiaro.png', site).href : undefined;
  const [customerEmailSent] = await Promise.all([
    sendCustomerEmail(order, logoUrl),
    sendWhatsApp(orderWhatsApp(order), `#${order.number}`),
  ]);

  const res: OrderResponse = {
    ok: true,
    number: order.number,
    lines: totals.lines,
    subtotal: totals.subtotal,
    fee: totals.fee,
    total: totals.total,
    customerEmailSent,
  };
  return json(res);
};

