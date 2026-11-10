// Route del pannello di Aldo. Montate in app.ts DOPO authenticate (token del sito)
// e con richiediSessione: servono sia il token sia la sessione di Aldo.
import { Router } from "express";
import { idParams } from "../../lib/schemas.js";
import { gestioneStatoSchema, storicoQuery } from "./gestione.schemas.js";
import * as service from "./gestione.service.js";

export const gestioneRouter = Router();

// Le tre liste (da accettare, in corso, chiusi oggi) + gli id scaduti in questa lettura
gestioneRouter.get("/ordini", async (_req, res) => {
  res.json(await service.listaPannello());
});

// Storico con ricerca: ?q=numero|nome|telefono&data=AAAA-MM-GG&page=1
gestioneRouter.get("/ordini/storico", async (req, res) => {
  res.json(await service.storico(storicoQuery.parse(req.query)));
});

gestioneRouter.post("/ordini/:id/stato", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await service.impostaStato(id, gestioneStatoSchema.parse(req.body)));
});
