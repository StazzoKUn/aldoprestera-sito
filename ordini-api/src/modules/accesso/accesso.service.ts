// Login, sessioni e blocco dopo troppi tentativi.
// Nel DB c'è solo l'hash SHA-256 del token di sessione: chi legge il DB non può usarlo.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/errors.js";
import { HASH_FINTO, verificaPassword } from "./password.js";

export const MAX_TENTATIVI = 5;
export const BLOCCO_MS = 15 * 60_000;
export const SESSIONE_MS = 30 * 24 * 3600_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface UtenteSessione {
  id: string;
  username: string;
  nome: string;
}

export async function login(username: string, password: string) {
  const utente = await prisma.utente.findUnique({ where: { username } });
  const adesso = new Date();

  if (utente?.bloccato_fino && utente.bloccato_fino > adesso) {
    await verificaPassword(password, HASH_FINTO); // niente scorciatoie sui tempi
    throw new AppError(429, "LOCKED", "Troppi tentativi: riprova tra qualche minuto");
  }

  const ok = await verificaPassword(password, utente?.password_hash ?? HASH_FINTO);
  if (!utente || !utente.attivo || !ok) {
    if (utente) {
      const tentativi = utente.tentativi_falliti + 1;
      const blocca = tentativi >= MAX_TENTATIVI;
      await prisma.utente.update({
        where: { id: utente.id },
        data: {
          tentativi_falliti: blocca ? 0 : tentativi,
          bloccato_fino: blocca ? new Date(adesso.getTime() + BLOCCO_MS) : null,
        },
      });
    }
    // Stesso messaggio per utente inesistente, password errata o account disattivato
    throw new AppError(401, "INVALID_CREDENTIALS", "Utente o password non corretti");
  }

  const token = randomBytes(32).toString("base64url");
  const scade_il = new Date(adesso.getTime() + SESSIONE_MS);
  await prisma.$transaction([
    prisma.utente.update({
      where: { id: utente.id },
      data: { tentativi_falliti: 0, bloccato_fino: null, ultimo_accesso: adesso },
    }),
    prisma.sessione.create({ data: { utente_id: utente.id, token_hash: hashToken(token), scade_il } }),
    // Pulizia: le sessioni scadute non servono più
    prisma.sessione.deleteMany({ where: { scade_il: { lt: adesso } } }),
  ]);
  return { token, scade_il, utente: { id: utente.id.toString(), username: utente.username, nome: utente.nome } };
}

/** Utente della sessione se il token è valido, non scaduto e l'account è attivo; altrimenti null */
export async function verificaSessione(token: string | undefined): Promise<UtenteSessione | null> {
  if (!token || token.length > 128) return null;
  const sessione = await prisma.sessione.findUnique({
    where: { token_hash: hashToken(token) },
    include: { utente: true },
  });
  if (!sessione || sessione.scade_il <= new Date() || !sessione.utente.attivo) return null;
  await prisma.sessione.update({ where: { id: sessione.id }, data: { ultimo_uso: new Date() } });
  const { id, username, nome } = sessione.utente;
  return { id: id.toString(), username, nome };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.sessione.deleteMany({ where: { token_hash: hashToken(token) } });
}
