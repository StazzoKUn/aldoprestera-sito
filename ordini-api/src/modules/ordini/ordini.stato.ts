// Macchina a stati dell'ordine: quali cambi di stato sono ammessi.
//
//   bozza ──► ricevuto ──► accettato ──► consegnato
//     │          │            │  ▲            │
//     │          │            │  └────────────┘  (solo correzione di un errore)
//     │          ▼            ▼
//     │       rifiutato    rifiutato
//     ▼
//  annullato   (solo errori tecnici)
//
// È una tabella pura, senza database.
import { StatoOrdine } from "../../generated/prisma/enums.js";
import { conflict } from "../../lib/errors.js";

export const STATI = Object.values(StatoOrdine) as [StatoOrdine, ...StatoOrdine[]];

export const TRANSIZIONI: Record<StatoOrdine, readonly StatoOrdine[]> = {
  bozza: ["ricevuto", "annullato"],
  ricevuto: ["accettato", "rifiutato"],
  accettato: ["consegnato", "rifiutato"],
  consegnato: ["accettato"], // correzione di un errore
  rifiutato: [],
  annullato: [],
};

export function verificaTransizione(da: StatoOrdine, a: StatoOrdine) {
  if (!TRANSIZIONI[da].includes(a)) {
    throw conflict(`Cambio di stato non consentito: ${da} → ${a}`, {
      stato_attuale: da,
      stati_ammessi: TRANSIZIONI[da],
    });
  }
}
