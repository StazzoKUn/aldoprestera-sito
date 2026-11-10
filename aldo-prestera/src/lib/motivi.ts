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
