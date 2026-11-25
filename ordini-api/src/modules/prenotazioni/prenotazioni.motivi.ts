// Motivi di rifiuto delle prenotazioni: lista fissa, senza testo libero (come per gli ordini).
// Il motivo scelto finisce in prenotazione.motivo_stato. Lista provvisoria, da confermare con Aldo.
export const MOTIVI_RIFIUTO_PRENOTAZIONE = [
  "Siamo al completo in quell'orario",
  "Locale chiuso in quella data",
  "Non siamo riusciti a contattarti",
] as const;

// Motivo del rifiuto automatico (nessuna risposta prima dell'orario prenotato): NON è selezionabile da Aldo.
export const MOTIVO_SCADENZA_PRENOTAZIONE = "La pizzeria non ha potuto rispondere";
