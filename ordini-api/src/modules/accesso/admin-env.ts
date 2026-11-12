// Account di Aldo da variabili d'ambiente: alternativa a `npm run admin:crea` quando non c'è SSH (es. Plesk).
// All'avvio, se ADMIN_USERNAME e ADMIN_PASSWORD sono impostate, crea l'utente o ne aggiorna la password.
// Per cambiare la password: si modifica ADMIN_PASSWORD nel pannello e si riavvia (le sessioni aperte si chiudono).
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { hashPassword, verificaPassword } from "./password.js";

export async function applicaAdminDaEnv() {
  const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = env;
  if (!username || !password) return;

  const esistente = await prisma.utente.findUnique({ where: { username } });
  if (!esistente) {
    await prisma.utente.create({
      data: { username, nome: env.ADMIN_NOME ?? username, password_hash: await hashPassword(password) },
    });
    console.log(`Account "${username}" creato da variabili d'ambiente.`);
    return;
  }
  if (await verificaPassword(password, esistente.password_hash)) return; // niente da fare: non chiude le sessioni a ogni riavvio
  await prisma.utente.update({
    where: { id: esistente.id },
    data: { password_hash: await hashPassword(password), tentativi_falliti: 0, bloccato_fino: null, attivo: true },
  });
  await prisma.sessione.deleteMany({ where: { utente_id: esistente.id } });
  console.log(`Password dell'account "${username}" aggiornata da variabili d'ambiente.`);
}
