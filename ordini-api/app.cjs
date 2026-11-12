// File di avvio per Passenger (Plesk): carica l'app ES module (dist/server.js) con un import dinamico,
// che funziona anche quando Passenger carica il file di avvio con require().
import('./dist/server.js').catch((err) => {
  console.error('Avvio fallito:', err);
  process.exit(1);
});
