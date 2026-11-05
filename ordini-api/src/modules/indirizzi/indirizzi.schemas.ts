// Validazione degli input degli indirizzi (nomi = colonne della tabella indirizzo).
// cliente_id non si manda nel body: arriva dall'URL /clienti/:cliente_id/indirizzi.
import { z } from "zod";
import { idSchema } from "../../lib/schemas.js";

const indirizzoFields = z.strictObject({
  destinatario: z.string().trim().min(1).max(150),
  via: z.string().trim().min(1).max(255),
  cap: z.string().trim().min(1).max(16),
  citta: z.string().trim().min(1).max(100),
  provincia: z.string().trim().min(1).max(64),
  nazione: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "codice ISO 3166-1 alpha-2 di 2 lettere, es. IT"),
  predefinito: z.boolean(),
});

export const indirizzoCreateSchema = indirizzoFields.extend({
  nazione: indirizzoFields.shape.nazione.default("IT"),
  predefinito: z.boolean().default(false),
});

export const indirizzoUpdateSchema = indirizzoFields
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "indica almeno un campo da modificare" });

export const clienteParams = z.object({ cliente_id: idSchema });
export const indirizzoParams = z.object({ cliente_id: idSchema, id: idSchema });

export type IndirizzoCreate = z.infer<typeof indirizzoCreateSchema>;
export type IndirizzoUpdate = z.infer<typeof indirizzoUpdateSchema>;
