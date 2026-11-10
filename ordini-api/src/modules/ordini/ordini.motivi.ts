// Motivi di rifiuto: lista fissa, senza testo libero. Il motivo scelto finisce in ordine.motivo_stato.
export const MOTIVI_RIFIUTO = [
  "Troppa richiesta, riprova più tardi",
  "Prodotto non disponibile",
  "Indirizzo fuori dalla zona di consegna",
  "Pizzeria in chiusura",
  "Non siamo riusciti a contattarti",
  "Annullato su tua richiesta",
] as const;

// Motivo della scadenza automatica (15 minuti in "ricevuto"): NON è selezionabile da Aldo.
export const MOTIVO_SCADENZA = "La pizzeria non ha potuto rispondere";
