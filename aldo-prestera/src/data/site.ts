// Dati della pizzeria. Valori segnaposto: sostituire con quelli reali.
export const site = {
  name: 'Aldo Prestera Pizzeria',
  phone: '351 067 5530',
  phoneHref: 'tel:+393510675530',
  /** Email della pizzeria: Reply-To del riepilogo al cliente */
  email: 'info@aldoprestera.it',
  address: { street: 'Viale John Fitzgerald Kennedy, 60', city: '81031 Aversa (CE)' },
  /** Dati dell'impresa individuale (da visura camerale, ufficiocamerale.it) */
  legal: {
    name: 'Prestera Aldo',
    form: 'Impresa individuale',
    pec: 'aldoprestera@pec.it',
    rea: 'CE-361111',
  },
  piva: '04845850611',
  hours: {
    short: 'Aperti tutti i giorni',
    /** Orari di apertura al pubblico (non quelli degli ordini online: vedi orderHours) */
    week: [
      { day: 'Lunedì', time: '17:30–00:00' },
      { day: 'Martedì', time: '12:00–17:00, 17:30–00:00' },
      { day: 'Mercoledì', time: '17:30–00:00' },
      { day: 'Giovedì', time: '12:00–15:30, 18:30–23:30' },
      { day: 'Venerdì', time: '12:00–15:00, 17:30–00:00' },
      { day: 'Sabato', time: '12:00–15:00, 17:30–01:00' },
      { day: 'Domenica', time: '12:00–14:30, 17:30–00:00' },
    ],
  },
  social: [
    { name: 'Instagram', href: 'https://www.instagram.com/pizzeriaaldoprestera/' },
    { name: 'Facebook', href: 'https://www.facebook.com/p/Pizzeria-Aldoprestera-aversa-61580980882567/' },
    { name: 'TikTok', href: 'https://www.tiktok.com/@aldo.prestera.piz' },
  ],
  // Coordinate per la mappa (dalla scheda Google Maps della pizzeria)
  map: { lat: 40.96963, lon: 14.21292 },
  year: 2026,
} as const;

export const fullAddress = `${site.address.street}, ${site.address.city}`;

export const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${site.name}, ${fullAddress}`,
)}`;

// Orari per gli ordini online: generano gli slot da 15 minuti (vedi src/lib/slots.ts).
// Le fasce sono quelle di hours.week: se cambiano gli orari di apertura aggiornare entrambi.
export const orderHours = {
  /**
   * Fasce di apertura per giorno (0 = domenica … 6 = sabato) come ['inizio', 'fine'].
   * Una chiusura dopo mezzanotte si scrive oltre le 24 (sabato: '25:00' = 01:00 di domenica).
   */
  week: {
    0: [['12:00', '14:30'], ['17:30', '24:00']],
    1: [['17:30', '24:00']],
    2: [['12:00', '17:00'], ['17:30', '24:00']],
    3: [['17:30', '24:00']],
    4: [['12:00', '15:30'], ['18:30', '23:30']],
    5: [['12:00', '15:00'], ['17:30', '24:00']],
    6: [['12:00', '15:00'], ['17:30', '25:00']],
  } as Record<number, readonly (readonly [string, string])[]>,
  /** Il primo slot di ogni fascia è l'apertura + questi minuti (il tempo di preparare) */
  firstAfterOpen: 15,
  /** L'ultimo slot è la chiusura − questi minuti */
  lastBeforeClose: 30,
  step: 15,
  /** Anticipo minimo rispetto all'ora attuale, in minuti */
  leadMinutes: { consegna: 45, asporto: 30 },
  timeZone: 'Europe/Rome',
} as const;

// Consegna a domicilio: tariffa unica (il comune lo scrive il cliente) e ordine minimo.
export const delivery = {
  minOrder: 10,
  fee: 2,
} as const;
