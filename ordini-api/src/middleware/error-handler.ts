// Middleware finale: ogni errore lanciato in una route (anche async: Express 5
// li intercetta da solo) arriva qui e diventa una risposta JSON uniforme.
import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Endpoint ${req.method} ${req.path} inesistente` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = toHttpError(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: body });
};

function toHttpError(err: unknown): {
  status: number;
  body: { code: string; message: string; details?: unknown };
} {
  if (err instanceof AppError) {
    return { status: err.status, body: { code: err.code, message: err.message, details: err.details } };
  }

  // Input non valido (schemi Zod)
  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: "Dati non validi",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  }

  // JSON malformato nel body (errore di express.json())
  if (err instanceof SyntaxError && "body" in err) {
    return { status: 400, body: { code: "INVALID_JSON", message: "Body JSON non valido" } };
  }

  // Errori noti di Prisma: https://www.prisma.io/docs/orm/reference/error-reference
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // violazione di un indice UNIQUE
        return {
          status: 409,
          body: { code: "CONFLICT", message: "Valore già esistente", details: err.meta },
        };
      case "P2003": // violazione di una FOREIGN KEY (es. ON DELETE RESTRICT)
        return {
          status: 409,
          body: { code: "CONFLICT", message: "Record collegato ad altri dati", details: err.meta },
        };
      case "P2025": // record da aggiornare/eliminare non trovato
        return { status: 404, body: { code: "NOT_FOUND", message: "Risorsa non trovata" } };
    }
  }

  return { status: 500, body: { code: "INTERNAL_ERROR", message: "Errore interno del server" } };
}
