// Hash delle password con scrypt di node:crypto (nessuna dipendenza).
// Formato salvato: scrypt$N$r$p$salt(base64)$hash(base64) — i parametri stanno nella stringa,
// così si potranno alzare in futuro senza invalidare gli hash esistenti.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

const derive = (password: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verificaPassword(password: string, salvato: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = salvato.split("$");
  if (alg !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const atteso = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: +n, r: +r, p: +p });
  return key.length === atteso.length && timingSafeEqual(key, atteso);
}

// Hash di comodo per il login con utente inesistente: stesso costo, stessi tempi di risposta
export const HASH_FINTO = await hashPassword(randomBytes(16).toString("hex"));
