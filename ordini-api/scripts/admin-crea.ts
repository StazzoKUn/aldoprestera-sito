// Crea (o reimposta la password dell') account di Aldo per /gestione: `npm run admin:crea`
// Username, nome e password si digitano qui; la password non compare a schermo né in nessun file.
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { prisma } from "../src/db/prisma.js";
import { hashPassword } from "../src/modules/accesso/password.js";

let muto = false;
const out = new Writable({
  write(chunk, _enc, cb) {
    if (!muto) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output: out, terminal: true });

const chiedi = (q: string) => rl.question(q);
async function chiediSegreto(q: string) {
  process.stdout.write(q);
  muto = true;
  const v = await rl.question("");
  muto = false;
  process.stdout.write("\n");
  return v;
}

try {
  const username = (await chiedi("Username: ")).trim();
  if (!/^[a-z0-9._-]{3,64}$/i.test(username)) throw new Error("username: 3-64 caratteri tra lettere, numeri, . _ -");
  const esistente = await prisma.utente.findUnique({ where: { username } });
  if (esistente) {
    const r = (await chiedi(`L'utente "${username}" esiste già. Reimposto la password? (s/N) `)).trim().toLowerCase();
    if (r !== "s") throw new Error("operazione annullata");
  }
  const nome = esistente ? esistente.nome : (await chiedi("Nome (es. Aldo): ")).trim();
  if (!nome) throw new Error("il nome è obbligatorio");

  const password = await chiediSegreto("Password (min 10 caratteri): ");
  if (password.length < 10) throw new Error("la password deve avere almeno 10 caratteri");
  if ((await chiediSegreto("Ripeti la password: ")) !== password) throw new Error("le password non coincidono");

  const password_hash = await hashPassword(password);
  await prisma.utente.upsert({
    where: { username },
    create: { username, nome, password_hash },
    update: { password_hash, tentativi_falliti: 0, bloccato_fino: null, attivo: true },
  });
  // Reimpostare la password chiude le sessioni aperte
  if (esistente) await prisma.sessione.deleteMany({ where: { utente_id: esistente.id } });
  console.log(esistente ? "Password aggiornata." : `Utente "${username}" creato.`);
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
