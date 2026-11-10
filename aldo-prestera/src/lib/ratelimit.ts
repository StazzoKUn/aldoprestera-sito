// Rate limiting in memoria, per chiave (di solito l'IP): nessuna dipendenza.
// Vale per il singolo processo del sito: basta per fermare spam e tentativi di password.
const hits = new Map<string, number[]>();

/** true se la richiesta è ammessa; false se la chiave ha già fatto `max` richieste nella finestra */
export function consenti(chiave: string, max: number, finestraMs: number): boolean {
  const ora = Date.now();
  const recenti = (hits.get(chiave) ?? []).filter((t) => ora - t < finestraMs);
  if (recenti.length >= max) {
    hits.set(chiave, recenti);
    return false;
  }
  recenti.push(ora);
  hits.set(chiave, recenti);
  // Pulizia occasionale delle chiavi inattive, per non far crescere la mappa
  if (hits.size > 5000) for (const [k, v] of hits) if (ora - (v.at(-1) ?? 0) > finestraMs) hits.delete(k);
  return true;
}
