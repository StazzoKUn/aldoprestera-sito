// Logica del pannello di Aldo: elenchi, storico e azioni sullo stato.
// Ogni scrittura è una transazione con lock sull'ordine (lockOrdine), come i cambi di stato.
import { prisma } from "../../db/prisma.js";
import type { Prisma, StatoOrdine } from "../../generated/prisma/client.js";
import { notFound } from "../../lib/errors.js";
import { paginated, toSkipTake } from "../../lib/pagination.js";
import { giornoRoma } from "../../lib/tempo.js";
import { MOTIVO_SCADENZA } from "../ordini/ordini.motivi.js";
import { cambiaStato, scadiOrdiniVecchi } from "../ordini/ordini.service.js";
import type { GestioneStato, StoricoQuery } from "./gestione.schemas.js";

const includeScheda = {
  righe: { orderBy: { id: "asc" } },
  indirizzo_spedizione: true,
  cliente: { select: { email: true } },
} satisfies Prisma.OrdineInclude;

type OrdineScheda = Prisma.OrdineGetPayload<{ include: typeof includeScheda }>;

/** Scheda dell'ordine come la vede il pannello: dati salvati sull'ordine, non quelli di cliente */
function scheda(o: OrdineScheda) {
  const i = o.indirizzo_spedizione;
  return {
    id: o.id,
    numero_ordine: o.numero_ordine,
    stato: o.stato,
    motivo_stato: o.motivo_stato,
    scaduto: o.stato === "rifiutato" && o.motivo_stato === MOTIVO_SCADENZA,
    modalita: o.modalita,
    orario_richiesto: o.orario_richiesto,
    creato_il: o.creato_il,
    aggiornato_il: o.aggiornato_il,
    nome_cliente: o.nome_cliente,
    telefono_cliente: o.telefono_cliente,
    cliente_email: o.cliente.email,
    metodo_pagamento: o.metodo_pagamento,
    indirizzo: i ? `${i.via}, ${i.cap} ${i.citta} (${i.provincia})` : null,
    citofono: o.citofono,
    note: o.note,
    righe: o.righe.map((r) => ({
      id: r.id,
      nome_prodotto: r.nome_prodotto,
      quantita: r.quantita,
      prezzo_unitario: r.prezzo_unitario,
      totale_riga: r.totale_riga,
    })),
    costo_consegna: o.costo_consegna,
    totale: o.totale,
  };
}

async function caricaScheda(id: bigint) {
  const o = await prisma.ordine.findUnique({ where: { id }, include: includeScheda });
  if (!o) throw notFound(`Ordine ${id} non trovato`);
  return scheda(o);
}

// ---------------------------------------------------------------- letture

/**
 * Le tre liste del pannello. Prima applica la scadenza dei 15 minuti (nessun timer in background):
 * `appena_scaduti` sono gli id scaduti in questa lettura, e il sito deve mandare le loro email di rifiuto.
 * "Chiusi oggi" = ordini conclusi (consegnato, rifiutato, annullato) della giornata, fino a mezzanotte (Roma).
 */
export async function listaPannello() {
  const appena_scaduti = await scadiOrdiniVecchi();
  const { da, a } = giornoRoma();
  const ordini = await prisma.ordine.findMany({
    where: {
      OR: [
        { stato: { in: ["ricevuto", "accettato"] } }, // aperti: sempre visibili
        { stato: { in: ["consegnato", "rifiutato", "annullato"] }, orario_richiesto: { gte: da, lt: a } },
      ],
    },
    include: includeScheda,
    orderBy: { orario_richiesto: "asc" },
  });
  const schede = ordini.map(scheda);
  return {
    da_accettare: schede.filter((o) => o.stato === "ricevuto"),
    in_corso: schede.filter((o) => o.stato === "accettato"),
    chiusi_oggi: schede
      .filter((o) => o.stato !== "ricevuto" && o.stato !== "accettato")
      .sort((x, y) => y.aggiornato_il.getTime() - x.aggiornato_il.getTime()),
    appena_scaduti,
  };
}

/** Storico con ricerca per numero, nome, telefono e data (giorno dell'orario richiesto, a Roma) */
export async function storico(query: StoricoQuery) {
  const appena_scaduti = await scadiOrdiniVecchi();
  const where: Prisma.OrdineWhereInput = { stato: { not: "bozza" } };
  if (query.q) {
    // Il telefono si cerca anche senza spazi né trattini ("3331234567" trova "+39 333 123 4567")
    const cifre = query.q.replace(/[^\d]/g, "");
    const perTelefono =
      cifre.length >= 3
        ? await prisma.$queryRaw<{ id: bigint }[]>`
            SELECT id FROM ordine
            WHERE REPLACE(REPLACE(REPLACE(telefono_cliente, ' ', ''), '-', ''), '+', '') LIKE ${"%" + cifre + "%"}`
        : [];
    where.OR = [
      { numero_ordine: { contains: query.q } },
      { nome_cliente: { contains: query.q } },
      { telefono_cliente: { contains: query.q } },
      ...(perTelefono.length > 0 ? [{ id: { in: perTelefono.map((r) => r.id) } }] : []),
    ];
  }
  if (query.data) {
    const { da, a } = giornoRoma(query.data);
    where.orario_richiesto = { gte: da, lt: a };
  }
  const [righe, totale] = await prisma.$transaction([
    prisma.ordine.findMany({ where, include: includeScheda, orderBy: { orario_richiesto: "desc" }, ...toSkipTake(query) }),
    prisma.ordine.count({ where }),
  ]);
  return { ...paginated(righe.map(scheda), totale, query), appena_scaduti };
}

// ---------------------------------------------------------------- azioni

/** Accetta, rifiuta, consegnato/ritirato, oppure (consegnato → accettato) correzione: stessa macchina a stati e stesso lock */
export async function impostaStato(id: bigint, input: GestioneStato) {
  const prima = await prisma.ordine.findUnique({ where: { id }, select: { stato: true } });
  if (!prima) throw notFound(`Ordine ${id} non trovato`);
  const aggiornato = await cambiaStato(id, input.stato, input.motivo);
  // stato_precedente: il sito manda l'email solo per ricevuto → accettato/rifiutato
  return { stato_precedente: prima.stato as StatoOrdine, ordine: await caricaScheda(aggiornato.id) };
}
