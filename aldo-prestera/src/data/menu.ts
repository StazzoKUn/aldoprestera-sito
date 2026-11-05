// Menù (segnaposto). Stessa forma del mockup: categorie → voci.
// In Fase 2 questo file potrà essere sostituito da un'API con la stessa forma.

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  /** Prezzo in euro */
  price: number;
  /** Nome file in src/assets/ (opzionale) */
  img?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  /** Etichetta breve per le pillole su smartphone */
  short: string;
  /** 'cards' = schede con foto, 'rows' = righe compatte */
  layout: 'cards' | 'rows';
  /** true se le voci occupano il forno (contano per la capacità degli slot) */
  oven: boolean;
  items: MenuItem[];
}

export const menu: MenuCategory[] = [
  {
    id: 'speciali',
    name: 'Le speciali',
    short: 'Speciali',
    layout: 'cards',
    oven: true,
    items: [
      { id: 'crudo', name: 'Crudo e rucola', desc: 'Fior di latte, crudo, rucola, scaglie di grana', price: 9.5, img: 'pizza-crudo-rucola.png' },
      { id: 'friarielli', name: 'Salsiccia e friarielli', desc: 'Fior di latte, salsiccia, friarielli', price: 9, img: 'pizza-salsiccia-friarielli.png' },
      { id: 'porchetta', name: 'Patate e porchetta', desc: 'Fior di latte, patate al forno, porchetta, crema', price: 10, img: 'pizza-patate-porchetta.png' },
      { id: 'wurstel', name: 'Würstel e patatine', desc: 'Fior di latte, würstel, patatine fritte', price: 8, img: 'pizza-wurstel-patatine.png' },
    ],
  },
  {
    id: 'classiche',
    name: 'Le classiche',
    short: 'Classiche',
    layout: 'rows',
    oven: true,
    items: [
      { id: 'margherita', name: 'Margherita', desc: 'Pomodoro, fior di latte, basilico', price: 6 },
      { id: 'marinara', name: 'Marinara', desc: 'Pomodoro, aglio, origano', price: 5 },
      { id: 'diavola', name: 'Diavola', desc: 'Pomodoro, fior di latte, salame piccante', price: 7.5 },
      { id: 'capricciosa', name: 'Capricciosa', desc: 'Cotto, funghi, carciofi, olive', price: 8.5 },
    ],
  },
  {
    id: 'bevande',
    name: 'Bevande',
    short: 'Bevande',
    layout: 'rows',
    oven: false,
    items: [
      { id: 'acqua', name: 'Acqua 50 cl', desc: 'Naturale o frizzante', price: 1.5 },
      { id: 'birra', name: 'Birra 33 cl', desc: 'Bionda artigianale', price: 3.5 },
      { id: 'cola', name: 'Coca-Cola 33 cl', desc: 'In lattina', price: 2.5 },
    ],
  },
];

export const allItems = menu.flatMap((c) => c.items);

/** Le prime 3 speciali, mostrate in home */
export const featured = menu[0].items.slice(0, 3);
