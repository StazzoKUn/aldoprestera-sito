// Route del pannello di Aldo. Montate in app.ts DOPO authenticate (token del sito)
// e con richiediSessione: servono sia il token sia la sessione di Aldo.
import { Router } from "express";
import { idParams } from "../../lib/schemas.js";
import { gestioneStatoSchema, storicoQuery } from "./gestione.schemas.js";
import { prenotazioneStatoSchema, prenotazioneTavoloSchema } from "../prenotazioni/prenotazioni.schemas.js";
import * as prenotazioni from "../prenotazioni/prenotazioni.service.js";
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

// ---- Prenotazioni tavolo

// Le liste (da confermare, confermate, chiuse) da oggi in avanti + gli id scaduti in questa lettura
gestioneRouter.get("/prenotazioni", async (_req, res) => {
  res.json(await prenotazioni.listaPannello());
});

gestioneRouter.post("/prenotazioni/:id/stato", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await prenotazioni.impostaStato(id, prenotazioneStatoSchema.parse(req.body)));
});

// Promemoria libero di Aldo sul tavolo ("T3+T4 uniti")
gestioneRouter.patch("/prenotazioni/:id/tavolo", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await prenotazioni.impostaTavolo(id, prenotazioneTavoloSchema.parse(req.body)));
});
