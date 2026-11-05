// Route HTTP degli indirizzi, annidate sotto il cliente:
//   /clienti/:cliente_id/indirizzi[/:id]
// mergeParams: true rende visibile :cliente_id, che è definito nel percorso di montaggio (app.ts).
import { Router } from "express";
import {
  clienteParams,
  indirizzoCreateSchema,
  indirizzoParams,
  indirizzoUpdateSchema,
} from "./indirizzi.schemas.js";
import * as service from "./indirizzi.service.js";

export const indirizziRouter = Router({ mergeParams: true });

indirizziRouter.get("/", async (req, res) => {
  const { cliente_id } = clienteParams.parse(req.params);
  res.json(await service.listIndirizzi(cliente_id));
});

indirizziRouter.get("/:id", async (req, res) => {
  const { cliente_id, id } = indirizzoParams.parse(req.params);
  res.json(await service.getIndirizzo(cliente_id, id));
});

indirizziRouter.post("/", async (req, res) => {
  const { cliente_id } = clienteParams.parse(req.params);
  const data = indirizzoCreateSchema.parse(req.body);
  res.status(201).json(await service.createIndirizzo(cliente_id, data));
});

indirizziRouter.patch("/:id", async (req, res) => {
  const { cliente_id, id } = indirizzoParams.parse(req.params);
  const data = indirizzoUpdateSchema.parse(req.body);
  res.json(await service.updateIndirizzo(cliente_id, id, data));
});

indirizziRouter.delete("/:id", async (req, res) => {
  const { cliente_id, id } = indirizzoParams.parse(req.params);
  await service.deleteIndirizzo(cliente_id, id);
  res.status(204).end();
});
