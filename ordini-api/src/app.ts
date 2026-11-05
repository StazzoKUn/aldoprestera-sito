import express from "express";
import { prisma } from "./db/prisma.js";
import { jsonReplacer } from "./lib/json.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { clientiRouter } from "./modules/clienti/clienti.routes.js";
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

// Le route dei moduli, tutte dietro il middleware di autenticazione.
const api = express.Router();
api.use(authenticate);
api.use("/prodotti", prodottiRouter);
api.use("/clienti/:cliente_id/indirizzi", indirizziRouter);
api.use("/clienti", clientiRouter);
api.use("/ordini", ordiniRouter);
app.use(api);

app.use(notFoundHandler);
app.use(errorHandler);
