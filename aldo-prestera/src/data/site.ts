// Dati della pizzeria. Valori segnaposto: sostituire con quelli reali.
export const site = {
  name: 'Aldo Prestera Pizzeria',
  phone: '000 000 0000',
  phoneHref: 'tel:+390000000000',
  /** Email della pizzeria: Reply-To del riepilogo al cliente */
  email: 'info@aldoprestera.it',
  address: { street: 'Via Esempio 12', city: '00000 Città (XX)' },
  piva: '00000000000',
  hours: {
    short: 'Mar–Dom · 18:30–23:00',
    long: 'Mar – Dom 18:30 – 23:00',
    closed: 'Lunedì chiuso',
  },
  social: [
    { name: 'Instagram', href: 'https://www.instagram.com/' },
    { name: 'Facebook', href: 'https://www.facebook.com/' },
  ],
  // Coordinate per la mappa (segnaposto: centro di Roma)
  map: { lat: 41.9028, lon: 12.4964 },
  year: 2026,
} as const;

export const fullAddress = `${site.address.street}, ${site.address.city}`;

export const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${site.name}, ${fullAddress}`,
)}`;

// Orari per gli ordini online: generano gli slot da 15 minuti (vedi src/lib/slots.ts).
export const orderHours = {
  /** Giorni di apertura, 0 = domenica … 6 = sabato */
  days: [0, 2, 3, 4, 5, 6],
  firstSlot: '19:30',
  lastSlot: '21:15',
  step: 15,
  /** Anticipo minimo rispetto all'ora attuale, in minuti */
  leadMinutes: { consegna: 45, asporto: 30 },
  timeZone: 'Europe/Rome',
} as const;

// Consegna a domicilio (segnaposto): comuni serviti, tariffa per zona e ordine minimo.
export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

export const delivery: { minOrder: number; zones: DeliveryZone[] } = {
  minOrder: 10,
  zones: [
    { id: 'citta', name: 'Città', fee: 2 },
    { id: 'frazione', name: 'Frazione Esempio', fee: 3 },
  ],
};
