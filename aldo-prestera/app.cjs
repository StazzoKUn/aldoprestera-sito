// File di avvio per Passenger (Plesk): carica il server Astro (ES module) con un import dinamico,
// che funziona anche quando Passenger carica il file di avvio con require().
import('./dist/server/entry.mjs').catch((err) => {
  console.error('Avvio fallito:', err);
  process.exit(1);
});
