import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { applicaAdminDaEnv } from "./modules/accesso/admin-env.js";

await applicaAdminDaEnv().catch((err) => console.error("Account admin da variabili non applicato:", err instanceof Error ? err.message : err));

const server = app.listen(env.PORT, () => {
  console.log(`API in ascolto su http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Chiusura ordinata: termina le richieste in corso e libera le connessioni al DB
async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
