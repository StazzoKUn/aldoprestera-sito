// Motivi di rifiuto: lista fissa, senza testo libero. Deve coincidere con ordini-api
// (ordini-api/src/modules/ordini/ordini.motivi.ts), che rifiuta qualunque altro valore.
export const MOTIVI_RIFIUTO = [
  'Troppa richiesta, riprova più tardi',
  'Prodotto non disponibile',
  'Indirizzo fuori dalla zona di consegna',
  'Pizzeria in chiusura',
  'Non siamo riusciti a contattarti',
  'Annullato su tua richiesta',
] as const;

// Motivi di rifiuto delle prenotazioni: devono coincidere con ordini-api
// (ordini-api/src/modules/prenotazioni/prenotazioni.motivi.ts). Lista provvisoria, da confermare con Aldo.
export const MOTIVI_RIFIUTO_PRENOTAZIONE = [
  "Siamo al completo in quell'orario",
  'Locale chiuso in quella data',
  'Non siamo riusciti a contattarti',
] as const;
