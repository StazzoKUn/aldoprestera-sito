# Deploy su Plesk (sito + ordini-api + database)

Tre pezzi, tutti sullo stesso Plesk:

| Pezzo | Cos'è | Dove |
| --- | --- | --- |
| Sito | app Node (Astro standalone) | dominio principale, es. `www.aldoprestera.it` |
| `ordini-api` | app Node (Express + Prisma) | sottodominio dedicato, es. `api.aldoprestera.it`: Plesk (Passenger) rende le app raggiungibili solo tramite un dominio. È protetta dal `ORDINI_API_TOKEN` (tutte le route tranne `/health`) |
| Database | MariaDB/MySQL di Plesk | database `aldop` |

Il bot WhatsApp (`whatsapp-bot/`) **non** si installa su Plesk (serve Chromium e un telefono collegato): senza di lui le comande partono comunque via email.

## 1. Preparare i pacchetti (sul PC di sviluppo)

```bash
cd aldo-prestera
npm run build
python scripts/pack-plesk.py
```

Crea in `aldo-prestera/deploy/`:
- `aldo-prestera-sito.zip` (`dist/` + `package.json` + lockfile)
- `ordini-api.zip` (sorgenti, `prisma/`, `scripts/`, `package.json` + lockfile)

Niente `.env` vero e niente `node_modules` negli zip: si creano/installano sul server. Ogni zip contiene il suo `.env.example` (valori fittizi, elenco delle variabili): serve da promemoria per compilare le variabili nel pannello Node.js. In alternativa lo si copia in `.env` nella cartella dell'app e lo si compila (l'API lo legge da sola; per il sito è meglio il pannello). Il `ORDINI_API_TOKEN` fittizio dell'esempio **va sempre sostituito** con una stringa casuale, uguale in sito e API. Zip creati con Python (barre normali): non usare `Compress-Archive`.

## 2. Database (Plesk → Database)

1. Crea il database `aldop` (collation `utf8mb4_unicode_ci`) con un utente dedicato e una password robusta.
2. Annota la stringa: `mysql://UTENTE:PASSWORD@localhost:3306/aldop` (caratteri speciali nella password vanno codificati URL).

## 3. ordini-api (Plesk → Node.js, nuova app)

Crea prima il sottodominio `api.aldoprestera.it` (Plesk → Siti web e domini → Aggiungi sottodominio) e attiva HTTPS anche su di lui.

1. Estrai `ordini-api.zip` nella cartella dell'app.
2. Impostazioni Node.js: versione **≥ 22.12**, modalità **production**, document root = cartella dell'app, file di avvio **`app.cjs`** (ponte che carica `dist/server.js`: Passenger non gestisce bene i moduli ES con `await` di primo livello).
3. Variabili d'ambiente (nel pannello Node.js):
   - `NODE_ENV=production`
   - `DATABASE_URL=mysql://UTENTE:PASSWORD@localhost:3306/aldop`
   - `ORDINI_API_TOKEN=` stringa casuale ≥ 16 caratteri (la stessa va nel sito)
4. **NPM install** dal pannello. Prisma e TypeScript (che servono a build e migrazioni) sono tra le dipendenze normali, quindi si installano anche in modalità production.
5. Da "Run script" (o dal terminale SSH nella cartella dell'app), in ordine:
   ```bash
   npm run prisma:generate
   npm run build
   npm run db:deploy      # applica le migration (prisma migrate deploy), non cancella nulla
   npm run db:menu        # solo la prima volta: carica il menù
   ```
6. **Menù iniziale**: `npm run db:menu` carica i 101 prodotti del menù di Aldo (solo prodotti, nessun dato di fantasia; si rifiuta se la tabella non è vuota, quindi è sicuro). **Mai `db:seed`** in produzione: crea clienti e ordini finti e il comando si rifiuta comunque con `NODE_ENV=production`.
7. **Account di Aldo** (senza SSH): nelle variabili d'ambiente dell'API aggiungi `ADMIN_USERNAME`, `ADMIN_NOME` e `ADMIN_PASSWORD` (min 10 caratteri). All'avvio l'API crea l'account (o ne aggiorna la password). **Per cambiare la password** basta modificare `ADMIN_PASSWORD` nel pannello e riavviare: le sessioni aperte si chiudono. In alternativa, con SSH: `npm run admin:crea` (chiede la password a schermo). Non usare `admin:dev` in produzione. Dopo il primo accesso puoi anche togliere `ADMIN_PASSWORD` dalle variabili: l'account resta.
8. Riavvia l'app e apri `https://api.aldoprestera.it/health`: deve rispondere senza errori.

## 4. Sito (Plesk → Node.js, app sul dominio)

1. Estrai `aldo-prestera-sito.zip` nella cartella dell'app (radice del dominio o quella indicata da Plesk).
2. Node.js **≥ 22.12**, modalità production, file di avvio **`app.cjs`** (ponte che carica `dist/server/entry.mjs`).
3. Variabili d'ambiente:
   - `ORDINI_API_URL=https://api.aldoprestera.it` (indirizzo dell'API)
   - `ORDINI_API_TOKEN=` **identico** a quello dell'API
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ORDER_FROM`, `ORDER_TO` (email delle comande e dei clienti)
   - lascia vuoti `WA_BOT_URL` / `WA_BOT_TOKEN` (niente WhatsApp)
4. **NPM install** (basta anche `--omit=dev`), poi avvia l'app.
5. Attiva HTTPS (Let's Encrypt) e forza il redirect a HTTPS: il cookie di sessione di `/gestione` è `Secure` e funziona solo su HTTPS.
6. L'app scrive in `.data/` (contatori e slot): la cartella dell'app deve essere scrivibile dall'utente di Plesk.

## 5. Prova dopo la pubblicazione

1. Home e `/ordina`: il menù si carica (viene dal DB).
2. Un ordine vero: compare in `/gestione` (login con l'account creato), si accetta, la pagina del cliente si aggiorna, arriva l'email.
3. Le azioni di `/gestione` controllano l'`Origin`: in `astro.config.mjs` sono ammessi `https://www.aldoprestera.it` e `https://aldoprestera.it` (`security.allowedDomains`), così funzionano dietro il proxy di Plesk. Se un giorno cambia il dominio, va aggiornato lì (e `site` nello stesso file). Provato in locale simulando gli header del proxy, non su Plesk vero.

## Prima di pubblicare

- I dati reali (telefono, indirizzo, orari, P.IVA, social, mappa) e i testi di `/privacy` e `/cookie` sono già nel build (2026-11-12); i testi legali vanno comunque fatti rivedere.
- `ORDINI_API_TOKEN` di produzione diverso da quello di sviluppo.
- Il sito vive su `https://aldoprestera.it` (senza `www`, che non ha record DNS): `site` in `astro.config.mjs` serve ai link e al logo delle email.

## Aggiornamenti successivi

Dopo ogni modifica: `npm run build`, `python scripts/pack-plesk.py`, ricarica lo zip sull'app interessata (sovrascrivendo; **non** toccare `.env`/variabili né `.data/`), poi:
- sito: riavvia;
- API: `npm install` (se cambia il lockfile), `npm run prisma:generate`, `npm run build`, `npm run db:deploy` (se ci sono nuove migration), riavvia. **Mai** `db:seed`.
