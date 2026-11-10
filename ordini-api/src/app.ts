import express from "express";
import { prisma } from "./db/prisma.js";
import { jsonReplacer } from "./lib/json.js";
import { authenticate, richiediSessione } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { accessoRouter } from "./modules/accesso/accesso.routes.js";
import { clientiRouter } from "./modules/clienti/clienti.routes.js";
import { gestioneRouter } from "./modules/gestione/gestione.routes.js";
import { indirizziRouter } from "./modules/indirizzi/indirizzi.routes.js";
import { ordiniRouter } from "./modules/ordini/ordini.routes.js";
import { prodottiRouter } from "./modules/prodotti/prodotti.routes.js";

export const app = express();

app.set("json replacer", jsonReplacer); // BigInt e Decimal -> JSON (vedi lib/json.ts)
app.use(express.json());

// Stato del servizio e della connessione al database
app.get("/health", async (_req, res) => {
  const [row] = await prisma.$queryRaw<{ versione: string; database: string }[]>`
    SELECT VERSION() AS versione, DATABASE() AS \`database\``;
  res.json({ status: "ok", db: row });
});

// Le route dei moduli, tutte dietro il token dell'API (ORDINI_API_TOKEN).
// Quelle di gestione aggiungono richiediSessione (vedi middleware/auth.ts).
const api = express.Router();
api.use(authenticate);
api.use("/accesso", accessoRouter);
api.use("/gestione", richiediSessione, gestioneRouter);
api.use("/prodotti", prodottiRouter);
api.use("/clienti/:cliente_id/indirizzi", indirizziRouter);
api.use("/clienti", clientiRouter);
api.use("/ordini", ordiniRouter);
app.use(api);

app.use(notFoundHandler);
app.use(errorHandler);
