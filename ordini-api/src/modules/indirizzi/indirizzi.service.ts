// Logica degli indirizzi di un cliente.
//
// Regola: al massimo UN indirizzo predefinito per cliente.
// MariaDB non ha indici UNIQUE "parziali" (es. UNIQUE su cliente_id solo dove
// predefinito = true), quindi la regola si applica qui, in una transazione:
//   1. SELECT ... FOR UPDATE sul cliente  -> le richieste concorrenti aspettano
//   2. UPDATE indirizzo SET predefinito = false WHERE cliente_id = ? (se serve)
//   3. INSERT / UPDATE dell'indirizzo
//   4. COMMIT
import { prisma } from "../../db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { isPrismaError } from "../../lib/prisma-errors.js";
import { lockCliente } from "../clienti/clienti.service.js";
import type { IndirizzoCreate, IndirizzoUpdate } from "./indirizzi.schemas.js";

export async function listIndirizzi(cliente_id: bigint) {
  const cliente = await prisma.cliente.findUnique({ where: { id: cliente_id }, select: { id: true } });
  if (!cliente) throw notFound(`Cliente ${cliente_id} non trovato`);
  const data = await prisma.indirizzo.findMany({
    where: { cliente_id },
    orderBy: [{ predefinito: "desc" }, { id: "asc" }],
  });
  return { data };
}

export async function getIndirizzo(cliente_id: bigint, id: bigint) {
  // Cerco per id E cliente_id: un indirizzo di un altro cliente risulta "non trovato"
  const indirizzo = await prisma.indirizzo.findFirst({ where: { id, cliente_id } });
  if (!indirizzo) throw notFound(`Indirizzo ${id} non trovato per il cliente ${cliente_id}`);
  return indirizzo;
}

export async function createIndirizzo(cliente_id: bigint, data: IndirizzoCreate) {
  const dati = normalizzaEValida(data);
  return prisma.$transaction(async (tx) => {
    await lockCliente(tx, cliente_id);
    if (dati.predefinito) await togliPredefinito(tx, cliente_id);
    return tx.indirizzo.create({ data: { ...dati, cliente_id } });
  });
}

export async function updateIndirizzo(cliente_id: bigint, id: bigint, data: IndirizzoUpdate) {
  return prisma.$transaction(async (tx) => {
    await lockCliente(tx, cliente_id);
    const attuale = await tx.indirizzo.findFirst({ where: { id, cliente_id } });
    if (!attuale) throw notFound(`Indirizzo ${id} non trovato per il cliente ${cliente_id}`);

    // CAP e provincia si controllano sul risultato finale (es. cambio solo nazione)
    const { provincia } = normalizzaEValida({ ...attuale, ...data });

    if (data.predefinito === true) await togliPredefinito(tx, cliente_id, id);
    return tx.indirizzo.update({ where: { id }, data: { ...data, provincia } });
  });
}

export async function deleteIndirizzo(cliente_id: bigint, id: bigint) {
  try {
    // deleteMany con id + cliente_id: elimina solo se l'indirizzo è di quel cliente
    const { count } = await prisma.indirizzo.deleteMany({ where: { id, cliente_id } });
    if (count === 0) throw notFound(`Indirizzo ${id} non trovato per il cliente ${cliente_id}`);
  } catch (err) {
    // FOREIGN KEY ordine.indirizzo_spedizione_id / indirizzo_fatturazione_id ... ON DELETE RESTRICT
    if (isPrismaError(err, "P2003")) {
      throw conflict(`L'indirizzo ${id} è usato in almeno un ordine e non può essere eliminato`);
    }
    throw err;
  }
}

// UPDATE indirizzo SET predefinito = false WHERE cliente_id = ? AND predefinito = true [AND id <> ?]
async function togliPredefinito(tx: Prisma.TransactionClient, cliente_id: bigint, tranneId?: bigint) {
  await tx.indirizzo.updateMany({
    where: { cliente_id, predefinito: true, ...(tranneId && { id: { not: tranneId } }) },
    data: { predefinito: false },
  });
}

// Per gli indirizzi italiani: CAP di 5 cifre e sigla della provincia di 2 lettere,
// salvata in maiuscolo ("mi" -> "MI"). Gli indirizzi esteri restano come sono.
function normalizzaEValida<T extends { nazione: string; cap: string; provincia: string }>(i: T): T {
  if (i.nazione !== "IT") return i;
  const errori = [];
  if (!/^\d{5}$/.test(i.cap)) errori.push({ path: "cap", message: "per l'Italia il CAP è di 5 cifre" });
  if (!/^[A-Za-z]{2}$/.test(i.provincia)) {
    errori.push({ path: "provincia", message: "per l'Italia indica la sigla di 2 lettere, es. MI" });
  }
  if (errori.length > 0) throw badRequest("Dati non validi", errori);
  return { ...i, provincia: i.provincia.toUpperCase() };
}
