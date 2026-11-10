// Dati di esempio da esplorare in phpMyAdmin: `npm run db:seed`
//
// - PRODOTTI: il menu ufficiale di Aldo Prestera (vedi seed/prodotti-aldo-prestera.ts)
// - CLIENTI, INDIRIZZI e ORDINI: dati di fantasia
//
// ATTENZIONE: prima di inserire SVUOTA le tabelle del menù e degli ordini (non utenti e sessioni) e azzera i contatori AUTO_INCREMENT,
// così ogni esecuzione riparte dagli stessi dati (ORD-2026-000001, ...).
// La struttura e lo storico delle migrazioni non vengono toccati.

// Il log SQL di ogni query qui sarebbe molto lungo: lo spengo, salvo LOG_QUERIES=true.
// (va impostato prima di importare il client, per questo gli import sono dinamici)
process.env.LOG_QUERIES ??= "false";

const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/db/prisma.js");
const ordini = await import("../src/modules/ordini/ordini.service.js");
const { CATEGORIE, PRODOTTI } = await import("./seed/prodotti-aldo-prestera.js");

if (env.NODE_ENV === "production") {
  console.error("Seed rifiutato: NODE_ENV=production. Questo script cancella tutti i dati.");
  process.exit(1);
}

try {
  await svuotaDatabase();
  const sku = await inserisciProdotti();
  const clienti = await inserisciClientiEIndirizzi();
  await inserisciOrdini(sku, clienti);
  await riepilogo();
} finally {
  await prisma.$disconnect();
}

// ------------------------------------------------------------------ 1. reset

async function svuotaDatabase() {
  // Ordine inverso rispetto alle foreign key: prima i "figli", poi i "padri"
  // (con ON DELETE RESTRICT, cancellare prima un cliente con ordini darebbe errore).
  for (const tabella of ["rimborso_riga", "rimborso", "riga_ordine", "ordine", "indirizzo", "cliente", "prodotto"]) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${tabella}\``);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tabella}\` AUTO_INCREMENT = 1`);
  }
  console.log("Tabelle svuotate e contatori azzerati");
}

// ------------------------------------------------------------------ 2. prodotti

// SKU leggibile: <prefisso categoria>-<nome senza accenti>, es. CLA-SG-MARGHERITA-SENZA-GLUTINE
function slug(testo: string) {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // "Crocchè" -> "Crocche"
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function inserisciProdotti() {
  const usati = new Set<string>();
  const righe = PRODOTTI.map((p) => {
    const base = `${CATEGORIE[p.categoria].sku}-${slug(p.nome)}`.slice(0, 60);
    let sku = base;
    for (let n = 2; usati.has(sku); n++) sku = `${base}-${n}`; // nomi doppi nel menu (es. "Primavera")
    usati.add(sku);
    return {
      sku,
      nome: p.nome,
      descrizione: p.descrizione,
      prezzo: p.prezzo.toFixed(2),
      valuta: "EUR",
      aliquota_iva: CATEGORIE[p.categoria].iva.toFixed(2),
      attivo: true,
    };
  });

  // Un solo INSERT con 101 righe: INSERT INTO prodotto (...) VALUES (...), (...), ...
  const { count } = await prisma.prodotto.createMany({ data: righe });
  console.log(`Prodotti inseriti: ${count}`);

  const tutti = await prisma.prodotto.findMany({ select: { id: true, sku: true } });
  return new Map(tutti.map((p) => [p.sku, p.id]));
}

// ------------------------------------------------------------------ 3. clienti e indirizzi (fantasia)

async function inserisciClientiEIndirizzi() {
  const mario = await prisma.cliente.create({
    data: {
      email: "mario.esposito@example.com",
      nome: "Mario",
      cognome: "Esposito",
      telefono: "+39 333 1112233",
      codice_fiscale: "SPSMRA85M01A512X",
      indirizzi: {
        create: [
          { destinatario: "Mario Esposito", via: "Via Roma 12", cap: "81031", citta: "Aversa", provincia: "CE", nazione: "IT", predefinito: true },
          { destinatario: "Mario Esposito c/o Studio Legale", via: "Corso Umberto I 140", cap: "81031", citta: "Aversa", provincia: "CE", nazione: "IT" },
        ],
      },
    },
    include: { indirizzi: { orderBy: { id: "asc" } } },
  });

  const giulia = await prisma.cliente.create({
    data: {
      email: "giulia.russo@example.com",
      nome: "Giulia",
      cognome: "Russo",
      telefono: "+39 347 5556677",
      codice_fiscale: "RSSGLI92D45F839K",
      indirizzi: {
        create: [{ destinatario: "Giulia Russo", via: "Via Garibaldi 5", cap: "81030", citta: "Lusciano", provincia: "CE", nazione: "IT", predefinito: true }],
      },
    },
    include: { indirizzi: true },
  });

  // Azienda: consegna in ufficio, fattura alla sede legale
  const azienda = await prisma.cliente.create({
    data: {
      email: "amministrazione@studiotecnicoferrara.example.com",
      nome: "Anna",
      cognome: "Ferrara",
      telefono: "+39 081 5001122",
      partita_iva: "04512340618",
      indirizzi: {
        create: [
          { destinatario: "Studio Tecnico Ferrara - Ufficio", via: "Via Andrea Costa 33", cap: "81031", citta: "Aversa", provincia: "CE", nazione: "IT", predefinito: true },
          { destinatario: "Studio Tecnico Ferrara S.r.l.", via: "Piazza Municipio 1", cap: "81100", citta: "Caserta", provincia: "CE", nazione: "IT" },
        ],
      },
    },
    include: { indirizzi: { orderBy: { id: "asc" } } },
  });

  const antonio = await prisma.cliente.create({
    data: {
      email: "antonio.romano@example.com",
      nome: "Antonio",
      cognome: "Romano",
      codice_fiscale: "RMNNTN78T12A512P",
      indirizzi: {
        create: [{ destinatario: "Antonio Romano", via: "Via Michelangelo 21", cap: "81031", citta: "Aversa", provincia: "CE", nazione: "IT", predefinito: true }],
      },
    },
    include: { indirizzi: true },
  });

  // Cliente SENZA ordini: è l'unico che si può eliminare (i suoi indirizzi spariscono per CASCADE)
  await prisma.cliente.create({
    data: {
      email: "luca.depalma@example.com",
      nome: "Luca",
      cognome: "De Palma",
      telefono: "+39 320 9998877",
      indirizzi: {
        create: [{ destinatario: "Luca De Palma", via: "Via Belvedere 8", cap: "81038", citta: "Trentola-Ducenta", provincia: "CE", nazione: "IT" }],
      },
    },
  });

  console.log("Clienti inseriti: 5 (con 7 indirizzi)");
  return { mario, giulia, azienda, antonio };
}

// ------------------------------------------------------------------ 4. ordini (con le regole vere)

type Clienti = Awaited<ReturnType<typeof inserisciClientiEIndirizzi>>;

async function inserisciOrdini(sku: Map<string, bigint>, c: Clienti) {
  const id = (codice: string) => {
    const valore = sku.get(codice);
    if (!valore) throw new Error(`SKU ${codice} non trovato nel menu`);
    return valore;
  };
  const casa = (cl: { indirizzi: { id: bigint }[] }, i = 0) => cl.indirizzi[i]!.id;

  // Stessa funzione usata da POST /ordini: snapshot, totali, numero_ordine, transazione
  const crea = (
    cliente: { id: bigint; nome: string; cognome: string; telefono: string | null },
    spedizione: bigint,
    fatturazione: bigint,
    righe: [string, number][],
    note?: string,
    stato: "bozza" | "ricevuto" = "ricevuto",
  ) =>
    ordini.createOrdine({
      stato,
      modalita: "consegna",
      orario_richiesto: new Date(Date.now() + 60 * 60_000),
      metodo_pagamento: "Contanti",
      nome_cliente: `${cliente.nome} ${cliente.cognome}`,
      telefono_cliente: cliente.telefono ?? "+39 333 0000000",
      costo_consegna: "2.00",
      cliente_id: cliente.id,
      indirizzo_spedizione_id: spedizione,
      indirizzo_fatturazione_id: fatturazione,
      note,
      righe: righe.map(([codice, quantita]) => ({ prodotto_id: id(codice), quantita })),
    });

  // Stessa funzione usata da PATCH /ordini/:id/stato: rispetta le transizioni ammesse
  const avanza = async (ordine: { id: bigint }, ...stati: ("accettato" | "consegnato" | "annullato" | "rifiutato")[]) => {
    for (const s of stati) await ordini.cambiaStato(ordine.id, s, s === "rifiutato" ? "Prodotto non disponibile" : undefined);
  };

  const o1 = await crea(c.mario, casa(c.mario), casa(c.mario), [["CLA-MARGHERITA", 2], ["BEV-COCA-COLA-ORIGINAL-TASTE-CAN-33-CL", 2]]);
  await avanza(o1, "accettato", "consegnato");

  const o2 = await crea(c.mario, casa(c.mario, 1), casa(c.mario), [["CLA-DIAVOLA", 1], ["FRI-FRITTO-MISTO", 1], ["BIR-PERONI-33-CL", 1]], "Consegna in studio, citofono 3");
  await avanza(o2, "accettato");

  const o3 = await crea(c.giulia, casa(c.giulia), casa(c.giulia), [["MET-MISTA-AL-METRO", 1], ["FRI-FRITTURINA-MISTA", 2], ["BIR-PERONI-BIRRA-66-CL", 2]], "Festa di compleanno: metà margherita, metà capricciosa");
  void o3; // resta "ricevuto": in attesa della risposta di Aldo

  // Resta in bozza: si può ancora modificare con PATCH /ordini/:id e PUT /ordini/:id/righe
  await crea(c.giulia, casa(c.giulia), casa(c.giulia), [["CLA-PRIMAVERA", 1], ["SPE-PISTACHIELLA", 1], ["DOL-PIZZA-ALLA-NUTELLA", 1]], undefined, "bozza");

  // Pranzo in ufficio: spedizione e fatturazione diverse
  const o5 = await crea(c.azienda, casa(c.azienda, 0), casa(c.azienda, 1), [
    ["SAL-SALTIMBOCCA-SORRENTINA", 2],
    ["SAL-SALTIMBOCCA-CARRETTIERA", 2],
    ["SAL-SALTIMBOCCA-PORCHETTA-E-PATATINE", 2],
    ["BEV-ACQUA-NATURALE-50CL", 4],
    ["BEV-ACQUA-FRIZZANTE-50CL", 2],
  ], "Pranzo riunione, consegna ore 13:00");
  await avanza(o5, "accettato", "consegnato");

  // Annullato direttamente dalla bozza
  const o6 = await crea(c.antonio, casa(c.antonio), casa(c.antonio), [["CLA-SG-MARGHERITA-SENZA-GLUTINE", 1], ["FRI-CROCCHE-SENZA-GLUTINE-MEDIO", 2]], undefined, "bozza");
  await avanza(o6, "annullato");

  // Ricevuto e poi rifiutato da Aldo
  const o7 = await crea(c.antonio, casa(c.antonio), casa(c.antonio), [["SPE-LA-SORRISI", 1], ["VIN-FALANGHINA-25CL", 1]]);
  await avanza(o7, "rifiutato");

  const o8 = await crea(c.azienda, casa(c.azienda, 0), casa(c.azienda, 1), [["CLA-CAPRICCIOSA", 3], ["CLA-4-FORMAGGI", 2], ["CLA-MARGHERITA-DOP", 3], ["BEV-COCA-COLA-ZERO-ZUCCHERI-330-ML", 8]]);
  void o8; // resta "ricevuto"

  console.log("Ordini inseriti: 8 (almeno uno per ogni stato)");
}

// ------------------------------------------------------------------ riepilogo

async function riepilogo() {
  const perStato = await prisma.ordine.groupBy({ by: ["stato"], _count: { _all: true }, orderBy: { stato: "asc" } });
  const ordiniCreati = await prisma.ordine.findMany({ select: { numero_ordine: true, stato: true, totale: true }, orderBy: { id: "asc" } });
  console.log("\nOrdini per stato:", Object.fromEntries(perStato.map((s) => [s.stato, s._count._all])));
  console.table(ordiniCreati.map((o) => ({ ...o, totale: o.totale.toFixed(2) })));
}
