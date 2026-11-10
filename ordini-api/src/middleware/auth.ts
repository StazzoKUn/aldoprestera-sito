// Autenticazione delle route.
// 1) authenticate: tutte le route (tranne /health) richiedono ORDINI_API_TOKEN, che solo il
//    server del sito conosce ("Authorization: Bearer <token>"). Il browser non parla mai con l'API.
// 2) richiediSessione: le route di gestione richiedono ANCHE la sessione di Aldo, che il sito
//    inoltra nell'header "X-Sessione" (il token letto dal cookie HttpOnly).
import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { verificaSessione } from "../modules/accesso/accesso.service.js";

const atteso = Buffer.from(env.ORDINI_API_TOKEN);

export const authenticate: RequestHandler = (req, _res, next) => {
  const m = /^Bearer (.+)$/.exec(req.get("authorization") ?? "");
  const ricevuto = Buffer.from(m?.[1] ?? "");
  // Confronto a tempo costante (e solo a lunghezze uguali, come richiede timingSafeEqual)
  if (ricevuto.length !== atteso.length || !timingSafeEqual(ricevuto, atteso)) {
    throw new AppError(401, "UNAUTHORIZED", "Token mancante o non valido");
  }
  next();
};

export const richiediSessione: RequestHandler = async (req, res, next) => {
  const utente = await verificaSessione(req.get("x-sessione"));
  if (!utente) throw new AppError(401, "SESSION_REQUIRED", "Sessione mancante o scaduta");
  res.locals.utente = utente;
  next();
};
