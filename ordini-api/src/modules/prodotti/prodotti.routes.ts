// Route HTTP dei prodotti: validano l'input con Zod e chiamano il service.
// Un errore di validazione (ZodError) diventa 400 in error-handler.ts.
import { Router } from "express";
import { idParams } from "../../lib/schemas.js";
import { prodottiListQuery, prodottoCreateSchema, prodottoUpdateSchema } from "./prodotti.schemas.js";
import * as service from "./prodotti.service.js";

export const prodottiRouter = Router();

// GET /prodotti?page=1&page_size=20&attivo=true&q=margherita
prodottiRouter.get("/", async (req, res) => {
  const query = prodottiListQuery.parse(req.query);
  res.json(await service.listProdotti(query));
});

prodottiRouter.get("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await service.getProdotto(id));
});

prodottiRouter.post("/", async (req, res) => {
  const data = prodottoCreateSchema.parse(req.body);
  res.status(201).json(await service.createProdotto(data));
});

prodottiRouter.patch("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const data = prodottoUpdateSchema.parse(req.body);
  res.json(await service.updateProdotto(id, data));
});

prodottiRouter.delete("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  await service.deleteProdotto(id);
  res.status(204).end();
});
