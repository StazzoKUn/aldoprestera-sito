# Deploy su Plesk (fase 1: solo sito statico)

Il sito si pubblica come file statici: nessun Node sul server. Il backend degli ordini si aggiunge dopo.

## Pacchetto

```
npm run build
python scripts/pack.py
```

Crea `deploy/aldo-prestera-sito.zip` con il contenuto di `dist/client`:
`index.html`, `_astro/`, `ordina/`, `privacy/`, `cookie/`, `email/`. Lo zip si estrae **direttamente in `httpdocs`**
e il sito è visibile. I percorsi usano le barre normali, quindi l'`unzip` di Plesk non segnala errori
(non creare lo zip con `Compress-Archive` di PowerShell).

## Passi in Plesk

1. In `httpdocs` elimina eventuali file di prove precedenti (`dist/`, `package.json`, `package-lock.json`).
2. Carica `aldo-prestera-sito.zip` in `httpdocs` ed estrailo.
3. Attiva HTTPS (Let's Encrypt) e apri `https://www.aldoprestera.it`.
4. Non serve nessuna impostazione Node.js.

## Cosa funziona e cosa no

- Funziona: home, menù, orari, contatti, `/privacy`, `/cookie`, e la pagina `/ordina` fino al carrello e al modulo.
- **Non funziona ancora l'invio dell'ordine**: `/api/slot` e `/api/ordine` non esistono sul server statico.
  Il modulo mostra che gli orari non si caricano e l'ordine non parte. Finché il backend non c'è, conviene
  togliere o disattivare i pulsanti "Ordina" della home.

## Prima di pubblicare (dati segnaposto nel build)

- `src/data/site.ts`: telefono `000 000 0000`, `Via Esempio 12`, P.IVA a zeri, mappa, orari, social
- `src/data/menu.ts`: menù di prova
- `/privacy` e `/cookie`: testi segnaposto

Dopo ogni modifica: `npm run build`, `python scripts/pack.py`, ricarica lo zip.

## Backend (dopo)

Da scegliere: API in PHP + MySQL nativo di Plesk (nessun Node), oppure l'estensione Node.js di Plesk.
Servono due endpoint (`/api/slot`, `/api/ordine`) e lo schema MySQL progettato in `docs/esempio-ordini.xlsx`.
