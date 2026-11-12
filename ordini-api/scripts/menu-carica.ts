// Carica SOLO il menù (prodotti) di prisma/seed/prodotti-aldo-prestera.ts: `npm run db:menu`
// Pensato per la produzione: nessun cliente né ordine di fantasia, non cancella nulla.
// Si rifiuta se la tabella prodotto non è vuota (per aggiornare il menù si lavora a mano).
process.env.LOG_QUERIES ??= "false";

const { prisma } = await import("../src/db/prisma.js");
const { CATEGORIE, PRODOTTI } = await import("../prisma/seed/prodotti-aldo-prestera.js");

function slug(testo: string) {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

try {
  const esistenti = await prisma.prodotto.count();
  if (esistenti > 0) {
    console.error(`Rifiutato: ci sono già ${esistenti} prodotti. Questo script carica il menù solo su tabella vuota.`);
    process.exitCode = 1;
  } else {
    const usati = new Set<string>();
    const righe = PRODOTTI.map((p) => {
      const base = `${CATEGORIE[p.categoria].sku}-${slug(p.nome)}`.slice(0, 60);
      let sku = base;
      for (let n = 2; usati.has(sku); n++) sku = `${base}-${n}`;
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
    const { count } = await prisma.prodotto.createMany({ data: righe });
    console.log(`Menù caricato: ${count} prodotti.`);
  }
} finally {
  await prisma.$disconnect();
}
