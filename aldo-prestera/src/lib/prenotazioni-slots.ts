import { orderHours, reservationHours } from '../data/site';
import { nowInPizzeria, toHHMM, toMin } from './slots';

/** Arrivi prenotabili in un giorno della settimana (0 = domenica … 6 = sabato), es. 12:00 … 14:30 e 17:30 … 23:00 */
export const reservationSlotsForDay = (day: number): string[] => {
  const out: string[] = [];
  for (const [open, close] of orderHours.week[day] ?? []) {
    const kind = toMin(open) < toMin(reservationHours.lunchOpensBefore) ? 'pranzo' : 'cena';
    // Ultimo arrivo del turno, ma mai oltre la chiusura
    const last = Math.min(toMin(close), toMin(reservationHours.lastArrival[kind]));
    for (let t = toMin(open); t <= last; t += reservationHours.step) out.push(toHHMM(t));
  }
  return out;
};

export type ReservationDay = { date: string; slots: string[] };

/**
 * Giorni prenotabili da oggi a `daysAhead` giorni avanti, con gli arrivi ancora disponibili.
 * Oggi restano solo gli arrivi con l'anticipo minimo; i giorni senza arrivi (chiusi) non compaiono.
 * `ignoreClock` (solo sviluppo) non toglie gli arrivi già passati di oggi.
 * Nessun limite di coperti: decide Aldo.
 */
export const availableReservationDays = (now = new Date(), ignoreClock = false): ReservationDay[] => {
  const today = nowInPizzeria(now);
  const [y, m, d] = today.date.split('-').map(Number) as [number, number, number];
  const days: ReservationDay[] = [];
  for (let offset = 0; offset <= reservationHours.daysAhead; offset++) {
    // Giorno di calendario (il fuso non c'entra: si somma solo ai giorni)
    const cal = new Date(Date.UTC(y, m - 1, d + offset));
    let slots = reservationSlotsForDay(cal.getUTCDay());
    if (offset === 0 && !ignoreClock) {
      const earliest = today.minutes + reservationHours.leadMinutes;
      slots = slots.filter((s) => toMin(s) >= earliest);
    }
    if (slots.length > 0) days.push({ date: cal.toISOString().slice(0, 10), slots });
  }
  return days;
};

/** L'arrivo (data AAAA-MM-GG + HH:MM) è prenotabile adesso? Il server lo ricontrolla sempre */
export const isReservationSlotAvailable = (date: string, slot: string, now = new Date(), ignoreClock = false): boolean =>
  availableReservationDays(now, ignoreClock).some((g) => g.date === date && g.slots.includes(slot));

/** Istante (UTC) di `slot` (HH:MM) nel giorno `date` (AAAA-MM-GG) nel fuso della pizzeria: è l'inizio salvato in DB */
export const reservationToDate = (date: string, slot: string): Date => {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = slot.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const wall = nowInPizzeria(new Date(guess)); // com'è quell'istante sull'orologio di Roma
  const [wy, wm, wd] = wall.date.split('-').map(Number) as [number, number, number];
  const wallMs = Date.UTC(wy, wm - 1, wd) + wall.minutes * 60_000;
  return new Date(guess - (wallMs - guess));
};
