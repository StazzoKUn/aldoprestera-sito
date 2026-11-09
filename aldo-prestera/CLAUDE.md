# CLAUDE.md — aldoprestera.it

Direttive globali per lavorare su questo progetto. Hanno la precedenza sulle abitudini di default.

## Progetto

Sito web della **Aldo Prestera Pizzeria** (https://www.aldoprestera.it).

- **Frontend**: sito **statico** in Astro (one page) + una sola isola interattiva (Preact) per il **modulo ordini**.
- **Backend**: **Node.js + MySQL** per ricezione, salvataggio e gestione degli ordini.
- **Hosting**: Plesk (vedi `docs/DEPLOY-plesk.md`). Build standalone con `@astrojs/node`.
- **Lingua**: interfaccia, copy, commenti, commit e documentazione in **italiano**. Identificatori di codice (variabili, funzioni, tabelle, colonne) in **inglese**, tranne dove il codice esistente usa già termini italiani (`ordine`, `slot`, `ordina`): resta coerente con ciò che c'è.

### Stato attuale vs obiettivo

Gli ordini sono validati in `src/pages/api/ordine.ts` e salvati su MariaDB tramite `ordini-api` (numero d'ordine assegnato dal DB); la comanda parte via email (`src/lib/notify.ts`) e WhatsApp (`whatsapp-bot/`).

**Slot orari:** nessun limite di ordini per fascia (decisione del 2026-11-09). Il server controlla solo che lo slot sia valido (non passato, dentro gli orari). Più avanti Aldo potrà **bloccare fasce orarie da una sua interfaccia** (back-office, da sviluppare alla fine): quando si tocca `slots.ts` o `/api/slot`, predisporre il punto in cui applicare quei blocchi, senza reintrodurre limiti automatici di capacità.

### Fasi

1. **Fase 1** — sito one page + modulo ordini (in corso). Segue il mockup 1:1 (`_handoff/.../README.md` e `reference/`).
2. **Fase 2** — tracking ordini stile Glovo + back-office. **NON iniziarla** finché l'utente non lo chiede esplicitamente. Brief in `docs/TODO-ordering-system.md`. Nessuna UI, nessun modello dati, nessuna scelta di backend per la Fase 2 prima del via.

Non inventare funzionalità oltre il mockup e le specifiche in `docs/SPEC-modulo-ordine.md`.

## Comandi

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro check + astro build  → deve passare senza errori prima di ogni consegna
npm start          # produzione: node ./dist/server/entry.mjs
```

Non avviare dev server con Bash se è disponibile il preview integrato.

## Architettura e struttura

| Percorso | Ruolo |
| --- | --- |
| `src/pages/index.astro` | Landing one page (hero, pizze, come funziona, dove siamo) |
| `src/pages/ordina.astro` | Pagina ordine, monta l'isola `OrderApp` |
| `src/components/order/OrderApp.tsx` | Flusso Menù → Dati e orario → Conferma |
| `src/pages/api/*.ts` | Endpoint server (`prerender = false`): solo qui gira codice backend |
| `src/lib/` | Logica condivisa: `order.ts`, `slots.ts`, `store.ts`, `notify.ts`, `whatsapp.ts`, `format.ts` |
| `src/lib/ordini-api.ts` | Client di `ordini-api` (`ORDINI_API_URL`, default `http://127.0.0.1:3000`): menù da MariaDB (`/ordina` e `/api/ordine`) e salvataggio ordini. **L'API deve essere accesa** |
| `src/data/menu.ts` | Solo i tipi del menù e la vetrina statica della home (`featured`); il menù ordinabile viene dal DB |
| `src/data/site.ts` | **Unica fonte** di telefono, indirizzo, P.IVA, orari, social, mappa, regole slot |
| `whatsapp-bot/` | Servizio separato per le comande WhatsApp |
| `docs/` | Specifiche, deploy, TODO Fase 2 |

Regole:

- **Static-first**: tutto ciò che può essere HTML statico lo è. JavaScript client solo dove serve (carrello e flusso ordine). Niente framework o librerie nuove per cose risolvibili in HTML/CSS.
- Solo `/api/*` è dinamico. Ogni nuovo endpoint dichiara `export const prerender = false`.
- Nessun dato di business hardcoded nei componenti: va in `src/data/site.ts` o `src/data/menu.ts`.
- Dati segnaposto (telefono `000 000 0000`, `Via Esempio 12`, P.IVA `00000000000`, social, coordinate): **non sostituirli con valori inventati**. Si cambiano solo con dati forniti dall'utente.

## Backend: ordini, Node e MySQL

### Sicurezza e correttezza (non negoziabili)

- **Mai fidarsi del client.** Il server rivalida tutto e **ricalcola prezzi, totali e costo consegna** a partire da `menu.ts`/`site.ts`. Si accettano dal client solo id voce e quantità.
- **Query sempre parametrizzate** (placeholder `?` / named). Vietata la concatenazione di stringhe SQL, anche per valori "interni".
- Validare input con whitelist: tipi, lunghezze massime, formato telefono, quantità intere 1–N, slot realmente disponibile, indirizzo obbligatorio solo se consegna.
- **Slot e orari**: la disponibilità si calcola lato server (`slots.ts`); rifiutare slot passati, fuori orario o oltre capacità.
- **Rate limiting** e protezione anti-spam (honeypot e/o limite per IP) su `POST /api/ordine`. Nessun CAPTCHA di terze parti senza approvazione (privacy/cookie).
- **Escape** di ogni dato utente inserito in email, WhatsApp e HTML (anti-injection, anti header-injection nelle email).
- Risposte d'errore generiche al client; dettagli solo nei log del server. Mai stack trace né errori SQL al client.
- Numero d'ordine assegnato dal server in modo **atomico** (transazione o `AUTO_INCREMENT`), mai dal client; niente race condition tra ordini simultanei.
- Se MySQL o l'invio notifiche falliscono, l'utente deve ricevere un messaggio chiaro e non un falso "Ordine ricevuto". Un ordine confermato deve essere **già persistito** prima di rispondere OK.

### MySQL

- Driver: `mysql2` con **pool di connessioni** (promise API); un solo pool per processo.
- Charset `utf8mb4`, collation `utf8mb4_unicode_ci`, InnoDB.
- Schema gestito con **migrazioni SQL versionate** in `db/migrations/` (file numerati, idempotenti dove possibile). Nessuna modifica manuale dello schema in produzione senza migrazione nel repo.
- Importi in **centesimi (INT)**, mai `FLOAT`/`DOUBLE`. Formattazione `€ 9,50` solo in presentazione (`format.ts`).
- Date/orari in UTC nel DB; conversione in `Europe/Rome` in presentazione e nel calcolo degli slot.
- Le righe d'ordine salvano **snapshot** di nome e prezzo al momento dell'ordine (il menù cambierà).
- Operazioni multi-tabella in **transazione**.
- Dati personali (nome, telefono, indirizzo): salvare solo il necessario, prevedere una politica di conservazione/cancellazione coerente con `privacy.astro` (GDPR).

### Configurazione e segreti

- Credenziali solo in variabili d'ambiente (`.env`, mai committato). Ogni nuova variabile va aggiunta a `.env.example` con valore fittizio e commento.
- Variabili previste per MySQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- Non loggare mai password, token (`WA_BOT_TOKEN`, `SMTP_PASS`) né dati personali completi.
- Non leggere, stampare o riportare in chat il contenuto di `.env`.

## Frontend e design

Fedeltà **alta** al mockup: colori, tipografia, spaziature e copy sono finali.

- Token (da `src/styles/global.css`, non duplicarli): inchiostro `#141312`, carta `#f2efe9`, rosso brand `#b8262d` (su scuro `#d0443f`).
- Font: **Cormorant Garamond** (titoli, nomi piatti) e **Jost** (testo/UI), self-hosted con Fontsource. **Nessuna richiesta a Google Fonts** né ad altri CDN.
- Responsive: desktop 1280, mobile 390, fluido in mezzo. Target tap minimo **44px**. Mobile: carrello come barra flottante in basso.
- Immagini con `<Image>` di Astro, `alt` sempre valorizzato, dimensioni esplicite (niente layout shift).
- Accessibilità: HTML semantico, focus visibile, contrasto AA, form con `label` e messaggi d'errore associati, navigabile da tastiera.
- Stato carrello e modalità consegna/ritiro in `localStorage` (con try/catch: può non essere disponibile).
- Regole di prezzo: consegna `€ 2,00` solo se modalità consegna **e** carrello non vuoto; ritiro "gratis". Pagamento sempre **alla consegna** (contanti / carta / POS): nessun pagamento online.

## Performance, SEO, privacy

- Obiettivo Lighthouse ≥ 90 in tutte le categorie su mobile. Non aggiungere dipendenze o JS che peggiorano il budget senza motivo.
- SEO: `<title>`/meta description per pagina, Open Graph, `lang="it"`, sitemap, dati strutturati `Restaurant`/`LocalBusiness` con i dati di `site.ts`.
- Privacy: nessun tracker, analytics o cookie non tecnici senza approvazione esplicita e relativo aggiornamento di `privacy.astro` e `cookie.astro`. Mappa: embed OpenStreetMap (nessun Google Maps embed).

## Qualità del codice

- **TypeScript strict**. `npm run build` (include `astro check`) deve passare: niente `any` non giustificati, niente `@ts-ignore` senza commento sul perché.
- Cambi **minimi e mirati**: non riformattare, rinominare o riorganizzare file non coinvolti. Niente refactor "già che ci sono".
- Riusare le utility esistenti (`format.ts`, `slots.ts`, `images.ts`) prima di scriverne di nuove.
- Commenti solo dove il *perché* non è ovvio; in italiano.
- Nessun codice morto, nessun `console.log` di debug lasciato.
- Aggiungere una dipendenza è una decisione da motivare: preferire la libreria standard / piattaforma. Mantenere `package.json` e lockfile coerenti.

## Modo di lavorare

- **Prima leggere, poi modificare.** Guardare il codice esistente e `docs/SPEC-modulo-ordine.md` prima di proporre soluzioni.
- Verificare i cambi visibili nel browser (desktop **e** mobile) e quelli backend con una richiesta reale a `/api/ordine`, includendo i casi d'errore (input invalido, slot pieno, DB non raggiungibile).
- Non dichiarare "fatto" senza aver eseguito `npm run build`. Riferire onestamente ciò che non è stato verificato.
- **Chiedere conferma prima di**: cancellare file/dati, toccare `.env` o credenziali, modificare lo schema DB, eseguire migrazioni su dati reali, fare deploy, inviare email/WhatsApp reali, commit/push.
- Non toccare `node_modules/`, `dist/`, `.data/`, `deploy/*.zip`, `_mockup/`, `_handoff/` (riferimenti e artefatti, sola lettura).
- Se una richiesta contraddice queste direttive o il mockup, segnalarlo e chiedere prima di procedere.

## Deploy

- Plesk con Node.js: procedura in `docs/DEPLOY-plesk.md`; pacchetto generato da `scripts/pack.py`.
- Prima di ogni rilascio: build pulita, `.env` di produzione verificato, migrazioni DB applicate, test di un ordine reale end-to-end (DB + email + WhatsApp), controllo che i segnaposto siano stati sostituiti.
