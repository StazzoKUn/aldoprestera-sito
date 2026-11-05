// Validazione degli input dei prodotti.
// I nomi dei campi sono quelli delle colonne (snake_case).
// z.strictObject rifiuta i campi sconosciuti (es. "id" o "creato_il" nel body).
import { z } from "zod";
import { aliquotaSchema, booleanQuery, importoSchema, valutaSchema } from "../../lib/schemas.js";
import { paginationQuery } from "../../lib/pagination.js";

// Campi comuni, SENZA valori di default: se li avessero, in PATCH lo schema
// "partial" li aggiungerebbe comunque (es. attivo: true) e una modifica del solo
// prezzo riattiverebbe di nascosto un prodotto disattivato.
const prodottoFields = z.strictObject({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "solo lettere, numeri, punto, trattino e underscore"),
  nome: z.string().trim().min(1).max(200),
  descrizione: z.string().trim().max(65535).nullish(),
  prezzo: importoSchema,
  valuta: valutaSchema,
  aliquota_iva: aliquotaSchema,
  attivo: z.boolean(),
});

// POST: valuta e attivo hanno un default
export const prodottoCreateSchema = prodottoFields.extend({
  valuta: valutaSchema.default("EUR"),
  attivo: z.boolean().default(true),
});

// PATCH: tutti i campi facoltativi, ma almeno uno
export const prodottoUpdateSchema = prodottoFields
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "indica almeno un campo da modificare" });

export const prodottiListQuery = paginationQuery.extend({
  attivo: booleanQuery.optional(),
  q: z.string().trim().min(1).max(100).optional(), // ricerca per nome o SKU
});

export type ProdottoCreate = z.infer<typeof prodottoCreateSchema>;
export type ProdottoUpdate = z.infer<typeof prodottoUpdateSchema>;
export type ProdottiListQuery = z.infer<typeof prodottiListQuery>;
