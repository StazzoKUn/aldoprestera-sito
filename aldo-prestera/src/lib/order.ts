import { delivery } from '../data/site';
import type { MenuCategory } from '../data/menu';
import { eur } from './format';

export type Mode = 'consegna' | 'asporto';
/** Si paga solo in contanti (al fattorino o al ritiro): niente scelta del metodo */
export type Pay = 'Contanti';
export const PAYS: Pay[] = ['Contanti'];

/** { idVoce: quantità } */
export type Cart = Record<string, number>;

export interface Customer {
  name: string;
  phone: string;
  email: string;
  /** Comune di consegna, scritto dal cliente (solo consegna) */
  city: string;
  street: string;
  number: string;
  /** CAP di 5 cifre (solo consegna) */
  cap: string;
  /** Sigla della provincia, 2 lettere (solo consegna) */
  province: string;
  intercom: string;
  notes: string;
}

export interface OrderRequest {
  cart: Cart;
  mode: Mode;
  slot: string;
  pay: Pay;
  customer: Customer;
  privacy: boolean;
}

export interface OrderLine {
  id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface OrderResponse {
  ok: true;
  number: string;
  /** Codice pubblico: porta alla pagina di attesa /ordine/<code> */
  code: string;
}

export const computeTotals = (cart: Cart, mode: Mode, menu: MenuCategory[]) => {
  const lines: OrderLine[] = [];
  let pizzas = 0;
  for (const cat of menu) {
    for (const i of cat.items) {
      const qty = cart[i.id] ?? 0;
      if (qty <= 0) continue;
      lines.push({ id: i.id, name: i.name, qty, price: i.price, total: i.price * qty });
      if (cat.oven) pizzas += qty;
    }
  }
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const fee = mode === 'consegna' && count > 0 ? delivery.fee : 0;
  const belowMin = mode === 'consegna' && count > 0 && subtotal < delivery.minOrder;
  return { lines, subtotal, count, pizzas, fee, total: subtotal + fee, belowMin };
};

export const minOrderTxt = () => `Ordine minimo per la consegna ${eur(delivery.minOrder)}`;

export type FieldErrors = Partial<
  Record<'name' | 'phone' | 'email' | 'city' | 'street' | 'number' | 'cap' | 'province' | 'slot' | 'privacy' | 'cart', string>
>;

const PHONE_RE = /^\+?[\d\s./-]{6,20}$/;
const CAP_RE = /^\d{5}$/;
const PROVINCE_RE = /^[A-Za-z]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validazione condivisa tra modulo e server */
export const validateOrder = (
  o: Pick<OrderRequest, 'customer' | 'mode' | 'slot' | 'privacy'>,
  t: { count: number; belowMin: boolean },
): FieldErrors => {
  const e: FieldErrors = {};
  const c = o.customer;
  if (t.count === 0) e.cart = 'Il carrello è vuoto.';
  else if (t.belowMin) e.cart = minOrderTxt() + '.';
  if (!c.name.trim()) e.name = 'Inserisci nome e cognome.';
  if (!c.phone.trim()) e.phone = 'Inserisci un numero di telefono.';
  else if (!PHONE_RE.test(c.phone.trim())) e.phone = 'Numero di telefono non valido.';
  if (!c.email.trim()) e.email = 'Inserisci la tua email.';
  else if (!EMAIL_RE.test(c.email.trim())) e.email = 'Email non valida.';
  if (o.mode === 'consegna') {
    if (!c.city.trim()) e.city = 'Inserisci il comune.';
    if (!c.street.trim()) e.street = "Inserisci l'indirizzo.";
    if (!c.number.trim()) e.number = 'N° civico.';
    if (!CAP_RE.test(c.cap.trim())) e.cap = 'CAP di 5 cifre.';
    if (!PROVINCE_RE.test(c.province.trim())) e.province = 'Sigla, es. CE.';
  }
  if (!o.slot) e.slot = 'Scegli un orario.';
  if (!o.privacy) e.privacy = "Devi accettare l'informativa privacy.";
  return e;
};
