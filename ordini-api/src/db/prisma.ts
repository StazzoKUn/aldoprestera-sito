// Unico PrismaClient dell'applicazione.
// Prisma 7 parla col database tramite un "driver adapter": qui usiamo il
// driver ufficiale `mariadb`, adatto al MariaDB di XAMPP.
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env, logQueries } from "../config/env.js";

const url = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 5,
  // XAMPP avvia MariaDB in modalità "non strict": un valore troppo lungo o
  // fuori intervallo verrebbe troncato in silenzio. Per le connessioni
  // dell'app attiviamo la modalità strict, così MariaDB rifiuta l'INSERT.
  initSql: "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
});

export const prisma = new PrismaClient({
  adapter,
  // "error" non è nell'elenco: gli errori attesi (SKU duplicato, FK RESTRICT...)
  // sono gestiti e tradotti in 404/409; quelli imprevisti li stampa error-handler.ts.
  log: logQueries ? [{ emit: "event", level: "query" }, "warn"] : ["warn"],
});

// Log didattico: in sviluppo stampa ogni istruzione SQL con i parametri e la durata
// (si può forzare con LOG_QUERIES=true/false nel .env).
if (logQueries) {
  prisma.$on("query", (e) => {
    console.log(`\x1b[36mSQL\x1b[0m ${e.query}`);
    if (e.params && e.params !== "[]") console.log(`    params: ${e.params}`);
    console.log(`    \x1b[2m${Number(e.duration).toFixed(1)} ms\x1b[0m`);
  });
}
