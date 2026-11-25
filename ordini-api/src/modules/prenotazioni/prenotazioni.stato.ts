// Macchina a stati della prenotazione: quali cambi di stato sono ammessi.
//
//   richiesta ──► confermata ──► annullata
//       │  │
//       │  └────► annullata
//       ▼
//    rifiutata
//
// Rifiutata e annullata sono finali. Nessuna correzione all'indietro (a differenza degli ordini).
// È una tabella pura, senza database.
import { StatoPrenotazione } from "../../generated/prisma/enums.js";
import { conflict } from "../../lib/errors.js";

export const STATI_PRENOTAZIONE = Object.values(StatoPrenotazione) as [StatoPrenotazione, ...StatoPrenotazione[]];

export const TRANSIZIONI_PRENOTAZIONE: Record<StatoPrenotazione, readonly StatoPrenotazione[]> = {
  richiesta: ["confermata", "rifiutata", "annullata"],
  confermata: ["annullata"],
  rifiutata: [],
  annullata: [],
};

export function verificaTransizionePrenotazione(da: StatoPrenotazione, a: StatoPrenotazione) {
  if (!TRANSIZIONI_PRENOTAZIONE[da].includes(a)) {
    throw conflict(`Cambio di stato non consentito: ${da} → ${a}`, {
      stato_attuale: da,
      stati_ammessi: TRANSIZIONI_PRENOTAZIONE[da],
    });
  }
}
