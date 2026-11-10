// POST /accesso/login · POST /accesso/logout · GET /accesso/me
// Dietro al token dell'API (lo manda il server del sito); la sessione la gestiscono queste route.
import { Router } from "express";
import { z } from "zod";
import { richiediSessione } from "../../middleware/auth.js";
import * as service from "./accesso.service.js";

export const accessoRouter = Router();

const loginSchema = z.strictObject({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

accessoRouter.post("/login", async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  res.json(await service.login(username, password));
});

accessoRouter.post("/logout", async (req, res) => {
  await service.logout(req.get("x-sessione"));
  res.status(204).end();
});

accessoRouter.get("/me", richiediSessione, (_req, res) => {
  res.json(res.locals.utente);
});
