// Route HTTP delle prenotazioni usate dal sito (dietro il token dell'API).
// Quelle del pannello di Aldo stanno in gestione.routes.ts (token + sessione).
import { Router } from "express";
import { prenotazioneCodiceParams, prenotazioneCreateSchema } from "./prenotazioni.schemas.js";
import * as service from "./prenotazioni.service.js";

export const prenotazioniRouter = Router();

// Creazione della richiesta (stato iniziale: richiesta)
prenotazioniRouter.post("/", async (req, res) => {
  const data = prenotazioneCreateSchema.parse(req.body);
  res.status(201).json(await service.createPrenotazione(data));
});

// Pagina di attesa del cliente: per codice pubblico (applica il rifiuto automatico a orario passato)
prenotazioniRouter.get("/pubblico/:codice", async (req, res) => {
  const { codice } = prenotazioneCodiceParams.parse(req.params);
  res.json(await service.getPrenotazionePubblica(codice));
});
