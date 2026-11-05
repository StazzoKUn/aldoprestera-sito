// Validazione degli input dei clienti (nomi = colonne della tabella cliente).
// stripe_customer_id non è accettato: lo gestirà il futuro modulo pagamenti.
import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

const clienteFields = z.strictObject({
  // Prima si normalizza (spazi, minuscole), poi si controlla il formato
  email: z.string().trim().toLowerCase().max(255).pipe(z.email({ message: "email non valida" })),
  nome: z.string().trim().min(1).max(100),
  cognome: z.string().trim().min(1).max(100),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{6,20}$/, "solo cifre e spazi, con + iniziale facoltativo")
    .nullish(),
  // 16 caratteri (persona fisica) oppure 11 cifre (società)
  codice_fiscale: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z0-9]{16}|\d{11})$/, "16 caratteri alfanumerici oppure 11 cifre")
    .nullish(),
  // Partita IVA italiana: 11 cifre
  partita_iva: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "deve essere composta da 11 cifre")
    .nullish(),
});

export const clienteCreateSchema = clienteFields;

export const clienteUpdateSchema = clienteFields
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "indica almeno un campo da modificare" });

export const clientiListQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(100).optional(), // ricerca per nome, cognome o email
});

export type ClienteCreate = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdate = z.infer<typeof clienteUpdateSchema>;
export type ClientiListQuery = z.infer<typeof clientiListQuery>;
