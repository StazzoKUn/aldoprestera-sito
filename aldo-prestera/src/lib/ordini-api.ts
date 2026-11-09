// Client (solo server) del backend ordini-api: menù da MariaDB e salvataggio degli ordini.
// Il browser non parla mai con l'API: passa sempre dagli endpoint /api/* di questo sito.
import type { MenuCategory, MenuItem } from '../data/menu';

const env = (k: string): string | undefined => process.env[k] ?? import.meta.env[k];

const baseUrl = () => (env('ORDINI_API_URL') ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Errore di una chiamata all'API; `status` 0 = API non raggiungibile */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(baseUrl() + path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new ApiError(`ordini-api non raggiungibile: ${err instanceof Error ? err.message : err}`, 0);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(`ordini-api ${init?.method ?? 'GET'} ${path} → ${res.status} ${detail.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

/* ---------- Menù ---------- */

interface Prodotto {
  id: string;
  sku: string;
  nome: string;
  descrizione: string | null;
  prezzo: number;
}

// Categoria dal prefisso dello SKU (vedi ordini-api/prisma/seed/prodotti-aldo-prestera.ts).
// L'ordine è quello del menù; `oven` = occupa il forno (conta per la capacità degli slot).
const CATEGORIES: { prefix: string; name: string; short: string; oven: boolean }[] = [
  { prefix: 'SPE', name: 'Pizze speciali', short: 'Speciali', oven: true },
  { prefix: 'CLA', name: 'Pizze classiche', short: 'Classiche', oven: true },
  { prefix: 'RIP', name: 'Pizze ripiene', short: 'Ripiene', oven: true },
  { prefix: 'MET', name: 'Pizze al metro', short: 'Al metro', oven: true },
  { prefix: 'SAL', name: 'Saltimbocca', short: 'Saltimbocca', oven: true },
  { prefix: 'FOC', name: 'Focacce', short: 'Focacce', oven: true },
  { prefix: 'FRI', name: 'Fritti', short: 'Fritti', oven: false },
  { prefix: 'DOL', name: 'Dolci', short: 'Dolci', oven: true },
  { prefix: 'BEV', name: 'Bevande', short: 'Bevande', oven: false },
  { prefix: 'BIR', name: 'Birre', short: 'Birre', oven: false },
  { prefix: 'VIN', name: 'Vini', short: 'Vini', oven: false },
];

// Le varianti senza glutine (SPE-SG-…, CLA-SG-…) hanno una categoria a parte, subito dopo la base
const GLUTEN_FREE = new Set(['SPE', 'CLA']);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function groupMenu(prodotti: Prodotto[]): MenuCategory[] {
  const groups = new Map<string, MenuCategory>();
  const bucket = (prefix: string, sg: boolean): MenuCategory | undefined => {
    const base = CATEGORIES.find((c) => c.prefix === prefix);
    if (!base) return undefined;
    const id = (prefix + (sg ? '-sg' : '')).toLowerCase();
    let cat = groups.get(id);
    if (!cat) {
      cat = {
        id,
        name: sg ? `${base.name} senza glutine` : base.name,
        short: sg ? `${base.short} s.g.` : base.short,
        layout: 'rows',
        oven: base.oven,
        items: [],
      };
      groups.set(id, cat);
    }
    return cat;
  };

  for (const p of prodotti) {
    const [prefix = '', second] = p.sku.split('-');
    const cat = bucket(prefix, GLUTEN_FREE.has(prefix) && second === 'SG');
    if (!cat) continue; // categoria sconosciuta: non ordinabile online finché non viene mappata qui
    const item: MenuItem = { id: p.id, name: p.nome, desc: p.descrizione ? capitalize(p.descrizione) : '', price: p.prezzo };
    cat.items.push(item);
  }

  // Ordine del menù: ogni categoria base seguita dalla sua variante senza glutine
  const order = CATEGORIES.flatMap((c) => [c.prefix.toLowerCase(), `${c.prefix.toLowerCase()}-sg`]);
  return order.flatMap((id) => groups.get(id) ?? []);
}

const MENU_TTL_MS = 60_000;
let menuCache: { at: number; menu: MenuCategory[] } | null = null;

/** Menù dei prodotti attivi. In cache per 60 s; se l'API non risponde si usa l'ultima copia, se c'è. */
export async function loadMenu(): Promise<MenuCategory[]> {
  if (menuCache && Date.now() - menuCache.at < MENU_TTL_MS) return menuCache.menu;
  try {
    const prodotti: Prodotto[] = [];
    for (let page = 1; ; page++) {
      const res = await call<{ data: Prodotto[]; pagination: { pagine: number } }>(
        `/prodotti?attivo=true&page_size=100&page=${page}`,
      );
      prodotti.push(...res.data);
      if (page >= res.pagination.pagine) break;
    }
    menuCache = { at: Date.now(), menu: groupMenu(prodotti) };
  } catch (err) {
    if (!menuCache) throw err;
    console.error('[ordini-api] menù non aggiornato, uso la copia in cache', err);
  }
  return menuCache.menu;
}

/* ---------- Ordini ---------- */

interface Cliente {
  id: string;
  email: string;
}

const splitName = (full: string) => {
  const [nome = '', ...rest] = full.trim().split(/\s+/);
  return { nome: nome.slice(0, 100), cognome: (rest.join(' ') || '-').slice(0, 100) };
};

// L'API accetta solo cifre e spazi, con + iniziale facoltativo
const apiPhone = (phone: string) => {
  const p = phone.replace(/[./-]/g, '').trim();
  return /^\+?[0-9 ]{6,20}$/.test(p) ? p : null;
};

/** Cliente con questa email: se esiste lo riusa (senza sovrascriverne i dati), altrimenti lo crea */
async function findOrCreateCliente(c: { name: string; email: string; phone: string }): Promise<string> {
  const email = c.email.trim().toLowerCase();
  const find = async () => {
    const res = await call<{ data: Cliente[] }>(`/clienti?q=${encodeURIComponent(email)}&page_size=20`);
    return res.data.find((x) => x.email.toLowerCase() === email)?.id;
  };
  const existing = await find();
  if (existing) return existing;
  try {
    const created = await call<Cliente>('/clienti', {
      method: 'POST',
      body: { email, ...splitName(c.name), telefono: apiPhone(c.phone) },
    });
    return created.id;
  } catch (err) {
    // due ordini simultanei con la stessa email: l'altro ha già creato il cliente
    if (err instanceof ApiError && err.status === 409) {
      const again = await find();
      if (again) return again;
    }
    throw err;
  }
}

interface Indirizzo {
  id: string;
  via: string;
  cap: string;
  citta: string;
}

/** Indirizzo di consegna del cliente: se già presente (stessa via, CAP e città) lo riusa, altrimenti lo crea */
async function findOrCreateIndirizzo(
  clienteId: string,
  recipient: string,
  d: { street: string; city: string; cap: string; province: string },
): Promise<string> {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const { data } = await call<{ data: Indirizzo[] }>(`/clienti/${clienteId}/indirizzi`);
  const found = data.find((i) => same(i.via, d.street) && i.cap === d.cap && same(i.citta, d.city));
  if (found) return found.id;
  const created = await call<Indirizzo>(`/clienti/${clienteId}/indirizzi`, {
    method: 'POST',
    body: {
      destinatario: recipient.trim().slice(0, 150),
      via: d.street.slice(0, 255),
      cap: d.cap,
      citta: d.city,
      provincia: d.province,
      nazione: 'IT',
      predefinito: data.length === 0,
    },
  });
  return created.id;
}

export interface NewOrder {
  customer: { name: string; email: string; phone: string };
  /** Dati senza colonna propria (modalità, orario, pagamento, citofono, note): finiscono in ordine.note */
  note: string;
  /** { idProdotto: quantità } */
  cart: Record<string, number>;
  /** Costo della consegna in euro (0 per il ritiro): l'API lo somma al totale */
  fee: number;
  /** Solo per la consegna: viene salvato tra gli indirizzi del cliente e collegato all'ordine */
  delivery?: { street: string; city: string; cap: string; province: string };
}

/** Salva l'ordine in stato "bozza" (nessun invio ancora): restituisce id e numero assegnati dal DB */
export async function createOrder(o: NewOrder): Promise<{ id: string; number: string }> {
  const clienteId = await findOrCreateCliente(o.customer);
  const indirizzoId = o.delivery ? await findOrCreateIndirizzo(clienteId, o.customer.name, o.delivery) : null;
  const ordine = await call<{ id: string; numero_ordine: string }>('/ordini', {
    method: 'POST',
    body: {
      cliente_id: clienteId,
      indirizzo_spedizione_id: indirizzoId,
      costo_consegna: o.fee,
      note: o.note,
      righe: Object.entries(o.cart).map(([prodotto_id, quantita]) => ({ prodotto_id, quantita })),
    },
  });
  return { id: ordine.id, number: ordine.numero_ordine };
}

export const confirmOrder = (id: string) =>
  call(`/ordini/${id}/stato`, { method: 'PATCH', body: { stato: 'confermato' } });

export const cancelOrder = (id: string) =>
  call(`/ordini/${id}/stato`, { method: 'PATCH', body: { stato: 'annullato' } });
