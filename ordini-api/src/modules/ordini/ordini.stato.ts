// Macchina a stati dell'ordine: quali cambi di stato sono ammessi.
//
//   bozza ──► confermato ──► spedito ──► consegnato
//     │            │
//     └──────┬─────┘
//            ▼
//        annullato
//
// È una tabella pura, senza database: il futuro modulo pagamenti potrà usarla
// (es. pagamento riuscito -> "confermato") senza duplicare le regole.
import { StatoOrdine } from "../../generated/prisma/enums.js";
import { conflict } from "../../lib/errors.js";

export const STATI = Object.values(StatoOrdine) as [StatoOrdine, ...StatoOrdine[]];

export const TRANSIZIONI: Record<StatoOrdine, readonly StatoOrdine[]> = {
  bozza: ["confermato", "annullato"],
  confermato: ["spedito", "annullato"],
  spedito: ["consegnato"],
  consegnato: [],
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
