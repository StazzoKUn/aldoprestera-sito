import { orderHours } from '../data/site';
import { EMAIL_RE, PHONE_RE } from './order';

// Tipi e validazione condivisi tra modulo di prenotazione e server.
// Nessun tetto di persone (decide Aldo): 200 è solo il limite tecnico dell'API.

export interface ReservationCustomer {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface ReservationRequest {
  /** Giorno AAAA-MM-GG nel fuso della pizzeria */
  date: string;
  /** Orario di arrivo HH:MM */
  slot: string;
  people: number;
  customer: ReservationCustomer;
  privacy: boolean;
}

export interface ReservationResponse {
  ok: true;
  /** Codice pubblico: porta alla pagina di attesa /prenotazione/<code> */
  code: string;
}

export type ReservationFieldErrors = Partial<Record<'name' | 'phone' | 'email' | 'date' | 'slot' | 'people' | 'privacy', string>>;

export const MAX_PEOPLE = 200;

export const validateReservation = (r: ReservationRequest): ReservationFieldErrors => {
  const e: ReservationFieldErrors = {};
  const c = r.customer;
  if (!r.date) e.date = 'Scegli un giorno.';
  if (!r.slot) e.slot = "Scegli l'orario di arrivo.";
  if (!Number.isInteger(r.people) || r.people < 1 || r.people > MAX_PEOPLE) e.people = 'Indica quante persone siete.';
  if (!c.name.trim()) e.name = 'Inserisci nome e cognome.';
  if (!c.phone.trim()) e.phone = 'Inserisci un numero di telefono.';
  else if (!PHONE_RE.test(c.phone.trim())) e.phone = 'Numero di telefono non valido.';
  if (!c.email.trim()) e.email = 'Inserisci la tua email.';
  else if (!EMAIL_RE.test(c.email.trim())) e.email = 'Email non valida.';
  if (!r.privacy) e.privacy = "Devi accettare l'informativa privacy.";
  return e;
};

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: orderHours.timeZone, hourCycle: 'h23', ...o }).format(new Date(iso));

/** "sabato 28 novembre" nel fuso della pizzeria */
export const dayLabel = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });

/** "20:30" nel fuso della pizzeria */
export const timeLabel = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });

/** "sabato 28 novembre, ore 20:30" */
export const whenLabel = (iso: string) => `${dayLabel(iso)}, ore ${timeLabel(iso)}`;
