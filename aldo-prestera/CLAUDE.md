# CLAUDE.md — aldoprestera.it

Direttive globali per lavorare su questo progetto. Hanno la precedenza sulle abitudini di default.

## Progetto

Sito web della **Aldo Prestera Pizzeria** (https://aldoprestera.it, senza www: `www` non ha record DNS).

- **Frontend**: sito **statico** in Astro (one page) + una sola isola interattiva (Preact) per il **modulo ordini**.
- **Backend**: **Node.js + MySQL** per ricezione, salvataggio e gestione degli ordini.
- **Hosting**: Plesk (vedi `docs/DEPLOY-plesk.md`). Build standalone con `@astrojs/node`.
- **Lingua**: interfaccia, copy, commenti, commit e documentazione in **italiano**. Identificatori di codice (variabili, funzioni, tabelle, colonne) in **inglese**, tranne dove il codice esistente usa già termini italiani (`ordine`, `slot`, `ordina`): resta coerente con ciò che c'è.

### Stato attuale vs obiettivo

Gli ordini sono validati in `src/pages/api/ordine.ts` e salvati su MariaDB tramite `ordini-api` (numero d'ordine assegnato dal DB); la comanda parte via email (`src/lib/notify.ts`) e WhatsApp (`whatsapp-bot/`) come **canale di riserva**: se falliscono l'ordine resta valido (è nel pannello di Aldo) e l'errore va nei log. Stati: `ricevuto → accettato → consegnato`, oppure `rifiutato`; il cliente riceve l'email solo quando Aldo decide.  Vedi «Area ordini e gestione».

**Slot orari:** nessun limite di ordini per fascia (decisione del 2026-11-09). Il server controlla solo che lo slot sia valido (non passato, dentro gli orari). Più avanti Aldo potrà **bloccare fasce orarie da una sua interfaccia** (back-office, da sviluppare alla fine): quando si tocca `slots.ts` o `/api/slot`, predisporre il punto in cui applicare quei blocchi, senza reintrodurre limiti automatici di capacità.

### Fasi

1. **Fase 1** — sito one page + modulo ordini (in corso). Segue il mockup 1:1 (`_handoff/.../README.md` e `reference/`).
2. **Fase 2** — **avviata solo per questo perimetro**: area riservata `/gestione` per Aldo (accetta/rifiuta/consegna) e schermata di attesa del cliente. Decisioni nella sezione **«Area ordini e gestione»** più sotto (unica fonte: non creare altri documenti di progetto). Il resto (tracking oltre l'attesa, Stripe, blocco fasce, menù dal pannello, stampa comande, più account/ruoli, produzione e Plesk) **NON va iniziato** senza richiesta esplicita.

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
| `docs/` | Specifiche (`SPEC-modulo-ordine.md`) e deploy. In caso di contrasto vale questo file |

Regole:

- **Static-first**: tutto ciò che può essere HTML statico lo è. JavaScript client solo dove serve (carrello e flusso ordine). Niente framework o librerie nuove per cose risolvibili in HTML/CSS.
- Sono dinamici `/api/*`, `/gestione*` e la pagina di attesa `/ordine/<codice>`: ognuno dichiara `export const prerender = false`. Il resto resta statico.
- Nessun dato di business hardcoded nei componenti: va in `src/data/site.ts` o `src/data/menu.ts`.
- Dati segnaposto (telefono `000 000 0000`, `Via Esempio 12`, P.IVA `00000000000`, social, coordinate): **non sostituirli con valori inventati**. Si cambiano solo con dati forniti dall'utente.

## Backend: ordini, Node e MySQL

### Sicurezza e correttezza (non negoziabili)

- **Mai fidarsi del client.** Il server rivalida tutto e **ricalcola prezzi, totali e costo consegna** a partire da `menu.ts`/`site.ts`. Si accettano dal client solo id voce e quantità.
- **Query sempre parametrizzate** (placeholder `?` / named). Vietata la concatenazione di stringhe SQL, anche per valori "interni".
- Validare input con whitelist: tipi, lunghezze massime, formato telefono, quantità intere 1–N, slot realmente disponibile, indirizzo obbligatorio solo se consegna.
- **Slot e orari**: la disponibilità si calcola lato server (`slots.ts`); rifiutare slot passati, fuori orario o oltre capacità.
- **Rate limiting** e protezione anti-spam (honeypot e/o limite per IP) su `POST /api/ordine`, sul login di `/gestione` e sul polling della pagina di attesa (non ancora implementato: da fare con la Fase 2). Nessun CAPTCHA di terze parti senza approvazione (privacy/cookie).
- **Escape** di ogni dato utente inserito in email, WhatsApp e HTML (anti-injection, anti header-injection nelle email).
- Risposte d'errore generiche al client; dettagli solo nei log del server. Mai stack trace né errori SQL al client.
- Numero d'ordine assegnato dal server in modo **atomico** (transazione o `AUTO_INCREMENT`), mai dal client; niente race condition tra ordini simultanei.
- Se il salvataggio su DB fallisce, l'utente deve ricevere un messaggio chiaro e non un falso "Ordine ricevuto": l'ordine non esiste e non compare ad Aldo. Un ordine deve essere **già persistito** (stato `ricevuto`) prima di rispondere OK. Se invece falliscono email o WhatsApp ad Aldo, l'ordine **resta valido** e l'errore va nei log.

### Database (ordini-api: Prisma + MariaDB)

Il backend degli ordini è **`../ordini-api`** (Express 5 + Prisma 7 + MariaDB). Il sito non parla col DB: usa `src/lib/ordini-api.ts` (solo server, con `ORDINI_API_TOKEN`). **Non** si usa `mysql2` e **non** si usano i centesimi.

- Schema in `ordini-api/prisma/schema.prisma`, modificato solo con **migrazioni Prisma** in `ordini-api/prisma/migrations/`. Nessuna modifica manuale dello schema.
- Importi `Decimal(10,2)` in euro (`Prisma.Decimal`, mai `FLOAT`/`DOUBLE`); nel sito sono `number` solo in presentazione (`format.ts`).
- Charset `utf8mb4`, collation `utf8mb4_unicode_ci`, InnoDB.
- Date/orari in UTC nel DB; conversione in `Europe/Rome` in presentazione e nel calcolo degli slot.
- Le righe d'ordine salvano **snapshot** di nome e prezzo al momento dell'ordine (il menù cambierà).
- Operazioni multi-tabella in **transazione**.
- Dati personali (nome, telefono, indirizzo): salvare solo il necessario, prevedere una politica di conservazione/cancellazione coerente con `privacy.astro` (GDPR).

### Configurazione e segreti

- Credenziali solo in variabili d'ambiente (`.env`, mai committato). Ogni nuova variabile va aggiunta a `.env.example` con valore fittizio e commento.
- Il DB si configura in `ordini-api/.env` (`DATABASE_URL`). Il sito conosce solo `ORDINI_API_URL` e `ORDINI_API_TOKEN` (stesso valore nel `.env` di `ordini-api`).
- Non loggare mai password, token (`WA_BOT_TOKEN`, `SMTP_PASS`, `ORDINI_API_TOKEN`, cookie di sessione) né dati personali completi.
- Non leggere, stampare o riportare in chat il contenuto di `.env`.

## Area ordini e gestione (Fase 2, solo locale)

Decisioni del 2026-11-09. Backend: `ordini-api` (Prisma, `Decimal`). Scelte già prese: non rimetterle in discussione.

**Stati** (`ordine.stato`, enum): `bozza`, `ricevuto`, `accettato`, `consegnato`, `rifiutato`, `annullato`. Il sito crea l'ordine direttamente in `ricevuto`, in una transazione. `annullato` solo per errori tecnici. A schermo `consegnato` = "Ritirato" per l'asporto. Transizioni (in transazione, con `lockOrdine`; tabella in `ordini-api/src/modules/ordini/ordini.stato.ts`): ricevuto→accettato|rifiutato; accettato→consegnato|rifiutato; consegnato→accettato (solo correzione di un errore); bozza→ricevuto|annullato. Niente tabelle per stati o storico dei cambi.

**Flusso cliente**
- Salvataggio fallito: ordine bloccato, non compare ad Aldo, errore chiaro al cliente.
- Salvataggio ok: schermata "In attesa di conferma dalla pizzeria"; l'ordine compare nel pannello; comanda via email e WhatsApp come riserva. Se falliscono, l'ordine resta valido e l'errore va nei log (rimuovere l'annullamento in `ordine.ts`).
- Nessuna email al cliente all'invio: parte solo quando Aldo accetta o rifiuta (rifiuto con motivo). Se l'email fallisce la scelta resta valida, la pagina si aggiorna, il pannello mostra "Email non inviata" + "Chiama". Quali email sono fallite si ricorda **in memoria del sito** (`src/lib/decisione.ts`, `emailFailed`), senza colonna in DB: si perde al riavvio (scelta del 2026-11-09).
- Pagina di attesa `/ordine/<codice_pubblico>`: codice casuale, mai il numero d'ordine; mostra solo stato, motivo del rifiuto, riepilogo; `noindex`; polling ogni 10 s; codice anche in `localStorage` (try/catch). Non è nel mockup: disegnarla nello stile del sito e farla vedere.
- Dopo 5 min in `ricevuto`: "Ci stiamo mettendo più del solito" + telefono da `site.ts`. Dopo 15 min: `rifiutato` con motivo "La pizzeria non ha potuto rispondere" (`ordine.motivo_stato`) + email. Niente timer in background: la scadenza si applica nelle letture di cliente e pannello, in transazione. Il pannello li mostra tra i chiusi come scaduti.
- Aggiornare i testi "Ti chiamiamo per confermare" in `OrderApp.tsx`, `notify.ts`, `HowItWorks.astro`.
- Come per Glovo, un ordine inviato (anche già pagato) deve comunque essere accettato da Aldo; può rifiutarlo.

**Motivi di rifiuto** (lista fissa, niente testo libero, in `ordini.motivi.ts`): Troppa richiesta, riprova più tardi · Prodotto non disponibile · Indirizzo fuori dalla zona di consegna · Pizzeria in chiusura · Non siamo riusciti a contattarti · Annullato su tua richiesta. Il motivo automatico di scadenza non è selezionabile.

**Dati sull'ordine**: `codice_pubblico`, `motivo_stato`, `modalita`, `orario_richiesto` (oggi + slot, UTC, calcolato dal server), `metodo_pagamento`, `nome_cliente`, `telefono_cliente`, `citofono`. `ordine.note` = solo note del cliente. Il pannello legge questi dati, non quelli di `cliente`.

**Rimborsi**: **non esistono nel gestionale** (decisione del 2026-11-09, in attesa di Stripe): si gestiscono fuori. Nessun endpoint né schermata per i rimborsi; nel codice non si usano. **Le tabelle `rimborso` e `rimborso_riga` e la colonna `ordine.totale_rimborsato` restano nel DB e nello schema Prisma, inutilizzate**: si è deciso di non fare modifiche al DB (2026-11-09). Se tornano, vanno riprogettati insieme a Stripe.

**Accesso**: un solo account, niente ruoli né registrazione; creato con `npm run admin:crea` in `ordini-api` (la password la inserisce l'utente, mai inventarla). **Solo in sviluppo/prova**: `npm run admin:dev` crea un account di prova con credenziali fisse scritte in `ordini-api/scripts/admin-dev.ts` (rifiutato in produzione). In produzione senza SSH: `ADMIN_USERNAME`/`ADMIN_NOME`/`ADMIN_PASSWORD` nell'ambiente dell'API creano o aggiornano l'account all'avvio (`modules/accesso/admin-env.ts`). Niente interfaccia per creare utenti. Password con `scrypt` di `node:crypto`, nessuna nuova dipendenza. 5 tentativi falliti → blocco 15 min. Sessione nel DB (solo hash del token), 30 giorni, logout; cookie `HttpOnly`, `SameSite=Strict`, `Secure` fuori dallo sviluppo. `ordini-api` richiede `ORDINI_API_TOKEN` (dal server del sito, valore fittizio nei `.env.example`) su tutte le route tranne `/health`; le route di gestione anche la sessione (`authenticate` è già montato in `app.ts`). Il browser parla solo col sito (`/api/gestione/*`), mai con l'API; controllo `Origin` sulle richieste che scrivono. Le pagine `/gestione` richiedono login, `noindex`, `prerender = false`.

**Pannello `/gestione`** (isola Preact, stile del sito, mobile-first). "Chiusi oggi" = ordini conclusi (consegnato, rifiutato, annullato) della giornata, fino a mezzanotte (Europe/Rome); lo storico (ricerca per numero, nome, telefono, data) copre tutto il resto. Endpoint già pronti: `GET /api/gestione/ordini`, `GET /api/gestione/ordini/storico`, `POST /api/gestione/ordini/<id>/stato` (in `ordini-api`: `/gestione/...`, token + sessione): sotto 768 px "Da accettare", "In corso", "Chiusi oggi" sono schede, da 768 px colonne; pulsanti ≥ 44 px. Scheda: orario, modalità, numero, nome, pagamento, indirizzo, citofono, prodotti, note, totale, "Chiama"; "In corso" ordinata per orario. Aggiornamento ogni 10 s. Suono ripetuto finché ci sono ordini da accettare, con "Inizia servizio" (abilita audio e, se possibile, tiene acceso lo schermo). Avviso rosso se cade la connessione. "Accetta" con un tocco; "Rifiuta" chiede motivo e conferma; "Consegnato"/"Ritirato" lascia qualche secondo "Annulla". Storico con ricerca per numero, nome, telefono, data.

**Fuori ambito**: rimborsi; produzione e Plesk; Stripe (incognita da riprendere alla fine); tracking oltre l'attesa; blocco fasce; modifica menù dal pannello; stampa comande; annullamento da parte del cliente; più account o ruoli.

**Ordine di lavoro**: ① documentazione ✔ ② schema, migrazione (applicata il 2026-11-09), stati ✔ ③ protezione API e login ✔ ④ flusso sito, attesa, email ✔ ⑤ endpoint gestione ✔ ⑥ pannello ✔ ⑦ prova completa (DA FARE, vedi sotto). Verifica finale: percorso completo in browser desktop e telefono; errori (API spenta, email fallita, transizione non ammessa, chiamate senza token/sessione, codice errato, scadenza 15 min); `npm run build` (sito) e `npm run typecheck` (ordini-api) verdi; dire chiaramente cosa è verificato e cosa no. Nessuna email/WhatsApp reale senza conferma: per le prove usa la configurazione `aldo-dev-prova` di `.claude/launch.json` (porta 4322, SMTP e WhatsApp svuotati da `aldo-prestera/dev-senza-invii.env`: comande ed email finiscono in console). Il `.env` del sito ha SMTP reale, quindi `aldo-dev` (4321) invierebbe davvero. `aldo-dev-smtp-guasto` (4323) simula un SMTP che rifiuta (per provare "Email non inviata"). Astro permette un solo dev server per volta: ferma l'altro prima di avviarne uno.

**Stato (2026-11-10) e PROVA FINALE ancora da fare** — passi ①–⑥ fatti e provati a pezzi in sviluppo; **il passo ⑦ (prova completa) NON è stato fatto**: va fatto sul PC fisso (o al primo avvio su un altro dispositivo) prima di considerare il lavoro chiuso. Cosa fare:
1. Preparare l'ambiente (sezione «Rimettere in piedi tutto» del CLAUDE.md in radice): stesso `ORDINI_API_TOKEN` nei due `.env`, `npm run db:migrate`, `npm run admin:dev` in `ordini-api`.
2. Percorso completo in browser, su **telefono (375 px) e desktop**: invio ordine → pagina di attesa → accetta (o rifiuta con motivo) dal pannello → la pagina del cliente si aggiorna da sola → email (solo con la config `aldo-dev-prova`, che le stampa in console) → consegnato/ritirato con «Annulla» → storico.
3. Casi d'errore: API spenta (invio ordine, polling, pannello con avviso rosso), email fallita (config `aldo-dev-smtp-guasto`: la scelta resta valida e compare «Email non inviata»), transizione non ammessa, chiamate senza token o senza sessione, codice pubblico sbagliato, scadenza dei 15 minuti (porta un ordine a `creato_il` di 16 minuti fa nel DB).
4. Non ancora verificati: suono ripetuto e schermo acceso del pannello (serve un telefono vero), layout sopra 768 px, limite del polling della pagina di attesa, concorrenza vera (due accettazioni insieme), un ordine reale con email e WhatsApp veri (solo con conferma dell'utente), il cookie `Secure` fuori dallo sviluppo.
5. `npm run build` (sito) e `npm run typecheck` (ordini-api) devono passare; dire chiaramente cosa è verificato e cosa no.
Decisioni prese dopo: **rimborsi tolti** dal gestionale e **solo contanti** (vedi sopra); nessuna modifica al DB per questo.

## Frontend e design

Fedeltà **alta** al mockup: colori, tipografia, spaziature e copy sono finali.

- Token (da `src/styles/global.css`, non duplicarli): inchiostro `#141312`, carta `#f2efe9`, rosso brand `#b8262d` (su scuro `#d0443f`).
- Font: **Cormorant Garamond** (titoli, nomi piatti) e **Jost** (testo/UI), self-hosted con Fontsource. **Nessuna richiesta a Google Fonts** né ad altri CDN.
- Responsive: desktop 1280, mobile 390, fluido in mezzo. Target tap minimo **44px**. Mobile: carrello come barra flottante in basso.
- Immagini con `<Image>` di Astro, `alt` sempre valorizzato, dimensioni esplicite (niente layout shift).
- Accessibilità: HTML semantico, focus visibile, contrasto AA, form con `label` e messaggi d'errore associati, navigabile da tastiera.
- Stato carrello e modalità consegna/ritiro in `localStorage` (con try/catch: può non essere disponibile).
- Regole di prezzo: consegna `€ 2,00` solo se modalità consegna **e** carrello non vuoto; ritiro "gratis". Pagamento **solo in contanti** alla consegna (al fattorino) o al ritiro: nessuna scelta del metodo, nessun pagamento online (decisione del 2026-11-09). `ordine.metodo_pagamento` resta in DB e vale sempre `Contanti`.

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

- Plesk con Node.js: procedura in `docs/DEPLOY-plesk.md`; pacchetti generati da `scripts/pack-plesk.py`.
- Prima di ogni rilascio: build pulita, `.env` di produzione verificato, migrazioni DB applicate, test di un ordine reale end-to-end (DB + email + WhatsApp), controllo che i segnaposto siano stati sostituiti.
