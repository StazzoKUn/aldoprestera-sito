// Logica degli ordini. Ogni operazione che scrive è una transazione:
// o va a buon fine tutta (COMMIT), o non resta traccia di nulla (ROLLBACK).
import { prisma } from "../../db/prisma.js";
import { Prisma, type StatoOrdine } from "../../generated/prisma/client.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { arrotonda, IMPORTO_MASSIMO, somma } from "../../lib/money.js";
import { paginated, toSkipTake } from "../../lib/pagination.js";
import { lockCliente } from "../clienti/clienti.service.js";
import type { OrdineCreate, OrdineUpdate, OrdiniListQuery, RigaInput } from "./ordini.schemas.js";
import { verificaTransizione } from "./ordini.stato.js";

type Tx = Prisma.TransactionClient;

// Cosa include il dettaglio di un ordine
const dettaglio = {
  righe: { orderBy: { id: "asc" } },
  cliente: { select: { id: true, email: true, nome: true, cognome: true } },
  indirizzo_spedizione: true,
  indirizzo_fatturazione: true,
} satisfies Prisma.OrdineInclude;

// ---------------------------------------------------------------- letture

export async function listOrdini(query: OrdiniListQuery) {
  const where: Prisma.OrdineWhereInput = { cliente_id: query.cliente_id, stato: query.stato };
  const [data, totale] = await prisma.$transaction([
    prisma.ordine.findMany({ where, orderBy: { id: "desc" }, ...toSkipTake(query) }),
    prisma.ordine.count({ where }),
  ]);
  return paginated(data, totale, query);
}

export async function getOrdine(id: bigint) {
  const ordine = await prisma.ordine.findUnique({ where: { id }, include: dettaglio });
  if (!ordine) throw notFound(`Ordine ${id} non trovato`);
  return ordine;
}

// ---------------------------------------------------------------- creazione

/**
 * Crea l'ordine con le sue righe in UNA transazione:
 *  1. SELECT ... FOR UPDATE sul cliente         (esiste? blocca richieste concorrenti)
 *  2. SELECT sugli indirizzi                    (sono di questo cliente?)
 *  3. SELECT sui prodotti                       (esistono? sono attivi? prezzo e IVA attuali)
 *  4. INSERT ordine con numero provvisorio + INSERT delle righe (snapshot)
 *  5. UPDATE ordine SET numero_ordine = 'ORD-2026-000123' (ricavato dall'id)
 *  6. COMMIT
 */
export async function createOrdine(input: OrdineCreate) {
  return prisma.$transaction(async (tx) => {
    await lockCliente(tx, input.cliente_id);
    await verificaIndirizzi(tx, input.cliente_id, input);
    const { righe, totale } = await preparaRighe(tx, input.righe);

    const { id } = await tx.ordine.create({
      data: {
        numero_ordine: numeroProvvisorio(),
        cliente_id: input.cliente_id,
        indirizzo_spedizione_id: input.indirizzo_spedizione_id ?? null,
        indirizzo_fatturazione_id: input.indirizzo_fatturazione_id ?? null,
        note: input.note ?? null,
        valuta: "EUR",
        totale,
        righe: { create: righe },
      },
      select: { id: true },
    });

    return tx.ordine.update({
      where: { id },
      data: { numero_ordine: numeroOrdine(id) },
      include: dettaglio,
    });
  });
}

// ---------------------------------------------------------------- modifiche (solo bozza)

export async function updateOrdine(id: bigint, data: OrdineUpdate) {
  return prisma.$transaction(async (tx) => {
    const ordine = await lockOrdine(tx, id);
    richiediBozza(ordine.stato, "i dati");
    await verificaIndirizzi(tx, ordine.cliente_id, data);
    return tx.ordine.update({ where: { id }, data, include: dettaglio });
  });
}

// Sostituisce tutte le righe con nuovi snapshot e ricalcola il totale
export async function replaceRighe(id: bigint, input: RigaInput[]) {
  return prisma.$transaction(async (tx) => {
    const ordine = await lockOrdine(tx, id);
    richiediBozza(ordine.stato, "le righe");
    const { righe, totale } = await preparaRighe(tx, input);

    await tx.rigaOrdine.deleteMany({ where: { ordine_id: id } });
    await tx.rigaOrdine.createMany({ data: righe.map((r) => ({ ...r, ordine_id: id })) });
    return tx.ordine.update({ where: { id }, data: { totale }, include: dettaglio });
  });
}

// ---------------------------------------------------------------- cambio di stato

export async function cambiaStato(id: bigint, nuovo: StatoOrdine) {
  return prisma.$transaction(async (tx) => {
    const ordine = await lockOrdine(tx, id);
    verificaTransizione(ordine.stato, nuovo); // 409 se non ammesso
    return tx.ordine.update({ where: { id }, data: { stato: nuovo }, include: dettaglio });
  });
}

// ---------------------------------------------------------------- funzioni di supporto

/**
 * SELECT ... FOR UPDATE sull'ordine: due richieste sullo stesso ordine (es. due
 * cambi di stato contemporanei) vengono eseguite una dopo l'altra, e la seconda
 * vede lo stato già aggiornato dalla prima.
 */
async function lockOrdine(tx: Tx, id: bigint) {
  const rows = await tx.$queryRaw<{ id: bigint; cliente_id: bigint; stato: StatoOrdine }[]>`
    SELECT id, cliente_id, stato FROM ordine WHERE id = ${id} FOR UPDATE`;
  const ordine = rows[0];
  if (!ordine) throw notFound(`Ordine ${id} non trovato`);
  return ordine;
}

function richiediBozza(stato: StatoOrdine, cosa: string) {
  if (stato !== "bozza") {
    throw conflict(`Si possono modificare ${cosa} solo con l'ordine in stato bozza (stato attuale: ${stato})`);
  }
}

// Gli indirizzi indicati devono esistere ed essere del cliente dell'ordine
async function verificaIndirizzi(
  tx: Tx,
  cliente_id: bigint,
  dati: { indirizzo_spedizione_id?: bigint | null; indirizzo_fatturazione_id?: bigint | null },
) {
  const campi = ["indirizzo_spedizione_id", "indirizzo_fatturazione_id"] as const;
  const richiesti = campi.flatMap((campo) => {
    const valore = dati[campo];
    return valore == null ? [] : [{ campo, id: valore }];
  });
  if (richiesti.length === 0) return;

  const trovati = await tx.indirizzo.findMany({
    where: { id: { in: richiesti.map((r) => r.id) }, cliente_id },
    select: { id: true },
  });
  const idTrovati = new Set(trovati.map((i) => i.id));
  const errori = richiesti
    .filter((r) => !idTrovati.has(r.id))
    .map((r) => ({ path: r.campo, message: `l'indirizzo ${r.id} non esiste o non appartiene al cliente ${cliente_id}` }));
  if (errori.length > 0) throw badRequest("Indirizzi non validi", errori);
}

/**
 * Legge i prodotti e costruisce le righe con lo SNAPSHOT di nome, SKU, prezzo e IVA:
 * se domani il prezzo del prodotto cambia, l'ordine di oggi resta com'era.
 * - prodotto inesistente -> 400 (errore nei dati inviati)
 * - prodotto non attivo  -> 409 (il prodotto esiste ma ora non è ordinabile)
 */
async function preparaRighe(tx: Tx, input: RigaInput[]) {
  const prodotti = await tx.prodotto.findMany({ where: { id: { in: input.map((r) => r.prodotto_id) } } });
  const perId = new Map(prodotti.map((p) => [p.id, p]));

  const inesistenti = input.flatMap((r, i) =>
    perId.has(r.prodotto_id) ? [] : [{ path: `righe.${i}.prodotto_id`, message: `il prodotto ${r.prodotto_id} non esiste` }],
  );
  if (inesistenti.length > 0) throw badRequest("Prodotti non validi", inesistenti);

  const nonAttivi = prodotti.filter((p) => !p.attivo).map((p) => ({ prodotto_id: p.id, sku: p.sku }));
  if (nonAttivi.length > 0) throw conflict("Alcuni prodotti non sono più ordinabili (attivo = false)", nonAttivi);

  const righe = input.map((r) => {
    const p = perId.get(r.prodotto_id)!;
    return {
      prodotto_id: p.id,
      nome_prodotto: p.nome,
      sku: p.sku,
      quantita: r.quantita,
      prezzo_unitario: p.prezzo,
      aliquota_iva: p.aliquota_iva,
      totale_riga: arrotonda(p.prezzo.mul(r.quantita)), // prezzo IVA inclusa × quantità
    };
  });
  const totale = somma(righe.map((r) => r.totale_riga));
  if (totale.greaterThan(IMPORTO_MASSIMO)) throw badRequest("Il totale supera l'importo massimo consentito");

  return { righe, totale };
}

// numero_ordine è NOT NULL e UNIQUE, ma l'id lo conosciamo solo dopo l'INSERT:
// inseriamo un valore provvisorio univoco e lo sostituiamo subito, nella stessa transazione.
function numeroProvvisorio() {
  return `TMP-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`; // 20 caratteri
}

// ORD-<anno>-<id a 6 cifre>: leggibile e univoco perché l'id è univoco
function numeroOrdine(id: bigint) {
  const anno = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric" }).format(new Date());
  return `ORD-${anno}-${id.toString().padStart(6, "0")}`;
}
