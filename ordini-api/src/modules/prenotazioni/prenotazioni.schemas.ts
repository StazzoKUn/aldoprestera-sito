// Validazione degli input delle prenotazioni.
// Gli orari prenotabili (turni, ultimo arrivo) li decide il sito (orderHours in site.ts):
// qui si controllano solo i limiti di sicurezza (nel futuro, entro 7 giorni) in prenotazioni.service.ts.
import { z } from "zod";
import { idSchema } from "../../lib/schemas.js";
import { MOTIVI_RIFIUTO_PRENOTAZIONE } from "./prenotazioni.motivi.js";

const idBody = idSchema.or(z.number().int().positive().transform((n) => BigInt(n)));

export const prenotazioneCreateSchema = z.strictObject({
  cliente_id: idBody,
  // Nessun tetto di persone deciso (decide Aldo): 200 è solo un limite tecnico anti-errore
  persone: z.number().int().min(1).max(200),
  inizio: z.coerce.date(), // ISO 8601, calcolato dal sito dallo slot scelto
  note: z.string().trim().max(1000).nullish(),
});

export const prenotazioneCodiceParams = z.object({
  codice: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/, "codice non valido"),
});

// Dal pannello di Aldo si impostano solo questi stati
export const prenotazioneStatoSchema = z
  .strictObject({
    stato: z.enum(["confermata", "rifiutata", "annullata"]),
    motivo: z.enum(MOTIVI_RIFIUTO_PRENOTAZIONE, { message: "motivo di rifiuto non valido" }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stato === "rifiutata" && !v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il rifiuto richiede un motivo" });
    if (v.stato !== "rifiutata" && v.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "il motivo si indica solo per il rifiuto" });
  });

// Promemoria libero di Aldo sul tavolo ("T3+T4 uniti"); null o stringa vuota lo cancella
export const prenotazioneTavoloSchema = z.strictObject({
  tavolo_note: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type PrenotazioneCreate = z.infer<typeof prenotazioneCreateSchema>;
export type PrenotazioneStato = z.infer<typeof prenotazioneStatoSchema>;
export type PrenotazioneTavolo = z.infer<typeof prenotazioneTavoloSchema>;
