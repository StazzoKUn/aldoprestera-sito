// Logica delle prenotazioni tavolo. Ogni operazione che scrive è una transazione con lock sulla riga,
// come per gli ordini. Nessun controllo di posti o tavoli: è Aldo a garantire se c'è posto.
import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { Prisma, StatoPrenotazione } from "../../generated/prisma/client.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { giornoRoma, oggiRoma } from "../../lib/tempo.js";
import { lockCliente } from "../clienti/clienti.service.js";
import { MOTIVO_SCADENZA_PRENOTAZIONE } from "./prenotazioni.motivi.js";
import type { PrenotazioneCreate, PrenotazioneStato, PrenotazioneTavolo } from "./prenotazioni.schemas.js";
import { verificaTransizionePrenotazione } from "./prenotazioni.stato.js";

type Tx = Prisma.TransactionClient;

/** Si prenota fino a questo numero di giorni avanti (oggi compreso, fino a mezzanotte di quel giorno) */
export const GIORNI_ANTICIPO = 7;

// Cosa include la scheda: i dati di contatto si leggono da cliente (nessun dato duplicato)
const includeScheda = {
  cliente: { select: { id: true, nome: true, cognome: true, telefono: true, email: true } },
} satisfies Prisma.PrenotazioneInclude;

type PrenotazioneScheda = Prisma.PrenotazioneGetPayload<{ include: typeof includeScheda }>;

/** Scheda come la vede il pannello di Aldo */
function scheda(p: PrenotazioneScheda) {
  return {
    id: p.id,
    codice_pubblico: p.codice_pubblico,
    stato: p.stato,
    motivo_stato: p.motivo_stato,
    scaduta: p.stato === "rifiutata" && p.motivo_stato === MOTIVO_SCADENZA_PRENOTAZIONE,
    persone: p.persone,
    inizio: p.inizio,
    note: p.note,
    tavolo_note: p.tavolo_note,
    creato_il: p.creato_il,
    aggiornato_il: p.aggiornato_il,
    nome_cliente: `${p.cliente.nome} ${p.cliente.cognome}`.trim(),
    telefono_cliente: p.cliente.telefono,
    cliente_email: p.cliente.email,
  };
}

// ---------------------------------------------------------------- creazione

/** Crea la richiesta (stato "richiesta") dopo aver bloccato il cliente. Orario nel futuro ed entro 7 giorni. */
export async function createPrenotazione(input: PrenotazioneCreate) {
  verificaFinestra(input.inizio);
  return prisma.$transaction(async (tx) => {
    await lockCliente(tx, input.cliente_id);
    const { id } = await tx.prenotazione.create({
      data: {
        codice_pubblico: codicePubblico(),
        cliente_id: input.cliente_id,
        persone: input.persone,
        inizio: input.inizio,
        note: input.note ?? null,
      },
      select: { id: true },
    });
    return scheda(await tx.prenotazione.findUniqueOrThrow({ where: { id }, include: includeScheda }));
  });
}

// Sicurezza lato server: l'orario scelto non può essere passato né oltre i 7 giorni.
// Turni e ultimo arrivo (16:00 pranzo, 23:00 cena) sono regole del sito (site.ts), non duplicate qui.
function verificaFinestra(inizio: Date) {
  const limite = giornoRoma(giornoDopo(oggiRoma(), GIORNI_ANTICIPO)).a; // mezzanotte dopo l'ultimo giorno prenotabile
  if (inizio.getTime() <= Date.now()) {
    throw badRequest("L'orario della prenotazione è già passato", [{ path: "inizio", message: "deve essere nel futuro" }]);
  }
  if (inizio.getTime() >= limite.getTime()) {
    throw badRequest(`Si prenota al massimo ${GIORNI_ANTICIPO} giorni avanti`, [
      { path: "inizio", message: `oltre i ${GIORNI_ANTICIPO} giorni consentiti` },
    ]);
  }
}

function giornoDopo(ymd: string, giorni: number) {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + giorni)).toISOString().slice(0, 10);
}

// Codice casuale (128 bit, 22 caratteri URL-safe) per la pagina di attesa: non indovinabile
function codicePubblico() {
  return randomBytes(16).toString("base64url");
}

// ---------------------------------------------------------------- scadenza e lettura pubblica

/**
 * Applica la scadenza a UNA prenotazione (in transazione, con lock): se è ancora "richiesta" e l'orario
 * prenotato è passato diventa "rifiutata" con il motivo automatico. Restituisce true solo a chi ha fatto
 * il cambio: è quel chiamante che deve mandare l'email al cliente (una volta sola).
 * Nessun timer in background: la scadenza si applica quando qualcuno legge la prenotazione.
 */
async function scadiSeNecessario(id: bigint): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const p = await lockPrenotazione(tx, id);
    if (p.stato !== "richiesta" || p.inizio.getTime() > Date.now()) return false;
    verificaTransizionePrenotazione(p.stato, "rifiutata");
    await tx.prenotazione.update({ where: { id }, data: { stato: "rifiutata", motivo_stato: MOTIVO_SCADENZA_PRENOTAZIONE } });
    return true;
  });
}

/** Fa scadere tutte le richieste con orario passato (per le letture del pannello). Restituisce gli id scaduti ora. */
export async function scadiPrenotazioniVecchie(): Promise<bigint[]> {
  const vecchie = await prisma.prenotazione.findMany({
    where: { stato: "richiesta", inizio: { lte: new Date() } },
    select: { id: true },
  });
  const scadute: bigint[] = [];
  for (const { id } of vecchie) if (await scadiSeNecessario(id)) scadute.push(id);
  return scadute;
}

/**
 * Stato della prenotazione per la pagina di attesa del cliente, dal codice pubblico (mai dall'id).
 * Restituisce SOLO ciò che serve alla pagina (niente tavolo_note); `contatto` c'è solo se la richiesta
 * è scaduta proprio ora (serve al sito per mandare l'email di rifiuto e non va mostrato al browser).
 */
export async function getPrenotazionePubblica(codice: string) {
  const trovata = await prisma.prenotazione.findUnique({ where: { codice_pubblico: codice }, select: { id: true } });
  if (!trovata) throw notFound("Prenotazione non trovata");
  const appena_scaduta = await scadiSeNecessario(trovata.id);

  const p = await prisma.prenotazione.findUniqueOrThrow({ where: { id: trovata.id }, include: includeScheda });
  return {
    stato: p.stato,
    motivo_stato: p.motivo_stato,
    persone: p.persone,
    inizio: p.inizio,
    note: p.note,
    attesa_secondi: Math.floor((Date.now() - p.creato_il.getTime()) / 1000),
    appena_scaduta,
    contatto: appena_scaduta ? { nome: p.cliente.nome, email: p.cliente.email } : null,
  };
}

// ---------------------------------------------------------------- pannello di Aldo

/**
 * Le liste del pannello. Prima applica la scadenza (nessun timer in background): `appena_scadute` sono
 * gli id scaduti in questa lettura, e il sito deve mandare le loro email di rifiuto.
 * Da oggi (mezzanotte di Roma) in avanti: le prenotazioni passate non servono al servizio.
 */
export async function listaPannello() {
  const appena_scadute = await scadiPrenotazioniVecchie();
  const { da } = giornoRoma();
  const prenotazioni = await prisma.prenotazione.findMany({
    where: { inizio: { gte: da } },
    include: includeScheda,
    orderBy: { inizio: "asc" },
  });
  const schede = prenotazioni.map(scheda);
  return {
    da_confermare: schede.filter((p) => p.stato === "richiesta"),
    confermate: schede.filter((p) => p.stato === "confermata"),
    chiuse: schede.filter((p) => p.stato === "rifiutata" || p.stato === "annullata"),
    appena_scadute,
  };
}

/** Conferma, rifiuta (con motivo) o annulla: macchina a stati e lock sulla prenotazione */
export async function impostaStato(id: bigint, input: PrenotazioneStato) {
  return prisma.$transaction(async (tx) => {
    const p = await lockPrenotazione(tx, id);
    verificaTransizionePrenotazione(p.stato, input.stato); // 409 se non ammesso
    // motivo_stato è compilato solo su "rifiutata" e si azzera in ogni altro stato
    await tx.prenotazione.update({
      where: { id },
      data: { stato: input.stato, motivo_stato: input.stato === "rifiutata" ? (input.motivo ?? null) : null },
    });
    const aggiornata = await tx.prenotazione.findUniqueOrThrow({ where: { id }, include: includeScheda });
    // stato_precedente: il sito manda l'email solo per richiesta → confermata/rifiutata
    return { stato_precedente: p.stato, prenotazione: scheda(aggiornata) };
  });
}

/** Promemoria libero di Aldo sul tavolo: non vincola niente e non cambia lo stato */
export async function impostaTavolo(id: bigint, input: PrenotazioneTavolo) {
  return prisma.$transaction(async (tx) => {
    await lockPrenotazione(tx, id);
    await tx.prenotazione.update({ where: { id }, data: { tavolo_note: input.tavolo_note } });
    return scheda(await tx.prenotazione.findUniqueOrThrow({ where: { id }, include: includeScheda }));
  });
}

// ---------------------------------------------------------------- funzioni di supporto

/**
 * SELECT ... FOR UPDATE sulla prenotazione: due richieste sulla stessa prenotazione (es. due cambi di
 * stato contemporanei) vengono eseguite una dopo l'altra, e la seconda vede lo stato già aggiornato.
 */
async function lockPrenotazione(tx: Tx, id: bigint) {
  const rows = await tx.$queryRaw<{ id: bigint; stato: StatoPrenotazione; inizio: Date }[]>`
    SELECT id, stato, inizio FROM prenotazione WHERE id = ${id} FOR UPDATE`;
  const p = rows[0];
  if (!p) throw notFound(`Prenotazione ${id} non trovata`);
  return p;
}
