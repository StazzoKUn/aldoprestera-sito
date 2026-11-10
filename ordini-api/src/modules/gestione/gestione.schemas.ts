// Input delle route di gestione (pannello di Aldo).
import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { MOTIVI_RIFIUTO } from "../ordini/ordini.motivi.js";

// Dal pannello si possono impostare solo questi stati (annullato e bozza non sono azioni di Aldo)
export const gestioneStatoSchema = z
  .strictObject({
    stato: z.enum(["accettato", "rifiutato", "consegnato"]),
    motivo: z.enum(MOTIVI_RIFIUTO, { message: "motivo di rifiuto non valido" }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stato === "rifiutato" && !v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il rifiuto richiede un motivo" });
    if (v.stato !== "rifiutato" && v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il motivo si indica solo per il rifiuto" });
  });

export const storicoQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato AAAA-MM-GG").optional(),
});

export type GestioneStato = z.infer<typeof gestioneStatoSchema>;
export type StoricoQuery = z.infer<typeof storicoQuery>;
