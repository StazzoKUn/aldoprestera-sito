import { orderHours } from '../data/site';
import type { Mode } from './order';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Tutti gli slot della serata, es. 19:30 … 21:15 */
export const allSlots = (): string[] => {
  const out: string[] = [];
  for (let t = toMin(orderHours.firstSlot); t <= toMin(orderHours.lastSlot); t += orderHours.step) {
    out.push(toHHMM(t));
  }
  return out;
};

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
  if (ignoreClock) return allSlots();
  const { day, minutes } = nowInPizzeria(now);
  if (!(orderHours.days as readonly number[]).includes(day)) return [];
  const earliest = minutes + orderHours.leadMinutes[mode];
  return allSlots().filter((s) => toMin(s) >= earliest);
};
