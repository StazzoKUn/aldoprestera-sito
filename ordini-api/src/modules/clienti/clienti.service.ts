// Logica dei clienti: parla con il database, non conosce Express.
import { prisma } from "../../db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { conflict, notFound } from "../../lib/errors.js";
import { paginated, toSkipTake } from "../../lib/pagination.js";
import { isPrismaError } from "../../lib/prisma-errors.js";
import type { ClienteCreate, ClientiListQuery, ClienteUpdate } from "./clienti.schemas.js";

export async function listClienti(query: ClientiListQuery) {
  const where: Prisma.ClienteWhereInput = query.q
    ? {
        OR: [
          { nome: { contains: query.q } },
          { cognome: { contains: query.q } },
          { email: { contains: query.q } },
        ],
      }
    : {};

  const [data, totale] = await prisma.$transaction([
    prisma.cliente.findMany({ where, orderBy: { id: "asc" }, ...toSkipTake(query) }),
    prisma.cliente.count({ where }),
  ]);
  return paginated(data, totale, query);
}

// Il dettaglio include gli indirizzi (prima il predefinito)
export async function getCliente(id: bigint) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { indirizzi: { orderBy: [{ predefinito: "desc" }, { id: "asc" }] } },
  });
  if (!cliente) throw notFound(`Cliente ${id} non trovato`);
  return cliente;
}

export async function createCliente(data: ClienteCreate) {
  try {
    return await prisma.cliente.create({ data });
  } catch (err) {
    if (isPrismaError(err, "P2002")) throw conflict(`Esiste già un cliente con email ${data.email}`);
    throw err;
  }
}

export async function updateCliente(id: bigint, data: ClienteUpdate) {
  try {
    return await prisma.cliente.update({ where: { id }, data });
  } catch (err) {
    if (isPrismaError(err, "P2025")) throw notFound(`Cliente ${id} non trovato`);
    if (isPrismaError(err, "P2002")) throw conflict(`Esiste già un cliente con email ${data.email}`);
    throw err;
  }
}

// DELETE FROM cliente: gli indirizzi spariscono per CASCADE, ma se il cliente
// ha ordini la FOREIGN KEY ordine.cliente_id (RESTRICT) blocca tutto.
export async function deleteCliente(id: bigint) {
  try {
    await prisma.cliente.delete({ where: { id } });
  } catch (err) {
    if (isPrismaError(err, "P2025")) throw notFound(`Cliente ${id} non trovato`);
    if (isPrismaError(err, "P2003")) {
      throw conflict(`Il cliente ${id} ha degli ordini e non può essere eliminato`);
    }
    throw err;
  }
}

/**
 * Dentro una transazione: blocca la riga del cliente con SELECT ... FOR UPDATE.
 * Le altre transazioni che vogliono bloccare lo stesso cliente aspettano il
 * COMMIT di questa: così due richieste contemporanee sugli indirizzi (o sugli
 * ordini) dello stesso cliente vengono eseguite una dopo l'altra.
 * Lancia 404 se il cliente non esiste.
 */
export async function lockCliente(tx: Prisma.TransactionClient, id: bigint) {
  const rows = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM cliente WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) throw notFound(`Cliente ${id} non trovato`);
}
