// Logica degli ordini. Ogni operazione che scrive è una transazione:
// o va a buon fine tutta (COMMIT), o non resta traccia di nulla (ROLLBACK).
import { prisma } from "../../db/prisma.js";
import { randomBytes } from "node:crypto";
import { Prisma, type StatoOrdine } from "../../generated/prisma/client.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { arrotonda, IMPORTO_MASSIMO, somma } from "../../lib/money.js";
import { paginated, toSkipTake } from "../../lib/pagination.js";
import { lockCliente } from "../clienti/clienti.service.js";
import type { OrdineCreate, OrdineUpdate, OrdiniListQuery, RigaInput } from "./ordini.schemas.js";
import { MOTIVO_SCADENZA } from "./ordini.motivi.js";
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

// ---------------------------------------------------------------- scadenza e lettura pubblica

/** Dopo questo tempo in "ricevuto" senza risposta l'ordine passa a "rifiutato" */
export const SCADENZA_MS = 15 * 60_000;

/**
 * Applica la scadenza a UN ordine (in transazione, con lock): se è ancora "ricevuto" e ha più di
 * 15 minuti diventa "rifiutato" con il motivo automatico. Restituisce true solo a chi ha fatto
 * il cambio: è quel chiamante che deve mandare l'email al cliente (una volta sola).
 * Nessun timer in background: la scadenza si applica quando qualcuno legge l'ordine.
 */
async function scadiSeNecessario(id: bigint): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ stato: StatoOrdine; creato_il: Date }[]>`
      SELECT stato, creato_il FROM ordine WHERE id = ${id} FOR UPDATE`;
    const o = rows[0];
    if (!o || o.stato !== "ricevuto" || Date.now() - o.creato_il.getTime() < SCADENZA_MS) return false;
    verificaTransizione(o.stato, "rifiutato");
    await tx.ordine.update({ where: { id }, data: { stato: "rifiutato", motivo_stato: MOTIVO_SCADENZA } });
    return true;
  });
}

/** Fa scadere tutti gli ordini "ricevuto" troppo vecchi (per le letture del pannello). Restituisce gli id scaduti ora. */
export async function scadiOrdiniVecchi(): Promise<bigint[]> {
  const vecchi = await prisma.ordine.findMany({
    where: { stato: "ricevuto", creato_il: { lt: new Date(Date.now() - SCADENZA_MS) } },
    select: { id: true },
  });
  const scaduti: bigint[] = [];
  for (const { id } of vecchi) if (await scadiSeNecessario(id)) scaduti.push(id);
  return scaduti;
}

/**
 * Stato dell'ordine per la pagina di attesa del cliente, dal codice pubblico (mai dal numero).
 * Restituisce SOLO ciò che serve alla pagina; `contatto` c'è solo se l'ordine è scaduto proprio ora
 * (serve al sito per mandare l'email di rifiuto e non va mostrato al browser).
 */
export async function getOrdinePubblico(codice: string) {
  const trovato = await prisma.ordine.findUnique({ where: { codice_pubblico: codice }, select: { id: true } });
  if (!trovato) throw notFound("Ordine non trovato");
  const appena_scaduto = await scadiSeNecessario(trovato.id);

  const o = await prisma.ordine.findUniqueOrThrow({
    where: { id: trovato.id },
    include: { righe: { orderBy: { id: "asc" } }, cliente: { select: { email: true } } },
  });
  return {
    numero_ordine: o.numero_ordine,
    stato: o.stato,
    motivo_stato: o.motivo_stato,
    modalita: o.modalita,
    orario_richiesto: o.orario_richiesto,
    metodo_pagamento: o.metodo_pagamento,
    attesa_secondi: Math.floor((Date.now() - o.creato_il.getTime()) / 1000),
    costo_consegna: o.costo_consegna,
    totale: o.totale,
    righe: o.righe.map((r) => ({ nome_prodotto: r.nome_prodotto, quantita: r.quantita, totale_riga: r.totale_riga })),
    appena_scaduto,
    contatto: appena_scaduto ? { nome: o.nome_cliente, email: o.cliente.email } : null,
  };
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
    const { righe, totale: totaleRighe } = await preparaRighe(tx, input.righe);
    const totale = conConsegna(totaleRighe, input.costo_consegna);

    const { id } = await tx.ordine.create({
      data: {
        numero_ordine: numeroProvvisorio(),
        cliente_id: input.cliente_id,
        indirizzo_spedizione_id: input.indirizzo_spedizione_id ?? null,
        indirizzo_fatturazione_id: input.indirizzo_fatturazione_id ?? null,
        stato: input.stato,
        codice_pubblico: codicePubblico(),
        modalita: input.modalita,
        orario_richiesto: input.orario_richiesto,
        metodo_pagamento: input.metodo_pagamento,
        nome_cliente: input.nome_cliente,
        telefono_cliente: input.telefono_cliente,
        citofono: input.citofono ?? null,
        note: input.note ?? null,
        valuta: "EUR",
        costo_consegna: input.costo_consegna,
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
    const { righe, totale: totaleRighe } = await preparaRighe(tx, input);
    const totale = conConsegna(totaleRighe, ordine.costo_consegna);

    await tx.rigaOrdine.deleteMany({ where: { ordine_id: id } });
    await tx.rigaOrdine.createMany({ data: righe.map((r) => ({ ...r, ordine_id: id })) });
    return tx.ordine.update({ where: { id }, data: { totale }, include: dettaglio });
  });
}

// ---------------------------------------------------------------- cambio di stato

export async function cambiaStato(id: bigint, nuovo: StatoOrdine, motivo?: string) {
  return prisma.$transaction(async (tx) => {
    const ordine = await lockOrdine(tx, id);
    verificaTransizione(ordine.stato, nuovo); // 409 se non ammesso
    // motivo_stato è compilato solo su "rifiutato" e si azzera in ogni altro stato
    return tx.ordine.update({
      where: { id },
      data: { stato: nuovo, motivo_stato: nuovo === "rifiutato" ? (motivo ?? null) : null },
      include: dettaglio,
    });
  });
}

// ---------------------------------------------------------------- funzioni di supporto

/**
 * SELECT ... FOR UPDATE sull'ordine: due richieste sullo stesso ordine (es. due
 * cambi di stato contemporanei) vengono eseguite una dopo l'altra, e la seconda
 * vede lo stato già aggiornato dalla prima.
 */
export async function lockOrdine(tx: Tx, id: bigint) {
  const rows = await tx.$queryRaw<
    { id: bigint; cliente_id: bigint; stato: StatoOrdine; costo_consegna: Prisma.Decimal }[]
  >`SELECT id, cliente_id, stato, costo_consegna FROM ordine WHERE id = ${id} FOR UPDATE`;
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

// Totale dell'ordine = totale righe + consegna, entro l'importo massimo
function conConsegna(totaleRighe: Prisma.Decimal, costoConsegna: Prisma.Decimal | string) {
  const totale = arrotonda(totaleRighe.add(costoConsegna));
  if (totale.greaterThan(IMPORTO_MASSIMO)) throw badRequest("Il totale supera l'importo massimo consentito");
  return totale;
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

// Codice casuale (128 bit, 22 caratteri URL-safe) per la pagina di attesa: non indovinabile
function codicePubblico() {
  return randomBytes(16).toString("base64url");
}
