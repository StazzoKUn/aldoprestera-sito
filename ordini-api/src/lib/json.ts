// UNICO punto in cui i tipi "speciali" restituiti da Prisma diventano JSON.
//
// - BIGINT  -> BigInt in JavaScript. JSON.stringify(10n) lancia un TypeError,
//              quindi lo convertiamo in stringa ("123"): una stringa non perde
//              precisione oltre Number.MAX_SAFE_INTEGER.
// - DECIMAL -> oggetto Prisma.Decimal. Di suo diventerebbe la stringa "19.99";
//              lo convertiamo in numero (19.99): con 2 decimali è esatto.
//
// La funzione viene registrata in app.ts con app.set("json replacer", ...),
// quindi vale per ogni res.json() dell'applicazione.
import { Prisma } from "../generated/prisma/client.js";

export function jsonReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();

  // JSON.stringify chiama toJSON() prima del replacer: per riconoscere il
  // Decimal guardiamo il valore originale, che è this[key].
  const original = this[key];
  if (Prisma.Decimal.isDecimal(original)) return (original as Prisma.Decimal).toNumber();

  return value;
}
