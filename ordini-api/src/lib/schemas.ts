// Schemi Zod riusati da più moduli.
import { z } from "zod";

// Id nei parametri dell'URL (/prodotti/:id): stringa di sole cifre -> BigInt.
export const idSchema = z
  .string()
  .regex(/^[1-9]\d{0,18}$/, "deve essere un id numerico positivo")
  .transform((v) => BigInt(v));

export const idParams = z.object({ id: idSchema });

// Importo in euro con al massimo 2 decimali, compatibile con DECIMAL(10,2).
// Accetta 19.99 oppure "19.99" e lo passa a Prisma come stringa: così il valore
// arriva al database esatto, senza passare da un float.
export const importoSchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), {
    message: "deve essere un importo >= 0 con al massimo 2 decimali (max 99999999.99)",
  });

// Aliquota IVA in percentuale (22 = 22%), compatibile con DECIMAL(5,2).
export const aliquotaSchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, {
    message: "deve essere una percentuale tra 0 e 100 con al massimo 2 decimali",
  });

// Per ora si vende solo in euro: quando arriveranno altre valute basterà allargare qui.
export const valutaSchema = z.literal("EUR", { message: "per ora è accettata solo la valuta EUR" });

// Filtri booleani in query string: ?attivo=true / ?attivo=false
export const booleanQuery = z
  .enum(["true", "false"], { message: "deve essere true o false" })
  .transform((v) => v === "true");
