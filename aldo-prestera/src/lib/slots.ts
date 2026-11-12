import { orderHours } from '../data/site';
import type { Mode } from './order';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const DAY = 24 * 60;
/** Sotto questo orario (06:00) uno slot appartiene alla notte, cioè al giorno dopo l'apertura */
const NIGHT_UNTIL = 6 * 60;
const toHHMM = (min: number) => {
  const m = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Slot del giorno di apertura `day`, in minuti dall'inizio di quel giorno (oltre 1440 = dopo mezzanotte) */
const daySlots = (day: number): number[] => {
  const out: number[] = [];
  for (const [open, close] of orderHours.week[day] ?? []) {
    for (let t = toMin(open) + orderHours.firstAfterOpen; t <= toMin(close) - orderHours.lastBeforeClose; t += orderHours.step) {
      out.push(t);
    }
  }
  return out;
};

/** Tutti gli slot di un giorno di apertura, es. 12:15 … 14:00 e 17:45 … 00:30 */
export const allSlots = (day: number): string[] => daySlots(day).map(toHHMM);

/** Data (YYYY-MM-DD), giorno della settimana e minuti da mezzanotte, nel fuso della pizzeria */
export const nowInPizzeria = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: orderHours.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    day,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

/**
 * Slot ancora prenotabili oggi in base a orari di apertura e anticipo minimo.
 * `ignoreClock` (solo sviluppo) restituisce sempre tutti gli slot.
 */
export const availableSlots = (mode: Mode, now = new Date(), ignoreClock = false): string[] => {
  const { day, minutes } = nowInPizzeria(now);
  if (ignoreClock) return allSlots(day);
  const earliest = minutes + orderHours.leadMinutes[mode];
  // Dopo mezzanotte valgono ancora gli slot notturni del giorno prima (riportati a minuti di oggi)
  const yesterday = daySlots((day + 6) % 7).map((t) => t - DAY);
  return [...yesterday, ...daySlots(day)].filter((t) => t >= earliest).map(toHHMM);
};

/** Istante (UTC) di oggi alle `slot` (HH:MM) nel fuso della pizzeria: è l'orario_richiesto salvato in DB */
export const slotToDate = (slot: string, now = new Date()): Date => {
  const today = nowInPizzeria(now);
  const [y, mo, d] = today.date.split('-').map(Number);
  // Uno slot notturno (es. 00:30) scelto prima di mezzanotte cade il giorno dopo
  const nextDay = toMin(slot) < NIGHT_UNTIL && today.minutes >= NIGHT_UNTIL ? 1 : 0;
  const guess = Date.UTC(y, mo - 1, d + nextDay, ...(slot.split(':').map(Number) as [number, number]));
  const wall = nowInPizzeria(new Date(guess)); // com'è quell'istante sull'orologio di Roma
  const [wy, wm, wd] = wall.date.split('-').map(Number);
  const wallMs = Date.UTC(wy, wm - 1, wd) + wall.minutes * 60_000;
  return new Date(guess - (wallMs - guess));
};
