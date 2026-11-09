import type { APIRoute } from 'astro';
import { PAYS, computeTotals, validateOrder, zoneById, type Cart, type Customer, type OrderRequest, type OrderResponse } from '../../lib/order';
import { availableSlots } from '../../lib/slots';
import { orderWhatsApp, sendCustomerEmail, sendOrderEmail, type PlacedOrder } from '../../lib/notify';
import { ApiError, cancelOrder, confirmOrder, createOrder, loadMenu } from '../../lib/ordini-api';
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

/** Dati che l'API ordini non ha in colonne proprie (modalità, orario, pagamento, telefono, citofono, note) */
const orderNote = (o: Pick<OrderRequest, 'mode' | 'slot' | 'pay' | 'customer'>) => {
  const c = o.customer;
  return [
    `${o.mode === 'consegna' ? 'Consegna' : 'Ritiro'} ore ${o.slot} · pagamento: ${o.pay}`,
    `${c.name.trim()} · tel. ${c.phone.trim()}`,
    o.mode === 'consegna' && c.intercom.trim() ? `Citofono: ${c.intercom.trim()}` : null,
    c.notes.trim() ? `Note: ${c.notes.trim()}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
};

export const POST: APIRoute = async ({ request, site }) => {
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
  const pay = PAYS.includes(body.pay as never) ? body.pay! : PAYS[0];
  const c = (body.customer ?? {}) as Partial<Customer>;
  const customer: Customer = {
    name: str(c.name, 80),
    phone: str(c.phone, 30),
    email: str(c.email, 120).trim(),
    zone: isC ? str(c.zone, 40) : '',
    street: isC ? str(c.street, 120) : '',
    number: isC ? str(c.number, 12) : '',
    cap: isC ? str(c.cap, 5).trim() : '',
    province: isC ? str(c.province, 2).trim().toUpperCase() : '',
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

  // L'orario deve essere uno slot ancora valido (non passato, dentro gli orari di apertura).
  // Non c'è un limite di ordini per fascia: eventuali blocchi li deciderà la pizzeria.
  if (!availableSlots(mode, new Date(), import.meta.env.DEV).includes(slot)) {
    return json({ ok: false, error: "L'orario scelto non è più disponibile. Scegline un altro.", fields: { slot: 'Orario non più disponibile.' } }, 409);
  }

  let order: PlacedOrder;
  try {
    // Prima si salva in DB (stato bozza): il numero lo assegna il database
    let saved: { id: string; number: string };
    try {
      saved = await createOrder({
        customer,
        cart,
        fee: totals.fee,
        note: orderNote({ mode, slot, pay, customer }),
        delivery: isC
          ? {
              street: `${customer.street.trim()} ${customer.number.trim()}`,
              city: zoneById(customer.zone).name,
              cap: customer.cap,
              province: customer.province,
            }
          : undefined,
      });
    } catch (err) {
      console.error('[ordine] salvataggio su ordini-api fallito', err);
      if (err instanceof ApiError && err.status === 409) {
        throw new OrderError('Un prodotto del carrello non è più disponibile. Ricarica il menù.', 409);
      }
      throw new OrderError("Non siamo riusciti a inviare l'ordine. Riprova o chiamaci.", 503);
    }
    const number = saved.number;
    order = { cart, mode, slot, pay, customer, privacy, number, lines: totals.lines, fee: totals.fee, total: totals.total };
    try {
      await sendOrderEmail(order);
    } catch (err) {
      console.error(`[ordine] comanda #${number} non inviata, annullo l'ordine`, err);
      await cancelOrder(saved.id).catch((e) => console.error(`[ordine] #${number} non annullato`, e));
      throw new OrderError("Non siamo riusciti a inviare l'ordine. Riprova o chiamaci.", 502);
    }
    await confirmOrder(saved.id).catch((e) => console.error(`[ordine] #${number} non confermato in DB`, e));
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

