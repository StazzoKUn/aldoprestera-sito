import type { APIRoute } from 'astro';
import { computeTotals, validateOrder, type Cart, type Customer, type OrderRequest, type OrderResponse, type Pay } from '../../lib/order';
import { availableSlots, slotToDate } from '../../lib/slots';
import { orderWhatsApp, sendOrderEmail, type PlacedOrder } from '../../lib/notify';
import { ApiError, createOrder, loadMenu } from '../../lib/ordini-api';
import { consenti } from '../../lib/ratelimit';
import { sendWhatsApp } from '../../lib/whatsapp';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Anti-spam: limite per IP sull'invio degli ordini
  if (!consenti(`ordine:${clientAddress}`, 8, 10 * 60_000)) {
    return json({ ok: false, error: 'Troppi tentativi ravvicinati. Riprova tra qualche minuto o chiamaci.' }, 429);
  }

  let body: Partial<OrderRequest>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Richiesta non valida.' }, 400);
  }

  // Normalizzazione: il server ricalcola tutto dal menù (DB), non si fida dei prezzi del client
  let menu;
  try {
    menu = await loadMenu();
  } catch (err) {
    console.error('[ordine] menù non disponibile', err);
    return json({ ok: false, error: "Non siamo riusciti a inviare l'ordine. Riprova o chiamaci." }, 503);
  }
  const ids = new Set(menu.flatMap((c) => c.items.map((i) => i.id)));
  const cart: Cart = {};
  for (const [id, q] of Object.entries(body.cart ?? {})) {
    if (ids.has(id) && Number.isInteger(q) && q > 0 && q <= 50) cart[id] = q;
  }
  const mode = body.mode === 'asporto' ? 'asporto' : 'consegna';
  const isC = mode === 'consegna';
  const pay: Pay = 'Contanti'; // solo contanti: il client non sceglie
  const c = (body.customer ?? {}) as Partial<Customer>;
  const customer: Customer = {
    name: str(c.name, 80),
    phone: str(c.phone, 30),
    email: str(c.email, 120).trim(),
    city: isC ? str(c.city, 60).trim() : '',
    street: isC ? str(c.street, 120) : '',
    number: isC ? str(c.number, 12) : '',
    cap: isC ? str(c.cap, 5).trim() : '',
    province: isC ? str(c.province, 2).trim().toUpperCase() : '',
    intercom: isC ? str(c.intercom, 80) : '',
    notes: str(c.notes, 500),
  };
  const slot = str(body.slot, 5);
  const privacy = body.privacy === true;

  const totals = computeTotals(cart, mode, menu);
  const fields = validateOrder({ customer, mode, slot, privacy }, totals);
  if (Object.keys(fields).length) {
    const error = fields.cart && totals.belowMin ? fields.cart : 'Controlla i campi evidenziati.';
    return json({ ok: false, error, fields }, 422);
  }

  // L'orario deve essere uno slot ancora valido (non passato, dentro gli orari di apertura).
  // Non c'è un limite di ordini per fascia: eventuali blocchi li deciderà la pizzeria.
  if (!availableSlots(mode, new Date(), import.meta.env.DEV).includes(slot)) {
    return json({ ok: false, error: "L'orario scelto non è più disponibile. Scegline un altro.", fields: { slot: 'Orario non più disponibile.' } }, 409);
  }

  // 1) Salvataggio in DB, direttamente in stato "ricevuto": se fallisce l'ordine non esiste e non compare ad Aldo
  let saved: { id: string; number: string; code: string };
  try {
    saved = await createOrder({
      customer,
      mode,
      requestedAt: slotToDate(slot),
      pay,
      cart,
      fee: totals.fee,
      delivery: isC
        ? {
            street: `${customer.street.trim()} ${customer.number.trim()}`,
            city: customer.city,
            cap: customer.cap,
            province: customer.province,
          }
        : undefined,
    });
  } catch (err) {
    console.error('[ordine] salvataggio su ordini-api fallito', err);
    if (err instanceof ApiError && err.status === 409) {
      return json({ ok: false, error: 'Un prodotto del carrello non è più disponibile. Ricarica il menù.' }, 409);
    }
    return json({ ok: false, error: "Non siamo riusciti a inviare l'ordine. Riprova o chiamaci." }, 503);
  }

  // 2) Comanda ad Aldo (email + WhatsApp): canale di riserva, l'ordine è già valido e visibile nel pannello.
  //    Se falliscono l'errore va nei log e basta.
  const order: PlacedOrder = { cart, mode, slot, pay, customer, privacy, number: saved.number, lines: totals.lines, fee: totals.fee, total: totals.total };
  await Promise.all([
    sendOrderEmail(order).catch((err) => console.error(`[ordine] comanda #${saved.number} non inviata via email`, err)),
    sendWhatsApp(orderWhatsApp(order), `#${saved.number}`),
  ]);

  // Nessuna email al cliente adesso: parte solo quando Aldo accetta o rifiuta
  const res: OrderResponse = { ok: true, number: saved.number, code: saved.code };
  return json(res);
};
