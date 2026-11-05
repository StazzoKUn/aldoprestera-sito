// Route HTTP dei clienti.
import { Router } from "express";
import { idParams } from "../../lib/schemas.js";
import { clienteCreateSchema, clientiListQuery, clienteUpdateSchema } from "./clienti.schemas.js";
import * as service from "./clienti.service.js";

export const clientiRouter = Router();

// GET /clienti?page=1&page_size=20&q=rossi
clientiRouter.get("/", async (req, res) => {
  const query = clientiListQuery.parse(req.query);
  res.json(await service.listClienti(query));
});

clientiRouter.get("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await service.getCliente(id));
});

clientiRouter.post("/", async (req, res) => {
  const data = clienteCreateSchema.parse(req.body);
  res.status(201).json(await service.createCliente(data));
});

clientiRouter.patch("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const data = clienteUpdateSchema.parse(req.body);
  res.json(await service.updateCliente(id, data));
});

clientiRouter.delete("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  await service.deleteCliente(id);
  res.status(204).end();
});
