// Menu ufficiale di Aldo Prestera (Viale J. F. Kennedy 60, Aversa) come pubblicato su Just Eat:
// https://www.justeat.it/restaurants-aldo-prestera-aversa/menu
// Estratto il 2026-11-05 (versione del menu del 2026-08-26), 101 prodotti in 13 categorie.
//
// Riportati così come sono sul sito: nome, ingredienti (descrizione) e prezzo base in euro.
// Non importati: le aggiunte/varianti a pagamento (modificatori di Just Eat) e le etichette
// "vegetariano"/"alcol", perché lo schema del database non ha colonne per loro.

export type ProdottoMenu = { categoria: Categoria; nome: string; prezzo: number; descrizione: string | null };

export type Categoria = keyof typeof CATEGORIE;

// Prefisso SKU e aliquota IVA per categoria.
// IVA: ipotesi da verificare con il commercialista. 10% per i cibi preparati,
// 22% per le bevande (acqua, bibite, birre, vini) cedute confezionate.
export const CATEGORIE = {
  "Pizze Classiche": { sku: "CLA", iva: 10 },
  "Pizze Classiche Senza Glutine": { sku: "CLA-SG", iva: 10 },
  "Pizze Speciali": { sku: "SPE", iva: 10 },
  "Pizze Speciali Senza Glutine": { sku: "SPE-SG", iva: 10 },
  "Pizze Ripiene": { sku: "RIP", iva: 10 },
  "Pizze al Metro": { sku: "MET", iva: 10 },
  Focacce: { sku: "FOC", iva: 10 },
  Saltimbocca: { sku: "SAL", iva: 10 },
  Fritti: { sku: "FRI", iva: 10 },
  Dolci: { sku: "DOL", iva: 10 },
  Bevande: { sku: "BEV", iva: 22 },
  Birre: { sku: "BIR", iva: 22 },
  Vini: { sku: "VIN", iva: 22 },
} as const;

const p = (categoria: Categoria, nome: string, prezzo: number, descrizione: string | null = null): ProdottoMenu => ({
  categoria,
  nome,
  prezzo,
  descrizione,
});

export const PRODOTTI: ProdottoMenu[] = [
  // --- Pizze Classiche (28)
  p("Pizze Classiche", "Ombra", 6, "poco pomodoro, mozzarella, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Sali e Scendi", 8.5, "salsiccia, peperoni, provola e olio extravergine d'oliva"),
  p("Pizze Classiche", "Tonno e Cipolla", 8.5, "tonno, cipolla, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche", "Gatto", 8.5, "panna, prosciutto cotto, provola, crocchè di patate e olio extravergine d'oliva"),
  p("Pizze Classiche", "Marinara", 5, "pomodoro pelato San Marzano, origano, aglio, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Bianca", 6, "mozzarella, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Filetto", 7, "mozzarella, pomodorini, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Marinara DOP", 7, "pomodoro pelato San Marzano, origano, acciughe, olive nere, aglio, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Margherita", 6, "pomodoro pelato San Marzano, mozzarella, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Margherita DOP", 7.5, "pomodoro pelato San Marzano, mozzarella di bufala, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "4 Formaggi", 8, "gorgonzola, mozzarella, panna, fontina, emmental e olio extravergine d'oliva"),
  p("Pizze Classiche", "Fiocco di Neve", 8.5, "panna, prosciutto cotto, salsiccia, provola, crocchè di patate e olio extravergine d'oliva"),
  p("Pizze Classiche", "Siciliana", 7.5, "pomodoro pelato San Marzano, mozzarella, melanzane a funghetti e olio extravergine d'oliva"),
  p("Pizze Classiche", "Olio e Pomodoro", 5, "pomodoro pelato San Marzano, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche", "Primavera", 9, "pomodorini, bocconcini, prosciutto crudo, rucola, scaglie di grana e olio extravergine d'oliva"),
  p("Pizze Classiche", "Diavola", 7.5, "pomodoro, mozzarella, salame piccante, peperoncino e olio extravergine d'oliva"),
  p("Pizze Classiche", "Wurstel e Patate", 8, "wurstel, patate, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche", "Mimosa", 8, "panna, prosciutto cotto, mais, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche", "Chef", 8, "panna, prosciutto cotto, funghi, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche", "Capricciosa", 8.5, "pomodoro, mozzarella, funghi, prosciutto cotto, carciofi, salame, olive nere e olio extravergine d'oliva"),
  p("Pizze Classiche", "Sofia Loren", 8, "pizza fritta, ricotta, provola, pomodoro, ciccioli o salame o prosciutto cotto"),
  p("Pizze Classiche", "Pizza Kebab", 8.5, "kebab, mozzarella, patatine e olio extravergine d'oliva"),
  p("Pizze Classiche", "Primavera", 8.5, "mozzarella, rucola, prosciutto crudo, scaglie di grana, e olio extravergine d'oliva"),
  p("Pizze Classiche", "Ortolana", 8.5, "peperoni, friarielli, melenzane, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche", "Zucchina", 8.5, "zucchine, provola, pancetta e olio extravergine d'oliva"),
  p("Pizze Classiche", "Cotto e Patatine", 8, "mozzarella, prosciutto cotto e patatine"),
  p("Pizze Classiche", "Cotto e Salsicce", 8.5, "mozzarella, salsicce e patatine"),
  p("Pizze Classiche", "Bianca Diavola", 7.5, "mozzarella e salamino piccante"),

  // --- Pizze Classiche Senza Glutine (19)
  p("Pizze Classiche Senza Glutine", "Margherita Senza Glutine", 7.5, "pomodoro pelato San Marzano, mozzarella, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche Senza Glutine", "Margherita DOP Senza Glutine", 7.5, "pomodoro pelato San Marzano, mozzarella di bufala, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche Senza Glutine", "Marinara Senza Glutine", 7, "pomodoro pelato San Marzano, origano, aglio, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche Senza Glutine", "Marinara DOP Senza Glutine", 7.5, "pomodoro pelato San Marzano, origano, acciughe, olive nere, aglio, olio extravergine d'oliva e basilico"),
  p("Pizze Classiche Senza Glutine", "4 Formaggi Senza Glutine", 9.5, "gorgonzola, mozzarella, panna, fontina, emmental e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Fiocco di Neve Senza Glutine", 10, "panna, prosciutto cotto, salsiccia, provola, crocchè di patate e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Siciliana Senza Glutine", 9, "pomodoro pelato San Marzano, mozzarella, melanzane a funghetti e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Primavera senza Glutine", 10, "pomodorini, bocconcini, prosciutto crudo, rucola, scaglie di grana e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Diavola Senza Glutine", 9, "pomodoro, mozzarella, salame piccante, peperoncino e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Wurstel e Patate Senza Glutine", 9.5, "wurstel, patate, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Sali e Scendi Senza Glutine", 10, "salsiccia, peperoni, provola e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Ariccia Senza Glutine", 10, "porchetta, provola, funghi e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Mimosa Senza Glutine", 9.5, "panna, prosciutto cotto, mais, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Chef Senza Glutine", 9.5, "panna, prosciutto cotto, funghi, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Capricciosa Senza Glutine", 10, "pomodoro, mozzarella, funghi, prosciutto cotto, carciofi, salame, olive nere e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Primavera Senza Glutine", 9.5, "mozzarella, rucola, prosciutto crudo, scaglie di grana, e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Tonno e Cipolla Senza Glutine", 9.5, "tonno, cipolla, mozzarella e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Fiocco di Neve Senza Glutine Copy", 10, "panna, prosciutto cotto, salsiccia, provola, crocchè di patate e olio extravergine d'oliva"),
  p("Pizze Classiche Senza Glutine", "Zucchina Senza Glutine", 9.5, "zucchine, provola, pancetta e olio extravergine d'oliva"),

  // --- Pizze Speciali (3)
  p("Pizze Speciali", "La Sorrisi", 9, "cornicione ripieno di ricotta, pomodori, bocconcini, scaglie di grana, rucola e olio extravergine d'oliva"),
  p("Pizze Speciali", "Pistachiella", 9, "crema di pistacchio, provola, mortadella, granella di pistacchio e olio extravergine d'oliva"),
  p("Pizze Speciali", "Ariccia DOP", 9, "porchetta di Ariccia, provola, patate al forno e olio extravergine d'oliva"),

  // --- Pizze Speciali Senza Glutine (6)
  p("Pizze Speciali Senza Glutine", "La Sorrisi Senza Glutine", 10, "cornicione ripieno di ricotta, pomodori, bocconcini, scaglie di grana, rucola e olio extravergine d'oliva"),
  p("Pizze Speciali Senza Glutine", "Pistachiella Senza Glutine", 10, "crema di pistacchio, provola, mortadella, granella di pistacchio e olio extravergine d'oliva"),
  p("Pizze Speciali Senza Glutine", "Zuccotta Senza Glutine", 10, "pancetta, crema di zucca, mozzarella e olio extravergine d'oliva"),
  p("Pizze Speciali Senza Glutine", "Porcina Senza Glutine", 10, "crema di funghi porcini, provola, salsiccia e olio extravergine d'oliva"),
  p("Pizze Speciali Senza Glutine", "Norcina Senza Glutine", 10, "crema di noci, provola, pancetta, noci sbriciolate e olio extravergine d'oliva"),
  p("Pizze Speciali Senza Glutine", "Ariccia DOP Senza Glutine", 10, "porchetta di Ariccia, provola, patate al forno e olio extravergine d'oliva"),

  // --- Pizze Ripiene (2)
  p("Pizze Ripiene", "Ripieno", 8, "pomodoro sopra e interno di ricotta, mozzarella, prosciutto o salame e olio extravergine d'oliva"),
  p("Pizze Ripiene", "Ripieno alla Parmigiana", 9, "pomodoro sopra e interno di parmigiana di melanzane, salsiccia, mozzarella e olio extravergine d'oliva"),

  // --- Pizze al Metro (4)
  p("Pizze al Metro", "Margherita al Metro", 13),
  p("Pizze al Metro", "Marinara al Metro", 10),
  p("Pizze al Metro", "Metà Margherita al Metro", 14, "metà margherita e metà un gusto a scelta"),
  p("Pizze al Metro", "Mista al Metro", 16, "due o tre gusti a scelta"),

  // --- Focacce (1)
  p("Focacce", "Focaccia", 4.5, "origano, sale e olio"),

  // --- Saltimbocca (14)
  p("Saltimbocca", "Saltimbocca Sorrentina", 8.5, "pomodorini, bocconcini, prosciutto crudo, rucola e grana"),
  p("Saltimbocca", "Saltimbocca Primavera", 8.5, "mozzarella, rucola, prosciutto crudo e grana"),
  p("Saltimbocca", "Saltimbocca Fiocco di Neve", 8.5, "prosciutto cotto, salsiccia, mozzarella e crocchè di patate"),
  p("Saltimbocca", "Saltimbocca Ortolana", 8.5, "peperoni, friarielli, melanzane e mozzarella"),
  p("Saltimbocca", "Saltimbocca Sali e Scendi", 8.5, "salsiccia, peperoni e mozzarella"),
  p("Saltimbocca", "Saltimbocca Kebab", 8.5, "kebab, mozzarella, patatine o insalata"),
  p("Saltimbocca", "Saltimbocca Carrettiera", 8.5, "salsiccia, friarielli e mozzarella"),
  p("Saltimbocca", "Saltimbocca Ariccia", 8.5, "porchetta, provola e funghi"),
  p("Saltimbocca", "Saltimbocca Wep", 8.5, "wurstel, patatine e mozzarella"),
  p("Saltimbocca", "Saltimbocca Prosciutto Cotto e Funghi", 8.5, "prosciutto cotto, funghi e mozzarella"),
  p("Saltimbocca", "Saltimbocca Porchetta e Friarielli", 8.5, "porchetta, provola e friarielli"),
  p("Saltimbocca", "Saltimbocca Siciliana", 8.5, "melanzane a funghetto, mozzarella e salsiccia"),
  p("Saltimbocca", "Saltimbocca Porchetta e Patatine", 8.5, "porchetta, patatine e mozzarella"),
  p("Saltimbocca", "Saltimbocca Prosciutto Cotto e Patate", 8.5, "prosciutto cotto, patatine e mozzarella"),

  // --- Fritti (10)
  p("Fritti", "Fritturina Mista", 3, "zeppolina, crocchè, arancino e polentina 5 pezzi"),
  p("Fritti", "Fritto Misto", 6, "1 crocchè medio, 1 frittatina, 1 arancino e patatine fritte"),
  p("Fritti", "Crocchè Medio", 2, "crocchè di patate imbottito con mozzarella"),
  p("Fritti", "Frittatina Pastellata classica", 3),
  p("Fritti", "Arancino Rosso siciliano", 2.5),
  p("Fritti", "Patatine e Wurstel", 5),
  p("Fritti", "Patatine e Salsiccia", 5),
  p("Fritti", "Patatine e Kebab", 5.5),
  p("Fritti", "Patatine Fritte", 3),
  p("Fritti", "Crocchè Senza Glutine Medio", 3, "crocchè di patate e imbottito con mozzarella"),

  // --- Dolci (1)
  p("Dolci", "Pizza alla Nutella", 5),

  // --- Bevande (6)
  p("Bevande", "Acqua Naturale 50cl", 1.5),
  p("Bevande", "Acqua Frizzante 50cl", 1.5),
  p("Bevande", "Coca-Cola Original Taste Can 33 cl", 2.5, "Bevanda analcolica."),
  p("Bevande", "Coca-Cola Zero Zuccheri 330 ml", 2.5, "Bevanda analcolica senza calorie con edulcoranti."),
  p("Bevande", "Fanta Original Sleek 33 cl", 2.5, "Bevanda analcolica."),
  p("Bevande", "Sprite Can Sleek 33 cl", 2.5, "Bevanda analcolica. Gusto lemon-lime."),

  // --- Birre (5)
  p("Birre", "Birra 33cl", 3.5),
  p("Birre", "Birra 66cl", 3.5),
  p("Birre", "Peroni Birra 66 cl", 3, "Birra alc. 4,7% vol."),
  p("Birre", "Peroni Senza Glutine 33cl", 3.5),
  p("Birre", "Peroni 33 cl", 2.5, "Birra alc. 4,7% vol."),

  // --- Vini (2)
  p("Vini", "Falanghina 25cl", 5),
  p("Vini", "Aglianico 75cl", 5),
];
