// Archivio minimo su file (solo server): numero d'ordine e pizze prenotate per slot.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = () => process.env.ORDERS_DIR ?? './.data';

const readJson = async <T,>(file: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(path.join(dir(), file), 'utf8')) as T;
  } catch {
    return fallback;
  }
};
const writeJson = async (file: string, data: unknown) => {
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), file), JSON.stringify(data));
};

/** Esegue le operazioni una alla volta, così due ordini simultanei non prendono lo stesso posto */
let queue: Promise<unknown> = Promise.resolve();
export const withLock = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
};

const slotsFile = (date: string) => `slots-${date}.json`;

/** Pizze già prenotate per ogni slot della data */
export const bookedSlots = (date: string) => readJson<Record<string, number>>(slotsFile(date), {});

export const bookSlot = async (date: string, slot: string, pizzas: number) => {
  const booked = await bookedSlots(date);
  booked[slot] = Math.max(0, (booked[slot] ?? 0) + pizzas);
  await writeJson(slotsFile(date), booked);
};

/** Numero d'ordine progressivo a 4 cifre */
export const nextOrderNumber = async () => {
  const { last = 0 } = await readJson<{ last?: number }>('counter.json', {});
  const n = last + 1;
  await writeJson('counter.json', { last: n });
  return String(n).padStart(4, '0');
};
