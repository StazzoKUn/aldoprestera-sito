// Route HTTP degli ordini.
import { Router } from "express";
import { idParams } from "../../lib/schemas.js";
import {
  ordineCreateSchema,
  ordineUpdateSchema,
  ordiniListQuery,
  righeUpdateSchema,
  statoUpdateSchema,
} from "./ordini.schemas.js";
import * as service from "./ordini.service.js";

export const ordiniRouter = Router();

// GET /ordini?cliente_id=1&stato=bozza&page=1&page_size=20
ordiniRouter.get("/", async (req, res) => {
  const query = ordiniListQuery.parse(req.query);
  res.json(await service.listOrdini(query));
});

// Dettaglio con righe, cliente e indirizzi
ordiniRouter.get("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await service.getOrdine(id));
});

// Creazione con righe (stato iniziale: bozza)
ordiniRouter.post("/", async (req, res) => {
  const data = ordineCreateSchema.parse(req.body);
  res.status(201).json(await service.createOrdine(data));
});

// Indirizzi e note (solo in bozza)
ordiniRouter.patch("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const data = ordineUpdateSchema.parse(req.body);
  res.json(await service.updateOrdine(id, data));
});

// Sostituzione delle righe (solo in bozza)
ordiniRouter.put("/:id/righe", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { righe } = righeUpdateSchema.parse(req.body);
  res.json(await service.replaceRighe(id, righe));
});

// Cambio di stato
ordiniRouter.patch("/:id/stato", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { stato } = statoUpdateSchema.parse(req.body);
  res.json(await service.cambiaStato(id, stato));
});
