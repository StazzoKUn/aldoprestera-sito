// Validazione degli input degli ordini.
// Il client manda SOLO prodotto_id e quantita per ogni riga: prezzi, IVA, nomi,
// totali e numero_ordine li decide il server. z.strictObject rifiuta qualunque
// altro campo (es. "prezzo_unitario" o "totale" mandati dal client -> 400).
import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { idSchema, importoSchema } from "../../lib/schemas.js";
import { MOTIVI_RIFIUTO } from "./ordini.motivi.js";
import { STATI } from "./ordini.stato.js";

const rigaInput = z.strictObject({
  prodotto_id: idSchema.or(z.number().int().positive().transform((n) => BigInt(n))),
  quantita: z.number().int().min(1).max(999),
});

// Almeno una riga, e ogni prodotto una sola volta (per 2 pezzi: quantita = 2)
const righeInput = z
  .array(rigaInput)
  .min(1, "l'ordine deve avere almeno una riga")
  .max(100)
  .superRefine((righe, ctx) => {
    const visti = new Set<bigint>();
    righe.forEach((r, i) => {
      if (visti.has(r.prodotto_id)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "prodotto_id"],
          message: "prodotto ripetuto: aumenta la quantita della riga esistente",
        });
      }
      visti.add(r.prodotto_id);
    });
  });

// Id nel body: accetto sia "3" (come lo restituiscono le nostre API) sia 3
const idBody = idSchema.or(z.number().int().positive().transform((n) => BigInt(n)));

export const ordineCreateSchema = z.strictObject({
  cliente_id: idBody,
  indirizzo_spedizione_id: idBody.nullish(),
  indirizzo_fatturazione_id: idBody.nullish(),
  // Il sito crea direttamente in "ricevuto"; "bozza" resta possibile ma non è usata
  stato: z.enum(["bozza", "ricevuto"]).default("ricevuto"),
  // Dati salvati sull'ordine (il pannello legge questi, non quelli di cliente)
  modalita: z.enum(["consegna", "asporto"]),
  orario_richiesto: z.coerce.date(), // ISO 8601, calcolato dal server del sito
  metodo_pagamento: z.string().trim().min(1).max(32),
  nome_cliente: z.string().trim().min(1).max(150),
  telefono_cliente: z.string().trim().min(1).max(32),
  citofono: z.string().trim().max(80).nullish(),
  // Solo note del cliente
  note: z.string().trim().max(65535).nullish(),
  // Consegna in euro (0 = ritiro): il totale dell'ordine è righe + consegna
  costo_consegna: importoSchema.default("0"),
  righe: righeInput,
});

// PATCH /ordini/:id — solo in bozza: indirizzi e note
export const ordineUpdateSchema = z
  .strictObject({
    indirizzo_spedizione_id: idBody.nullable(),
    indirizzo_fatturazione_id: idBody.nullable(),
    note: z.string().trim().max(65535).nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "indica almeno un campo da modificare" });

// PUT /ordini/:id/righe — solo in bozza: sostituisce tutte le righe
export const righeUpdateSchema = z.strictObject({ righe: righeInput });

export const statoUpdateSchema = z
  .strictObject({
    stato: z.enum(STATI, { message: `stato non valido: ammessi ${STATI.join(", ")}` }),
    motivo: z.enum(MOTIVI_RIFIUTO, { message: "motivo di rifiuto non valido" }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stato === "rifiutato" && !v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il rifiuto richiede un motivo" });
    if (v.stato !== "rifiutato" && v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il motivo si indica solo per il rifiuto" });
  });

export const codicePubblicoParams = z.object({ codice: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/, "codice non valido") });

export const ordiniListQuery = paginationQuery.extend({
  cliente_id: idSchema.optional(),
  stato: z.enum(STATI).optional(),
});

export type OrdineCreate = z.infer<typeof ordineCreateSchema>;
export type OrdineUpdate = z.infer<typeof ordineUpdateSchema>;
export type RigaInput = z.infer<typeof rigaInput>;
export type OrdiniListQuery = z.infer<typeof ordiniListQuery>;
