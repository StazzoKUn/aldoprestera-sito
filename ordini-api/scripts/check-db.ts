// Verifica della connessione: `npm run db:check`
// Mostra versione del server, database e utente in uso, charset/collation
// e i permessi dell'utente (utili per capire se Prisma può creare lo shadow database).
import { prisma } from "../src/db/prisma.js";

try {
  const [info] = await prisma.$queryRaw<Record<string, string>[]>`
    SELECT VERSION()               AS versione,
           DATABASE()              AS db,
           CURRENT_USER()          AS utente,
           @@character_set_database AS charset_db,
           @@collation_database     AS collation_db,
           @@SESSION.sql_mode       AS sql_mode_sessione`;
  console.log("\nConnessione riuscita:");
  console.table(info);

  const grants = await prisma.$queryRawUnsafe<Record<string, string>[]>("SHOW GRANTS");
  console.log("Permessi dell'utente:");
  for (const g of grants) console.log("  " + Object.values(g)[0]);
} catch (err) {
  console.error("\nConnessione fallita:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
