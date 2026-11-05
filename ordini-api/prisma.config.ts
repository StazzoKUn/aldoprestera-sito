// Configurazione della CLI di Prisma (migrate, generate, seed, studio).
// Da Prisma 7 la CLI non legge più il .env da sola: lo carichiamo con dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run db:seed` (= prisma db seed) esegue questo comando
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Se SHADOW_DATABASE_URL non è impostata, `prisma migrate dev` crea e poi
    // cancella da solo un database temporaneo: serve il permesso CREATE/DROP
    // sui database (root di XAMPP ce l'ha).
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
