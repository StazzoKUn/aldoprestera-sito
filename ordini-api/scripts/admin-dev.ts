// Account di PROVA per /gestione, solo in sviluppo: `npm run admin:dev`
// Credenziali fisse e pubbliche (sono in questo file): rifiutato con NODE_ENV=production.
// Per un account vero, con una password scelta da te, usa `npm run admin:crea`.
process.env.LOG_QUERIES ??= "false";

const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/db/prisma.js");
const { hashPassword } = await import("../src/modules/accesso/password.js");

const USERNAME = "aldo";
const PASSWORD = "aldo";

if (env.NODE_ENV === "production") {
  console.error("Rifiutato: NODE_ENV=production. Usa `npm run admin:crea`.");
  process.exit(1);
}

try {
  const password_hash = await hashPassword(PASSWORD);
  await prisma.utente.upsert({
    where: { username: USERNAME },
    create: { username: USERNAME, nome: "Aldo", password_hash },
    update: { password_hash, attivo: true, tentativi_falliti: 0, bloccato_fino: null },
  });
  console.log(`Account di prova pronto: utente "${USERNAME}", password in scripts/admin-dev.ts.`);
} finally {
  await prisma.$disconnect();
}
