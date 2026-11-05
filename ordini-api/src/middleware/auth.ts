// Segnaposto per l'autenticazione (fuori ambito per ora).
// È già montato in app.ts davanti alle route delle API: quando servirà basterà
// verificare qui il token/la sessione e chiamare next() oppure rispondere 401.
import type { RequestHandler } from "express";

export const authenticate: RequestHandler = (_req, _res, next) => {
  next();
};
