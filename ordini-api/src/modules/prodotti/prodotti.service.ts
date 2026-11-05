// Logica dei prodotti: parla con il database, non conosce Express.
import { prisma } from "../../db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { conflict, notFound } from "../../lib/errors.js";
import { paginated, toSkipTake } from "../../lib/pagination.js";
import { isPrismaError } from "../../lib/prisma-errors.js";
import type { ProdottiListQuery, ProdottoCreate, ProdottoUpdate } from "./prodotti.schemas.js";

export async function listProdotti(query: ProdottiListQuery) {
  const where: Prisma.ProdottoWhereInput = {
    attivo: query.attivo,
    // `contains` diventa LIKE '%testo%'. Con la collation utf8mb4_unicode_ci
    // il confronto è già case-insensitive: "PIZZA" trova anche "pizza".
    ...(query.q && {
      OR: [{ nome: { contains: query.q } }, { sku: { contains: query.q } }],
    }),
  };

  // Due query (elenco + conteggio) nella stessa transazione, così sono coerenti.
  const [data, totale] = await prisma.$transaction([
    prisma.prodotto.findMany({ where, orderBy: { id: "asc" }, ...toSkipTake(query) }),
    prisma.prodotto.count({ where }),
  ]);
  return paginated(data, totale, query);
}

export async function getProdotto(id: bigint) {
  const prodotto = await prisma.prodotto.findUnique({ where: { id } });
  if (!prodotto) throw notFound(`Prodotto ${id} non trovato`);
  return prodotto;
}

export async function createProdotto(data: ProdottoCreate) {
  try {
    return await prisma.prodotto.create({ data });
  } catch (err) {
    if (isPrismaError(err, "P2002")) throw conflict(`Esiste già un prodotto con SKU ${data.sku}`);
    throw err;
  }
}

export async function updateProdotto(id: bigint, data: ProdottoUpdate) {
  try {
    return await prisma.prodotto.update({ where: { id }, data });
  } catch (err) {
    if (isPrismaError(err, "P2025")) throw notFound(`Prodotto ${id} non trovato`);
    if (isPrismaError(err, "P2002")) throw conflict(`Esiste già un prodotto con SKU ${data.sku}`);
    throw err;
  }
}

export async function deleteProdotto(id: bigint) {
  try {
    await prisma.prodotto.delete({ where: { id } });
  } catch (err) {
    if (isPrismaError(err, "P2025")) throw notFound(`Prodotto ${id} non trovato`);
    // FOREIGN KEY riga_ordine.prodotto_id ... ON DELETE RESTRICT
    if (isPrismaError(err, "P2003")) {
      throw conflict(
        `Il prodotto ${id} compare in almeno un ordine e non può essere eliminato: disattivalo con "attivo": false`,
      );
    }
    throw err;
  }
}
